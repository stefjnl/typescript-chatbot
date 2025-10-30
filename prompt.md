Create a complete, production-ready AI chatbot application using TypeScript, Node.js, and Next.js 14+ (App Router). The application must be fully functional, visually polished to match Claude/Gemini quality, and deployable via Docker.

═══════════════════════════════════════════════════════════════════

TECHNICAL STACK:
- Next.js 14+ with App Router and Server Actions
- TypeScript (strict mode enabled)
- Tailwind CSS for styling
- Shadcn/ui for UI components  
- NanoGPT API (OpenAI-compatible endpoint)
- Docker for containerized deployment

═══════════════════════════════════════════════════════════════════

NANOGPT API INTEGRATION:
API Endpoint: https://api.nano-gpt.com/v1/chat/completions
Authentication: Bearer token via Authorization header

Request Format:
{
  "model": "gpt-4o",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant"},
    {"role": "user", "content": "Hello"}
  ],
  "stream": true,
  "temperature": 0.7,
  "max_tokens": 2000
}

Response: OpenAI-compatible streaming/non-streaming responses

Implementation Requirements:
- Use native fetch() for API calls (no external SDK needed)
- Implement streaming with Server-Sent Events (SSE)
- Handle both streaming and non-streaming modes
- Add proper error handling for API failures
- Store API key in environment variable (NANOGPT_API_KEY)

═══════════════════════════════════════════════════════════════════

CORE FEATURES:
1. Streaming chat interface with real-time message display
2. Conversation history with localStorage persistence
3. Multiple conversation threads (sidebar navigation)
4. New chat / delete chat / rename chat functionality
5. Markdown rendering with syntax highlighting for code blocks
6. Copy code button for code blocks
7. Auto-scroll to latest message
8. Typing indicators during streaming
9. Mobile-responsive design with collapsible sidebar
10. Dark/light mode toggle with system preference detection

═══════════════════════════════════════════════════════════════════

UI/UX REQUIREMENTS:
Design Pattern: Clean, minimalist interface similar to Claude.ai

Layout:
- Left sidebar (280px): Conversation list with search
- Main area: Chat messages + input field at bottom
- Sidebar toggle button for mobile

Message Styling:
- User messages: Right-aligned, colored background
- Assistant messages: Left-aligned, neutral background  
- Distinct avatars for user/assistant
- Timestamp on hover
- Message actions: Copy, regenerate (for assistant)

Input Field:
- Multi-line textarea with auto-resize
- Send button (disabled when empty/loading)
- Enter to send, Shift+Enter for new line
- Character count indicator
- Stop generation button during streaming

Empty States:
- Welcome screen with example prompts
- Helpful suggestions for first-time users

Loading States:
- Skeleton loaders for messages
- Pulsing indicator during API calls
- Smooth transitions

═══════════════════════════════════════════════════════════════════

PROJECT STRUCTURE:
/app
  /api
    /chat
      route.ts          # API route for NanoGPT streaming
  /chat
    /[id]
      page.tsx          # Individual chat page
  layout.tsx            # Root layout with providers
  page.tsx              # Home/redirect to latest chat

/components
  /chat
    ChatInterface.tsx   # Main chat container
    MessageList.tsx     # Messages display
    MessageInput.tsx    # Input field component
    Message.tsx         # Individual message
  /sidebar
    Sidebar.tsx         # Conversation sidebar
    ConversationList.tsx
    ConversationItem.tsx
  /ui
    # Shadcn components: button, input, textarea, dialog, etc.

/lib
  /api
    nanogpt.ts          # NanoGPT API client
  /storage
    conversations.ts    # localStorage operations
  /utils
    markdown.ts         # Markdown parsing utilities
    streaming.ts        # SSE streaming helpers

/types
  chat.ts               # TypeScript interfaces
  api.ts

═══════════════════════════════════════════════════════════════════

CONVERSATION STORAGE (localStorage):
Schema:
{
  "conversations": [
    {
      "id": "uuid",
      "title": "Conversation title",
      "createdAt": "ISO timestamp",
      "updatedAt": "ISO timestamp",
      "messages": [
        {
          "id": "uuid",
          "role": "user|assistant",
          "content": "message text",
          "timestamp": "ISO timestamp"
        }
      ]
    }
  ]
}

Operations:
- Auto-generate title from first message
- Save after each message exchange
- Load on mount with error handling
- Export/import functionality (bonus)

═══════════════════════════════════════════════════════════════════

DOCKER DEPLOYMENT:
Dockerfile Requirements:
- Multi-stage build (builder + runner)
- Node.js 20 Alpine base
- Build Next.js for production
- Expose port 3000
- Health check endpoint
- Non-root user for security

docker-compose.yml:
- Service definition for the app
- Environment variable injection
- Volume mounts for development
- Restart policy

Build Commands:
docker build -t ai-chatbot .
docker run -p 3000:3000 -e NANOGPT_API_KEY=your_key ai-chatbot

═══════════════════════════════════════════════════════════════════

TECHNICAL IMPLEMENTATION DETAILS:

API Route Handler (/app/api/chat/route.ts):
- Accept POST requests with messages array
- Call NanoGPT API with streaming enabled
- Transform streaming response to client
- Handle errors with proper status codes
- Implement request timeout (30s)

Streaming Implementation:
- Use ReadableStream for Server-Sent Events
- Parse delta chunks from NanoGPT response
- Send formatted chunks to client
- Handle connection interruption gracefully

Error Handling:
- API key validation
- Rate limiting detection
- Network failures with retry logic
- Malformed response handling
- User-friendly error messages

Performance:
- Lazy load conversation history
- Virtualize long message lists
- Debounce input typing
- Optimize re-renders with React.memo
- Code splitting for markdown renderer

═══════════════════════════════════════════════════════════════════

REQUIRED DELIVERABLES:

1. Complete source code with proper file organization
2. package.json with all dependencies:
   - next@latest
   - react@18
   - typescript@5
   - tailwindcss@3
   - @radix-ui/react-* (for shadcn)
   - react-markdown
   - react-syntax-highlighter
   - uuid
   - date-fns

3. Configuration files:
   - next.config.js
   - tsconfig.json
   - tailwind.config.ts
   - .eslintrc.json
   - .env.example (with NANOGPT_API_KEY placeholder)

4. Docker files:
   - Dockerfile
   - docker-compose.yml
   - .dockerignore

5. Documentation:
   - README.md with:
     * Setup instructions
     * Environment variables
     * Docker commands
     * Development workflow
     * API key acquisition guide
     * Troubleshooting section

6. Additional files:
   - .gitignore
   - Type definitions for all components
   - Utility functions with JSDoc comments

═══════════════════════════════════════════════════════════════════

CODE QUALITY REQUIREMENTS:
- TypeScript strict mode with no 'any' types
- ESLint configuration for Next.js
- Proper error boundaries
- Accessible components (ARIA labels)
- Responsive breakpoints: mobile (640px), tablet (768px), desktop (1024px)
- Clean code with single responsibility principle
- Reusable component architecture

═══════════════════════════════════════════════════════════════════

FINAL OUTPUT:
Generate ALL files needed to:
1. Run `npm install`
2. Create `.env` file with NANOGPT_API_KEY
3. Run `npm run dev` OR `docker-compose up`
4. Access fully functional chatbot at localhost:3000

The application must work immediately without ANY additional coding or configuration.