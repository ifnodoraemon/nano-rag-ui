export interface DocumentChunk {
  id: string;
  text: string;
  embedding: number[];
  metadata: {
    source: string;
    index: number;
  };
}

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export class NanoVectorStore {
  private chunks: DocumentChunk[] = [];
  private events: { id: string; time: string; message: string; type: 'info' | 'success' | 'warn' | 'error' }[] = [
    { id: 'init', time: new Date().toLocaleTimeString(), message: 'System Kernel Initialized', type: 'info' }
  ];
  private listeners: (() => void)[] = [];

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l());
  }

  addEvent(message: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') {
    this.events.unshift({
      id: Math.random().toString(36).substr(2, 9),
      time: new Date().toLocaleTimeString(),
      message,
      type
    });
    if (this.events.length > 50) this.events.pop();
    this.notify();
  }

  getEvents() {
    return this.events;
  }

  addChunks(chunks: DocumentChunk[]) {
    this.chunks.push(...chunks);
    this.addEvent(`Indexed ${chunks.length} new chunks from ${chunks[0]?.metadata.source}`, 'success');
  }

  search(queryEmbedding: number[], topK: number = 3): { chunk: DocumentChunk, score: number }[] {
    const scores = this.chunks.map((chunk) => ({
      chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }));

    scores.sort((a, b) => b.score - a.score);
    this.addEvent(`Vector search executed (Top-${topK})`, 'info');
    return scores.slice(0, topK);
  }

  clear() {
    this.chunks = [];
    this.addEvent('Neural cache cleared', 'warn');
  }

  removeBySource(sourceName: string) {
    const prevCount = this.chunks.length;
    this.chunks = this.chunks.filter(c => c.metadata.source !== sourceName);
    this.addEvent(`Removed document: ${sourceName} (${prevCount - this.chunks.length} chunks deleted)`, 'warn');
  }

  getAllChunks() {
    return this.chunks;
  }
}

export const globalStore = new NanoVectorStore();
