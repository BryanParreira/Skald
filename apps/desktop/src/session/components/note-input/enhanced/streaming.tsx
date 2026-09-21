import { motion } from "motion/react";
import { Streamdown } from "streamdown";

import { cn } from "@notiz/utils";

import { streamdownComponents } from "../../streamdown";

import { useAITaskTask } from "~/ai/hooks";
import { createTaskId } from "~/store/zustand/ai-task/task-configs";

function SummaryTitleSpace() {
  return (
    <div
      aria-hidden="true"
      data-testid="summary-title-space"
      className="pointer-events-none mb-4 h-[1.875rem]"
    />
  );
}

const SKELETON_LINES = [
  { width: "75%", delay: 0 },
  { width: "90%", delay: 0.1 },
  { width: "60%", delay: 0.2 },
  { width: "85%", delay: 0.3 },
  { width: "45%", delay: 0.4 },
];

function Generatingskeleton() {
  return (
    <motion.div
      role="status"
      aria-live="polite"
      aria-label="Generating notes"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-3 pt-1 pb-2"
    >
      <div className="flex items-center gap-2">
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          className="bg-foreground/20 h-1.5 w-1.5 rounded-full"
        />
        <span className="text-muted-foreground/60 text-xs tracking-wide">
          Generating notes
        </span>
      </div>
      <div className="flex flex-col gap-2.5">
        {SKELETON_LINES.map((line, i) => (
          <motion.div
            key={i}
            className="bg-muted-foreground/10 h-3 rounded-full"
            style={{ width: line.width }}
            animate={{ opacity: [0.5, 0.9, 0.5] }}
            transition={{
              duration: 1.8,
              repeat: Infinity,
              ease: "easeInOut",
              delay: line.delay,
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}

export function StreamingView({ enhancedNoteId }: { enhancedNoteId: string }) {
  const taskId = createTaskId(enhancedNoteId, "enhance");
  const { streamedText, isGenerating } = useAITaskTask(taskId, "enhance");

  if (streamedText.trim().length === 0) {
    return <Generatingskeleton />;
  }

  return (
    <div className="pb-2">
      <div className="flex flex-col gap-1">
        <SummaryTitleSpace />
        <Streamdown
          components={streamdownComponents}
          className={cn(["flex flex-col"])}
          caret="block"
          isAnimating={isGenerating}
        >
          {streamedText}
        </Streamdown>
      </div>
    </div>
  );
}
