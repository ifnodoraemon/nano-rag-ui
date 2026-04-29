import React, { useEffect, useState } from 'react';
import { Activity, Bug, Database, FileSearch, Loader2, Play, RefreshCw, RotateCcw } from 'lucide-react';
import {
  DiagnosisResponse,
  HealthDetail,
  TraceRecord,
  TraceSummary,
  diagnoseAuto,
  diagnoseEval,
  diagnoseTrace,
  getBenchmarkReportDetail,
  getEvalReportDetail,
  getTrace,
  listBenchmarkReports,
  listEvalDatasets,
  listEvalReports,
  listTraces,
  replayTrace,
  retrieveDebug,
  runBenchmark,
  runEval,
  storageDebug,
} from '../lib/api';
import { cn } from '../lib/utils';
import { useRagSettings } from '../lib/settings-store';

type OpsTab = 'overview' | 'retrieve' | 'traces' | 'eval' | 'diagnosis';

interface OperationsConsoleProps {
  health: HealthDetail | null;
  onRefresh: () => void;
}

export const OperationsConsole: React.FC<OperationsConsoleProps> = ({ health, onRefresh }) => {
  const [settings] = useRagSettings();
  const [tab, setTab] = useState<OpsTab>('overview');

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">运维与评测</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">覆盖后端调试、追踪、评测、基准和诊断接口。</p>
        </div>
        <button type="button" onClick={onRefresh} className="btn-secondary">
          <RefreshCw className="h-3.5 w-3.5" />
          刷新
        </button>
      </div>

      <div className="grid grid-cols-5 gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
        <TabButton active={tab === 'overview'} onClick={() => setTab('overview')}>概览</TabButton>
        <TabButton active={tab === 'retrieve'} onClick={() => setTab('retrieve')}>检索</TabButton>
        <TabButton active={tab === 'traces'} onClick={() => setTab('traces')}>追踪</TabButton>
        <TabButton active={tab === 'eval'} onClick={() => setTab('eval')}>评测</TabButton>
        <TabButton active={tab === 'diagnosis'} onClick={() => setTab('diagnosis')}>诊断</TabButton>
      </div>

      {tab === 'overview' && <OverviewPanel health={health} />}
      {tab === 'retrieve' && <RetrievePanel kbId={settings.kbId} topK={settings.topK} />}
      {tab === 'traces' && <TracePanel kbId={settings.kbId} />}
      {tab === 'eval' && <EvalPanel enabled={health?.features?.eval !== false} benchmarkEnabled={health?.features?.benchmark !== false} />}
      {tab === 'diagnosis' && <DiagnosisPanel enabled={health?.features?.diagnosis !== false} />}
    </div>
  );
};

const OverviewPanel = ({ health }: { health: HealthDetail | null }) => {
  const [storage, setStorage] = useState<any>(null);

  const loadStorage = async () => {
    setStorage(await storageDebug());
  };

  useEffect(() => {
    loadStorage();
  }, []);

  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Activity className="h-4 w-4 text-slate-500" />
          运行状态
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <KeyValue label="服务" value={health?.service} />
          <KeyValue label="模型模式" value={health?.gateway_mode} />
          <KeyValue label="向量库" value={health?.vectorstore_backend} />
          <KeyValue label="追踪数量" value={String(health?.trace_count ?? 0)} />
          <KeyValue label="Langfuse UI" value={formatReachable(health?.langfuse?.ui_reachable)} />
          <KeyValue label="Trace 写入" value={formatReachable(health?.langfuse?.otel_reachable)} />
          <KeyValue label="文档解析" value={formatProvider(health?.providers?.document_parser)} />
          <KeyValue label="鉴权" value={formatAuth(health?.auth_status)} />
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Database className="h-4 w-4 text-slate-500" />
            存储调试
          </div>
          <button type="button" onClick={loadStorage} className="btn-secondary">刷新</button>
        </div>
        <JsonBlock data={storage} />
      </section>
    </div>
  );
};

