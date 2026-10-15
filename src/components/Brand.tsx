import { cn } from "@/lib/utils";

/** Atrium identity only; no services or application state from the old build. */
export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn("atrium-brand", className)}>
      <img src="/atrium-logo.png" alt="" width={36} height={36} />
      <span>Atrium</span>
    </span>
  );
}
