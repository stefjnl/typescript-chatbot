"use client";

import type { ChangeEvent, KeyboardEvent } from "react";
import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import type { Conversation } from "@/types/chat";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

export function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onRename,
  onDelete,
}: ConversationItemProps) {
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState(conversation.title);

  const subtitle = useMemo(() => {
    try {
      return formatDistanceToNow(new Date(conversation.updatedAt), {
        addSuffix: true,
      });
    } catch {
      return "Recently";
    }
  }, [conversation.updatedAt]);

  const handleRename = () => {
    const trimmed = titleDraft.trim();
    if (!trimmed) {
      return;
    }
    onRename(conversation.id, trimmed);
    setDialogOpen(false);
  };

  return (
    <div
      className={cn(
        "group flex items-center justify-between rounded-xl border border-transparent px-3 py-2 transition hover:border-border hover:bg-muted",
        isActive && "border-primary/40 bg-primary/10"
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(conversation.id)}
        className="flex flex-1 flex-col items-start text-left"
      >
        <span className="text-sm font-semibold text-foreground">
          {conversation.title}
        </span>
        <span className="text-xs text-muted-foreground">
          {conversation.messages.length} messages • Updated {subtitle}
        </span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" className="h-8 w-8 opacity-0 transition group-hover:opacity-100">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <DropdownMenuItem className="gap-2">
                <Pencil className="h-4 w-4" /> Rename
              </DropdownMenuItem>
            </DialogTrigger>
            <DialogContent>
              <DialogTitle>Rename conversation</DialogTitle>
              <DialogDescription>
                Update the title to quickly recognise this thread later.
              </DialogDescription>
              <Input
                value={titleDraft}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setTitleDraft(event.target.value)
                }
                onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                  if (event.key === "Enter") {
                    handleRename();
                  }
                }}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleRename}>Save</Button>
              </div>
            </DialogContent>
          </Dialog>
          <DropdownMenuItem
            className="gap-2 text-destructive focus:text-destructive"
            onClick={() => onDelete(conversation.id)}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
