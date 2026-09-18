import { useMemo } from "react";

import { format, safeParseDate } from "@skald/utils";

import { useSessionEvent } from "~/store/tinybase/hooks";
import * as main from "~/store/tinybase/store/main";

export type SessionBrief = {
  eventTitle: string;
  startLabel: string;
  location?: string;
  meetingLink?: string;
  participantNames: string[];
};

export function useCanShowBrief(sessionId: string): boolean {
  const event = useSessionEvent(sessionId);
  const transcriptIds = main.UI.useSliceRowIds(
    main.INDEXES.transcriptBySession,
    sessionId,
    main.STORE_ID,
  );

  return Boolean(event) && (transcriptIds?.length ?? 0) === 0;
}

export function useSessionBrief(sessionId: string): SessionBrief | null {
  const event = useSessionEvent(sessionId);
  const queries = main.UI.useQueries(main.STORE_ID);

  const participantNames = useMemo((): string[] => {
    if (!queries) return [];

    const names: string[] = [];
    queries.forEachResultRow(
      main.QUERIES.sessionParticipantsWithDetails,
      (rowId) => {
        const participantSessionId = queries.getResultCell(
          main.QUERIES.sessionParticipantsWithDetails,
          rowId,
          "session_id",
        );
        if (participantSessionId === sessionId) {
          const name = queries.getResultCell(
            main.QUERIES.sessionParticipantsWithDetails,
            rowId,
            "human_name",
          );
          if (name && typeof name === "string") {
            names.push(name);
          }
        }
      },
    );
    return names;
  }, [queries, sessionId]);

  return useMemo(() => {
    if (!event) {
      return null;
    }

    const startDate = safeParseDate(event.started_at);

    return {
      eventTitle: event.title || "Untitled meeting",
      startLabel: startDate ? format(startDate, "EEE, MMM d 'at' h:mm a") : "",
      location: event.location,
      meetingLink: event.meeting_link,
      participantNames,
    };
  }, [event, participantNames]);
}
