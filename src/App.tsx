import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Database, FileUp, Github, Library, MessageSquareText, Settings as SettingsIcon, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { DocumentUploader } from './components/DocumentUploader';
import { ChatInterface } from './components/ChatInterface';
import { KnowledgeExplorer } from './components/KnowledgeExplorer';
import { Settings } from './components/Settings';
import { SystemLog } from './components/SystemLog';
import { OperationsConsole } from './components/OperationsConsole';
import { cn } from './lib/utils';
import { HealthDetail, KnowledgeBaseSummary, createKnowledgeBase, health as healthSummary, healthDetail, listDocuments, listKnowledgeBases } from './lib/api';
import { settingsForKnowledgeBase, useRagSettings } from './lib/settings-store';

type ActiveTab = 'upload' | 'explorer' | 'operations' | 'settings';

export default function App() {
  const [settings, setSettings] = useRagSettings();
  const [activeTab, setActiveTab] = useState<ActiveTab>('upload');
  const [health, setHealth] = useState<HealthDetail | null>(null);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseSummary[]>([]);
  const [docStats, setDocStats] = useState({ documents: 0, chunks: 0 });
  const [newKbId, setNewKbId] = useState('');
  const [newKbName, setNewKbName] = useState('');
  const [isCreatingKb, setIsCreatingKb] = useState(false);

  const activeKnowledgeBase = useMemo(() => {
    return knowledgeBases.find((item) => item.kb_id === settings.kbId);
  }, [settings.kbId, knowledgeBases]);

  const scopeLabel = activeKnowledgeBase?.name || settings.kbName || settings.kbId;

  const refreshStatus = useCallback(async (mode: 'summary' | 'detail' = 'detail', forceDetailRefresh = false) => {
    const [healthResult, knowledgeBasesResult] = await Promise.allSettled([
      mode === 'detail' ? healthDetail(forceDetailRefresh) : healthSummary(),
      listKnowledgeBases(),
    ]);
    if (healthResult.status === 'fulfilled') {
      if (mode === 'detail') {
        setHealth(healthResult.value as HealthDetail);
      } else {
        setHealth((prev) => ({ ...(prev ?? {}), ...healthResult.value }));
      }
    }
    if (knowledgeBasesResult.status === 'fulfilled') {
      const nextKnowledgeBases = knowledgeBasesResult.value;
      setKnowledgeBases(nextKnowledgeBases);
      const activeKb = nextKnowledgeBases.find((item) => item.kb_id === settings.kbId) || nextKnowledgeBases[0];
      if (!settings.kbId && activeKb) {
        setSettings(settingsForKnowledgeBase(settings, activeKb));
      }
    }
    const activeKbId = knowledgeBasesResult.status === 'fulfilled'
      ? (knowledgeBasesResult.value.find((item) => item.kb_id === settings.kbId) || knowledgeBasesResult.value[0])?.kb_id
      : settings.kbId;
    if (activeKbId) {
      try {
        const docs = await listDocuments(activeKbId);
        setDocStats({
          documents: docs.length,
          chunks: docs.reduce((sum, doc) => sum + doc.chunk_count, 0),
        });
      } catch {
        setDocStats({ documents: 0, chunks: 0 });
      }
    } else {
      setDocStats({ documents: 0, chunks: 0 });
    }
  }, [setSettings, settings.kbId, settings.kbName, settings.sessionId, settings.topK]);

  useEffect(() => {
    refreshStatus('detail');
    const intervalId = window.setInterval(() => refreshStatus('summary'), 30000);
    return () => window.clearInterval(intervalId);
  }, [refreshStatus]);

  const createKb = async () => {
    const kbId = newKbId.trim();
    const name = newKbName.trim() || kbId;
    if (!kbId || isCreatingKb) return;
    setIsCreatingKb(true);
    try {
      const created = await createKnowledgeBase({ kb_id: kbId, name });
      setKnowledgeBases((prev) => [...prev.filter((item) => item.kb_id !== created.kb_id), created]);
      setSettings(settingsForKnowledgeBase(settings, created));
      setNewKbId('');
      setNewKbName('');
      await refreshStatus('detail', true);
    } finally {
      setIsCreatingKb(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex h-screen min-h-[720px] overflow-hidden">
        <aside className="hidden w-[288px] shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
          <div className="border-b border-slate-200 px-5 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-950 text-white">
                <Library className="h-4 w-4" />
              </div>
              <div>
                <h1 className="text-base font-semibold tracking-tight">Nano RAG</h1>
                <p className="text-xs text-slate-500">证据优先的知识问答工作台</p>
              </div>
            </div>
          </div>

          <nav className="space-y-1 px-3 py-4">
            <NavButton icon={FileUp} active={activeTab === 'upload'} onClick={() => setActiveTab('upload')}>
              文档注入
            </NavButton>
            <NavButton icon={Database} active={activeTab === 'explorer'} onClick={() => setActiveTab('explorer')}>
              知识库
            </NavButton>
            <NavButton icon={SlidersHorizontal} active={activeTab === 'operations'} onClick={() => setActiveTab('operations')}>
              运维评测
            </NavButton>
            <NavButton icon={SettingsIcon} active={activeTab === 'settings'} onClick={() => setActiveTab('settings')}>
              设置
            </NavButton>
          </nav>

          <div className="mt-auto border-t border-slate-200 p-4">
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <StatusRow label="模型模式" value={health?.gateway_mode} tone={health?.gateway_mode === 'live' ? 'good' : 'muted'} />
              <StatusRow label="向量库" value={health?.vectorstore_backend} tone={health?.vectorstore?.status === 'ok' ? 'good' : 'muted'} />
              <StatusRow label="鉴权" value={formatAuthStatus(health?.auth_status)} tone={health?.auth_enabled ? 'good' : 'muted'} />
            </div>
            <a
              href="https://github.com/ifnodoraemon/nano-rag"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex items-center gap-2 text-xs text-slate-500 transition-colors hover:text-slate-900"
            >
              <Github className="h-3.5 w-3.5" />
              项目仓库
            </a>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:px-6">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>当前知识库</span>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-slate-700">{scopeLabel || '未选择'}</span>
                  {health?.auth_enabled === false && (
                    <span className="rounded-md bg-amber-50 px-2 py-0.5 text-amber-700">本地鉴权关闭</span>
                  )}
                </div>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">RAG 运营台</h2>
              </div>
              <div className="min-w-[220px]">
                <label className="text-xs text-slate-500">知识库</label>
                <select
                  value={settings.kbId}
                  onChange={(event) => {
                    const kb = knowledgeBases.find((item) => item.kb_id === event.target.value);
                    if (kb) setSettings(settingsForKnowledgeBase(settings, kb));
                  }}
                  disabled={knowledgeBases.length === 0}
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition-colors focus:border-slate-950"
                >
                  <option value="">请选择知识库</option>
                  {knowledgeBases.map((kb) => (
                    <option key={kb.kb_id} value={kb.kb_id}>{kb.name}</option>
                  ))}
                </select>
                <div className="mt-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
                  <input value={newKbId} onChange={(event) => setNewKbId(event.target.value)} placeholder="kb_id" className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs outline-none focus:border-slate-950" />
                  <input value={newKbName} onChange={(event) => setNewKbName(event.target.value)} placeholder="名称" className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs outline-none focus:border-slate-950" />
                  <button type="button" onClick={createKb} disabled={!newKbId.trim() || isCreatingKb} className="rounded-md bg-slate-950 px-3 text-xs font-medium text-white disabled:bg-slate-200 disabled:text-slate-400">新建</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Metric icon={Database} label="文档" value={String(docStats.documents)} />
                <Metric icon={Activity} label="分块" value={String(docStats.chunks)} />
                <Metric icon={MessageSquareText} label="追踪" value={String(health?.trace_count ?? 0)} />
                <Metric icon={ShieldCheck} label="模式" value={health?.gateway_mode} />
              </div>
            </div>
          </header>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 xl:grid-cols-[420px_minmax(0,1fr)]">
            <section className="min-h-0 border-r border-slate-200 bg-white">
              <div className="flex items-center gap-1 border-b border-slate-200 px-3 py-2 lg:hidden">
                <NavButton compact icon={FileUp} active={activeTab === 'upload'} onClick={() => setActiveTab('upload')}>注入</NavButton>
                <NavButton compact icon={Database} active={activeTab === 'explorer'} onClick={() => setActiveTab('explorer')}>知识库</NavButton>
                <NavButton compact icon={SlidersHorizontal} active={activeTab === 'operations'} onClick={() => setActiveTab('operations')}>运维</NavButton>
                <NavButton compact icon={SettingsIcon} active={activeTab === 'settings'} onClick={() => setActiveTab('settings')}>设置</NavButton>
              </div>
              <div className="h-full overflow-y-auto p-4 md:p-5">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.16 }}
                  >
                    {activeTab === 'upload' && <DocumentUploader health={health} onProcessingComplete={() => refreshStatus('detail', true)} />}
                    {activeTab === 'explorer' && <KnowledgeExplorer />}
                    {activeTab === 'operations' && <OperationsConsole health={health} onRefresh={() => refreshStatus('detail', true)} />}
                    {activeTab === 'settings' && <Settings />}
                  </motion.div>
                </AnimatePresence>
                <div className="mt-5">
                  <SystemLog />
                </div>
              </div>
            </section>

            <section className="min-h-0 bg-slate-100">
              <ChatInterface />
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

const NavButton = ({
  active,
  children,
  compact = false,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  compact?: boolean;
  icon: React.ElementType;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={cn(
      'flex items-center gap-2 rounded-md text-sm font-medium transition-colors',
      compact ? 'flex-1 justify-center px-3 py-2' : 'w-full px-3 py-2.5',
      active ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
    )}
  >
    <Icon className="h-4 w-4" />
    <span>{children}</span>
  </button>
);

const Metric = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string }) => (
  <div className="min-w-[116px] rounded-md border border-slate-200 bg-white px-3 py-2">
    <div className="flex items-center gap-2 text-xs text-slate-500">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </div>
    <div className="mt-1 truncate font-mono text-sm font-semibold text-slate-950">{value}</div>
  </div>
);

const StatusRow = ({ label, value, tone }: { label: string; value?: string; tone: 'good' | 'muted' }) => (
  <div className="flex items-center justify-between gap-3 text-xs">
    <span className="text-slate-500">{label}</span>
    <span className={cn('truncate font-medium', tone === 'good' && 'text-emerald-700', tone === 'muted' && 'text-slate-700')}>
      {value}
    </span>
  </div>
);

const formatAuthStatus = (status?: string) => {
  if (status === 'disabled') return '已关闭';
  if (status === 'configured') return '已配置';
  if (status === 'missing_keys') return '等待 API Key 或代理配置';
  return status;
};
