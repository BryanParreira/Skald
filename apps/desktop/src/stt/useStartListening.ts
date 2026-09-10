import { useCallback, useRef } from "react";

import { commands as analyticsCommands } from "@hypr/plugin-analytics";
import { commands as fsSyncCommands } from "@hypr/plugin-fs-sync";
import type { TranscriptStorage } from "@hypr/store";

import { useListener } from "./contexts";
import { useKeywords } from "./useKeywords";
import {
  canRunBatchTranscription,
  isStoppedTranscriptionError,
  useRunBatch,
} from "./useRunBatch";
import { useSTTConnection } from "./useSTTConnection";

import { useShell } from "~/contexts/shell";
import { deleteProcessedAudioForRetention } from "~/services/audio-retention";
import { getEnhancerService } from "~/services/enhancer";
import { getSessionEventById } from "~/session/utils";
import { useConfigValue } from "~/shared/config";
import { id } from "~/shared/utils";
import * as main from "~/store/tinybase/store/main";
import * as settings from "~/store/tinybase/store/settings";
import type {
  LiveTranscriptPersistCallback,
  OnStoppedCallback,
} from "~/store/zustand/listener/transcript";
import {
  getLiveTranscriptionConfig,
  getTranscriptionLanguages,
} from "~/stt/capabilities";
import {
  createTranscriptAccumulator,
  parseTranscriptWords,
  type TranscriptAccumulator,
} from "~/stt/utils";

function hasTranscriptContent(
  store: main.Store,
  indexes: ReturnType<typeof main.UI.useIndexes> | undefined,
  sessionId: string,
) {
  const transcriptIds =
    indexes?.getSliceRowIds(main.INDEXES.transcriptBySession, sessionId) ?? [];

  return transcriptIds.some(
    (transcriptId) => parseTranscriptWords(store, transcriptId).length > 0,
  );
}

const LIVE_TRANSCRIPT_SETTLE_INTERVAL_MS = 500;
const LIVE_TRANSCRIPT_SETTLE_MAX_ATTEMPTS = 6; // ~3s

// Live segments persist asynchronously, so an empty store right at stop time
// doesn't yet mean live transcription failed. Give it a short window before
// concluding there's nothing and falling back to batch.
async function waitForLiveTranscript(
  store: main.Store,
  indexes: ReturnType<typeof main.UI.useIndexes> | undefined,
  sessionId: string,
): Promise<boolean> {
  for (
    let attempt = 0;
    attempt < LIVE_TRANSCRIPT_SETTLE_MAX_ATTEMPTS;
    attempt++
  ) {
    if (hasTranscriptContent(store, indexes, sessionId)) {
      return true;
    }

    await new Promise((resolve) =>
      setTimeout(resolve, LIVE_TRANSCRIPT_SETTLE_INTERVAL_MS),
    );
  }

  return hasTranscriptContent(store, indexes, sessionId);
}

const AUDIO_FINALIZE_POLL_INTERVAL_MS = 2000;
const AUDIO_FINALIZE_POLL_MAX_ATTEMPTS = 30; // ~60s

// The recorder finalizes (WAV -> mp3) asynchronously after the stop signal
// fires; on a busy local-transcription runtime that can lag a few seconds,
// so the very first `audioPath` we get can be null even though the file is
// about to show up. Poll briefly instead of giving up permanently — this is
// exactly what the user otherwise has to trigger by hand via "regenerate
// transcript".
async function waitForAudioPath(sessionId: string): Promise<string | null> {
  for (let attempt = 0; attempt < AUDIO_FINALIZE_POLL_MAX_ATTEMPTS; attempt++) {
    await new Promise((resolve) =>
      setTimeout(resolve, AUDIO_FINALIZE_POLL_INTERVAL_MS),
    );

    const result = await fsSyncCommands.audioPath(sessionId);
    if (result.status === "ok") {
      return result.data;
    }
  }

  return null;
}

export function getPostCaptureAction(
  details: {
    audioPath: string | null;
    liveTranscriptionActive: boolean;
  },
  canRunBatch: boolean,
) {
  if (details.liveTranscriptionActive) {
    return "enhance_only" as const;
  }

  if (!!details.audioPath && canRunBatch) {
    return "batch_then_enhance" as const;
  }

  return "none" as const;
}

