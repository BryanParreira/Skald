import { useLingui } from "@lingui/react/macro";
import { useMutation } from "@tanstack/react-query";
import { BellPlusIcon, Loader2Icon, RefreshCwIcon } from "lucide-react";

import { useTaskRecords, useTaskStorage } from "@hypr/editor/task-storage";
import { commands as todoCommands } from "@hypr/plugin-todo";
import { Button } from "@hypr/ui/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@hypr/ui/components/ui/tooltip";
import { cn } from "@hypr/utils";

import { useActionItemExtraction } from "~/session/insights/action-items";
import {
  buildTaskReminderUrl,
  selectUnsentTasks,
} from "~/session/insights/reminder-links";
import { usePermission } from "~/shared/hooks/usePermissions";
import { showTransientToast } from "~/sidebar/toast/transient";
import * as main from "~/store/tinybase/store/main";

const ACTION_ITEMS_SOURCE_TYPE = "session_action_items";

export function ActionItems({ sessionId }: { sessionId: string }) {
  const { t } = useLingui();
  const taskStorage = useTaskStorage();
  const tasks = useTaskRecords({
    type: ACTION_ITEMS_SOURCE_TYPE,
    id: sessionId,
  });
  const { isGenerating, canGenerate, generate } =
    useActionItemExtraction(sessionId);
  const { send, isSending } = useSendToReminders(sessionId, tasks);
  const hasOpenTasks = tasks.some((task) => task.status !== "done");

  return (
    <div data-session-action-items className="relative h-full min-h-0">
      <div className="absolute top-2 right-1 z-10 flex items-center gap-0.5">
        <SendToRemindersButton
          isDisabled={!hasOpenTasks || isSending || isGenerating}
          isSending={isSending}
          onClick={send}
        />
        <GenerateButton
          isDisabled={!canGenerate || isGenerating}
          isGenerating={isGenerating}
          hasTasks={tasks.length > 0}
          onClick={generate}
        />
      </div>

      <div
        className={cn(["scroll-fade-y h-full overflow-y-auto py-4 pr-10 pl-3"])}
      >
        <div className="flex min-w-0 flex-col gap-2">
          {tasks.length > 0 ? (
            tasks.map((task) => (
              <label
                key={task.taskId}
                className="flex min-w-0 cursor-pointer items-start gap-2 text-xs leading-5"
              >
                <input
                  type="checkbox"
                  checked={task.status === "done"}
                  onChange={(e) => {
                    taskStorage.upsertTasksForSource(
                      { type: ACTION_ITEMS_SOURCE_TYPE, id: sessionId },
                      tasks.map((t) =>
                        t.taskId === task.taskId
                          ? {
                              ...t,
                              status: e.target.checked ? "done" : "todo",
                            }
                          : t,
                      ),
                    );
                  }}
                  className="accent-primary mt-0.5"
                />
                <span
                  className={cn([
                    "min-w-0 break-words",
                    task.status === "done"
                      ? "text-muted-foreground/70 line-through"
                      : "text-muted-foreground",
                  ])}
                >
                  {task.textPreview}
                </span>
              </label>
            ))
          ) : (
            <p className="text-muted-foreground text-xs leading-5">
              {isGenerating
                ? t`Extracting action items...`
                : t`No action items yet.`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function useSendToReminders(
  sessionId: string,
  tasks: { taskId: string; status: string; textPreview: string }[],
) {
  const { t } = useLingui();
  const reminders = usePermission("reminders");
  const sessionTitle = main.UI.useCell(
    "sessions",
    sessionId,
    "title",
    main.STORE_ID,
  ) as string | undefined;

  const mutation = useMutation({
    mutationFn: async () => {
      const existing = await todoCommands.fetchTodos({
        kind: "All",
        list_ids: null,
      });
      if (existing.status === "error") {
        throw new Error(existing.error);
      }

      const pending = selectUnsentTasks(
        tasks,
        sessionId,
        existing.data.map((reminder) => reminder.url),
      );

      for (const task of pending) {
        const result = await todoCommands.createTodo({
          title: task.textPreview,
          list_id: null,
          notes: sessionTitle ? `From Velo: ${sessionTitle}` : "From Velo",
          url: buildTaskReminderUrl(sessionId, task.taskId),
          priority: null,
          due_date: null,
          start_date: null,
        });
        if (result.status === "error") {
          throw new Error(result.error);
        }
      }

      return pending.length;
    },
    onSuccess: (count) => {
      showTransientToast({
        id: "action-items-reminders",
        description:
          count === 0
            ? t`These action items are already in Reminders.`
            : t`Added ${count} to Reminders.`,
      });
    },
    onError: (error) => {
      console.error("Failed to send action items to Reminders", error);
      showTransientToast({
        id: "action-items-reminders",
        description: t`Could not add to Reminders. Try again.`,
        variant: "error",
      });
    },
  });

  const send = () => {
    if (reminders.status === "authorized") {
      mutation.mutate();
      return;
    }

    // A denied permission can no longer be re-prompted; only System Settings
    // can grant it, so send the user there instead of a request that does nothing.
    if (reminders.status === "denied") {
      void reminders.open();
    } else {
      reminders.request();
    }
    showTransientToast({
      id: "action-items-reminders",
      description: t`Allow Reminders access, then try again.`,
    });
  };

  return { send, isSending: mutation.isPending };
}

function SendToRemindersButton({
  isDisabled,
  isSending,
  onClick,
}: {
  isDisabled: boolean;
  isSending: boolean;
  onClick: () => void;
}) {
  const { t } = useLingui();
  const label = t`Add to Reminders`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={label}
          disabled={isDisabled}
          onClick={onClick}
          className={cn([
            "text-muted-foreground h-6 w-6 shrink-0 rounded-full",
            "hover:bg-accent/70 hover:text-foreground",
            "disabled:text-muted-foreground/70 disabled:cursor-not-allowed",
          ])}
        >
          {isSending ? (
            <Loader2Icon size={12} className="animate-spin" />
          ) : (
            <BellPlusIcon size={12} />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function GenerateButton({
  isDisabled,
  isGenerating,
  hasTasks,
  onClick,
}: {
  isDisabled: boolean;
  isGenerating: boolean;
  hasTasks: boolean;
  onClick: () => void;
}) {
  const { t } = useLingui();
  const label = hasTasks ? t`Regenerate action items` : t`Extract action items`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={label}
          disabled={isDisabled}
          onClick={onClick}
          className={cn([
            "text-muted-foreground h-6 w-6 shrink-0 rounded-full",
            "hover:bg-accent/70 hover:text-foreground",
            "disabled:text-muted-foreground/70 disabled:cursor-not-allowed",
          ])}
        >
          {isGenerating ? (
            <Loader2Icon size={12} className="animate-spin" />
          ) : (
            <RefreshCwIcon size={12} />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}
