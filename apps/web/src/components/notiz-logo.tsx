export function NotizLogo({
  className,
  compact,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <img
      src="/logo.svg"
      alt="Notiz"
      className={className}
      data-compact={compact ? "true" : undefined}
    />
  );
}
