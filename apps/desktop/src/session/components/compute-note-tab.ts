import type { EditorView } from "~/store/zustand/tabs/schema";

export function computeCurrentNoteTab(
  tabView: EditorView | null,
  isLiveSessionActive: boolean,
  firstEnhancedNoteId: string | undefined,
  canShowTranscript = false,
  sessionId?: string,
): EditorView {
  // Sessions with no enhanced note yet used to fall back to a shared
  // `id: ""` sentinel. Every session hitting this fallback read/wrote the
  // *same* `enhanced_notes` row, so typing in one empty note leaked into
  // every other empty note. Scoping the fallback id to the session keeps
  // each draft isolated.
  // Falls back to the summary even when a transcript is available. Right
  // after a recording there's often no enhanced note yet while transcription
  // runs, and picking transcript here dropped the user on raw transcript text
  // when what they're waiting for is the summary — which shows a skeleton
  // until it's ready. The transcript tab is still there to switch to.
  const enhancedFallback: EditorView = firstEnhancedNoteId
    ? { type: "enhanced", id: firstEnhancedNoteId }
    : { type: "enhanced", id: sessionId ? `draft-${sessionId}` : "" };

  if (isLiveSessionActive) {
    if (tabView?.type === "enhanced" && firstEnhancedNoteId) {
      return tabView;
    }
    if (tabView?.type === "transcript" && canShowTranscript) {
      return tabView;
    }
    return enhancedFallback;
  }

  if (tabView) {
    if (tabView.type === "enhanced" && firstEnhancedNoteId) {
      return tabView;
    }
    if (tabView.type === "transcript" && canShowTranscript) {
      return tabView;
    }
    return enhancedFallback;
  }

  return enhancedFallback;
}
