import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLibrary } from '../contexts/LibraryContext';
import { useReader } from '../contexts/ReaderContext';
import type { Book } from '../../domain/entities/Book';

function formatLastRead(lastReadAt: string | null) {
  if (!lastReadAt) return 'Never opened';

  const date = new Date(lastReadAt);
  if (Number.isNaN(date.getTime())) return 'Recently';

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function LibraryScreen() {
  const navigate = useNavigate();
  const { books, isLoading, error, importBook, importArticleUrl, deleteBook, toggleFavorite } = useLibrary();
  const { openBook, resumeLastSession, lastSession, isRestoringSession } = useReader();
  const [isImporting, setIsImporting] = useState(false);
  const [isImportingArticle, setIsImportingArticle] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [articleUrl, setArticleUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    console.log('[Import] Selected:', file.name, file.type, file.size);
    setIsImporting(true);
    try {
      await importBook(file);
      console.log('[Import] Success:', file.name);
    } catch (err) {
      console.error('[Import] Failed:', err);
      alert(`Import failed: ${err instanceof Error ? err.message : err}. Try a different file.`);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    setIsImporting(true);
    try {
      await importBook(file);
    } catch (err) {
      console.error('Import failed:', err);
      alert('Failed to import book. Please try again.');
    } finally {
      setIsImporting(false);
    }
  }, [importBook]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDelete = async (book: Book, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete "${book.title}"?`)) {
      await deleteBook(book.id);
    }
  };

  const handleFavorite = async (book: Book, e: React.MouseEvent) => {
    e.stopPropagation();
    await toggleFavorite(book.id);
  };

  const handleBookClick = async (book: Book) => {
    await openBook(book);
    navigate('/reader');
  };

  const handleContinueReading = async () => {
    const resumed = await resumeLastSession();
    if (resumed) {
      navigate('/reader');
    }
  };

  const handleArticleImport = async () => {
    const trimmed = articleUrl.trim();
    if (!trimmed) return;

    setIsImportingArticle(true);
    try {
      const book = await importArticleUrl(trimmed);
      setArticleUrl('');
      await openBook(book);
      navigate('/reader');
    } catch (err) {
      console.error('[Article Import] Failed:', err);
      alert(`Article import failed: ${err instanceof Error ? err.message : err}. Try another URL.`);
    } finally {
      setIsImportingArticle(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-background">
        <header className="flex items-center justify-between p-4 border-b border-gray-800">
          <h1 className="text-xl font-semibold text-white">Library</h1>
        </header>
        <main className="flex-1 flex items-center justify-center">
          <div className="text-gray-400">Loading...</div>
        </main>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full bg-background"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <header className="flex items-center justify-between p-4 border-b border-gray-800">
        <div>
          <h1 className="text-xl font-semibold text-white">Library</h1>
          <p className="text-xs text-gray-500 mt-1">Imported books and resume history</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="p-2 rounded-full bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
          >
            {isImporting ? (
              <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.epub,.txt,application/pdf,application/epub+zip,text/plain"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </header>

      {isDragOver && (
        <div className="fixed inset-0 z-50 bg-blue-900/50 flex items-center justify-center pointer-events-none">
          <div className="p-8 border-2 border-dashed border-blue-400 rounded-xl text-center">
            <svg className="w-16 h-16 text-blue-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-blue-300 text-lg font-medium">Drop file here to import</p>
          </div>
        </div>
      )}

      {error && (
        <div className="mx-4 mt-2 p-2 bg-red-900/50 border border-red-700 rounded text-red-400 text-sm">
          {error}
        </div>
      )}

      <main className="flex-1 p-4 overflow-auto pb-24">
        <div className="mb-4 rounded-2xl border border-gray-800 bg-gray-950/80 p-4">
          <div className="text-xs uppercase tracking-wide text-blue-300">Send an article to read</div>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              value={articleUrl}
              onChange={(e) => setArticleUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleArticleImport();
                }
              }}
              placeholder="Paste an article URL"
              className="flex-1 rounded-xl bg-gray-900 px-3 py-2 text-sm text-white outline-none ring-1 ring-gray-800 focus:ring-blue-500"
            />
            <button
              onClick={() => { void handleArticleImport(); }}
              disabled={isImportingArticle || !articleUrl.trim()}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {isImportingArticle ? 'Importing...' : 'Import URL'}
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Best for public articles, blog posts, and web pages. We extract the readable text and open it in the reader.
          </p>
        </div>

        {lastSession && (
          <div className="mb-4 rounded-2xl border border-blue-800 bg-gradient-to-r from-blue-950 to-slate-950 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-blue-300">Continue Reading</div>
                <h2 className="text-lg font-semibold text-white mt-1">{lastSession.title}</h2>
                <p className="text-sm text-gray-400">{lastSession.author}</p>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-400">
                  <span>{lastSession.progress}% complete</span>
                  <span>Word {Math.min(lastSession.position + 1, lastSession.totalWords)} of {lastSession.totalWords}</span>
                  <span>Saved {formatLastRead(lastSession.lastSavedAt)}</span>
                  <span className="capitalize">{lastSession.lastSavedSource} save</span>
                </div>
                {lastSession.lastWord && (
                  <p className="text-sm text-blue-200 mt-2">Last word: {lastSession.lastWord}</p>
                )}
              </div>
              <button
                onClick={handleContinueReading}
                disabled={isRestoringSession}
                className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
              >
                {isRestoringSession ? 'Restoring...' : 'Continue'}
              </button>
            </div>
          </div>
        )}

        {books.length === 0 ? (
          <div
            className={`flex flex-col items-center justify-center mt-20 border-2 border-dashed rounded-xl p-8 transition-colors ${isDragOver ? 'border-blue-400 bg-blue-900/20' : 'border-gray-700'}`}
            onDrop={(e) => { e.preventDefault(); void handleDrop(e); }}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          >
            <svg className="w-16 h-16 text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <p className="text-lg text-gray-400">No books in library</p>
            <p className="text-sm text-gray-500 mt-1">Click + or drag & drop a file to import</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-500 transition-colors"
            >
              Choose File
            </button>
            <p className="text-xs text-gray-600 mt-2">Supports PDF, EPUB, TXT</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {books.map((book) => (
              <div
                key={book.id}
                onClick={() => { void handleBookClick(book); }}
                className="relative bg-gray-900 rounded-lg p-3 cursor-pointer hover:bg-gray-800 transition-colors border border-gray-800"
              >
                <div className="aspect-[3/4] bg-gray-700 rounded mb-2 flex items-center justify-center overflow-hidden">
                  {book.coverImage ? (
                    <img src={book.coverImage} alt={book.title} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-4xl">📖</span>
                  )}
                </div>
                <button
                  onClick={(e) => { void handleFavorite(book, e); }}
                  className="absolute top-4 right-4 p-1 rounded-full bg-black/50"
                >
                  {book.isFavorite ? (
                    <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.906c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.906a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={(e) => { void handleDelete(book, e); }}
                  className="absolute bottom-24 right-2 p-1 rounded-full bg-black/50 hover:bg-red-600 transition-colors"
                >
                  <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <h3 className="text-sm font-medium text-white truncate">{book.title}</h3>
                <p className="text-xs text-gray-400 truncate">{book.author}</p>
                <div className="mt-2">
                  <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${book.currentProgress}%` }} />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-gray-500">{book.currentProgress}%</span>
                    <span className="text-xs text-gray-500">{book.totalWords} words</span>
                  </div>
                  <div className="mt-2 text-[11px] text-gray-500">
                    Last read {formatLastRead(book.lastReadAt)}
                  </div>
                  {book.chapters.length > 0 && (
                    <div className="mt-1 text-[11px] text-gray-500">
                      {book.chapters.length} chapter{book.chapters.length === 1 ? '' : 's'}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
