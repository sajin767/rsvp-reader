// Reader Context - manages RSVP reading state
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import type { Bookmark } from '../../domain/entities/Bookmark';
import { createBookmark } from '../../domain/entities/Bookmark';
import type { Note } from '../../domain/entities/Note';
import { createNote } from '../../domain/entities/Note';
import type { RSVPWord } from '../../domain/usecases/RSVPEngine';
import { RSVPEngine, WPM_PRESETS } from '../../domain/usecases/RSVPEngine';
import { useSettings } from './SettingsContext';
import { useLibrary } from './LibraryContext';
import type { Book } from '../../domain/entities/Book';
import { BookRepository } from '../../data/repositories/BookRepository';
import { BookmarkRepository, StatsRepository } from '../../data/repositories/StatsRepository';
import { NoteRepository } from '../../data/repositories/NoteRepository';

export interface ReaderSession {
  bookId: string;
  title: string;
  author: string;
  position: number;
  progress: number;
  totalWords: number;
  lastSavedAt: string;
  lastWord: string | null;
  shouldResumePlayback: boolean;
  lastSavedSource: 'autosave' | 'manual' | 'lifecycle' | 'completion';
}

interface ReaderContextType {
  currentBook: Book | null;
  currentWord: RSVPWord | null;
  currentIndex: number;
  totalWords: number;
  progress: number;
  isPlaying: boolean;
  isPaused: boolean;
  isRestoringSession: boolean;
  wpm: number;
  wpmPresets: typeof WPM_PRESETS;
  bookmarks: Bookmark[];
  notes: Note[];
  lastSession: ReaderSession | null;
  openBook: (book: Book) => Promise<void>;
  closeBook: () => Promise<void>;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  skipForward: (count?: number) => void;
  skipBackward: (count?: number) => void;
  setWpm: (wpm: number) => void;
  seekToProgress: (percentage: number) => void;
  seekToPosition: (position: number) => void;
  syncToPosition: (position: number) => void;
  saveProgressNow: () => Promise<void>;
  addBookmark: (label?: string) => Promise<void>;
  deleteBookmark: (id: string) => Promise<void>;
  addNote: (content: string) => Promise<void>;
  updateNote: (id: string, content: string) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  resumeLastSession: (options?: { autoplay?: boolean }) => Promise<boolean>;
}

const ReaderContext = createContext<ReaderContextType | undefined>(undefined);

const LAST_SESSION_KEY = 'rsvp_last_session';

const bookRepository = new BookRepository();
const bookmarkRepository = new BookmarkRepository();
const statsRepository = new StatsRepository();
const noteRepository = new NoteRepository();

// Wake Lock API to keep screen awake while reading
let wakeLock: WakeLockSentinel | null = null;

async function requestWakeLock() {
  if ('wakeLock' in navigator && !wakeLock) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      console.log('[WakeLock] Screen will stay awake');
    } catch (err) {
      console.warn('[WakeLock] Could not acquire wake lock:', err);
    }
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release();
    wakeLock = null;
    console.log('[WakeLock] Released');
  }
}

function readStoredSession(): ReaderSession | null {
  try {
    const stored = localStorage.getItem(LAST_SESSION_KEY);
    return stored ? JSON.parse(stored) as ReaderSession : null;
  } catch (error) {
    console.error('Failed to read last session:', error);
    return null;
  }
}

function persistStoredSession(session: ReaderSession | null) {
  try {
    if (!session) {
      localStorage.removeItem(LAST_SESSION_KEY);
      return;
    }
    localStorage.setItem(LAST_SESSION_KEY, JSON.stringify(session));
  } catch (error) {
    console.error('Failed to persist last session:', error);
  }
}

interface ReaderProviderProps {
  children: ReactNode;
}