export function useStartListening(sessionId: string) {
  const { user_id } = main.UI.useValues(main.STORE_ID);
  const store = main.UI.useStore(main.STORE_ID);
  const indexes = main.UI.useIndexes(main.STORE_ID);
  const settingsStore = settings.UI.useStore(settings.STORE_ID);

  const aiLanguage = useConfigValue("ai_language");
  const spokenLanguages = useConfigValue("spoken_languages");

  const start = useListener((state) => state.start);
  const { conn } = useSTTConnection();
  const runBatch = useRunBatch(sessionId);
  const { leftsidebar } = useShell();
  const setLeftSidebarExpanded = leftsidebar.setExpanded;

  const keywords = useKeywords(sessionId);
  const runBatchRef = useRef(runBatch);
  const canRunBatchRef = useRef(canRunBatchTranscription(conn));
  runBatchRef.current = runBatch;
  canRunBatchRef.current = canRunBatchTranscription(conn);

  const startListening = useCallback(async () => {
    if (!store) {
      return;
    }

    let transcriptId: string | null = null;
    const startedAt = Date.now();
    const memoMd = store.getCell("sessions", sessionId, "raw_md");
    const createdAt = new Date().toISOString();
    const hadTranscriptBeforeStart = hasTranscriptContent(
      store as main.Store,
      indexes ?? undefined,
      sessionId,
    );
    const transcriptAccumulatorRef: {
      current: TranscriptAccumulator | null;
    } = { current: null };

    const onStopped: OnStoppedCallback = async (_sessionId, details) => {
      transcriptAccumulatorRef.current?.dispose();
      transcriptAccumulatorRef.current = null;

      let postCaptureAction = getPostCaptureAction(
        details,
        canRunBatchRef.current,
      );
      let resolvedAudioPath = details.audioPath;

      console.info("[onStopped] post-capture decision", {
        sessionId,
        postCaptureAction,
        liveTranscriptionActive: details.liveTranscriptionActive,
        audioPath: details.audioPath,
        canRunBatch: canRunBatchRef.current,
      });

      if (
        postCaptureAction === "none" &&
        !details.liveTranscriptionActive &&
        !details.audioPath &&
        canRunBatchRef.current
      ) {
        resolvedAudioPath = await waitForAudioPath(sessionId);
        if (resolvedAudioPath) {
          postCaptureAction = "batch_then_enhance";
        }
      }

      // "Live transcription was running" was being treated as "a transcript
      // exists", so batch got skipped entirely. When live yields nothing —
      // it needs a moment to warm up, so short recordings routinely end with
      // zero words — that left the note with no transcript at all and no
      // second attempt. Fall back to batch against the audio we already have.
      if (postCaptureAction === "enhance_only" && canRunBatchRef.current) {
        const liveProducedWords = await waitForLiveTranscript(
          store as main.Store,
          indexes ?? undefined,
          sessionId,
        );

        if (!liveProducedWords) {
          const audioPath =
            details.audioPath ?? (await waitForAudioPath(sessionId));
          if (audioPath) {
            console.info(
              "[onStopped] live transcription produced no words; falling back to batch",
              { sessionId },
            );
            resolvedAudioPath = audioPath;
            postCaptureAction = "batch_then_enhance";
          }
        }
      }

      if (postCaptureAction === "batch_then_enhance") {
        try {
          await runBatchRef.current(resolvedAudioPath!);
        } catch (error) {
          if (isStoppedTranscriptionError(error)) {
            return;
          }
          console.error(
            "[listener] failed to run post-capture transcription",
            error,
          );
          return;
        }
      }

      if (postCaptureAction === "none") {
        return;
      }

      const service = getEnhancerService();
      const shouldRegenerateExistingSummary =
        hadTranscriptBeforeStart &&
        (transcriptId !== null || postCaptureAction === "batch_then_enhance");
      if (shouldRegenerateExistingSummary) {
        service?.resetEnhanceTasks(sessionId);
        service?.queueAutoEnhance(sessionId);
      } else {
        service?.queueAutoEnhanceIfSummaryEmpty(sessionId);
      }

      if (settingsStore) {
        await deleteProcessedAudioForRetention(
          store as main.Store,
          settingsStore as settings.Store,
          sessionId,
        );
      }
    };

    const handlePersist: LiveTranscriptPersistCallback = (delta) => {
      if (delta.new_words.length === 0 && delta.replaced_ids.length === 0) {
        return;
      }

      if (!transcriptId) {
        transcriptId = id();
        const transcriptRow = {
          session_id: sessionId,
          user_id: user_id ?? "",
          created_at: createdAt,
          started_at: startedAt,
          words: "[]",
          speaker_hints: "[]",
          memo_md: typeof memoMd === "string" ? memoMd : "",
        } satisfies TranscriptStorage;

        store.setRow("transcripts", transcriptId, transcriptRow);
        transcriptAccumulatorRef.current = createTranscriptAccumulator(
          store,
          transcriptId,
          { words: [], hints: [] },
        );
      }

      transcriptAccumulatorRef.current ??= createTranscriptAccumulator(
        store,
        transcriptId,
      );

      store.transaction(() => {
        transcriptAccumulatorRef.current?.applyLiveDelta(delta);
      });
    };

    const participantHumanIds: string[] = [];
    store.forEachRow(
      "mapping_session_participant",
      (mappingId, _forEachCell) => {
        const sid = store.getCell(
          "mapping_session_participant",
          mappingId,
          "session_id",
        );
        if (sid !== sessionId) return;
        const hid = store.getCell(
          "mapping_session_participant",
          mappingId,
          "human_id",
        );
        if (typeof hid === "string" && hid) {
          participantHumanIds.push(hid);
        }
      },
    );

    const languages = getTranscriptionLanguages(aiLanguage, spokenLanguages);
    const liveTranscriptionConfig = await getLiveTranscriptionConfig({
      provider: conn?.provider,
      model: conn?.model,
      languages,
    });

    const started = await start(
      {
        session_id: sessionId,
        languages: liveTranscriptionConfig.languages,
        onboarding: false,
        model: conn?.model ?? "",
        base_url: conn?.baseUrl ?? "",
        api_key: conn?.apiKey ?? "",
        keywords,
        transcription_mode: liveTranscriptionConfig.transcriptionMode,
        participant_human_ids: participantHumanIds,
        self_human_id: typeof user_id === "string" ? user_id : null,
      },
      {
        handlePersist,
        onStopped,
      },
    );

    if (!started) {
      transcriptAccumulatorRef.current?.dispose();
      transcriptAccumulatorRef.current = null;

      if (transcriptId) {
        store.delRow("transcripts", transcriptId);
      }
      return;
    }

    setLeftSidebarExpanded(false);

    void analyticsCommands.event({
      event: "session_started",
      has_calendar_event: !!getSessionEventById(store, sessionId),
      ...(conn
        ? {
            stt_provider: conn.provider,
            stt_model: conn.model,
          }
        : {}),
    });
  }, [
    aiLanguage,
    conn,
    store,
    indexes,
    sessionId,
    start,
    keywords,
    user_id,
    spokenLanguages,
    setLeftSidebarExpanded,
    settingsStore,
  ]);

  return startListening;
}
