// TXT File Parser - extract text from plain text files
import type { BookChapter } from '../../domain/entities/Book';

export interface ParsedBook {
  title: string;
  author: string;
  content: string;
  totalWords: number;
  chapters?: BookChapter[];
  coverImage?: string;
}

function cleanMetadataValue(value: string) {
  return value.replace(/^[^:]+:\s*/i, '').trim();
}

function buildTxtChapters(content: string): BookChapter[] {
  const lines = content.split('\n');
  const chapters: BookChapter[] = [];
  let wordOffset = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^(chapter|part|section)\b/i.test(trimmed)) {
      chapters.push({
        id: `chapter-${chapters.length + 1}`,
        title: trimmed,
        startWord: wordOffset,
        endWord: wordOffset,
      });
    }
    wordOffset += trimmed ? trimmed.split(/\s+/).length : 0;
  }

  if (chapters.length === 0) {
    return [];
  }

  return chapters.map((chapter, index) => ({
    ...chapter,
    endWord: index < chapters.length - 1 ? Math.max(chapters[index + 1].startWord - 1, chapter.startWord) : Math.max(wordOffset - 1, chapter.startWord),
  }));
}

export async function parseTxtFile(file: File): Promise<ParsedBook> {
  console.log('[parseTxtFile] Starting with file:', file.name, 'size:', file.size);
  
  // Check if file has content
  if (!file || file.size === 0) {
    throw new Error('File is empty or invalid');
  }

  const content = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const result = event.target?.result as string;
      console.log('[parseTxtFile] FileReader onload, bytes read:', result?.length);
      if (result) {
        resolve(result);
      } else {
        reject(new Error('FileReader returned no content'));
      }
    };
    
    reader.onerror = (error) => {
      console.error('[parseTxtFile] FileReader error:', error);
      reject(new Error('Failed to read file. Error code: ' + reader.error?.code));
    };
    
    reader.readAsText(file);
  });

  if (!content || content.trim().length === 0) {
    throw new Error('File content is empty');
  }

  const trimmedContent = content.trim();
  const words = trimmedContent.split(/\s+/).filter(w => w.length > 0);
  const fileName = file.name.replace(/\.txt$/i, '').replace(/[-_]/g, ' ');
  const lines = trimmedContent.split('\n').map(line => line.trim()).filter(Boolean);

  let title = fileName || 'Untitled';
  let author = 'Unknown Author';

  const metadataLineCandidates = lines.slice(0, 6);
  const titleLine = metadataLineCandidates.find(line => /^title\s*:/i.test(line));
  const authorLine = metadataLineCandidates.find(line => /^(author|by)\s*:/i.test(line));
  if (titleLine) {
    title = cleanMetadataValue(titleLine);
  } else if (lines[0] && lines[0].length < 100) {
    title = lines[0];
  }

  if (authorLine) {
    author = cleanMetadataValue(authorLine);
  } else {
    const byLine = metadataLineCandidates.find(line => /^by\s+[A-Z]/.test(line));
    if (byLine) {
      author = byLine.replace(/^by\s+/i, '').trim();
    }
  }

  const chapters = buildTxtChapters(trimmedContent);
  
  console.log('[parseTxtFile] Success - words:', words.length, 'content length:', content.length);
  
  return {
    title,
    author,
    content: trimmedContent,
    totalWords: words.length,
    chapters,
  };
}