export function ReaderProvider({ children }: ReaderProviderProps) {
  const { settings, updateSettings } = useSettings();
  const { refreshLibrary } = useLibrary();
  const engineRef = useRef<RSVPEngine | null>(null);
  const currentBookRef = useRef<Book | null>(null);
  const lastSavedSnapshotRef = useRef<{ bookId: string; position: number; progress: number } | null>(null);
  const saveCurrentProgressRef = useRef<((options?: SaveOptions) => Promise<void>) | null>(null);
  const activePlaybackStartedAtRef = useRef<number | null>(null);
  const accumulatedPlaybackMsRef = useRef(0);
  const flushedPlaybackMsRef = useRef(0);
  const countedSessionRef = useRef(false);

  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  const [currentWord, setCurrentWord] = useState<RSVPWord | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalWords, setTotalWords] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [lastSession, setLastSession] = useState<ReaderSession | null>(() => readStoredSession());
  const [isRestoringSession, setIsRestoringSession] = useState(false);

  useEffect(() => {
    currentBookRef.current = currentBook;
  }, [currentBook]);

  const persistLastSession = useCallback((book: Book, position: number, progress: number, source: ReaderSession['lastSavedSource']) => {
    const session: ReaderSession = {
      bookId: book.id,
      title: book.title,
      author: book.author,
      position,
      progress,
      totalWords: engineRef.current?.getTotalWords() || book.totalWords,
      lastSavedAt: new Date().toISOString(),
      lastWord: engineRef.current?.getCurrentWord()?.text || null,
      shouldResumePlayback: !!engineRef.current?.isPlayingState() && !engineRef.current?.isPausedState(),
      lastSavedSource: source,
    };

    setLastSession(session);
    persistStoredSession(session);
  }, []);

  const capturePlaybackTime = useCallback(() => {
    if (activePlaybackStartedAtRef.current !== null) {
      accumulatedPlaybackMsRef.current += Date.now() - activePlaybackStartedAtRef.current;
      activePlaybackStartedAtRef.current = null;
    }
  }, []);

  const resetPlaybackTracking = useCallback(() => {
    activePlaybackStartedAtRef.current = null;
    accumulatedPlaybackMsRef.current = 0;
    flushedPlaybackMsRef.current = 0;
    countedSessionRef.current = false;
  }, []);

  const flushReadingStats = useCallback(async (options?: { endSession?: boolean; completedBook?: boolean }) => {
    const wasPlaying = activePlaybackStartedAtRef.current !== null;
    if (wasPlaying) {
      capturePlaybackTime();
    }

    const unflushedMs = accumulatedPlaybackMsRef.current - flushedPlaybackMsRef.current;
    const shouldRecordWords = unflushedMs >= 5000;
    const shouldCountSession = !!options?.endSession && !countedSessionRef.current && accumulatedPlaybackMsRef.current >= 5000;

    if (shouldRecordWords || options?.completedBook || shouldCountSession) {
      await statsRepository.recordReadingActivity({
        minutesRead: unflushedMs / 60000,
        wpm: settings.wpm,
        completedBook: options?.completedBook,
        countSession: shouldCountSession,
      });
      flushedPlaybackMsRef.current = accumulatedPlaybackMsRef.current;
      if (shouldCountSession) {
        countedSessionRef.current = true;
      }
    }

    if (wasPlaying && !options?.endSession) {
      activePlaybackStartedAtRef.current = Date.now();
    }
  }, [capturePlaybackTime, settings.wpm]);

  const loadBookmarks = useCallback(async (bookId: string) => {
    const nextBookmarks = await bookmarkRepository.getByBookId(bookId);
    nextBookmarks.sort((a, b) => a.position - b.position);
    setBookmarks(nextBookmarks);
  }, []);

  const loadNotes = useCallback(async (bookId: string) => {
    const nextNotes = await noteRepository.getByBookId(bookId);
    setNotes(nextNotes);
  }, []);

  // Re-acquire wake lock and save state across lifecycle events.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void saveCurrentProgressRef.current?.({
          refreshLibrary: false,
          endSession: true,
          source: 'lifecycle',
        });
      } else if (isPlaying && !isPaused) {
        requestWakeLock();
      }
    };

    const handlePageHide = () => {
      void saveCurrentProgressRef.current?.({
        refreshLibrary: false,
        endSession: true,
        source: 'lifecycle',
      });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);

    let appStateListener: { remove: () => Promise<void> } | null = null;
    void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        void saveCurrentProgressRef.current?.({
          refreshLibrary: false,
          endSession: true,
          source: 'lifecycle',
        });
        return;
      }

      if (isPlaying && !isPaused) {
        requestWakeLock();
      }
    }).then((listener) => {
      appStateListener = listener;
    });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
      void appStateListener?.remove();
      releaseWakeLock();
    };
  }, [isPlaying, isPaused]);

  // Initialize engine
  useEffect(() => {
    engineRef.current = new RSVPEngine(settings);

    engineRef.current.onWord((word, index, total) => {
      setCurrentWord(word);
      setCurrentIndex(index);
      setTotalWords(total);
    });

    engineRef.current.onEnd(() => {
      capturePlaybackTime();
      setIsPlaying(false);
      setIsPaused(false);
      releaseWakeLock();
      void saveCurrentProgressRef.current?.({
        refreshLibrary: true,
        force: true,
        completedBook: true,
        endSession: true,
        source: 'completion',
      });
    });

    return () => {
      engineRef.current?.destroy();
      releaseWakeLock();
    };
    // Engine is initialized once; later settings changes are applied by the settings effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update engine settings when settings change
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setSettings(settings);
    }
  }, [settings]);

  interface SaveOptions {
    refreshLibrary?: boolean;
    force?: boolean;
    completedBook?: boolean;
    endSession?: boolean;
    source?: ReaderSession['lastSavedSource'];
  }

  const saveCurrentProgress = useCallback(async (options?: SaveOptions) => {
    const book = currentBookRef.current;
    if (!engineRef.current || !book) return;

    const position = engineRef.current.getPosition();
    const progress = engineRef.current.getProgress();
    const snapshot = lastSavedSnapshotRef.current;
    const source = options?.source || 'autosave';

    persistLastSession(book, position, progress, source);

    if (
      !options?.force &&
      snapshot &&
      snapshot.bookId === book.id &&
      snapshot.position === position &&
      snapshot.progress === progress
    ) {
      if (options?.completedBook || options?.endSession) {
        await flushReadingStats({
          completedBook: options.completedBook,
          endSession: options.endSession,
        });
      }
      return;
    }

    await bookRepository.updateProgress(book.id, position, progress);

    lastSavedSnapshotRef.current = {
      bookId: book.id,
      position,
      progress,
    };

    setCurrentBook((prev) => prev ? {
      ...prev,
      currentPosition: position,
      currentProgress: progress,
      lastReadAt: new Date().toISOString(),
    } : prev);

    if (options?.refreshLibrary !== false) {
      await refreshLibrary();
    }

    await flushReadingStats({
      completedBook: options?.completedBook,
      endSession: options?.endSession,
    });
  }, [flushReadingStats, persistLastSession, refreshLibrary]);

  useEffect(() => {
    saveCurrentProgressRef.current = saveCurrentProgress;
  }, [saveCurrentProgress]);

  useEffect(() => {
    if (!currentBook) {
      return;
    }

    const autosaveTimer = window.setInterval(() => {
      void saveCurrentProgressRef.current?.({
        refreshLibrary: false,
        source: 'autosave',
      });
    }, 3000);

    return () => {
      window.clearInterval(autosaveTimer);
    };
  }, [currentBook]);

  useEffect(() => {
    if (!currentBook || currentIndex <= 0 || currentIndex % 25 !== 0) {
      return;
    }

    void saveCurrentProgressRef.current?.({
      refreshLibrary: false,
      source: 'autosave',
    });
  }, [currentBook, currentIndex]);

  const seekToPosition = useCallback((position: number) => {
    engineRef.current?.setPosition(position);
    const word = engineRef.current?.getCurrentWord();
    if (word) {
      setCurrentWord(word);
    }
    setCurrentIndex(position);
    void saveCurrentProgressRef.current?.({
      refreshLibrary: false,
      source: 'manual',
    });
  }, []);

  const syncToPosition = useCallback((position: number) => {
    engineRef.current?.setPosition(position);
    const word = engineRef.current?.getCurrentWord();
    if (word) {
      setCurrentWord(word);
    }
    setCurrentIndex(position);
  }, []);

  const openBook = useCallback(async (book: Book) => {
    if (!engineRef.current) return;

    releaseWakeLock();
    await saveCurrentProgress({
      endSession: true,
      source: 'manual',
    });
    engineRef.current.stop();

    const latestBook = await bookRepository.getById(book.id) || book;
    if (!latestBook.content) {
      return;
    }

    resetPlaybackTracking();
    engineRef.current.loadText(latestBook.content);
    if (latestBook.currentPosition > 0) {
      engineRef.current.setPosition(latestBook.currentPosition);
    }

    const engineWord = engineRef.current.getCurrentWord();
    setCurrentWord(engineWord);
    setCurrentBook(latestBook);
    currentBookRef.current = latestBook;
    setTotalWords(engineRef.current.getTotalWords());
    setCurrentIndex(Math.min(latestBook.currentPosition, Math.max(engineRef.current.getTotalWords() - 1, 0)));
    setIsPlaying(false);
    setIsPaused(false);
    lastSavedSnapshotRef.current = {
      bookId: latestBook.id,
      position: latestBook.currentPosition,
      progress: latestBook.currentProgress,
    };
    persistLastSession(latestBook, latestBook.currentPosition, latestBook.currentProgress, 'manual');
    await Promise.all([
      loadBookmarks(latestBook.id),
      loadNotes(latestBook.id),
    ]);
  }, [loadBookmarks, loadNotes, persistLastSession, resetPlaybackTracking, saveCurrentProgress]);

  const closeBook = useCallback(async () => {
    releaseWakeLock();
    if (engineRef.current && currentBookRef.current) {
      capturePlaybackTime();
      engineRef.current.stop();
      await saveCurrentProgress({
        endSession: true,
        source: 'manual',
      });
    }

    setCurrentBook(null);
    currentBookRef.current = null;
    setCurrentWord(null);
    setCurrentIndex(0);
    setTotalWords(0);
    setIsPlaying(false);
    setIsPaused(false);
    setBookmarks([]);
    setNotes([]);
    resetPlaybackTracking();
  }, [capturePlaybackTime, resetPlaybackTracking, saveCurrentProgress]);

  const play = useCallback(() => {
    if (activePlaybackStartedAtRef.current === null) {
      activePlaybackStartedAtRef.current = Date.now();
    }
    engineRef.current?.play();
    setIsPlaying(true);
    setIsPaused(false);
    requestWakeLock();
  }, []);

  const pause = useCallback(() => {
    engineRef.current?.pause();
    capturePlaybackTime();
    setIsPaused(true);
    releaseWakeLock();
    void saveCurrentProgressRef.current?.({
      refreshLibrary: false,
      source: 'manual',
    });
  }, [capturePlaybackTime]);

  const toggle = useCallback(() => {
    if (!engineRef.current) return;

    if (engineRef.current.isPlayingState()) {
      if (engineRef.current.isPausedState()) {
        if (activePlaybackStartedAtRef.current === null) {
          activePlaybackStartedAtRef.current = Date.now();
        }
        engineRef.current.resume();
        setIsPaused(false);
        requestWakeLock();
      } else {
        engineRef.current.pause();
        capturePlaybackTime();
        setIsPaused(true);
        releaseWakeLock();
        void saveCurrentProgressRef.current?.({
          refreshLibrary: false,
          source: 'manual',
        });
      }
    } else {
      if (activePlaybackStartedAtRef.current === null) {
        activePlaybackStartedAtRef.current = Date.now();
      }
      engineRef.current.play();
      setIsPlaying(true);
      setIsPaused(false);
      requestWakeLock();
    }
  }, [capturePlaybackTime]);

  const skipForward = useCallback((count: number = 1) => {
    engineRef.current?.skipForward(count);
    const position = engineRef.current?.getPosition() || 0;
    setCurrentIndex(position);
    const word = engineRef.current?.getCurrentWord();
    if (word) {
      setCurrentWord(word);
    }
    void saveCurrentProgressRef.current?.({
      refreshLibrary: false,
      source: 'manual',
    });
  }, []);

  const skipBackward = useCallback((count: number = 1) => {
    engineRef.current?.skipBackward(count);
    const position = engineRef.current?.getPosition() || 0;
    setCurrentIndex(position);
    const word = engineRef.current?.getCurrentWord();
    if (word) {
      setCurrentWord(word);
    }
    void saveCurrentProgressRef.current?.({
      refreshLibrary: false,
      source: 'manual',
    });
  }, []);

  const setWpm = useCallback((wpm: number) => {
    void updateSettings({ wpm });
    // Force refresh current word with new delay values when WPM changes
    if (engineRef.current) {
      const word = engineRef.current.getCurrentWord();
      if (word) {
        // Recalculate delay based on new WPM
        const baseDelay = 60000 / wpm;
        const lengthBonus = Math.max(0, (word.text.length - 5) * 5);
        const updatedWord = {
          ...word,
          delay: Math.round(baseDelay + lengthBonus),
        };
        setCurrentWord(updatedWord);
      }
    }
  }, [updateSettings]);

  const seekToProgress = useCallback((percentage: number) => {
    const total = engineRef.current?.getTotalWords() || 1;
    const position = Math.floor((percentage / 100) * total);
    seekToPosition(position);
  }, [seekToPosition]);

  const addBookmark = useCallback(async (label?: string) => {
    const book = currentBookRef.current;
    const engine = engineRef.current;
    if (!book || !engine) return;

    const position = engine.getPosition();
    const currentWordText = engine.getCurrentWord()?.text || `Word ${position + 1}`;
    const bookmark = createBookmark(
      book.id,
      position,
      label?.trim() || currentWordText,
    );

    await bookmarkRepository.save(bookmark);
    await loadBookmarks(book.id);
    await saveCurrentProgress({
      refreshLibrary: false,
      source: 'manual',
    });
  }, [loadBookmarks, saveCurrentProgress]);

  const deleteBookmark = useCallback(async (id: string) => {
    await bookmarkRepository.delete(id);
    if (currentBookRef.current) {
      await loadBookmarks(currentBookRef.current.id);
    }
  }, [loadBookmarks]);

  const addNote = useCallback(async (content: string) => {
    const book = currentBookRef.current;
    const engine = engineRef.current;
    const trimmedContent = content.trim();
    if (!book || !engine || !trimmedContent) return;

    const position = engine.getPosition();
    const anchorText = engine.getCurrentWord()?.text || `Word ${position + 1}`;
    const note = createNote(book.id, position, anchorText, trimmedContent);
    await noteRepository.save(note);
    await loadNotes(book.id);
  }, [loadNotes]);

  const updateNote = useCallback(async (id: string, content: string) => {
    await noteRepository.update(id, content);
    if (currentBookRef.current) {
      await loadNotes(currentBookRef.current.id);
    }
  }, [loadNotes]);

  const deleteNote = useCallback(async (id: string) => {
    await noteRepository.delete(id);
    if (currentBookRef.current) {
      await loadNotes(currentBookRef.current.id);
    }
  }, [loadNotes]);

  const resumeLastSession = useCallback(async (options?: { autoplay?: boolean }) => {
    const session = readStoredSession();
    if (!session) {
      return false;
    }

    const book = await bookRepository.getById(session.bookId);
    if (!book) {
      return false;
    }

    setIsRestoringSession(true);
    try {
      await openBook(book);
      if (session.position > 0) {
        seekToPosition(session.position);
      }
      if (options?.autoplay ?? session.shouldResumePlayback) {
        play();
      }
      return true;
    } finally {
      setIsRestoringSession(false);
    }
  }, [openBook, play, seekToPosition]);

  const saveProgressNow = useCallback(async () => {
    await saveCurrentProgress({
      source: 'manual',
    });
  }, [saveCurrentProgress]);

  const progress = totalWords > 0 ? Math.round((currentIndex / totalWords) * 100) : 0;

  return (
    <ReaderContext.Provider value={{
      currentBook,
      currentWord,
      currentIndex,
      totalWords,
      progress,
      isPlaying,
      isPaused,
      isRestoringSession,
      wpm: settings.wpm,
      wpmPresets: WPM_PRESETS,
      bookmarks,
      notes,
      lastSession,
      openBook,
      closeBook,
      play,
      pause,
      toggle,
      skipForward,
      skipBackward,
      setWpm,
      seekToProgress,
      seekToPosition,
      syncToPosition,
      saveProgressNow,
      addBookmark,
      deleteBookmark,
      addNote,
      updateNote,
      deleteNote,
      resumeLastSession,
    }}>
      {children}
    </ReaderContext.Provider>
  );
}

export function useReader() {
  const context = useContext(ReaderContext);
  if (!context) {
    throw new Error('useReader must be used within a ReaderProvider');
  }
  return context;
}
