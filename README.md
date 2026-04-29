# NanoRAG Frontend

A lightweight, modern frontend interface for a Document RAG (Retrieval-Augmented Generation) system. Built with React, Vite, and Tailwind CSS.

## Features

- **Document Ingestion**: Upload documents to be chunked and embedded by the backend.
- **RAG Chat**: Chat with your documents using an optimized retrieval system and see citations for answers.
- **Knowledge Explorer**: Browse uploaded documents and their extracted chunks.
- **System Log**: Real-time audit log of system operations and API interactions.
- **Configuration**: Easily switch Knowledge Base IDs and provide API keys.

## Development

1. Setup environment variables by copying `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Fill in your `VITE_API_BASE_URL` (if your backend is not on the same host) and `VITE_RAG_API_KEY`.

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

In development, API requests to `/v1/*`, `/health`, and `/debug` will be proxied to `http://localhost:8000` by default.

## Build

```bash
npm run build
```
The output will be in the `dist/` directory, ready to be served by Nginx or another static file server.

## Environment Variables

- `VITE_API_BASE_URL`: Base URL for backend API requests (leave empty if served on the same origin).
- `VITE_RAG_API_KEY`: API Key for backend authentication (sent as `X-API-Key` header).
