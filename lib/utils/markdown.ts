import remarkGfm from "remark-gfm";
import type { PluggableList } from "unified";

export const markdownRemarkPlugins = [
  remarkGfm,
] as unknown as PluggableList;

export function deriveCodeLanguage(className?: string): string | undefined {
  const match = /language-(\w+)/.exec(className ?? "");
  return match?.[1];
}