const RetrievePanel = ({ kbId, topK }: { kbId: string; topK: number }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const run = async () => {
    if (!kbId) return;
    setLoading(true);
    try {
      setResult(await retrieveDebug({ query, kb_id: kbId, top_k: topK }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
        <FileSearch className="h-4 w-4 text-slate-500" />
        检索调试
      </div>
      <div className="space-y-3">
        <input value={query} onChange={(event) => setQuery(event.target.value)} className="control" placeholder="输入检索问题" />
        <button type="button" onClick={run} disabled={!kbId || !query.trim() || loading} className="btn-primary">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          执行检索
        </button>
        <JsonBlock data={result} />
      </div>
    </section>
  );
};

const TracePanel = ({ kbId }: { kbId: string }) => {
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [selected, setSelected] = useState<TraceRecord | null>(null);
  const [replay, setReplay] = useState<any>(null);

  const load = async () => {
    if (!kbId) {
      setTraces([]);
      setSelected(null);
      setReplay(null);
      return;
    }
    const response = await listTraces(kbId, 1, 20);
    setTraces(response.items);
  };

  useEffect(() => {
    load();
  }, [kbId]);

  const openTrace = async (traceId: string) => {
    setSelected(await getTrace(traceId, kbId));
    setReplay(null);
  };

  const runReplay = async () => {
    if (!selected?.trace_id) return;
    setReplay(await replayTrace(selected.trace_id));
  };

  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
          <div className="text-sm font-semibold text-slate-900">追踪列表</div>
          <button type="button" onClick={load} disabled={!kbId} className="btn-secondary">刷新</button>
        </div>
        <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
          {traces.map((trace) => (
            <button key={trace.trace_id} type="button" onClick={() => openTrace(trace.trace_id)} className="block w-full px-3 py-3 text-left hover:bg-slate-50">
              <div className="truncate font-mono text-xs text-slate-900">{trace.trace_id}</div>
              <div className="mt-1 truncate text-xs text-slate-500">{trace.query}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-slate-900">追踪详情</div>
          <button type="button" onClick={runReplay} disabled={!selected || !kbId} className="btn-secondary">
            <RotateCcw className="h-3.5 w-3.5" />
            重放
          </button>
        </div>
        <JsonBlock data={selected} />
        {replay && <div className="mt-3"><JsonBlock data={replay} /></div>}
      </section>
    </div>
  );
};

const EvalPanel = ({ benchmarkEnabled, enabled }: { enabled: boolean; benchmarkEnabled: boolean }) => {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [evalReports, setEvalReports] = useState<any[]>([]);
  const [benchmarkReports, setBenchmarkReports] = useState<any[]>([]);
  const [datasetPath, setDatasetPath] = useState('');
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [runResult, setRunResult] = useState<any>(null);

  const load = async () => {
    const [nextDatasets, nextEvalReports, nextBenchmarkReports] = await Promise.all([
      listEvalDatasets(),
      listEvalReports(),
      listBenchmarkReports(),
    ]);
    setDatasets(nextDatasets);
    setEvalReports(nextEvalReports);
    setBenchmarkReports(nextBenchmarkReports);
  };

  useEffect(() => {
    load();
  }, []);

  const runSelectedEval = async () => {
    setRunResult(await runEval(datasetPath));
    await load();
  };

  const runSelectedBenchmark = async () => {
    setRunResult(await runBenchmark(datasetPath));
    await load();
  };

  const openReport = async (path: string, type: 'eval' | 'benchmark') => {
    setSelectedReport(type === 'eval' ? await getEvalReportDetail(path) : await getBenchmarkReportDetail(path));
  };

  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 text-sm font-semibold text-slate-900">评测运行</div>
        <div className="space-y-3">
          <select value={datasetPath} onChange={(event) => setDatasetPath(event.target.value)} className="control">
            <option value="">请选择评测数据集</option>
            {datasets.map((dataset) => <option key={dataset.path} value={dataset.path}>{dataset.path}</option>)}
          </select>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={runSelectedEval} disabled={!enabled || !datasetPath} className="btn-primary">运行评测</button>
            <button type="button" onClick={runSelectedBenchmark} disabled={!benchmarkEnabled || !datasetPath} className="btn-secondary">运行基准</button>
            <button type="button" onClick={load} className="btn-secondary">刷新报告</button>
          </div>
        </div>
      </section>

      <ReportList title="评测报告" reports={evalReports} onOpen={(path) => openReport(path, 'eval')} />
      <ReportList title="基准报告" reports={benchmarkReports} onOpen={(path) => openReport(path, 'benchmark')} />
      <JsonBlock data={runResult ? runResult : selectedReport} />
    </div>
  );
};

const DiagnosisPanel = ({ enabled }: { enabled: boolean }) => {
  const [settings] = useRagSettings();
  const [traceId, setTraceId] = useState('');
  const [reportPath, setReportPath] = useState('');
  const [resultIndex, setResultIndex] = useState(0);
  const [includeAi, setIncludeAi] = useState(false);
  const [result, setResult] = useState<DiagnosisResponse | null>(null);
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [reports, setReports] = useState<any[]>([]);

  const loadOptions = async () => {
    const [traceResponse, nextReports] = await Promise.all([
      settings.kbId
        ? listTraces(settings.kbId, 1, 50)
        : Promise.resolve({ items: [], total: 0, page: 1, page_size: 50, total_pages: 0 }),
      listEvalReports(),
    ]);
    setTraces(traceResponse.items);
    setReports(nextReports);
  };

  useEffect(() => {
    loadOptions();
  }, [settings.kbId]);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
        <Bug className="h-4 w-4 text-slate-500" />
        诊断
      </div>
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={includeAi} onChange={(event) => setIncludeAi(event.target.checked)} className="accent-slate-950" />
          包含 AI 建议
        </label>
        <select value={traceId} onChange={(event) => setTraceId(event.target.value)} className="control font-mono">
          <option value="">请选择追踪</option>
          {traces.map((trace) => (
            <option key={trace.trace_id} value={trace.trace_id}>
              {trace.trace_id}
            </option>
          ))}
        </select>
        <button type="button" onClick={async () => setResult(await diagnoseTrace(traceId, includeAi))} disabled={!enabled || !traceId.trim()} className="btn-primary">诊断追踪</button>
        <div className="grid grid-cols-[1fr_88px] gap-2">
          <select value={reportPath} onChange={(event) => setReportPath(event.target.value)} className="control font-mono">
            <option value="">请选择评测报告</option>
            {reports.map((report) => (
              <option key={report.path} value={report.path}>
                {report.path}
              </option>
            ))}
          </select>
          <input type="number" min="0" value={resultIndex} onChange={(event) => setResultIndex(Number(event.target.value))} className="control font-mono" />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={async () => setResult(await diagnoseEval(reportPath, resultIndex, includeAi))} disabled={!enabled || !reportPath.trim()} className="btn-secondary">诊断评测样本</button>
          <button type="button" onClick={async () => setResult(await diagnoseAuto(includeAi))} disabled={!enabled} className="btn-secondary">自动诊断</button>
          <button type="button" onClick={loadOptions} className="btn-secondary">刷新选项</button>
        </div>
        <JsonBlock data={result} />
      </div>
    </section>
  );
};

const ReportList = ({ onOpen, reports, title }: { title: string; reports: any[]; onOpen: (path: string) => void }) => (
  <section className="rounded-lg border border-slate-200 bg-white">
    <div className="border-b border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900">{title}</div>
    <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
      {reports.map((report) => (
        <button key={report.path} type="button" onClick={() => onOpen(String(report.path))} className="block w-full px-3 py-2 text-left hover:bg-slate-50">
          <div className="truncate font-mono text-xs text-slate-900">{report.path}</div>
          {report.updated_at && <div className="mt-1 text-xs text-slate-500">{new Date(Number(report.updated_at) * 1000).toLocaleString()}</div>}
        </button>
      ))}
      {reports.length === 0 && <div className="px-3 py-6 text-center text-sm text-slate-500">暂无报告</div>}
    </div>
  </section>
);

const TabButton = ({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) => (
  <button type="button" onClick={onClick} className={cn('rounded-md px-2 py-2 text-xs font-medium transition-colors', active ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-950')}>
    {children}
  </button>
);

const KeyValue = ({ label, value }: { label: string; value?: string }) => (
  <div className="rounded-md bg-slate-50 p-3">
    <div className="text-xs text-slate-500">{label}</div>
    <div className="mt-1 truncate font-mono text-sm font-medium text-slate-900">{value}</div>
  </div>
);

const JsonBlock = ({ data }: { data: any }) => (
  <pre className="max-h-96 overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-3 text-xs leading-5 text-slate-100">
    {data ? JSON.stringify(data, null, 2) : '暂无数据'}
  </pre>
);

const formatAuth = (status?: string) => {
  if (status === 'disabled') return '已关闭';
  if (status === 'configured') return '已配置';
  if (status === 'missing_keys') return '等待 API Key 或代理配置';
  return status;
};

const formatProvider = (provider?: { enabled?: boolean; configured?: boolean; provider?: string }) => {
  if (!provider?.enabled) return '未启用';
  if (!provider.configured) return `${provider.provider || 'provider'} 未配置`;
  return `${provider.provider || 'provider'} 已配置`;
};

const formatReachable = (reachable?: boolean) => {
  if (reachable === true) return '可用';
  if (reachable === false) return '不可用';
  return '未知';
};
