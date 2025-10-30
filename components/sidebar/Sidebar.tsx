"use client";

import { ConversationList } from "@/components/sidebar/ConversationList";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import type { Conversation } from "@/types/chat";
import { Download, Upload } from "lucide-react";
import type { ChangeEvent } from "react";
import { useRef } from "react";

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId?: string;
  onSelectConversation: (id: string) => void;
  onCreateConversation: () => void;
  onRenameConversation: (id: string, title: string) => void;
  onDeleteConversation: (id: string) => void;
  onExport: () => string;
  onImport: (json: string) => void;
}

export function Sidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onCreateConversation,
  onRenameConversation,
  onDeleteConversation,
  onExport,
  onImport,
}: SidebarProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleExport = () => {
    const data = onExport();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `chatbot-conversations-${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const text = await file.text();
      onImport(text);
    } catch (error) {
      console.error("Failed to import conversations", error);
    } finally {
      event.target.value = "";
    }
  };

  return (
    <aside className="hidden h-full w-72 shrink-0 flex-col border-r bg-muted/20 p-4 lg:flex">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Conversations</h2>
        <ThemeToggle />
      </div>
      <Separator className="my-4" />
      <ConversationList
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={onSelectConversation}
        onRenameConversation={onRenameConversation}
        onDeleteConversation={onDeleteConversation}
        onCreateConversation={onCreateConversation}
      />
      <Separator className="my-4" />
      <div className="mt-auto flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={handleImportFile}
        />
        <Button variant="outline" className="w-full gap-2" onClick={handleExport}>
          <Download className="h-4 w-4" /> Export
        </Button>
        <Button variant="outline" className="w-full gap-2" onClick={handleImportClick}>
          <Upload className="h-4 w-4" /> Import
        </Button>
      </div>
    </aside>
  );
}
