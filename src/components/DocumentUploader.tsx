import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle2, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { embedBatch } from '../lib/gemini';
import { chunkText } from '../lib/chunker';
import { globalStore, DocumentChunk } from '../lib/vector-store';
import { cn } from '../lib/utils';

interface DocumentUploaderProps {
  onProcessingComplete: () => void;
}

import { useRagSettings } from '../lib/settings-store';

export const DocumentUploader: React.FC<DocumentUploaderProps> = ({ onProcessingComplete }) => {
  const [settings] = useRagSettings();
  const [isUploading, setIsUploading] = useState(false);
  const [files, setFiles] = useState<{ name: string; status: 'idle' | 'processing' | 'done' | 'error' }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    setFiles(prev => [...prev, { name: file.name, status: 'processing' }]);
    setIsUploading(true);

    try {
      const text = await file.text();
      const chunks = chunkText(text, settings.chunkSize, settings.overlap);
      
      const embeddings = await embedBatch(chunks);
      
      const documentChunks: DocumentChunk[] = chunks.map((content, i) => ({
        id: `${file.name}-${i}`,
        text: content,
        embedding: embeddings[i],
        metadata: {
          source: file.name,
          index: i
        }
      }));

      globalStore.addChunks(documentChunks);
      
      setFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'done' } : f));
    } catch (error) {
      console.error("Error processing file:", error);
      setFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'error' } : f));
    } finally {
      setIsUploading(false);
      onProcessingComplete();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      Array.from(e.target.files).forEach(processFile);
    }
  };

  const clearStore = () => {
    globalStore.clear();
    setFiles([]);
    onProcessingComplete();
  };

  return (
    <div className="space-y-4">
      <div 
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "tech-border rounded-xl p-8 bg-zinc-900/20 transition-all cursor-pointer group",
          "hover:bg-zinc-900/40 active:scale-[0.98]",
          isUploading ? "opacity-50 pointer-events-none" : ""
        )}
        id="drop-zone"
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept=".txt,.md,.js,.ts,.tsx,.json"
          multiple
          onChange={handleFileChange}
        />
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="w-10 h-10 rounded-lg bg-zinc-900 flex items-center justify-center group-hover:shadow-[0_0_15px_rgba(39,39,42,0.5)] transition-all border border-zinc-800">
            <Upload className="w-5 h-5 text-zinc-500 group-hover:text-emerald-500 transition-colors" />
          </div>
          <div className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">开始注入数据</p>
            <p className="text-[9px] text-zinc-600 mt-1 uppercase font-mono tracking-tighter">支持格式: TXT, MD, JS, TS, JSON</p>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {files.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="tech-border rounded-xl overflow-hidden glass-panel"
          >
            <div className="p-3 border-b border-zinc-800/50 flex justify-between items-center bg-zinc-900/50">
              <span className="text-xs font-mono uppercase tracking-wider text-zinc-500">已索引文件 / INDEXED</span>
              <button 
                onClick={clearStore}
                className="text-[10px] text-zinc-500 hover:text-red-400 transition-colors uppercase font-bold"
              >
                全部清除 / CLEAR
              </button>
            </div>
            <div className="max-h-[200px] overflow-y-auto divide-y divide-zinc-800/50">
              {files.map((file, idx) => (
                <div key={`${file.name}-${idx}`} className="p-3 flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-3 truncate">
                    <FileText className="w-4 h-4 text-zinc-400 shrink-0" />
                    <span className="truncate text-zinc-300">{file.name}</span>
                  </div>
                  <div className="flex items-center ml-2">
                    {file.status === 'processing' && <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />}
                    {file.status === 'done' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                    {file.status === 'error' && <X className="w-4 h-4 text-red-500" />}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
