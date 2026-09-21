import { AlertCircleIcon, AudioLinesIcon, SquareIcon } from "lucide-react";

import { Button } from "@notiz/ui/components/ui/button";

// Widths vary per line so the placeholder reads as text rather than a solid
// block — mirrors how a real transcript line wraps.
const SKELETON_LINE_WIDTHS = ["92%", "78%", "85%", "60%", "88%", "70%"];

function TranscriptSkeleton() {
  return (
    <div className="flex w-full max-w-md flex-col gap-3" aria-hidden>
      {SKELETON_LINE_WIDTHS.map((width, index) => (
        <div
          key={index}
          className="bg-muted h-3 animate-pulse rounded-full"
          style={{ width, animationDelay: `${index * 100}ms` }}
        />
      ))}
    </div>
  );
}

export function TranscriptEmptyState({
  isBatching,
  hasAudio,
  percentage,
  phase,
  error,
  onUploadAudio,
  onUploadTranscript,
  onStopTranscription,
}: {
  isBatching?: boolean;
  hasAudio?: boolean;
  percentage?: number;
  phase?: "importing" | "transcribing";
  error?: string | null;
  onUploadAudio?: () => void;
  onUploadTranscript?: () => void;
  onStopTranscription?: () => void;
}) {
  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <AlertCircleIcon className="h-8 w-8 text-red-400" />
        <div className="flex max-w-md flex-col gap-1">
          <p className="text-muted-foreground text-sm font-medium">
            Batch transcription failed
          </p>
          <p className="text-muted-foreground text-xs">{error}</p>
        </div>
      </div>
    );
  }

  if (isBatching) {
    return (
      <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-4 px-6">
        <TranscriptSkeleton />
        <div className="flex flex-col items-center gap-1">
          {typeof percentage === "number" && percentage > 0 ? (
            <p className="text-muted-foreground text-2xl font-medium tabular-nums">
              {Math.round(percentage * 100)}%
            </p>
          ) : null}
          <p className="text-sm">
            {phase === "importing"
              ? "Importing audio..."
              : "Generating transcript..."}
          </p>
          {onStopTranscription ? (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 gap-1.5 text-xs"
              onClick={onStopTranscription}
            >
              <SquareIcon className="size-3 fill-current" />
              Stop transcription
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-3">
      <AudioLinesIcon className="h-8 w-8" />
      <div className="flex max-w-sm flex-col items-center gap-1 text-center">
        <p className="text-muted-foreground text-sm">
          {hasAudio ? "Recording available" : "No transcript available"}
        </p>
        <p className="text-muted-foreground text-xs">
          {hasAudio
            ? "Use the refresh button above to generate a transcript, or upload a file."
            : "Upload audio or a transcript file to populate this note."}
        </p>
        {(onUploadAudio || onUploadTranscript) && (
          <div className="mt-3 flex items-center gap-2">
            {onUploadAudio && (
              <Button variant="outline" size="sm" onClick={onUploadAudio}>
                Upload audio
              </Button>
            )}
            {onUploadTranscript && (
              <Button variant="outline" size="sm" onClick={onUploadTranscript}>
                Upload transcript
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
