import type { PluggableList } from "unified";
import remarkGfm from "remark-gfm";

export const markdownRemarkPlugins = [
  remarkGfm,
] as unknown as PluggableList;

export function deriveCodeLanguage(className?: string): string | undefined {
  const match = /language-(\w+)/.exec(className ?? "");
  return match?.[1];
}
