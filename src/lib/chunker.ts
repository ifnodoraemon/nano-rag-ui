export function chunkText(text: string, chunkSize: number = 500, overlap: number = 100): string[] {
  const chunks: string[] = [];
  let index = 0;

  while (index < text.length) {
    const end = Math.min(index + chunkSize, text.length);
    chunks.push(text.slice(index, end));
    
    // Move index by chunkSize minus overlap
    index += (chunkSize - overlap);
    
    // Prevent infinite loop if overlap >= chunkSize
    if (chunkSize <= overlap) break;
  }

  return chunks;
}
