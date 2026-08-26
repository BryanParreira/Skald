import { useLingui } from "@lingui/react/macro";
import { CalendarIcon, LinkIcon, MapPinIcon, UsersIcon } from "lucide-react";
import { useMemo } from "react";

import { getCompiledInsightFacts } from "./insights";

import { useSessionBrief } from "~/session/insights/brief";
import { usePastSessionNotes } from "~/session/insights/past-notes";

export function Brief({ sessionId }: { sessionId: string }) {
  const { t } = useLingui();
  const brief = useSessionBrief(sessionId);
  const pastNotes = usePastSessionNotes(sessionId);
  const insightFacts = useMemo(
    () => getCompiledInsightFacts(pastNotes.notes),
    [pastNotes.notes],
  );

  if (!brief) {
    return null;
  }

  return (
    <div
      data-session-brief
      className="scroll-fade-y h-full overflow-y-auto py-4 pr-3 pl-3"
    >
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">{brief.eventTitle}</h2>

          {brief.startLabel ? (
            <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <CalendarIcon size={12} className="shrink-0" />
              <span>{brief.startLabel}</span>
            </div>
          ) : null}

          {brief.participantNames.length > 0 ? (
            <div className="text-muted-foreground flex items-start gap-1.5 text-xs">
              <UsersIcon size={12} className="mt-0.5 shrink-0" />
              <span className="min-w-0 break-words">
                {brief.participantNames.join(", ")}
              </span>
            </div>
          ) : null}

          {brief.location ? (
            <div className="text-muted-foreground flex items-start gap-1.5 text-xs">
              <MapPinIcon size={12} className="mt-0.5 shrink-0" />
              <span className="min-w-0 break-words">{brief.location}</span>
            </div>
          ) : null}

          {brief.meetingLink ? (
            <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <LinkIcon size={12} className="shrink-0" />
              <a
                href={brief.meetingLink}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 truncate underline"
              >
                {brief.meetingLink}
              </a>
            </div>
          ) : null}
        </div>

        {insightFacts.length > 0 ? (
          <div className="flex flex-col gap-2">
            <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              {t`From past meetings`}
            </h3>
            <ul className="text-muted-foreground min-w-0 list-disc space-y-2 pr-1 pl-5 text-xs leading-5">
              {insightFacts.map((fact) => (
                <li key={fact.key} className="min-w-0 break-words">
                  {fact.text}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
