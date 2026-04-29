// Library Context - manages book library state and operations
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { Book } from '../../domain/entities/Book';
import { createBook } from '../../domain/entities/Book';
import { BookRepository } from '../../data/repositories/BookRepository';
import { parseTxtFile } from '../../data/parsers/txtParser';
import { parsePdfFile } from '../../data/parsers/pdfParser';
import { parseEpubFile } from '../../data/parsers/epubParser';

interface LibraryContextType {
  books: Book[];
  isLoading: boolean;
  error: string | null;
  importBook: (file: File) => Promise<void>;
  deleteBook: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  refreshLibrary: () => Promise<void>;
}

const LibraryContext = createContext<LibraryContextType | undefined>(undefined);

const repository = new BookRepository();

interface LibraryProviderProps {
  children: ReactNode;
}

export function LibraryProvider({ children }: LibraryProviderProps) {
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBooks = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const allBooks = await repository.getAll();
      setBooks(allBooks);
    } catch (err) {
      setError('Failed to load library');
      console.error('Library load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  const importBook = useCallback(async (file: File) => {
    try {
      setError(null);
      console.log('[importBook] Starting import:', file.name, 'size:', file.size);
      let parsed;
      const fileType = file.name.split('.').pop()?.toLowerCase() as 'txt' | 'pdf' | 'epub';
      console.log('[importBook] File type:', fileType);

      switch (fileType) {
        case 'pdf':
          console.log('[importBook] Calling pdfParser');
          parsed = await parsePdfFile(file);
          console.log('[importBook] pdfParser succeeded');
          break;
        case 'epub':
          console.log('[importBook] Calling epubParser');
          parsed = await parseEpubFile(file);
          console.log('[importBook] epubParser succeeded');
          break;
        case 'txt':
        default:
          console.log('[importBook] Calling txtParser');
          parsed = await parseTxtFile(file);
          console.log('[importBook] txtParser succeeded');
      }
      console.log('[importBook] Parsed content length:', parsed?.content?.length, 'words:', parsed?.totalWords);

      const book = createBook({
        title: parsed.title,
        author: parsed.author,
        fileType,
        filePath: URL.createObjectURL(file),
        totalWords: parsed.totalWords,
        content: parsed.content,
        fileSize: file.size,
      });
      console.log('[importBook] Book created, id:', book.id);

      console.log('[importBook] Saving to repository');
      await repository.save(book);
      console.log('[importBook] Save succeeded');
      
      setBooks(prev => [...prev, book]);
      console.log('[importBook] Complete');
    } catch (err) {
      console.error('[importBook] Error:', err);
      setError(`Failed to import book: ${err}`);
      throw err;
    }
  }, []);

  const deleteBook = useCallback(async (id: string) => {
    try {
      await repository.delete(id);
      setBooks(prev => prev.filter(b => b.id !== id));
    } catch (err) {
      setError('Failed to delete book');
      throw err;
    }
  }, []);

  const toggleFavorite = useCallback(async (id: string) => {
    const book = books.find(b => b.id === id);
    if (book) {
      const updated = { ...book, isFavorite: !book.isFavorite };
      await repository.update(updated);
      setBooks(prev => prev.map(b => b.id === id ? updated : b));
    }
  }, [books]);

  const refreshLibrary = useCallback(async () => {
    await loadBooks();
  }, [loadBooks]);

  return (
    <LibraryContext.Provider value={{ books, isLoading, error, importBook, deleteBook, toggleFavorite, refreshLibrary }}>
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibrary() {
  const context = useContext(LibraryContext);
  if (!context) {
    throw new Error('useLibrary must be used within a LibraryProvider');
  }
  return context;
}
