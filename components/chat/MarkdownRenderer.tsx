"use client";

import { deriveCodeLanguage, markdownRemarkPlugins } from "@/lib/utils/markdown";
import { Check, Copy } from "lucide-react";
import { Component, type ReactNode, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { nightOwl } from "react-syntax-highlighter/dist/cjs/styles/prism";

interface MarkdownRendererProps {
  content: string;
  isStreaming?: boolean;
}

export function MarkdownRenderer({ content, isStreaming }: MarkdownRendererProps) {
  if (!content) {
    return null;
  }

  const containsLikelyTable = /(^|\n)\s*\|.+\|/.test(content);

  if (isStreaming || containsLikelyTable) {
    return <pre className="whitespace-pre-wrap break-words font-sans text-sm">{content}</pre>;
  }

  return (
    <MarkdownErrorBoundary content={content}>
      <ReactMarkdown
        className="markdown-body"
        remarkPlugins={markdownRemarkPlugins}
        components={{
          code: ({
            inline,
            className,
            children,
            ...props
          }: {
            inline?: boolean;
            className?: string;
            children?: ReactNode;
          }) => {
            const rawContent = String(children ?? "");
            if (inline) {
              return (
                <code className={className} {...props}>
                  {rawContent}
                </code>
              );
            }
            const language = deriveCodeLanguage(className);
            return <CodeBlock language={language} value={rawContent} />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </MarkdownErrorBoundary>
  );
}

type MarkdownErrorBoundaryProps = {
  content: string;
  children: ReactNode;
};

type MarkdownErrorBoundaryState = {
  hasError: boolean;
};

class MarkdownErrorBoundary extends Component<
  MarkdownErrorBoundaryProps,
  MarkdownErrorBoundaryState
> {
  constructor(props: MarkdownErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): MarkdownErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("Markdown render failed", error);
  }

  componentDidUpdate(prevProps: MarkdownErrorBoundaryProps) {
    if (prevProps.content !== this.props.content && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <pre className="whitespace-pre-wrap break-words font-sans text-sm">
          {this.props.content}
        </pre>
      );
    }

    return this.props.children;
  }
}

function CodeBlock({ language, value }: { language?: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy code", error);
    }
  };

  return (
    <div className="group relative">
      <button
        type="button"
        className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background/70 text-xs text-muted-foreground opacity-0 transition group-hover:opacity-100"
        onClick={handleCopy}
        aria-label="Copy code"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </button>
      <SyntaxHighlighter
        customStyle={{ margin: 0, borderRadius: "0.75rem", fontSize: "0.875rem" }}
        language={language}
        style={nightOwl}
        PreTag="div"
        wrapLongLines
      >
        {value.replace(/\n$/, "")}
      </SyntaxHighlighter>
    </div>
  );
}
