import { useMutation } from "@tanstack/react-query";
import { generateText } from "ai";
import { useMemo } from "react";

import {
  commands as templateCommands,
  type JsonValue,
} from "@hypr/plugin-template";

import { useLanguageModel } from "~/ai/hooks";
import { deterministicGenerationSettings } from "~/ai/model-settings";
import { getSessionNoteMarkdown } from "~/session/insights/session-note-markdown";
import * as main from "~/store/tinybase/store/main";

import systemPromptTemplate from "./follow-up.system.md.jinja?raw";
import userPromptTemplate from "./follow-up.user.md.jinja?raw";

const GENERATION_TIMEOUT_MS = 30_000;

export function useFollowUpDraft(sessionId: string) {
  const model = useLanguageModel("enhance");
  const store = main.UI.useStore(main.STORE_ID);

  const sessionTitle = main.UI.useCell(
    "sessions",
    sessionId,
    "title",
    main.STORE_ID,
  ) as string | undefined;

  const enhancedNotesTable = main.UI.useTable("enhanced_notes", main.STORE_ID);
  const noteMarkdown = useMemo(
    () => (store ? getSessionNoteMarkdown(store, sessionId) : ""),
    [store, sessionId, enhancedNotesTable],
  );

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

  const mutation = useMutation({
    mutationKey: ["follow-up-draft", sessionId],
    mutationFn: async (): Promise<string> => {
      if (!model || !noteMarkdown.trim()) {
        return "";
      }

      const system = await renderJinja(systemPromptTemplate, {});
      const prompt = await renderJinja(userPromptTemplate, {
        session: {
          title: sessionTitle || "Untitled",
          participant_names: participantNames,
        },
        note: noteMarkdown,
      });

      const result = await generateText({
        model,
        ...deterministicGenerationSettings(model),
        system,
        prompt,
        maxRetries: 2,
        maxOutputTokens: 500,
        timeout: { totalMs: GENERATION_TIMEOUT_MS },
      });

      return result.text.trim();
    },
  });

  return {
    draft: mutation.data ?? "",
    isGenerating: mutation.isPending,
    error: mutation.isError,
    canGenerate: Boolean(model) && Boolean(noteMarkdown.trim()),
    generate: mutation.mutate,
  };
}

type TemplateContext = Partial<{ [key: string]: JsonValue }>;

async function renderJinja(templateContent: string, ctx: TemplateContext) {
  const result = await templateCommands.renderCustom(templateContent, ctx);
  if (result.status === "error") {
    throw new Error(result.error);
  }
  return result.data;
}
