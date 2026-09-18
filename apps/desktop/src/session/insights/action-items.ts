import { useMutation } from "@tanstack/react-query";
import { generateText, Output } from "ai";
import { useCallback, useMemo } from "react";
import { z } from "zod";

import { createTaskId, type TaskRecord } from "@skald/editor/tasks";
import {
  commands as templateCommands,
  type JsonValue,
} from "@skald/plugin-template";

import systemPromptTemplate from "./action-items.system.md.jinja?raw";
import userPromptTemplate from "./action-items.user.md.jinja?raw";

import { useLanguageModel } from "~/ai/hooks";
import { deterministicGenerationSettings } from "~/ai/model-settings";
import { useStoreBackedTaskStorage } from "~/editor-bridge/task-storage";
import { getSessionNoteMarkdown } from "~/session/insights/session-note-markdown";
import { showTransientToast } from "~/sidebar/toast/transient";
import * as main from "~/store/tinybase/store/main";

const ACTION_ITEMS_SOURCE_TYPE = "session_action_items";
const GENERATION_TIMEOUT_MS = 30_000;

const actionItemsSchema = z.object({
  items: z.array(
    z.object({
      text: z.string(),
      assignee: z.string().optional(),
    }),
  ),
});

export function useActionItemExtraction(sessionId: string) {
  const model = useLanguageModel("enhance");
  const taskStorage = useStoreBackedTaskStorage();
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

  const taskRowIds = main.UI.useSliceRowIds(
    main.INDEXES.tasksBySource,
    `${ACTION_ITEMS_SOURCE_TYPE}:${sessionId}`,
    main.STORE_ID,
  );

  const mutation = useMutation({
    mutationKey: ["action-items", sessionId],
    mutationFn: async () => {
      if (!model || !taskStorage || !noteMarkdown.trim()) {
        return;
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
        output: Output.object({ schema: actionItemsSchema }),
        maxRetries: 2,
        maxOutputTokens: 600,
        timeout: { totalMs: GENERATION_TIMEOUT_MS },
      });

      const items = result.output?.items ?? [];
      const records: TaskRecord[] = items.map((item, index) => {
        const text = item.assignee
          ? `${item.text} (${item.assignee})`
          : item.text;
        return {
          taskId: createTaskId(),
          sourceId: sessionId,
          sourceType: ACTION_ITEMS_SOURCE_TYPE,
          sourceOrder: index,
          status: "todo",
          textPreview: text,
          body: [
            {
              type: "paragraph",
              content: [{ type: "text", text }],
            },
          ],
        };
      });

      taskStorage.upsertTasksForSource(
        { type: ACTION_ITEMS_SOURCE_TYPE, id: sessionId },
        records,
      );
    },
    onError: (error) => {
      console.error("Failed to extract action items", error);
      showTransientToast({
        id: "action-items-error",
        description: "Could not extract action items. Try again.",
        variant: "error",
      });
    },
  });

  const { mutate, isPending } = mutation;
  const generate = useCallback(() => {
    mutate();
  }, [mutate]);

  return {
    taskCount: taskRowIds?.length ?? 0,
    hasTasks: (taskRowIds?.length ?? 0) > 0,
    isGenerating: isPending,
    canGenerate: Boolean(model) && Boolean(noteMarkdown.trim()),
    generate,
  };
}

export function useCanShowActionItems(sessionId: string): boolean {
  const useTable =
    (main.UI.useTable as typeof main.UI.useTable | undefined) ??
    ((() => undefined) as unknown as typeof main.UI.useTable);
  const store = main.UI.useStore(main.STORE_ID);
  const enhancedNotesTable = useTable("enhanced_notes", main.STORE_ID);

  return useMemo(() => {
    if (!store || typeof store.forEachRow !== "function") {
      return false;
    }
    return Boolean(getSessionNoteMarkdown(store, sessionId).trim());
  }, [store, sessionId, enhancedNotesTable]);
}

type TemplateContext = Partial<{ [key: string]: JsonValue }>;

async function renderJinja(templateContent: string, ctx: TemplateContext) {
  const result = await templateCommands.renderCustom(templateContent, ctx);
  if (result.status === "error") {
    throw new Error(result.error);
  }
  return result.data;
}
