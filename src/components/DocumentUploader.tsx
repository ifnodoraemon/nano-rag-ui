import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, FileText, Loader2, Upload, XCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { HealthDetail, IngestSourceSummary, ingestPath, ingestUpload, listIngestSources } from '../lib/api';
import { cn } from '../lib/utils';
import { useRagSettings } from '../lib/settings-store';

interface DocumentUploaderProps {
  health: HealthDetail | null;
  onProcessingComplete: () => void;
}

const parserBackedExtensions = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.webp']);

export const DocumentUploader: React.FC<DocumentUploaderProps> = ({ health, onProcessingComplete }) => {
  const [settings] = useRagSettings();
  const [isUploading, setIsUploading] = useState(false);
  const [sources, setSources] = useState<IngestSourceSummary[]>([]);
  const [selectedSourcePath, setSelectedSourcePath] = useState('');
  const [filesStatus, setFilesStatus] = useState<{ name: string; status: 'processing' | 'done' | 'error'; detail?: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadSources = async () => {
    const nextSources = await listIngestSources();
    setSources(nextSources);
  };

  useEffect(() => {
    loadSources();
  }, []);

  const processFiles = async (files: File[]) => {
    if (!files.length) return;
    if (!settings.kbId) return;
    const embeddingError = ingestReadinessError(health);
    if (embeddingError) {
      setFilesStatus((prev) => [...prev, ...files.map((file) => ({ name: file.name, status: 'error' as const, detail: embeddingError }))]);
      return;
    }
    const parser = health?.providers?.document_parser;
    const needsParser = files.some((file) => parserBackedExtensions.has(extensionOf(file.name)));
    if (needsParser && parser?.enabled && parser.configured === false) {
      const detail = '文档解析器未就绪，后端启动日志和健康检查已记录原因。';
      setFilesStatus((prev) => [...prev, ...files.map((file) => ({ name: file.name, status: 'error' as const, detail }))]);
      return;
    }
    setFilesStatus((prev) => [...prev, ...files.map((file) => ({ name: file.name, status: 'processing' as const }))]);
    setIsUploading(true);

    try {
      const result = await ingestUpload(files, settings.kbId);
      setFilesStatus((prev) => prev.map((item) => (
        files.some((file) => file.name === item.name)
          ? { ...item, status: 'done', detail: `${result.documents} docs / ${result.chunks} chunks` }
          : item
      )));
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setFilesStatus((prev) => prev.map((item) => (
        files.some((file) => file.name === item.name)
          ? { ...item, status: 'error', detail }
          : item
      )));
    } finally {
      setIsUploading(false);
      onProcessingComplete();
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const processPath = async () => {
    const path = selectedSourcePath;
    if (!path || isUploading || !settings.kbId) return;
    const embeddingError = ingestReadinessError(health);
    if (embeddingError) {
      setFilesStatus((prev) => [...prev, { name: path, status: 'error', detail: embeddingError }]);
      return;
    }
    setFilesStatus((prev) => [...prev, { name: path, status: 'processing' }]);
    setIsUploading(true);
    try {
      const result = await ingestPath(path, settings.kbId);
      setFilesStatus((prev) => prev.map((item) => (
        item.name === path ? { ...item, status: 'done', detail: `${result.documents} 个文档 / ${result.chunks} 个分块` } : item
      )));
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setFilesStatus((prev) => prev.map((item) => (
        item.name === path ? { ...item, status: 'error', detail } : item
      )));
    } finally {
      setIsUploading(false);
      onProcessingComplete();
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-slate-950">文档注入</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">把文件写入当前知识范围，后端会生成解析产物、分块并写入向量索引。</p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 text-sm font-semibold text-slate-900">服务器文件注入</div>
        <div className="flex gap-2">
          <select
            value={selectedSourcePath}
            onChange={(event) => setSelectedSourcePath(event.target.value)}
            className="control font-mono"
            disabled={sources.length === 0 || !settings.kbId}
          >
            <option value="">请选择服务器文件</option>
            {sources.map((source) => (
              <option key={source.path} value={source.path}>
                {source.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={processPath} disabled={!settings.kbId || !selectedSourcePath || isUploading} className="btn-primary shrink-0">
            注入
          </button>
        </div>
        {sources.length === 0 && (
          <p className="mt-2 text-xs text-slate-500">后端当前没有返回可注入文件。</p>
        )}
      </section>

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={!settings.kbId || isUploading}
        className={cn(
          'flex w-full flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center transition-colors',
          isUploading ? 'cursor-wait opacity-70' : 'hover:border-slate-500 hover:bg-white',
        )}
      >
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept=".pdf,.md,.txt,.html,.png,.jpg,.jpeg,.webp,.mp3,.wav,.mp4,.mov"
          multiple
          onChange={(event) => processFiles(Array.from(event.target.files || []))}
        />
        <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600">
          {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
        </div>
        <div className="mt-4 text-sm font-medium text-slate-950">{isUploading ? '正在索引文件...' : '选择要上传的文件'}</div>
        <div className="mt-1 text-xs text-slate-500">支持 PDF、Markdown、文本、HTML、图像、音频和视频</div>
      </button>
      {ingestReadinessError(health) && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
          当前不能注入：{ingestReadinessError(health)}
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <ScopeValue label="kb_id" value={settings.kbId || '未选择'} />
          <ScopeValue label="知识库" value={settings.kbName || settings.kbId || '未选择'} />
        </div>
      </div>

      <AnimatePresence>
        {filesStatus.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-lg border border-slate-200 bg-white"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
              <span className="text-xs font-semibold tracking-wide text-slate-500">最近注入</span>
              <button type="button" onClick={() => setFilesStatus([])} className="text-xs font-medium text-slate-500 hover:text-slate-950">清空</button>
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
              {filesStatus.map((file, index) => (
                <div key={`${file.name}-${index}`} className="flex items-start gap-3 px-3 py-3">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-800">{file.name}</div>
                    {file.detail && <div className="mt-0.5 truncate text-xs text-slate-500">{file.detail}</div>}
                  </div>
                  {file.status === 'processing' && <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-slate-400" />}
                  {file.status === 'done' && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />}
                  {file.status === 'error' && <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ScopeValue = ({ label, value }: { label: string; value: string }) => (
  <div>
    <div className="text-slate-500">{label}</div>
    <div className="mt-1 truncate font-mono font-medium text-slate-900">{value}</div>
  </div>
);

const extensionOf = (name: string) => {
  const index = name.lastIndexOf('.');
  return index >= 0 ? name.slice(index).toLowerCase() : '';
};

const ingestReadinessError = (health: HealthDetail | null) => {
  if (!health) return '系统健康状态未加载。';
  const embedding = health.gateway?.capabilities?.embedding;
  if (!embedding?.reachable) {
    return '后端健康检查显示 embedding provider 不可用。';
  }
  return null;
};
