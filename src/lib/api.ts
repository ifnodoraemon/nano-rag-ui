import { eventBus } from './event-bus';

export interface ChatRequest { query: string; kb_id?: string; tenant_id?: string | null; session_id?: string; top_k?: number; metadata_filters?: any; }
export interface Citation { citation_label?: string; chunk_id: string; source: string; score?: number; evidence_role?: string; span_text?: string; span_start?: number; span_end?: number; modality?: string; media_uri?: string; }
export interface ChatResponse { answer: string; citations: Citation[]; contexts: any[]; trace_id: string; kb_id: string | null; tenant_id: string | null; session_id: string | null; }
export interface IngestResponse { status: string; kb_id: string; tenant_id: string | null; documents: number; chunks: number; source: string; uploaded_files: string[]; }
export interface FeedbackRequest { trace_id: string; rating: "up"|"down"; kb_id?: string; tenant_id?: string | null; session_id?: string; comment?: string; tags?: string[]; }
export interface DocumentSummary { doc_id: string; title: string; source_path: string; kb_id: string; tenant_id: string | null; chunk_count: number; updated_at: number; doc_type?: string; source_key?: string; }
export interface WorkspaceSummary { workspace_id: string; name: string; kb_id: string; tenant_id: string | null; document_count: number; chunk_count: number; trace_count: number; updated_at?: number | null; }
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
  features?: Record<string, boolean>;
  trace_count?: number;
}
export interface PaginatedResponse<T> { items: T[]; total: number; page: number; page_size: number; total_pages: number; }
export interface TraceSummary {
  trace_id: string;
  latency_seconds?: number | null;
  query?: string | null;
  kb_id?: string | null;
  tenant_id?: string | null;
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

function scopedParams(kbId: string, tenantId?: string | null) {
  const params = new URLSearchParams({ kb_id: kbId });
  if (tenantId?.trim()) {
    params.set('tenant_id', tenantId.trim());
  }
  return params;
}

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
        errorMessage = '账号会话无权访问该接口。';
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
    eventBus.emit(`接口请求失败 [${options?.method ?? 'GET'} ${url}]: ${errObj.message}`, 'error');
    throw errObj;
  }
}

export async function ingestUpload(files: File[], kbId: string, tenantId?: string | null): Promise<IngestResponse> {
  const fd = new FormData();
  files.forEach(f => fd.append("files", f));
  fd.append("kb_id", kbId);
  if (tenantId?.trim()) {
    fd.append("tenant_id", tenantId.trim());
  }
  eventBus.emit(`正在上传 ${files.length} 个文件到知识库 ${kbId}${tenantId ? ` / 租户 ${tenantId}` : ''}`, 'info');
  const result = await fetchWithHandlers('/v1/rag/ingest/upload', {
    method: 'POST',
    headers: getHeaders(true),
    body: fd,
  });
  eventBus.emit(`注入完成：${result.documents} 个文档，${result.chunks} 个分块`, 'success');
  return result;
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

export async function listDocuments(kbId: string, tenantId?: string | null): Promise<DocumentSummary[]> {
  const params = scopedParams(kbId, tenantId);
  return await fetchWithHandlers(`/v1/rag/documents?${params.toString()}`, { headers: getHeaders() });
}

export async function getParsedDoc(docId: string): Promise<{document: any, chunks: any[]}> {
  return await fetchWithHandlers(`/debug/parsed/${docId}`, { headers: getHeaders() });
}

export async function health(): Promise<HealthSummary> {
  return await fetchWithHandlers('/health', { headers: getHeaders() });
}

export async function healthDetail(): Promise<HealthDetail> {
  return await fetchWithHandlers('/health/detail', { headers: getHeaders() });
}

export async function listWorkspaces(): Promise<WorkspaceSummary[]> {
  return await fetchWithHandlers('/v1/rag/workspaces', { headers: getHeaders() });
}

export async function listIngestSources(): Promise<IngestSourceSummary[]> {
  return await fetchWithHandlers('/v1/rag/ingest/sources', { headers: getHeaders() });
}

export async function ingestPath(path: string, kbId: string, tenantId?: string | null): Promise<IngestResponse> {
  eventBus.emit(`正在从路径注入：${path}`, 'info');
  const result = await fetchWithHandlers('/v1/rag/ingest', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ path, kb_id: kbId, tenant_id: tenantId ? tenantId : null }),
  });
  eventBus.emit(`路径注入完成：${result.documents} 个文档，${result.chunks} 个分块`, 'success');
  return result;
}

export async function retrieveDebug(payload: ChatRequest): Promise<RetrievalDebugResponse> {
  return await fetchWithHandlers('/retrieve/debug', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function listTraces(kbId?: string, tenantId?: string | null, page = 1, pageSize = 20): Promise<PaginatedResponse<TraceSummary>> {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (kbId) params.set('kb_id', kbId);
  if (tenantId?.trim()) params.set('tenant_id', tenantId.trim());
  return await fetchWithHandlers(`/traces?${params.toString()}`, { headers: getHeaders() });
}

export async function getTrace(traceId: string, kbId?: string, tenantId?: string | null): Promise<TraceRecord> {
  const params = new URLSearchParams();
  if (kbId) params.set('kb_id', kbId);
  if (tenantId?.trim()) params.set('tenant_id', tenantId.trim());
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
