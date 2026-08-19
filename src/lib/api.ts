import { eventBus } from './event-bus';

export interface ChatRequest { query: string; kb_id?: string; session_id?: string; top_k?: number; metadata_filters?: any; }
export interface Citation { citation_label?: string; chunk_id: string; node_id?: string; source: string; score?: number; page_number?: number; hierarchy_path?: string[]; bounding_box?: Record<string, any> | null; evidence_role?: string; span_text?: string; span_start?: number; span_end?: number; modality?: string; media_uri?: string; mime_type?: string; }
export interface ChatResponse { answer: string; citations: Citation[]; contexts: any[]; trace_id: string; kb_id: string | null; session_id: string | null; }
export interface IngestResponse { status: string; kb_id: string; job_id?: string | null; stage?: string | null; documents: number; chunks: number; source: string; uploaded_files: string[]; error?: string | null; }
export interface IngestJobResponse extends IngestResponse { job_id: string; path: string; submitted_at: number; started_at?: number | null; completed_at?: number | null; }
export interface FeedbackRequest { trace_id: string; rating: "up"|"down"; kb_id?: string; session_id?: string; comment?: string; tags?: string[]; }
export interface DocumentSummary { doc_id: string; title: string; source_path: string; kb_id: string; chunk_count: number; updated_at: number; doc_type?: string; source_key?: string; }
export interface DocumentNode { node_id: string; doc_id: string; kb_id: string; node_type: string; text?: string; title?: string | null; children?: DocumentNode[]; provenance?: { page_number?: number | null; hierarchy_path?: string[]; bounding_box?: Record<string, any> | null; source_ref?: string | null }; table?: any; metadata?: Record<string, any>; }
export interface StructuredDocument { doc_id: string; kb_id: string; source_path: string; title: string; root: DocumentNode; metadata?: Record<string, any>; }
export interface KnowledgeBaseSummary { kb_id: string; name: string; description?: string | null; source: string; external_ref?: string | null; metadata: Record<string, any>; created_at: number; updated_at: number; document_count: number; chunk_count: number; trace_count: number; last_activity_at?: number | null; }
export interface KnowledgeBaseCreateRequest { kb_id: string; name: string; description?: string | null; source?: string; external_ref?: string | null; metadata?: Record<string, any>; }
export interface IngestSourceSummary { path: string; name: string; extension: string; size_bytes: number; updated_at: number; }
export interface HealthSummary { status: string; auth_enabled?: boolean; auth_configured?: boolean; auth_status?: string; }
export interface HealthDetail extends HealthSummary {
  service?: string;
  gateway_mode?: string;
  vectorstore_backend?: string;
  parsed_dir?: string;
  gateway?: {
    base_url?: string;
    reachable?: boolean;
    error?: string | null;
    capabilities?: Record<string, { base_url?: string; reachable?: boolean; error?: string | null }>;
  };
  providers?: {
    document_parser?: {
      enabled?: boolean;
      provider?: string;
      model?: string;
      base_url?: string | null;
      configured?: boolean;
      missing?: string[];
    };
  };
  langfuse?: {
    enabled?: boolean;
    reachable?: boolean;
    ui_reachable?: boolean;
    otel_reachable?: boolean;
    error?: string | null;
    ui_endpoint?: string | null;
    otel_endpoint?: string | null;
  };
  vectorstore?: { status?: string; error?: string | null; details?: Record<string, any> };
  ingestion?: { executor?: string; broker_configured?: boolean; job_store_dir?: string };
  features?: Record<string, boolean>;
  trace_count?: number;
}
export interface PaginatedResponse<T> { items: T[]; total: number; page: number; page_size: number; total_pages: number; }
export interface TraceSummary {
  trace_id: string;
  latency_seconds?: number | null;
  query?: string | null;
  kb_id?: string | null;
  session_id?: string | null;
  model_alias?: string | null;
  context_count?: number | null;
  conflicting_context_count?: number | null;
}
export interface TraceRecord extends TraceSummary {
  answer?: string | null;
  contexts?: any[];
  citations?: any[];
  retrieved?: any[];
  reranked?: any[];
  prompt_messages?: any[];
  step_latencies?: Record<string, number>;
}
export interface RetrievalDebugResponse { query: string; retrieved: any[]; reranked: any[]; contexts: any[]; trace_id?: string | null; }
export interface DiagnosisResponse { target_type: string; trace_id?: string | null; sample_id?: string | null; summary: string; findings: any[]; ai_suggestion?: string | null; }
export interface RunReportResponse { status: string; output_path?: string | null; report: any; }

function getHeaders(isFormData = false): HeadersInit {
  const headers: Record<string, string> = {};
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

const API_BASE = '';

const scopedParams = (kbId: string) => new URLSearchParams({ kb_id: kbId });
const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    // Detach the abort listener once the sleep settles normally — otherwise a
    // long ingest poll (up to 300 rounds) accumulates listeners on the signal.
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });

