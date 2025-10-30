# TypeScript NanoGPT Chatbot

An AI chatbot built with Next.js 14 App Router, TypeScript, and Tailwind CSS, featuring real-time streaming responses powered by the NanoGPT MiniMax-M2 model.

## Features

- Real-time streaming chat interface with Server-Sent Events (SSE)
- Conversation history with local browser storage persistence
- Multiple conversation threads with rename, delete, and export/import functionality
- Markdown rendering with syntax highlighting and one-click code copying
- Responsive layout with dark/light mode support
- Clean architecture with separated domain, application, and infrastructure layers
- Type-safe implementation with strict TypeScript configuration
- Component-based UI using Radix UI primitives and shadcn/ui components

## Architecture

The application follows Clean Architecture principles with clear separation of concerns:

### Domain Layer (`types/`)
- Core business entities and value objects
- Type definitions for chat messages, conversations, and API contracts

### Application Layer (`app/`, `components/`, `hooks/`)
- UI components and pages
- Custom hooks for state management
- Orchestration between domain and infrastructure

### Infrastructure Layer (`lib/`)
- External API integrations (NanoGPT)
- Local storage implementations
- Utility functions and helpers

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and provide credentials:

   ```bash
   cp .env.example .env
   # Edit .env and set NANOGPT_API_KEY
   ```

3. Run the development server:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) - app will automatically redirect to `/chat/new`

## Environment Variables

- `NANOGPT_API_KEY`: API key for the NanoGPT OpenAI-compatible endpoint

The app reads variables from `.env` during development and from the runtime environment in containers. Never commit secrets to source control.

## Development Workflow

```bash
npm run dev         # Start the Next.js dev server with hot reload
npm run lint        # Run ESLint checks
npm run type-check  # Run TypeScript in isolated mode
npm run build       # Create an optimized production build
npm run start       # Start the production build locally
```

Recommended flow: iterate with `npm run dev`, run lint/type checks before committing, and verify production bundles with `npm run build`.

## Project Structure

```
├── app/                    # Next.js App Router pages and API routes
│   ├── api/chat/          # Chat API endpoint with streaming support
│   ├── chat/[id]/         # Dynamic chat page routes
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout with providers
│   └── page.tsx           # Home page (redirects to /chat/new)
├── components/            # Reusable UI components
│   ├── chat/              # Chat-specific components
│   ├── sidebar/           # Conversation management components
│   ├── ui/                # Base UI components (shadcn/ui)
│   └── providers/         # React context providers
├── hooks/                 # Custom React hooks
├── lib/                   # Infrastructure layer
│   ├── api/               # External API integrations
│   ├── storage/           # Local storage implementations
│   └── utils/             # Utility functions
└── types/                 # TypeScript type definitions
```

## API Key Acquisition

1. Sign up for NanoGPT at [https://nano-gpt.com](https://nano-gpt.com) and create an account.
2. Navigate to your dashboard and generate an API key compatible with the OpenAI Chat Completions API.
3. Copy the key into your local `.env` file or supply it as `NANOGPT_API_KEY` in deployment environments.

## Troubleshooting

- **Missing API key**: Ensure `NANOGPT_API_KEY` is defined. The API route returns 401 errors without it.
- **Streaming stalls**: Confirm that firewalls or proxies are not buffering SSE traffic to `https://nano-gpt.com/api`.
- **Build failures**: Run `npm run lint` and `npm run type-check` to surface syntax or type issues early.
- **LocalStorage errors**: Use a modern browser with localStorage enabled; some privacy modes disable persistence.

## Tech Stack

- **Framework**: Next.js 14 App Router
- **Language**: TypeScript in strict mode
- **Styling**: Tailwind CSS with shadcn/ui components
- **UI Components**: Radix UI primitives
- **Markdown**: react-markdown with react-syntax-highlighter
- **API Integration**: NanoGPT streaming API (MiniMax-M2 model)
- **State Management**: React hooks with localStorage persistence
- **Theme**: next-themes for dark/light mode support