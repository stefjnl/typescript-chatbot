"use client";

import type { ChangeEvent } from "react";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { ChatMessage, Conversation } from "@/types/chat";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ConversationItem } from "@/components/sidebar/ConversationItem";

interface ConversationListProps {
  conversations: Conversation[];
  activeConversationId?: string;
  onSelectConversation: (id: string) => void;
  onRenameConversation: (id: string, title: string) => void;
  onDeleteConversation: (id: string) => void;
  onCreateConversation: () => void;
}

export function ConversationList({
  conversations,
  activeConversationId,
  onSelectConversation,
  onRenameConversation,
  onDeleteConversation,
  onCreateConversation,
}: ConversationListProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const lowercase = query.trim().toLowerCase();
    if (!lowercase) {
      return conversations;
    }
    return conversations.filter((conversation: Conversation) =>
      [
        conversation.title,
        ...conversation.messages.map(
          (message: ChatMessage) => message.content
        ),
      ]
        .join(" ")
        .toLowerCase()
        .includes(lowercase)
    );
  }, [conversations, query]);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search conversations"
            value={query}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setQuery(event.target.value)
            }
            className="pl-9"
          />
        </div>
        <Button onClick={onCreateConversation}>New chat</Button>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-muted p-4 text-center text-sm text-muted-foreground">
            No conversations yet. Start a new chat!
          </div>
        ) : (
          filtered.map((conversation: Conversation) => (
            <ConversationItem
              key={conversation.id}
              conversation={conversation}
              isActive={conversation.id === activeConversationId}
              onSelect={onSelectConversation}
              onRename={onRenameConversation}
              onDelete={onDeleteConversation}
            />
          ))
        )}
      </div>
    </div>
  );
}
