import { Trans, useLingui } from "@lingui/react/macro";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@notiz/utils";

import { useFollowUpDraft } from "~/session/insights/follow-up";

export function FollowUpModal({
  sessionId,
  open,
  onOpenChange,
}: {
  sessionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useLingui();
  const { draft, isGenerating, error, canGenerate, generate } =
    useFollowUpDraft(sessionId);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open && !draft && !isGenerating) {
      generate();
    }
  }, [open, draft, isGenerating, generate]);

  const handleCopy = async () => {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error(e);
    }
  };

  if (!open) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/20 backdrop-blur-xs"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="absolute top-1/2 left-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 px-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={cn([
            "border-border/80 bg-background rounded-xl border",
            "shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)]",
            "flex flex-col gap-4 p-5",
          ])}
        >
          <div className="flex flex-col gap-1 text-center">
            <h2 className="text-base font-semibold">
              <Trans>Draft follow-up</Trans>
            </h2>
            <p className="text-muted-foreground text-sm">
              <Trans>An AI-drafted follow-up based on this note.</Trans>
            </p>
          </div>

          <div className="border-border/60 bg-muted/30 max-h-72 overflow-y-auto rounded-lg border p-3">
            {isGenerating ? (
              <p className="text-muted-foreground text-sm">{t`Drafting...`}</p>
            ) : error ? (
              <p className="text-sm text-red-600">
                {t`Could not draft a follow-up. Try again.`}
              </p>
            ) : draft ? (
              <pre className="text-foreground font-sans text-sm break-words whitespace-pre-wrap">
                {draft}
              </pre>
            ) : (
              <p className="text-muted-foreground text-sm">
                {canGenerate
                  ? t`No draft yet.`
                  : t`Add a summary to this note first.`}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => generate()}
              disabled={isGenerating || !canGenerate}
              className="border-border/80 hover:bg-accent flex h-10 flex-1 items-center justify-center rounded-full border text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t`Regenerate`}
            </button>
            <button
              onClick={handleCopy}
              disabled={!draft}
              className="border-primary bg-primary text-primary-foreground hover:bg-primary/90 flex h-10 flex-1 items-center justify-center rounded-full border-2 text-sm font-medium shadow-[0_4px_14px_rgba(87,83,78,0.4)] transition-all disabled:cursor-not-allowed disabled:opacity-50"
            >
              {copied ? t`Copied!` : t`Copy to clipboard`}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
