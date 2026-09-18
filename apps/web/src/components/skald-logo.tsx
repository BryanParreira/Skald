export function SkaldLogo({
  className,
  compact,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <img
      src="/logo.svg"
      alt="Skald"
      className={className}
      data-compact={compact ? "true" : undefined}
    />
  );
}
