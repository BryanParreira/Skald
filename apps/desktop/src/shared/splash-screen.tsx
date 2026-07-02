import { Spinner } from "@hypr/ui/components/ui/spinner";

export function SplashScreen() {
  return (
    <div className="bg-background text-foreground flex h-screen w-screen flex-col items-center justify-center gap-6">
      <span className="animate-pulse font-sans text-4xl font-semibold tracking-tight">
        Velo
      </span>
      <Spinner size={20} className="text-muted-foreground" />
    </div>
  );
}