async function fetchWithHandlers(url: string, options?: RequestInit) {
  try {
    const response = await fetch(`${API_BASE}${url}`, {
      credentials: 'include',
      ...options,
    });
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP ${response.status} ${response.statusText}`;
      if (response.status === 401 || response.status === 403) {
        errorMessage = '当前请求无权访问该接口。';
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
    // An abort (e.g. the component unmounted mid-poll) is expected control
    // flow, not a failure — surface nothing.
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    const errObj = error instanceof Error ? error : new Error(String(error));
    eventBus.emit(`接口请求失败 [${options?.method ?? 'GET'} ${url}]: ${errObj.message}`, 'error');
    throw errObj;
  }
}

export async function ingestUpload(files: File[], kbId: string, signal?: AbortSignal): Promise<IngestResponse> {
  const fd = new FormData();
  files.forEach(f => fd.append("files", f));
  fd.append("kb_id", kbId);
  eventBus.emit(`正在上传 ${files.length} 个文件到知识库 ${kbId}`, 'info');
  const result = await fetchWithHandlers('/v1/rag/ingest/upload', {
    method: 'POST',
    headers: getHeaders(true),
    body: fd,
    signal,
  });
  eventBus.emit(`注入任务已提交：${result.job_id}`, 'info');
  return await waitForIngestJob(result.job_id, signal);
}

export async function chat(payload: ChatRequest): Promise<ChatResponse> {
  eventBus.emit(`正在发送问答请求`, 'info');
  const result = await fetchWithHandlers('/v1/rag/chat', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  eventBus.emit(`问答完成 [Trace ID: ${result.trace_id}]`, 'success');
  return result;
}

export async function* chatStream(payload: ChatRequest): AsyncGenerator<any, void, unknown> {
  eventBus.emit(`正在发送流式问答请求`, 'info');
  const response = await fetch(`${API_BASE}/v1/rag/chat/stream`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  if (!response.body) {
    throw new Error('ReadableStream not yet supported in this browser.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      // Normalize CRLF/CR so frame splitting is robust to any server newline style.
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n').replace(/\r/g, '\n');

      const frames = buffer.split('\n\n');
      buffer = frames.pop() || '';

      for (const frame of frames) {
        const dataLine = frame.split('\n').find((line) => line.startsWith('data:'));
        if (!dataLine) continue;
        const dataStr = dataLine.slice('data:'.length).trimStart();
        if (dataStr === '[DONE]') continue;
        try {
          yield JSON.parse(dataStr);
        } catch (e) {
          // Surface a parse failure to the log (the consumer still renders what
          // it has) instead of dropping the frame silently.
          console.error('Failed to parse SSE frame', dataStr, e);
        }
      }
    }
  } finally {
    // Abort the stream (and release the lock) whether the consumer finished,
    // broke early, or threw — otherwise the fetch body keeps downloading.
    try {
      await reader.cancel();
    } catch {
      // Already closed/canceled — nothing to do.
    }
  }
}

export async function sendFeedback(payload: FeedbackRequest): Promise<{status: string, feedback_id: string}> {
  eventBus.emit(`正在提交反馈：${payload.trace_id}`, 'info');
  const result = await fetchWithHandlers('/v1/rag/feedback', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  eventBus.emit(`反馈已提交`, 'success');
  return result;
}

export async function listDocuments(kbId: string): Promise<DocumentSummary[]> {
  const params = scopedParams(kbId);
  return await fetchWithHandlers(`/v1/rag/documents?${params.toString()}`, { headers: getHeaders() });
}

export async function getDocumentTree(docId: string, kbId: string): Promise<StructuredDocument> {
  const params = scopedParams(kbId);
  return await fetchWithHandlers(`/v1/rag/documents/${docId}/tree?${params.toString()}`, { headers: getHeaders() });
}

export async function health(): Promise<HealthSummary> {
  return await fetchWithHandlers('/health', { headers: getHeaders() });
}

export async function healthDetail(refresh = false): Promise<HealthDetail> {
  const suffix = refresh ? '?refresh=true' : '';
  return await fetchWithHandlers(`/health/detail${suffix}`, { headers: getHeaders() });
}

export async function listKnowledgeBases(): Promise<KnowledgeBaseSummary[]> {
  return await fetchWithHandlers('/v1/rag/knowledge-bases', { headers: getHeaders() });
}

export async function createKnowledgeBase(payload: KnowledgeBaseCreateRequest): Promise<KnowledgeBaseSummary> {
  return await fetchWithHandlers('/v1/rag/knowledge-bases', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ source: 'local', metadata: {}, ...payload }),
  });
}

export async function listIngestSources(): Promise<IngestSourceSummary[]> {
  return await fetchWithHandlers('/v1/rag/ingest/sources', { headers: getHeaders() });
}

export async function ingestPath(path: string, kbId: string, signal?: AbortSignal): Promise<IngestResponse> {
  eventBus.emit(`正在从路径注入：${path}`, 'info');
  const result = await fetchWithHandlers('/v1/rag/ingest', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ path, kb_id: kbId }),
    signal,
  });
  eventBus.emit(`路径注入任务已提交：${result.job_id}`, 'info');
  return await waitForIngestJob(result.job_id, signal);
}

export async function getIngestJob(jobId: string, signal?: AbortSignal): Promise<IngestJobResponse> {
  return await fetchWithHandlers(`/v1/rag/ingest/jobs/${jobId}`, { headers: getHeaders(), signal });
}

async function waitForIngestJob(jobId?: string | null, signal?: AbortSignal): Promise<IngestJobResponse> {
  if (!jobId) throw new Error('后端没有返回注入任务 ID。');
  for (let attempt = 0; attempt < 300; attempt += 1) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const job = await getIngestJob(jobId, signal);
    if (job.status === 'completed') {
      eventBus.emit(`注入完成：${job.documents} 个文档，${job.chunks} 个节点`, 'success');
      return job;
    }
    if (job.status === 'failed') {
      throw new Error(job.error || '注入任务失败。');
    }
    await sleep(1200, signal);
  }
  throw new Error(`注入任务超时：${jobId}`);
}

export async function retrieveDebug(payload: ChatRequest): Promise<RetrievalDebugResponse> {
  return await fetchWithHandlers('/retrieve/debug', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function listTraces(kbId?: string, page = 1, pageSize = 20): Promise<PaginatedResponse<TraceSummary>> {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (kbId) params.set('kb_id', kbId);
  return await fetchWithHandlers(`/traces?${params.toString()}`, { headers: getHeaders() });
}

export async function getTrace(traceId: string, kbId?: string): Promise<TraceRecord> {
  const params = new URLSearchParams();
  if (kbId) params.set('kb_id', kbId);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return await fetchWithHandlers(`/traces/${traceId}${suffix}`, { headers: getHeaders() });
}

export async function replayTrace(traceId: string): Promise<any> {
  return await fetchWithHandlers(`/replay/${traceId}`, { method: 'POST', headers: getHeaders() });
}

export async function storageDebug(): Promise<any> {
  return await fetchWithHandlers('/debug/storage', { headers: getHeaders() });
}

export async function listEvalDatasets(): Promise<any[]> {
  return await fetchWithHandlers('/eval/datasets', { headers: getHeaders() });
}

export async function listEvalReports(): Promise<any[]> {
  return await fetchWithHandlers('/eval/reports', { headers: getHeaders() });
}

export async function listBenchmarkReports(): Promise<any[]> {
  return await fetchWithHandlers('/benchmark/reports', { headers: getHeaders() });
}

export async function getEvalReportDetail(path: string): Promise<any> {
  return await fetchWithHandlers(`/eval/reports/detail?${new URLSearchParams({ path }).toString()}`, { headers: getHeaders() });
}

export async function getBenchmarkReportDetail(path: string): Promise<any> {
  return await fetchWithHandlers(`/benchmark/reports/detail?${new URLSearchParams({ path }).toString()}`, { headers: getHeaders() });
}

export async function runEval(datasetPath: string, outputPath?: string, useRagasLib = false): Promise<RunReportResponse> {
  return await fetchWithHandlers('/eval/run', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ dataset_path: datasetPath, output_path: outputPath ? outputPath : null, use_ragas_lib: useRagasLib }),
  });
}

export async function runBenchmark(datasetPath: string, outputPath?: string, useRagasLib = false): Promise<RunReportResponse> {
  return await fetchWithHandlers('/v1/rag/benchmark/run', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ dataset_path: datasetPath, output_path: outputPath ? outputPath : null, use_ragas_lib: useRagasLib }),
  });
}

export async function diagnoseTrace(traceId: string, includeAi = false): Promise<DiagnosisResponse> {
  return await fetchWithHandlers('/diagnose/trace', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ trace_id: traceId, include_ai: includeAi }),
  });
}

export async function diagnoseEval(reportPath: string, resultIndex: number, includeAi = false): Promise<DiagnosisResponse> {
  return await fetchWithHandlers('/diagnose/eval', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ report_path: reportPath, result_index: resultIndex, include_ai: includeAi }),
  });
}

export async function diagnoseAuto(includeAi = false): Promise<DiagnosisResponse> {
  return await fetchWithHandlers('/diagnose/auto', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ include_ai: includeAi }),
  });
}
