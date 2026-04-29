import React, { useState, useEffect } from 'react';
import { listDocuments, getParsedDoc, DocumentSummary } from '../lib/api';
import { Database, FileText, Trash2, Search, X, Info, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useRagSettings } from '../lib/settings-store';

interface KnowledgeExplorerProps {
  onRefresh: () => void;
}

export const KnowledgeExplorer: React.FC<KnowledgeExplorerProps> = ({ onRefresh }) => {
  const [settings] = useRagSettings();
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'sources' | 'chunks'>('sources');
  const [sources, setSources] = useState<DocumentSummary[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [chunks, setChunks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadSources();
  }, [settings.kbId, onRefresh]);

  const loadSources = async () => {
    try {
      setIsLoading(true);
      const docs = await listDocuments(settings.kbId);
      setSources(docs || []);
    } catch (e) {
      console.error(e);
      setSources([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadChunks = async (docId: string) => {
    try {
      setIsLoading(true);
      const data = await getParsedDoc(docId);
      setChunks(data?.chunks || []);
      setSelectedDocId(docId);
      setViewMode('chunks');
    } catch (e) {
      console.error(e);
      setChunks([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredSources = sources.filter(s => 
    s.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredChunks = chunks.filter(c => 
    (c.text || '').toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 50);

  if (sources.length === 0 && !isLoading) return null;

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
          {viewMode === 'chunks' ? (
            <>
              <button 
                onClick={() => { setViewMode('sources'); setSelectedDocId(null); }}
                className="hover:text-zinc-300 transition-colors"
                title="Back to sources"
              >
                <ArrowLeft className="w-3 h-3" />
              </button>
              分块详情 / CHUNKS
            </>
          ) : (
            <>
              <Database className="w-3 h-3" />
              知识库缓存 / NEURAL CACHE
            </>
          )}
        </h2>
      </div>

      {viewMode === 'sources' && (
        <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-lg p-3 text-[11px] text-zinc-400 leading-relaxed font-sans flex items-start space-x-2">
          <Info className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
          <p>
            <strong className="text-zinc-200">知识库缓存区</strong>展示了已注入系统并被向量化的文本数据。文档在上传后会被自动切分为<strong>分块 (Chunks)</strong>，点击文档可查看分块详情。
          </p>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
        <input 
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="搜索知识内容..."
          className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-2.5 pl-9 pr-4 text-[11px] text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-emerald-600/30 transition-all"
        />
        {searchTerm && (
          <button 
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
        {isLoading && viewMode === 'chunks' && <div className="text-[11px] text-zinc-500 text-center py-4">加载中...</div>}
        <AnimatePresence mode="popLayout">
          {viewMode === 'sources' ? (
            filteredSources.map((source, i) => (
              <motion.div
                key={source.doc_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={() => loadChunks(source.doc_id)}
                className="group p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/50 hover:bg-zinc-900/60 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2 min-w-0">
                    <FileText className="w-3 h-3 text-emerald-500/50 shrink-0" />
                    <span className="text-[11px] font-mono text-zinc-300 truncate font-bold">
                      {source.title}
                    </span>
                  </div>
                  <button 
                    disabled
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-600 cursor-not-allowed"
                    title="暂不支持删除单文档"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                
                <div className="flex items-center space-x-3">
                  <div className="px-1.5 py-0.5 rounded bg-zinc-800/50 text-[9px] font-mono text-zinc-500 uppercase tracking-tighter">
                    {source.chunk_count} Chunks
                  </div>
                  <div className="h-px flex-1 bg-zinc-800/30" />
                  <div className="text-[9px] text-zinc-600 font-mono">
                    {new Date(source.updated_at).toLocaleDateString()}
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            filteredChunks.map((chunk, i) => (
              <motion.div
                key={chunk.chunk_id || Math.random().toString()}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="p-3 rounded-lg bg-zinc-950 border border-zinc-900 hover:border-zinc-800 transition-all"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9px] font-mono text-emerald-500/30">
                    CHUNK_{chunk.chunk_id?.substring(0, 8)}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 leading-relaxed">
                  {chunk.text}
                </p>
              </motion.div>
            ))
          )}
        </AnimatePresence>
        
        {searchTerm && (viewMode === 'sources' ? filteredSources : filteredChunks).length === 0 && (
          <div className="py-10 text-center">
            <p className="text-[11px] text-zinc-600 font-mono italic">未找到匹配 / NO_MATCH</p>
          </div>
        )}
      </div>
    </div>
  );
};
