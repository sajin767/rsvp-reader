// EPUB File Parser - extract text from EPUB files using epubjs
import type { ParsedBook } from './txtParser';

export async function parseEpubFile(file: File): Promise<ParsedBook> {
  const ePub = await import('epubjs');
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const book = ePub.default(arrayBuffer);
        await book.ready;
        
        // Try to get metadata
        const metadata = await book.loaded.metadata;
        
        let fullText = '';
        
        // Get all chapters/spine items
        const spine = book.spine as any;
        const spineItems = spine.items;
        
        for (const item of spineItems) {
          try {
            const doc = await book.load(item.href) as Document;
            const body = doc.body || doc.documentElement;
            if (body && body.textContent) {
              fullText += body.textContent + '\n';
            }
          } catch {
            // Skip failed chapters
            continue;
          }
        }
        
        const words = fullText.trim().split(/\s+/).filter(w => w.length > 0);
        const fileName = file.name.replace(/\.epub$/i, '').replace(/[-_]/g, ' ');
        
        resolve({
          title: metadata.title || fileName || 'Untitled EPUB',
          author: metadata.creator || 'Unknown Author',
          content: fullText.trim(),
          totalWords: words.length,
        });
      } catch (error) {
        reject(new Error('Failed to parse EPUB file'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read EPUB file'));
    };
    
    reader.readAsArrayBuffer(file);
  });
}
