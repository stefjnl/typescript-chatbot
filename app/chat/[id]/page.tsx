import { ChatInterface } from "@/components/chat/ChatInterface";

interface ChatPageParams {
  params: { id: string };
}

export default function ChatPage({ params }: ChatPageParams) {
  const { id } = params;
  const isNewConversation = id === "new";

  return (
    <ChatInterface
      initialConversationId={isNewConversation ? undefined : id}
      createNewConversation={isNewConversation}
    />
  );
}
