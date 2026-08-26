import { useLingui } from "@lingui/react/macro";
import { Loader2Icon, RefreshCwIcon } from "lucide-react";

import { useTaskRecords, useTaskStorage } from "@hypr/editor/task-storage";
import { Button } from "@hypr/ui/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@hypr/ui/components/ui/tooltip";
import { cn } from "@hypr/utils";

import { useActionItemExtraction } from "~/session/insights/action-items";

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

  return (
    <div data-session-action-items className="relative h-full min-h-0">
      <div className="absolute top-2 right-1 z-10">
        <GenerateButton
          isDisabled={!canGenerate || isGenerating}
          isGenerating={isGenerating}
          hasTasks={tasks.length > 0}
          onClick={generate}
        />
      </div>

      <div
        className={cn([
          "scroll-fade-y h-full overflow-y-auto py-4 pr-10 pl-3",
        ])}
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
