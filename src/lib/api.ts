import { eventBus } from './event-bus';

export interface ChatRequest { query: string; kb_id?: string; tenant_id?: string | null; session_id?: string; top_k?: number; metadata_filters?: any; }
export interface Citation { citation_label?: string; chunk_id: string; source: string; score?: number; evidence_role?: string; span_text?: string; span_start?: number; span_end?: number; modality?: string; media_uri?: string; }
export interface ChatResponse { answer: string; citations: Citation[]; contexts: any[]; trace_id: string; kb_id: string | null; tenant_id: string | null; session_id: string | null; }
export interface IngestResponse { status: string; kb_id: string; tenant_id: string | null; documents: number; chunks: number; source: string; uploaded_files: string[]; }
export interface FeedbackRequest { trace_id: string; rating: "up"|"down"; kb_id?: string; tenant_id?: string | null; session_id?: string; comment?: string; tags?: string[]; }
export interface DocumentSummary { doc_id: string; title: string; source_path: string; kb_id: string; tenant_id: string | null; chunk_count: number; updated_at: number; doc_type?: string; source_key?: string; }

function getHeaders(isFormData = false): HeadersInit {
  const headers: Record<string, string> = {};
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  const apiKey = localStorage.getItem('nanorag_api_key') || import.meta.env.VITE_RAG_API_KEY;
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }
  return headers;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

async function fetchWithHandlers(url: string, options?: RequestInit) {
  try {
    const response = await fetch(`${API_BASE}${url}`, options);
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP ${response.status} ${response.statusText}`;
      if (response.status === 401 || response.status === 403) {
        errorMessage = 'Authorization failed. Please check your API Key in Settings.';
      } else if (errorText) {
        try {
          const parsed = JSON.parse(errorText);
          errorMessage = parsed.detail || errorMessage;
        } catch {
          errorMessage = errorText.substring(0, 50) + '...';
        }
      }
      throw new Error(errorMessage);
    }
    return response.json();
  } catch (error) {
    const errObj = error instanceof Error ? error : new Error(String(error));
    eventBus.emit(`API Error [${options?.method || 'GET'} ${url}]: ${errObj.message}`, 'error');
    throw errObj;
  }
}

export async function ingestUpload(files: File[], kbId = "default"): Promise<IngestResponse> {
  const fd = new FormData();
  files.forEach(f => fd.append("files", f));
  fd.append("kb_id", kbId);
  eventBus.emit(`Uploading ${files.length} files to kb: ${kbId}...`, 'info');
  const result = await fetchWithHandlers('/v1/rag/ingest/upload', {
    method: 'POST',
    headers: getHeaders(true),
    body: fd,
  });
  eventBus.emit(`Ingestion complete: ${result.documents} docs, ${result.chunks} chunks`, 'success');
  return result;
}

export async function chat(payload: ChatRequest): Promise<ChatResponse> {
  eventBus.emit(`Sending chat query...`, 'info');
  const result = await fetchWithHandlers('/v1/rag/chat', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  eventBus.emit(`Chat response received [Trace ID: ${result.trace_id}]`, 'success');
  return result;
}

export async function sendFeedback(payload: FeedbackRequest): Promise<{status: string, feedback_id: string}> {
  eventBus.emit(`Sending feedback for trace_id ${payload.trace_id}...`, 'info');
  const result = await fetchWithHandlers('/v1/rag/feedback', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  eventBus.emit(`Feedback submitted successfully`, 'success');
  return result;
}

export async function listDocuments(kbId = "default"): Promise<DocumentSummary[]> {
  const params = new URLSearchParams({ kb_id: kbId });
  return await fetchWithHandlers(`/v1/rag/documents?${params.toString()}`, { headers: getHeaders() });
}

export async function getParsedDoc(docId: string): Promise<{document: any, chunks: any[]}> {
  return await fetchWithHandlers(`/debug/parsed/${docId}`, { headers: getHeaders() });
}

export async function health(): Promise<{status: string, components: any}> {
  return await fetchWithHandlers('/health', { headers: getHeaders() });
}
