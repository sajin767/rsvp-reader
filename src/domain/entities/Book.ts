export interface BookChapter {
  id: string;
  title: string;
  startWord: number;
  endWord: number;
}

// Book entity - represents a book in the library
export interface Book {
  id: string;
  title: string;
  author: string;
  fileType: 'pdf' | 'epub' | 'txt' | 'article';
  filePath: string;
  fileSize: number;
  totalWords: number;
  currentPosition: number;
  currentProgress: number;
  lastReadAt: string | null;
  addedAt: string;
  isFavorite: boolean;
  tags: string[];
  chapters: BookChapter[];
  coverImage?: string;
  content?: string;
}

// Factory function to create a new book
export function createBook(params: Partial<Book> & { title: string; filePath: string; fileType: Book['fileType'] }): Book {
  return {
    id: crypto.randomUUID(),
    title: params.title,
    author: params.author || 'Unknown Author',
    fileType: params.fileType,
    filePath: params.filePath,
    fileSize: params.fileSize || 0,
    totalWords: params.totalWords || 0,
    currentPosition: params.currentPosition || 0,
    currentProgress: params.currentProgress || 0,
    lastReadAt: params.lastReadAt || null,
    addedAt: new Date().toISOString(),
    isFavorite: params.isFavorite || false,
    tags: params.tags || [],
    chapters: params.chapters || [],
    coverImage: params.coverImage,
    content: params.content,
  };
}
