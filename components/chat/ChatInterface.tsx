"use client";

import { MessageInput } from "@/components/chat/MessageInput";
import { MessageList } from "@/components/chat/MessageList";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useChatController } from "@/hooks/use-chat-controller";

interface ChatInterfaceProps {
  initialConversationId?: string;
  createNewConversation?: boolean;
}

export function ChatInterface({
  initialConversationId,
  createNewConversation = false,
}: ChatInterfaceProps) {
  const {
    conversations,
    activeConversation,
    activeConversationId,
    isReady,
    input,
    setInput,
    isStreaming,
    error,
    placeholderMessages,
    onSendMessage,
    onRegenerateMessage,
    onStopStreaming,
    onCreateConversation,
    onSelectConversation,
    onImportConversations,
    renameConversation,
    deleteConversation,
    exportData,
  } = useChatController({ initialConversationId, createNewConversation });

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background lg:flex-row">
      <Sidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={onSelectConversation}
        onCreateConversation={onCreateConversation}
        onRenameConversation={renameConversation}
        onDeleteConversation={deleteConversation}
        onExport={exportData}
        onImport={onImportConversations}
      />
      <main className="flex h-full flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-card/80 px-6 py-4 backdrop-blur">
          <div>
            <h1 className="text-xl font-semibold">
              {activeConversation?.title ?? "New Conversation"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Powered by NanoGPT • Streaming responses in real time
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              className={buttonVariants({ variant: "outline" })}
              onClick={onCreateConversation}
            >
              New chat
            </Button>
            <ThemeToggle />
          </div>
        </header>
        <div className="flex flex-1 flex-col overflow-hidden">
          {error && (
            <div className="mx-auto mt-4 w-full max-w-2xl rounded border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="flex h-full flex-col">
            {isReady ? (
              <MessageList
                messages={activeConversation?.messages ?? placeholderMessages}
                isStreaming={isStreaming}
                onRegenerate={onRegenerateMessage}
              />
            ) : (
              <div className="flex flex-1 flex-col gap-4 p-6">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            )}
          </div>
        </div>
        <Separator />
        <div className="sticky bottom-0 z-10 border-t bg-background/95 p-4 backdrop-blur">
          <MessageInput
            value={input}
            onChange={setInput}
            onSubmit={onSendMessage}
            onStop={onStopStreaming}
            isStreaming={isStreaming}
          />
        </div>
      </main>
    </div>
  );
}
