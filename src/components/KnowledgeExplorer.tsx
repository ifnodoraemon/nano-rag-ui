import React, { useState } from 'react';
import { globalStore } from '../lib/vector-store';
import { Database, FileText, Trash2, Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface KnowledgeExplorerProps {
  onRefresh: () => void;
}

export const KnowledgeExplorer: React.FC<KnowledgeExplorerProps> = ({ onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'sources' | 'chunks'>('sources');
  const chunks = globalStore.getAllChunks();
  
  // Group chunks by source
  const sources = Array.from(new Set(chunks.map(c => c.metadata.source))).map(sourceName => {
    const docChunks = chunks.filter(c => c.metadata.source === sourceName);
    return {
      name: sourceName,
      chunkCount: docChunks.length,
      sampleText: docChunks[0]?.text || ''
    };
  });

  const filteredSources = sources.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.sampleText.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredChunks = chunks.filter(c => 
    c.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.metadata.source.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 50);

  if (chunks.length === 0) return null;

  const handleDeleteSource = (sourceName: string) => {
    globalStore.removeBySource(sourceName);
    onRefresh();
  };

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
          <Database className="w-3 h-3" />
          知识库缓存 / NEURAL CACHE
        </h2>
        <div className="flex items-center bg-zinc-900 rounded-lg p-0.5 border border-zinc-800">
          <button 
            onClick={() => setViewMode('sources')}
            className={cn(
              "px-2 py-1 text-[9px] uppercase font-bold rounded transition-all",
              viewMode === 'sources' ? "bg-emerald-500/10 text-emerald-500" : "text-zinc-600 hover:text-zinc-400"
            )}
          >
            文档
          </button>
          <button 
            onClick={() => setViewMode('chunks')}
            className={cn(
              "px-2 py-1 text-[9px] uppercase font-bold rounded transition-all",
              viewMode === 'chunks' ? "bg-emerald-500/10 text-emerald-500" : "text-zinc-600 hover:text-zinc-400"
            )}
          >
            分块
          </button>
        </div>
      </div>

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
        <AnimatePresence mode="popLayout">
          {viewMode === 'sources' ? (
            filteredSources.map((source, i) => (
              <motion.div
                key={source.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="group p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/50 hover:bg-zinc-900/60 transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2 min-w-0">
                    <FileText className="w-3 h-3 text-emerald-500/50 shrink-0" />
                    <span className="text-[11px] font-mono text-zinc-300 truncate font-bold">
                      {source.name}
                    </span>
                  </div>
                  <button 
                    onClick={() => handleDeleteSource(source.name)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 hover:text-red-400 text-zinc-600 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                
                <div className="flex items-center space-x-3 mb-2">
                  <div className="px-1.5 py-0.5 rounded bg-zinc-800/50 text-[9px] font-mono text-zinc-500 uppercase tracking-tighter">
                    {source.chunkCount} Chunks
                  </div>
                  <div className="h-px flex-1 bg-zinc-800/30" />
                </div>

                <p className="text-[10px] text-zinc-500 leading-relaxed line-clamp-2 italic font-serif">
                  "{source.sampleText}"
                </p>
              </motion.div>
            ))
          ) : (
            filteredChunks.map((chunk, i) => (
              <motion.div
                key={chunk.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="p-3 rounded-lg bg-zinc-950 border border-zinc-900 hover:border-zinc-800 transition-all"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9px] font-mono text-zinc-600 uppercase truncate max-w-[120px]">
                    {chunk.metadata.source}
                  </span>
                  <span className="text-[9px] font-mono text-emerald-500/30">
                    ID_{chunk.metadata.index}
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
            <p className="text-[11px] text-zinc-600 font-mono italic">未找到匹配的知识片段 / NO_MATCH</p>
          </div>
        )}
      </div>
    </div>
  );
};
