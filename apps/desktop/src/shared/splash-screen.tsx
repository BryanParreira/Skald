import { motion } from "motion/react";

import { cn } from "@hypr/utils";

const SIDEBAR_ROWS = [
  { width: "85%", delay: 0 },
  { width: "70%", delay: 0.1 },
  { width: "90%", delay: 0.2 },
  { width: "60%", delay: 0.3 },
  { width: "75%", delay: 0.4 },
  { width: "65%", delay: 0.5 },
];

const CONTENT_LINES = [
  { width: "40%", delay: 0, height: "h-4" },
  { width: "95%", delay: 0.1, height: "h-3" },
  { width: "88%", delay: 0.2, height: "h-3" },
  { width: "92%", delay: 0.3, height: "h-3" },
  { width: "55%", delay: 0.4, height: "h-3" },
];

function PulseBar({
  width,
  delay,
  className,
}: {
  width: string;
  delay: number;
  className?: string;
}) {
  return (
    <motion.div
      className={cn(["bg-muted-foreground/10 rounded-full", className])}
      style={{ width }}
      animate={{ opacity: [0.5, 0.9, 0.5] }}
      transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", delay }}
    />
  );
}

export function SplashScreen() {
  return (
    <div className="bg-background flex h-screen w-screen">
      <div className="border-border/70 flex w-[240px] shrink-0 flex-col gap-2 border-r px-3 pt-12">
        {SIDEBAR_ROWS.map((row, i) => (
          <PulseBar key={i} width={row.width} delay={row.delay} className="h-7" />
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-3 px-10 pt-14">
        {CONTENT_LINES.map((line, i) => (
          <PulseBar
            key={i}
            width={line.width}
            delay={line.delay}
            className={line.height}
          />
        ))}
      </div>
    </div>
  );
}
