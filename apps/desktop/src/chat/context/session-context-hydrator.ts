import { json2md, parseJsonContent } from "@skald/editor/markdown";
import { commands as fsSyncCommands } from "@skald/plugin-fs-sync";
import type { SessionContentData } from "@skald/plugin-fs-sync";
import type { SessionContext, Transcript } from "@skald/plugin-template";

import type * as main from "~/store/tinybase/store/main";
import {
  buildRenderTranscriptRequestFromFsTranscript,
  buildRenderTranscriptRequestFromStore,
  renderTranscriptSegments,
} from "~/stt/render-transcript";

function extractEventName(event: unknown): string | null {
  if (!event || typeof event !== "object") {
    return null;
  }

  const record = event as Record<string, unknown>;
  if (typeof record.name === "string" && record.name) {
    return record.name;
  }
  if (typeof record.title === "string" && record.title) {
    return record.title;
  }

  return null;
}

function getSessionRowIds(
  store: ReturnType<typeof main.UI.useStore>,
  table: "transcripts" | "enhanced_notes",
  sessionId: string,
): string[] {
  if (!store) {
    return [];
  }

  const rows = store.getTable(table);
  return Object.entries(rows)
    .filter(([, row]) => row.session_id === sessionId)
    .map(([id]) => id);
}

// Mirrors the fs-sync `notes[]` join (sort by position, drop empties, join
// with a separator) but reads straight from the live store, for sessions
// whose enhanced note hasn't synced to disk yet.
function buildLiveEnhancedContent(
  store: ReturnType<typeof main.UI.useStore>,
  sessionId: string,
): string | null {
  if (!store) {
    return null;
  }

  const noteIds = getSessionRowIds(store, "enhanced_notes", sessionId);
  if (noteIds.length === 0) {
    return null;
  }

  const content = noteIds
    .map((noteId) => ({
      position: store.getCell("enhanced_notes", noteId, "position") as
        | number
        | undefined,
      content: store.getCell("enhanced_notes", noteId, "content") as
        | string
        | undefined,
    }))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map(({ content }) => (content ? json2md(parseJsonContent(content)) : null))
    .filter((md): md is string => Boolean(md))
    .join("\n\n---\n\n");

  return content || null;
}

// Mirrors `buildTranscript` below, but reads live transcript rows from the
// store instead of the fs-sync snapshot, for sessions whose transcript
// hasn't synced to disk yet (e.g. still recording, or just finished).
async function buildLiveTranscript(
  store: ReturnType<typeof main.UI.useStore>,
  sessionId: string,
): Promise<Transcript | null> {
  if (!store) {
    return null;
  }

  const transcriptIds = getSessionRowIds(store, "transcripts", sessionId);
  if (transcriptIds.length === 0) {
    return null;
  }

  const request = buildRenderTranscriptRequestFromStore(store, transcriptIds);
  if (!request) {
    return null;
  }
  const segments = await renderTranscriptSegments(request);
  if (segments.length === 0) {
    return null;
  }

  const startedAtCandidates = transcriptIds
    .map((id) => store.getCell("transcripts", id, "started_at"))
    .filter((v): v is number => typeof v === "number");
  const endedAtCandidates = transcriptIds
    .map((id) => store.getCell("transcripts", id, "ended_at"))
    .filter((v): v is number => typeof v === "number");

  return {
    segments: segments.map((segment) => ({
      speaker: segment.speaker_label,
      text: segment.text,
    })),
    startedAt:
      startedAtCandidates.length > 0 ? Math.min(...startedAtCandidates) : null,
    endedAt:
      endedAtCandidates.length > 0 ? Math.max(...endedAtCandidates) : null,
  };
}

async function buildTranscript(
  transcriptData: SessionContentData["transcript"],
  store: ReturnType<typeof main.UI.useStore>,
  sessionId: string,
): Promise<Transcript | null> {
  const transcripts = transcriptData?.transcripts ?? [];
  if (transcripts.length === 0) {
    return null;
  }
  const request = buildRenderTranscriptRequestFromFsTranscript(
    transcriptData,
    store,
    sessionId,
  );
  if (!request) {
    return null;
  }
  const segments = await renderTranscriptSegments(request);

  const startedAtCandidates = transcripts
    .map((t) => t.started_at)
    .filter((v): v is number => typeof v === "number");
  const endedAtCandidates = transcripts
    .map((t) => t.ended_at)
    .filter((v): v is number => typeof v === "number");

  return {
    segments: segments.map((segment) => ({
      speaker: segment.speaker_label,
      text: segment.text,
    })),
    startedAt:
      startedAtCandidates.length > 0 ? Math.min(...startedAtCandidates) : null,
    endedAt:
      endedAtCandidates.length > 0 ? Math.max(...endedAtCandidates) : null,
  };
}

export async function hydrateSessionContextFromFs(
  store: ReturnType<typeof main.UI.useStore>,
  sessionId: string,
): Promise<SessionContext | null> {
  const result = await fsSyncCommands.loadSessionContent(sessionId);
  if (result.status === "error") {
    return null;
  }

  const payload = result.data;
  const participants =
    payload.meta?.participants
      ?.map((participant) => {
        const row = store?.getRow("humans", participant.humanId);
        if (!row || typeof row.name !== "string" || !row.name) {
          return null;
        }

        return {
          name: row.name,
          jobTitle:
            typeof row.job_title === "string" && row.job_title
              ? row.job_title
              : null,
        };
      })
      .filter(
        (
          participant,
        ): participant is { name: string; jobTitle: string | null } =>
          Boolean(participant),
      ) ?? [];

  const enhancedContent = payload.notes
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((note) => note.markdown ?? null)
    .filter((note): note is string => Boolean(note))
    .join("\n\n---\n\n");

  const fsTranscript = await buildTranscript(
    payload.transcript,
    store,
    sessionId,
  );
  const eventName = extractEventName(payload.meta?.event);

  // The fs-sync payload reflects whatever has already been flushed to
  // disk. A note that was just created/edited and hasn't synced yet
  // (or never had its raw markdown synced at all) comes back with
  // rawMemoMarkdown/notes/transcript empty, silently sending the LLM an
  // incomplete or empty <context> block instead of the note the user is
  // actually looking at — most noticeably right during/after a live
  // meeting, exactly when someone would ask chat about "this meeting".
  // Fall back to the live in-memory content from the store for each field
  // independently.
  const rawContent =
    payload.rawMemoMarkdown ||
    (store
      ? json2md(
          parseJsonContent(
            store.getCell("sessions", sessionId, "raw_md") as
              | string
              | undefined,
          ),
        ) || null
      : null);

  const enhancedContentResolved =
    enhancedContent || buildLiveEnhancedContent(store, sessionId);

  const transcript =
    fsTranscript ?? (await buildLiveTranscript(store, sessionId));

  return {
    title: payload.meta?.title ?? null,
    date: payload.meta?.createdAt ?? null,
    rawContent,
    enhancedContent: enhancedContentResolved || null,
    transcript,
    participants,
    event: eventName ? { name: eventName } : null,
  };
}
