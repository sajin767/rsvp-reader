// EPUB File Parser - extract text from EPUB files using epubjs
import type { ParsedBook } from './txtParser';
import type { BookChapter } from '../../domain/entities/Book';

function normalizeMetadataText(value: string | undefined | null, fallback: string) {
  if (!value) return fallback;
  return value.replace(/\s+/g, ' ').trim() || fallback;
}

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
        const navigation = await book.loaded.navigation;
        
        let fullText = '';
        let wordOffset = 0;
        const chapters: BookChapter[] = [];
        
        // Get all chapters/spine items
        const spine = book.spine as any;
        const spineItems = spine.items;
        
        for (const item of spineItems) {
          try {
            const doc = await book.load(item.href) as Document;
            const body = doc.body || doc.documentElement;
            if (body && body.textContent) {
              const chapterText = body.textContent.replace(/\s+/g, ' ').trim();
              if (chapterText) {
                const navMatch = navigation?.toc?.find?.((entry: { href?: string; label?: string }) => entry.href && item.href?.includes(entry.href.split('#')[0]));
                const chapterTitle = normalizeMetadataText(navMatch?.label || doc.querySelector('h1,h2,h3,title')?.textContent, `Chapter ${chapters.length + 1}`);
                const chapterWords = chapterText.split(/\s+/).filter(Boolean).length;
                chapters.push({
                  id: `chapter-${chapters.length + 1}`,
                  title: chapterTitle,
                  startWord: wordOffset,
                  endWord: Math.max(wordOffset + chapterWords - 1, wordOffset),
                });
                wordOffset += chapterWords;
                fullText += chapterText + '\n';
              }
            }
          } catch {
            // Skip failed chapters
            continue;
          }
        }
        
        const words = fullText.trim().split(/\s+/).filter(w => w.length > 0);
        const fileName = file.name.replace(/\.epub$/i, '').replace(/[-_]/g, ' ');
        let coverImage: string | undefined;

        try {
          if (typeof (book as any).coverUrl === 'function') {
            coverImage = await (book as any).coverUrl();
          }
        } catch {
          coverImage = undefined;
        }
        
        resolve({
          title: normalizeMetadataText(metadata.title, fileName || 'Untitled EPUB'),
          author: normalizeMetadataText(metadata.creator, 'Unknown Author'),
          content: fullText.trim(),
          totalWords: words.length,
          chapters,
          coverImage,
        });
      } catch (_error) {
        reject(new Error('Failed to parse EPUB file'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read EPUB file'));
    };
    
    reader.readAsArrayBuffer(file);
  });
}
