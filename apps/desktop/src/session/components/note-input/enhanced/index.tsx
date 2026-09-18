import { useLingui } from "@lingui/react/macro";
import type { EditorView } from "prosemirror-view";
import { forwardRef, useMemo } from "react";

import type { NoteEditorRef } from "@skald/editor/note";

import { ConfigError } from "./config-error";
import { EnhancedEditor } from "./editor";
import { EnhanceError } from "./enhance-error";
import { StreamingView } from "./streaming";

import { useAITaskTask } from "~/ai/hooks";
import { useLLMConnectionStatus } from "~/ai/hooks";
import { shouldShowEmptySummaryConfigError } from "~/session/enhance-config";
import * as main from "~/store/tinybase/store/main";
import { createTaskId } from "~/store/zustand/ai-task/task-configs";
import { useListener } from "~/stt/contexts";
import { parseTranscriptWords } from "~/stt/utils";

const SUMMARY_SKELETON_WIDTHS = ["55%", "90%", "82%", "70%", "45%", "88%"];

// Below this, a recording holds only a few passing remarks and the summary
// cannot say much. Telling the user why avoids it looking broken.
const SHORT_RECORDING_WORD_COUNT = 60;

// Transcription runs before the summary can start streaming, so without this
// the tab falls through to an empty editor for that whole window — the user
// stops recording and sees a blank page with no sign anything is happening.
function SummarySkeleton() {
  return (
    <div className="flex h-full flex-col gap-4 pt-2" aria-hidden>
      <div className="bg-muted h-5 w-1/3 animate-pulse rounded-md" />
      <div className="flex flex-col gap-3">
        {SUMMARY_SKELETON_WIDTHS.map((width, index) => (
          <div
            key={index}
            className="bg-muted h-3 animate-pulse rounded-full"
            style={{ width, animationDelay: `${index * 100}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

export const Enhanced = forwardRef<
  NoteEditorRef,
  {
    sessionId: string;
    enhancedNoteId: string;
    onNavigateToTitle?: (pixelWidth?: number) => void;
    onViewReady?: (view: EditorView) => void;
    onViewDisposed?: (view: EditorView) => void;
  }
>(
  (
    {
      sessionId,
      enhancedNoteId,
      onNavigateToTitle,
      onViewReady,
      onViewDisposed,
    },
    ref,
  ) => {
    const taskId = createTaskId(enhancedNoteId, "enhance");
    const llmStatus = useLLMConnectionStatus();
    const { status, error } = useAITaskTask(taskId, "enhance");
    const sessionMode = useListener((state) => state.getSessionMode(sessionId));
    const content = main.UI.useCell(
      "enhanced_notes",
      enhancedNoteId,
      "content",
      main.STORE_ID,
    );

    const hasContent = typeof content === "string" && content.trim().length > 0;
    const isPreparingSummary =
      sessionMode === "finalizing" || sessionMode === "running_batch";

    const isConfigError = shouldShowEmptySummaryConfigError(llmStatus);
    const { t } = useLingui();
    const store = main.UI.useStore(main.STORE_ID);
    const transcriptIds = main.UI.useSliceRowIds(
      main.INDEXES.transcriptBySession,
      sessionId,
      main.STORE_ID,
    );
    const transcriptWordCount = useMemo(() => {
      if (!store || !transcriptIds) {
        return 0;
      }
      return transcriptIds.reduce(
        (total, transcriptId) =>
          total + parseTranscriptWords(store, transcriptId).length,
        0,
      );
    }, [store, transcriptIds, content]);

    // Before the config error: mid-transcription the LLM connection can
    // briefly read as unconfigured, and showing a setup error for something
    // that's simply still working would be wrong.
    if (isPreparingSummary && !hasContent && status !== "generating") {
      return <SummarySkeleton />;
    }

    if (status === "idle" && isConfigError && !hasContent) {
      return <ConfigError status={llmStatus} />;
    }

    if (status === "error") {
      return (
        <EnhanceError
          sessionId={sessionId}
          enhancedNoteId={enhancedNoteId}
          error={error}
        />
      );
    }

    if (status === "generating") {
      return <StreamingView enhancedNoteId={enhancedNoteId} />;
    }

    const editor = (
      <EnhancedEditor
        ref={ref}
        sessionId={sessionId}
        enhancedNoteId={enhancedNoteId}
        onNavigateToTitle={onNavigateToTitle}
        onViewReady={onViewReady}
        onViewDisposed={onViewDisposed}
      />
    );

    const isShortRecording =
      hasContent &&
      transcriptWordCount > 0 &&
      transcriptWordCount < SHORT_RECORDING_WORD_COUNT;
    if (!isShortRecording) {
      return editor;
    }

    return (
      <div className="flex h-full flex-col">
        <p className="text-muted-foreground pb-2 text-xs">
          {t`Short recording, so the summary is brief. The transcript has everything that was said.`}
        </p>
        <div className="min-h-0 flex-1">{editor}</div>
      </div>
    );
  },
);
