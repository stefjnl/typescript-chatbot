"use client";

export function TypingIndicator() {
  return (
    <div className="mx-auto flex w-full max-w-lg items-center justify-center gap-2 rounded-full border border-dashed border-muted-foreground/40 bg-muted/40 px-6 py-3 text-muted-foreground">
      <span className="text-sm">NanoGPT is thinking</span>
      <span className="flex items-center gap-1">
        <span className="h-2 w-2 animate-[blink_1s_ease-in-out_infinite] rounded-full bg-muted-foreground" />
        <span className="h-2 w-2 animate-[blink_1s_ease-in-out_infinite_200ms] rounded-full bg-muted-foreground" />
        <span className="h-2 w-2 animate-[blink_1s_ease-in-out_infinite_400ms] rounded-full bg-muted-foreground" />
      </span>
    </div>
  );
}
