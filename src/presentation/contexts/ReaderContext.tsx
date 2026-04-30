// Reader Context - manages RSVP reading state
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import type { RSVPWord } from '../../domain/usecases/RSVPEngine';
import { RSVPEngine, WPM_PRESETS } from '../../domain/usecases/RSVPEngine';
import { useSettings } from './SettingsContext';
import { useLibrary } from './LibraryContext';
import type { Book } from '../../domain/entities/Book';
import { BookRepository } from '../../data/repositories/BookRepository';

interface ReaderContextType {
  currentBook: Book | null;
  currentWord: RSVPWord | null;
  currentIndex: number;
  totalWords: number;
  progress: number;
  isPlaying: boolean;
  isPaused: boolean;
  wpm: number;
  wpmPresets: typeof WPM_PRESETS;
  openBook: (book: Book) => void;
  closeBook: () => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  skipForward: (count?: number) => void;
  skipBackward: (count?: number) => void;
  setWpm: (wpm: number) => void;
  seekToProgress: (percentage: number) => void;
}

const ReaderContext = createContext<ReaderContextType | undefined>(undefined);

const bookRepository = new BookRepository();

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

interface ReaderProviderProps {
  children: ReactNode;
}

export function ReaderProvider({ children }: ReaderProviderProps) {
  const { settings, updateSettings } = useSettings();
  const { refreshLibrary } = useLibrary();
  const engineRef = useRef<RSVPEngine | null>(null);
  
  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  const [currentWord, setCurrentWord] = useState<RSVPWord | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalWords, setTotalWords] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Re-acquire wake lock if page becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isPlaying && !isPaused) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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
      setIsPlaying(false);
      setIsPaused(false);
      releaseWakeLock();
    });

    return () => {
      engineRef.current?.destroy();
      releaseWakeLock();
    };
  }, []);

  // Update engine settings when settings change
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setSettings(settings);
    }
  }, [settings]);

  const openBook = useCallback((book: Book) => {
    if (engineRef.current) {
      engineRef.current.stop();
      if (book.content) {
        engineRef.current.loadText(book.content);
        if (book.currentPosition > 0) {
          engineRef.current.setPosition(book.currentPosition);
          const wordAtPos = engineRef.current.getCurrentWord();
          setCurrentWord(wordAtPos);
        }
        setCurrentBook(book);
        setTotalWords(engineRef.current.getTotalWords());
        setCurrentIndex(book.currentPosition > 0 ? book.currentPosition : 0);
      }
    }
  }, []);

  const closeBook = useCallback(async () => {
    releaseWakeLock();
    if (engineRef.current && currentBook) {
      engineRef.current.stop();
      await bookRepository.updateProgress(
        currentBook.id,
        engineRef.current.getPosition(),
        engineRef.current.getProgress()
      );
      // Reload library so progress bar in library shows updated %
      if (refreshLibrary) {
        refreshLibrary();
      }
    }
    setCurrentBook(null);
    setCurrentWord(null);
    setCurrentIndex(0);
    setIsPlaying(false);
    setIsPaused(false);
  }, [currentBook]);

  const play = useCallback(() => {
    engineRef.current?.play();
    setIsPlaying(true);
    setIsPaused(false);
    requestWakeLock();
  }, []);

  const pause = useCallback(() => {
    engineRef.current?.pause();
    setIsPaused(true);
    releaseWakeLock();
  }, []);

  const toggle = useCallback(() => {
    if (engineRef.current?.isPlayingState()) {
      if (engineRef.current.isPausedState()) {
        engineRef.current.resume();
        setIsPaused(false);
        requestWakeLock();
      } else {
        engineRef.current.pause();
        setIsPaused(true);
        releaseWakeLock();
      }
    } else {
      engineRef.current?.play();
      setIsPlaying(true);
      setIsPaused(false);
      requestWakeLock();
    }
  }, []);

  const skipForward = useCallback((count: number = 1) => {
    engineRef.current?.skipForward(count);
  }, []);

  const skipBackward = useCallback((count: number = 1) => {
    engineRef.current?.skipBackward(count);
  }, []);

  const setWpm = useCallback((wpm: number) => {
    updateSettings({ wpm });
  }, [updateSettings]);

  const seekToProgress = useCallback((percentage: number) => {
    const total = engineRef.current?.getTotalWords() || 1;
    const position = Math.floor((percentage / 100) * total);
    engineRef.current?.setPosition(position);
    const word = engineRef.current?.getCurrentWord();
    if (word) setCurrentWord(word);
    setCurrentIndex(position);
  }, []);

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
      wpm: settings.wpm,
      wpmPresets: WPM_PRESETS,
      openBook,
      closeBook,
      play,
      pause,
      toggle,
      skipForward,
      skipBackward,
      setWpm,
      seekToProgress,
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
