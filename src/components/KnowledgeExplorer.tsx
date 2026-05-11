import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Database, FileText, Loader2, Search, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { DocumentNode, DocumentSummary, getDocumentTree, listDocuments } from '../lib/api';
import { useRagSettings } from '../lib/settings-store';

export const KnowledgeExplorer: React.FC = () => {
  const [settings] = useRagSettings();
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'sources' | 'nodes'>('sources');
  const [sources, setSources] = useState<DocumentSummary[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocumentSummary | null>(null);
  const [nodes, setNodes] = useState<DocumentNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadSources = async () => {
    if (!settings.kbId) {
      setSources([]);
      setSelectedDoc(null);
      setNodes([]);
      setViewMode('sources');
      return;
    }
    setIsLoading(true);
    try {
      const docs = await listDocuments(settings.kbId);
      setSources(docs);
    } catch (error) {
      console.error(error);
      setSources([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSources();
  }, [settings.kbId]);

  const loadNodes = async (source: DocumentSummary) => {
    if (!settings.kbId) return;
    setIsLoading(true);
    try {
      const data = await getDocumentTree(source.doc_id, settings.kbId);
      setSelectedDoc(source);
      setNodes(flattenNodes(data.root));
      setViewMode('nodes');
    } catch (error) {
      console.error(error);
      setNodes([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredSources = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return sources.filter((source) => {
      return source.title.toLowerCase().includes(term) || source.source_path.toLowerCase().includes(term);
    });
  }, [sources, searchTerm]);

  const filteredNodes = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return nodes.filter((node) => {
      const text = `${node.title || ''} ${node.text || ''} ${node.node_id}`.toLowerCase();
      return text.includes(term);
    }).slice(0, 120);
  }, [nodes, searchTerm]);

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-950">{viewMode === 'sources' ? '知识库' : '文档节点'}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              {viewMode === 'sources' ? '当前知识库内后端返回的文档。' : selectedDoc?.title}
            </p>
          </div>
          {viewMode === 'nodes' && (
            <button
              type="button"
              onClick={() => { setViewMode('sources'); setSelectedDoc(null); setNodes([]); }}
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-950"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              返回
            </button>
          )}
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder={viewMode === 'sources' ? '搜索文档...' : '搜索节点...'}
          className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-9 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-slate-950"
        />
        {searchTerm && (
          <button type="button" onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="min-h-[280px] space-y-2">
        {isLoading && (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white py-10 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            加载中
          </div>
        )}

        {!isLoading && viewMode === 'sources' && (
          <AnimatePresence mode="popLayout">
            {filteredSources.map((source) => (
              <motion.button
                key={source.doc_id}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                onClick={() => loadNodes(source)}
                className="block w-full rounded-lg border border-slate-200 bg-white p-3 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-900">{source.title}</div>
                    <div className="mt-1 truncate font-mono text-xs text-slate-500">{source.source_path}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="rounded bg-slate-100 px-2 py-0.5">{source.chunk_count} nodes</span>
                      {source.doc_type && <span className="rounded bg-slate-100 px-2 py-0.5">{source.doc_type}</span>}
                      {source.source_key && <span className="rounded bg-slate-100 px-2 py-0.5">{source.source_key}</span>}
                    </div>
                  </div>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        )}

        {!isLoading && viewMode === 'nodes' && (
          <AnimatePresence mode="popLayout">
            {filteredNodes.map((node) => (
              <motion.div
                key={node.node_id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="rounded-lg border border-slate-200 bg-white p-3"
              >
                <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                  <span className="truncate font-mono text-slate-500">{node.node_id}</span>
                  <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-slate-500">{node.node_type}</span>
                </div>
                {node.provenance?.hierarchy_path?.length ? (
                  <div className="mb-2 truncate text-xs text-slate-500">{node.provenance.hierarchy_path.join(' / ')}</div>
                ) : null}
                <p className="text-sm leading-6 text-slate-700">{node.text || node.title}</p>
              </motion.div>
            ))}
          </AnimatePresence>
        )}

        {!isLoading && viewMode === 'sources' && filteredSources.length === 0 && (
          <EmptyState icon={Database} title={settings.kbId ? '暂无文档' : '未选择知识库'} detail={settings.kbId ? '后端当前知识库没有返回文档。' : '请选择或创建知识库后查看文档。'} />
        )}
        {!isLoading && viewMode === 'nodes' && filteredNodes.length === 0 && (
          <EmptyState icon={FileText} title="暂无节点" detail="后端结构化文档树为空，或没有匹配当前搜索词。" />
        )}
      </div>
    </div>
  );
};

const EmptyState = ({ icon: Icon, title, detail }: { icon: React.ElementType; title: string; detail: string }) => (
  <div className="rounded-lg border border-slate-200 bg-white px-4 py-10 text-center">
    <Icon className="mx-auto h-5 w-5 text-slate-400" />
    <div className="mt-3 text-sm font-medium text-slate-900">{title}</div>
    <div className="mt-1 text-sm text-slate-500">{detail}</div>
  </div>
);

const flattenNodes = (root: DocumentNode): DocumentNode[] => {
  const result: DocumentNode[] = [];
  const visit = (node: DocumentNode) => {
    if (node.node_type !== 'root') result.push(node);
    (node.children || []).forEach(visit);
  };
  visit(root);
  return result;
};
