import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getPreparedAudioStatus,
  isSpeechAvailable,
  pausePreparedAudio,
  playPreparedAudio,
  prepareBookAudio,
  prepareDeepgramAudio,
  seekPreparedAudio,
  setPreparedAudioWpm,
  speakText,
  stopPreparedAudio,
  stopSpeech,
  supportsNativeAudioTimeline,
} from '../../data/native/nativeTts';
import type { NativeAudioSegment, NativeAudioStatus } from '../../data/native/nativeTts';
import { fetchDeepgramVoiceManifest, fetchNaturalVoiceManifest, findWordAtAudioTime, looksLikeDirectDeepgramKey } from '../../data/native/naturalVoice';
import type { NaturalVoiceManifest } from '../../data/native/naturalVoice';
import { useReader } from '../contexts/ReaderContext';
import { useSettings } from '../contexts/SettingsContext';
import { Modal } from '../components/Modal';

const HIGHLIGHT_COLORS: Record<string, string> = {
  red: '#ff4444',
  yellow: '#ffdd44',
  cyan: '#44ffff',
  green: '#44ff88',
  blue: '#4488ff',
  white: '#ffffff',
};

// Warm mode color filters (reduce blue light)
const WARM_FILTERS: Record<string, string> = {
  off: 'none',
  low: 'sepia(10%) saturate(110%) brightness(105%)',
  medium: 'sepia(25%) saturate(130%) brightness(102%)',
  high: 'sepia(40%) saturate(150%) brightness(100%)',
};

interface SearchResult {
  position: number;
  snippet: string;
}

interface DictionaryDefinition {
  word: string;
  phonetic?: string;
  partOfSpeech?: string;
  definition: string;
  example?: string;
}

function normalizeWord(word: string) {
  return word.toLowerCase().replace(/[^a-z0-9']/gi, '');
}

function normalizeDictionaryWord(word: string) {
  return word.toLowerCase().replace(/^[^a-z]+|[^a-z]+$/gi, '').replace(/'s$/i, '');
}

function readDictionaryCache(word: string): DictionaryDefinition | null {
  try {
    const cached = localStorage.getItem(`rsvp_dictionary_${word}`);
    return cached ? JSON.parse(cached) as DictionaryDefinition : null;
  } catch {
    return null;
  }
}

function writeDictionaryCache(word: string, definition: DictionaryDefinition) {
  try {
    localStorage.setItem(`rsvp_dictionary_${word}`, JSON.stringify(definition));
  } catch {
    // Dictionary cache is optional; storage pressure should not block reading.
  }
}

function extractDictionaryDefinition(data: unknown, fallbackWord: string): DictionaryDefinition | null {
  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  const entry = data[0] as {
    word?: string;
    phonetic?: string;
    meanings?: Array<{
      partOfSpeech?: string;
      definitions?: Array<{ definition?: string; example?: string }>;
    }>;
  };

  const meaning = entry.meanings?.find((item) => item.definitions?.[0]?.definition);
  const firstDefinition = meaning?.definitions?.[0];
  if (!firstDefinition?.definition) {
    return null;
  }

  return {
    word: entry.word || fallbackWord,
    phonetic: entry.phonetic,
    partOfSpeech: meaning?.partOfSpeech,
    definition: firstDefinition.definition,
    example: firstDefinition.example,
  };
}

function buildSpeechChunk(content: string, startIndex: number) {
  const words = content.split(/\s+/).filter(Boolean);
  const start = Math.max(0, Math.min(startIndex, words.length - 1));
  const minWords = 3;
  const maxWords = 7;
  let end = Math.min(words.length, start + maxWords);

  for (let index = start + minWords; index < end; index += 1) {
    if (/[.!?;:]$/.test(words[index])) {
      end = index + 1;
      break;
    }
  }

  return {
    start,
    end,
    text: words.slice(start, end).join(' '),
  };
}

function hashText(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function punctuationPauseForWord(word: string, fallbackPauseMs: number) {
  if (/[,)]$/.test(word)) return Math.round(fallbackPauseMs * 0.45);
  if (/[;:]$/.test(word)) return Math.round(fallbackPauseMs * 0.7);
  if (/[.!?]$/.test(word)) return fallbackPauseMs;
  return 0;
}

function buildAudioTimelineSegments(content: string, punctuationPauseMs: number): NativeAudioSegment[] {
  const words = content.split(/\s+/).filter(Boolean);
  const segments: NativeAudioSegment[] = [];
  let index = 0;

  while (index < words.length) {
    const startWord = index;
    const minWords = 3;
    const maxWords = 8;
    let endExclusive = Math.min(words.length, startWord + maxWords);

    for (let cursor = startWord + minWords - 1; cursor < endExclusive; cursor += 1) {
      if (/[,;:.!?]$/.test(words[cursor])) {
        endExclusive = cursor + 1;
        break;
      }
    }

    const phraseWords = words.slice(startWord, endExclusive);
    const lastWord = phraseWords[phraseWords.length - 1] || '';
    segments.push({
      id: `segment-${segments.length}`,
      startWord,
      endWord: Math.max(startWord, endExclusive - 1),
      text: phraseWords.join(' '),
      pauseMs: punctuationPauseForWord(lastWord, punctuationPauseMs),
    });

    index = endExclusive;
  }

  return segments;
}

function buildNaturalVoiceSegments(content: string, punctuationPauseMs: number): NativeAudioSegment[] {
  const words = content.split(/\s+/).filter(Boolean);
  const segments: NativeAudioSegment[] = [];
  let index = 0;

  while (index < words.length) {
    const startWord = index;
    const minWords = 35;
    const maxWords = 180;
    const maxChars = 1500;
    let endExclusive = Math.min(words.length, startWord + maxWords);
    let charCount = 0;
    let bestSentenceEnd = -1;
    let bestCommaEnd = -1;

    for (let cursor = startWord; cursor < Math.min(words.length, startWord + maxWords); cursor += 1) {
      charCount += words[cursor].length + 1;
      if (charCount > maxChars) {
        endExclusive = Math.max(cursor, startWord + 1);
        break;
      }

      const offset = cursor - startWord + 1;
      if (offset >= minWords && /[.!?]$/.test(words[cursor])) {
        bestSentenceEnd = cursor + 1;
        break;
      }
      if (offset >= minWords && /[,;:]$/.test(words[cursor])) {
        bestCommaEnd = cursor + 1;
      }
    }

    if (bestSentenceEnd > -1) {
      endExclusive = bestSentenceEnd;
    } else if (bestCommaEnd > -1) {
      endExclusive = bestCommaEnd;
    }

    const segmentWords = words.slice(startWord, endExclusive);
    const lastWord = segmentWords[segmentWords.length - 1] || '';
    segments.push({
      id: `natural-segment-${segments.length}`,
      startWord,
      endWord: Math.max(startWord, endExclusive - 1),
      text: segmentWords.join(' '),
      pauseMs: punctuationPauseForWord(lastWord, punctuationPauseMs),
    });

    index = endExclusive;
  }

  return segments;
}

function formatVoiceStatus(status: NativeAudioStatus | null, nativeAudioTimeline: boolean, ttsEnabled: boolean) {
  if (!ttsEnabled) return '';
  if (!nativeAudioTimeline) return 'Live voice';
  if (!status?.supported) return 'Voice unavailable';
  if (status.totalSegments > 0 && status.generatedSegments < status.totalSegments) {
    return `Preparing voice ${Math.round((status.generatedSegments / status.totalSegments) * 100)}%`;
  }
  if (status.playing) return 'Voice playing';
  if (status.ready) return 'Voice ready';
  return 'Preparing voice';
}

function formatNaturalVoiceStatus(status: 'idle' | 'loading' | 'ready' | 'error', enabled: boolean, ttsEnabled: boolean) {
  if (!ttsEnabled) return '';
  if (!enabled) return '';
  if (status === 'loading') return 'Preparing natural voice';
  if (status === 'ready') return 'Natural voice ready';
  if (status === 'error') return 'Natural voice unavailable';
  return 'Natural voice configured';
}

function formatSavedTime(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'recently';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function ReaderScreen() {
  const navigate = useNavigate();
  const {
    currentBook,
    currentWord,
    currentIndex,
    totalWords,
    progress,
    isPlaying,
    isPaused,
    isRestoringSession,
    wpm,
    wpmPresets,
    bookmarks,
    notes,
    lastSession,
    toggle,
    pause,
    play,
    skipForward,
    skipBackward,
    setWpm,
    seekToProgress,
    seekToPosition,
    syncToPosition,
    closeBook,
    addBookmark,
    deleteBookmark,
    addNote,
    updateNote,
    deleteNote,
    resumeLastSession,
    saveProgressNow,
  } = useReader();

  const { settings } = useSettings();
  const [showControls, setShowControls] = useState(true);
  const [isFrozen, setIsFrozen] = useState(false);
  const [showBreakReminder, setShowBreakReminder] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [bookmarkLabel, setBookmarkLabel] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [jumpInput, setJumpInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchMessage, setSearchMessage] = useState('');
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [speechAvailable, setSpeechAvailable] = useState(false);
  const [audioStatus, setAudioStatus] = useState<NativeAudioStatus | null>(null);
  const [naturalVoiceManifest, setNaturalVoiceManifest] = useState<NaturalVoiceManifest | null>(null);
  const [naturalVoiceStatus, setNaturalVoiceStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [dictionaryDefinition, setDictionaryDefinition] = useState<DictionaryDefinition | null>(null);
  const [dictionaryStatus, setDictionaryStatus] = useState<'idle' | 'loading' | 'ready' | 'missing' | 'error'>('idle');
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const freezeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const breakReminderTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasPlayingBeforeFreeze = useRef(false);
  const attemptedSessionRestore = useRef(false);
  const activeSpeechChunk = useRef<{ start: number; end: number; wpm: number } | null>(null);
  const lastNativeAudioIndex = useRef<number | null>(null);
  const currentIndexRef = useRef(0);
  const wpmRef = useRef(wpm);
  const naturalAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastNaturalVoiceWord = useRef<number | null>(null);
  const nativeAudioTimeline = supportsNativeAudioTimeline();
  const showQuickActions = !isPlaying || isPaused;
  const currentDictionaryWord = currentWord ? normalizeDictionaryWord(currentWord.text) : '';
  const configuredVoiceValue = settings.naturalVoiceEndpoint.trim();
  const directDeepgramKey = looksLikeDirectDeepgramKey(configuredVoiceValue);
  const nativeDeepgramEnabled = nativeAudioTimeline && directDeepgramKey;
  const browserDeepgramEnabled = !nativeAudioTimeline && directDeepgramKey;
  const manifestVoiceEnabled = !!configuredVoiceValue && !directDeepgramKey;
  const htmlNaturalVoiceEnabled = manifestVoiceEnabled || browserDeepgramEnabled;
  const voiceAvailable = speechAvailable || nativeDeepgramEnabled;
  const voiceStatus = formatNaturalVoiceStatus(naturalVoiceStatus, htmlNaturalVoiceEnabled, ttsEnabled)
    || formatVoiceStatus(audioStatus, nativeAudioTimeline, ttsEnabled);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    wpmRef.current = wpm;
  }, [wpm]);

  useEffect(() => {
    if (currentBook || attemptedSessionRestore.current) {
      return;
    }

    attemptedSessionRestore.current = true;
    void resumeLastSession();
  }, [currentBook, resumeLastSession]);

  useEffect(() => {
    void isSpeechAvailable().then(setSpeechAvailable);
  }, []);

  useEffect(() => {
    if (htmlNaturalVoiceEnabled || nativeAudioTimeline || !ttsEnabled || !speechAvailable || !currentBook?.content || !isPlaying || isPaused || isFrozen) {
      return;
    }

    const activeChunk = activeSpeechChunk.current;
    if (activeChunk && activeChunk.wpm === wpm && currentIndex >= activeChunk.start && currentIndex < activeChunk.end) {
      return;
    }

    const speechChunk = buildSpeechChunk(currentBook.content, currentIndex);
    if (!speechChunk.text) {
      return;
    }

    activeSpeechChunk.current = {
      start: speechChunk.start,
      end: speechChunk.end,
      wpm,
    };

    void speakText(speechChunk.text, wpm);
  }, [currentBook?.content, currentIndex, htmlNaturalVoiceEnabled, isFrozen, isPaused, isPlaying, nativeAudioTimeline, speechAvailable, ttsEnabled, wpm]);

  useEffect(() => {
    if (!currentBook?.content || !htmlNaturalVoiceEnabled) {
      setNaturalVoiceManifest(null);
      setNaturalVoiceStatus('idle');
      return;
    }

    const contentHash = hashText(`${currentBook.content}:natural:${settings.punctuationPause}:${settings.punctuationPauseMs}`);
    const segments = buildNaturalVoiceSegments(
      currentBook.content,
      settings.punctuationPause ? settings.punctuationPauseMs : 0,
    );

    const controller = new AbortController();
    setNaturalVoiceManifest(null);
    setNaturalVoiceStatus('loading');

    const request = {
      bookId: currentBook.id,
      title: currentBook.title,
      author: currentBook.author,
      contentHash,
      wpm,
      segments,
    };

    const manifestPromise = browserDeepgramEnabled
      ? fetchDeepgramVoiceManifest(settings.naturalVoiceEndpoint, request)
      : fetchNaturalVoiceManifest(settings.naturalVoiceEndpoint, request);

    void manifestPromise
      .then((manifest) => {
        if (!controller.signal.aborted) {
          setNaturalVoiceManifest(manifest);
          setNaturalVoiceStatus('ready');
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setNaturalVoiceManifest(null);
          setNaturalVoiceStatus('error');
        }
      });

    return () => {
      controller.abort();
    };
  }, [browserDeepgramEnabled, currentBook?.author, currentBook?.content, currentBook?.id, currentBook?.title, htmlNaturalVoiceEnabled, settings.naturalVoiceEndpoint, settings.punctuationPause, settings.punctuationPauseMs, wpm]);

  useEffect(() => {
    if (!naturalVoiceManifest) {
      naturalAudioRef.current?.pause();
      naturalAudioRef.current = null;
      return;
    }

    const audio = new Audio(naturalVoiceManifest.audioUrl);
    audio.preload = 'auto';
    naturalAudioRef.current = audio;

    const syncFromAudio = () => {
      const wordIndex = findWordAtAudioTime(naturalVoiceManifest.marks, audio.currentTime * 1000);
      if (wordIndex === null || wordIndex === lastNaturalVoiceWord.current) {
        return;
      }
      lastNaturalVoiceWord.current = wordIndex;
      syncToPosition(wordIndex);
    };

    audio.addEventListener('timeupdate', syncFromAudio);
    audio.addEventListener('seeked', syncFromAudio);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', syncFromAudio);
      audio.removeEventListener('seeked', syncFromAudio);
      if (naturalAudioRef.current === audio) {
        naturalAudioRef.current = null;
      }
    };
  }, [naturalVoiceManifest, syncToPosition]);

  useEffect(() => {
    if (!naturalVoiceManifest || !naturalAudioRef.current) {
      return;
    }

    naturalAudioRef.current.playbackRate = Math.max(0.65, Math.min(2.0, wpm / 300));
  }, [naturalVoiceManifest, wpm]);

  useEffect(() => {
    if (!htmlNaturalVoiceEnabled || !ttsEnabled || !naturalVoiceManifest || !naturalAudioRef.current) {
      naturalAudioRef.current?.pause();
      return;
    }

    const audio = naturalAudioRef.current;
    if (!isPlaying || isPaused || isFrozen) {
      audio.pause();
      return;
    }

    const targetWord = currentIndexRef.current;
    const mark = naturalVoiceManifest.marks.find((item) => item.wordIndex >= targetWord) || naturalVoiceManifest.marks[0];
    if (mark && Math.abs(audio.currentTime * 1000 - mark.startMs) > 1200) {
      audio.currentTime = mark.startMs / 1000;
    }

    void audio.play();
  }, [currentIndex, htmlNaturalVoiceEnabled, isFrozen, isPaused, isPlaying, naturalVoiceManifest, ttsEnabled]);

  useEffect(() => {
    if (htmlNaturalVoiceEnabled || !nativeAudioTimeline || (!nativeDeepgramEnabled && !speechAvailable) || !currentBook?.content) {
      return;
    }

    const pauseMs = settings.punctuationPause ? settings.punctuationPauseMs : 0;

    if (nativeDeepgramEnabled) {
      const contentHash = hashText(`${currentBook.content}:deepgram:${settings.punctuationPause}:${settings.punctuationPauseMs}`);
      void prepareDeepgramAudio({
        apiKey: configuredVoiceValue,
        bookId: currentBook.id,
        contentHash,
        segments: buildNaturalVoiceSegments(currentBook.content, pauseMs),
        wpm: wpmRef.current,
      });
      return;
    }

    const contentHash = hashText(`${currentBook.content}:native:${settings.punctuationPause}:${settings.punctuationPauseMs}`);
    void prepareBookAudio({
      bookId: currentBook.id,
      contentHash,
      segments: buildAudioTimelineSegments(currentBook.content, pauseMs),
      wpm: wpmRef.current,
    });
  }, [configuredVoiceValue, currentBook?.content, currentBook?.id, htmlNaturalVoiceEnabled, nativeAudioTimeline, nativeDeepgramEnabled, settings.punctuationPause, settings.punctuationPauseMs, speechAvailable]);

  useEffect(() => {
    if (!nativeAudioTimeline || !currentBook) {
      setAudioStatus(null);
      return;
    }

    let cancelled = false;
    const loadStatus = async () => {
      const status = await getPreparedAudioStatus();
      if (!cancelled) {
        setAudioStatus(status);
      }
    };

    void loadStatus();
    const intervalId = window.setInterval(() => {
      void loadStatus();
    }, 750);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [currentBook, nativeAudioTimeline]);

  useEffect(() => {
    if (htmlNaturalVoiceEnabled || !nativeAudioTimeline || !currentBook || !ttsEnabled) {
      void stopPreparedAudio();
      lastNativeAudioIndex.current = null;
      return;
    }

    if (!isPlaying || isPaused || isFrozen) {
      void pausePreparedAudio();
      return;
    }

    const startIndex = currentIndexRef.current;
    lastNativeAudioIndex.current = startIndex;
    void playPreparedAudio(currentBook.id, startIndex, wpmRef.current);
  }, [currentBook, htmlNaturalVoiceEnabled, isFrozen, isPaused, isPlaying, nativeAudioTimeline, ttsEnabled]);

  useEffect(() => {
    if (htmlNaturalVoiceEnabled || !nativeAudioTimeline || !ttsEnabled) {
      return;
    }

    void setPreparedAudioWpm(wpm);
  }, [htmlNaturalVoiceEnabled, nativeAudioTimeline, ttsEnabled, wpm]);

  useEffect(() => {
    if (!nativeAudioTimeline || !ttsEnabled || !isPlaying || isPaused || isFrozen) {
      lastNativeAudioIndex.current = currentIndex;
      return;
    }

    const previousIndex = lastNativeAudioIndex.current;
    lastNativeAudioIndex.current = currentIndex;
    if (previousIndex !== null && Math.abs(currentIndex - previousIndex) > 2) {
      void seekPreparedAudio(currentIndex, wpm);
    }
  }, [currentIndex, isFrozen, isPaused, isPlaying, nativeAudioTimeline, ttsEnabled, wpm]);

  useEffect(() => {
    if (!ttsEnabled) {
      activeSpeechChunk.current = null;
      naturalAudioRef.current?.pause();
      void stopSpeech();
      void stopPreparedAudio();
    }
  }, [ttsEnabled]);

  useEffect(() => {
    if (!isPlaying || isPaused || isFrozen || !ttsEnabled) {
      activeSpeechChunk.current = null;
      void stopSpeech();
      if (!nativeAudioTimeline) {
        return;
      }
      void pausePreparedAudio();
    }
  }, [isPlaying, isPaused, isFrozen, nativeAudioTimeline, ttsEnabled]);

  useEffect(() => {
    return () => {
      void stopPreparedAudio();
      void stopSpeech();
    };
  }, []);

  useEffect(() => {
    if (!showQuickActions || !currentDictionaryWord) {
      setDictionaryDefinition(null);
      setDictionaryStatus('idle');
      return;
    }

    const cached = readDictionaryCache(currentDictionaryWord);
    if (cached) {
      setDictionaryDefinition(cached);
      setDictionaryStatus('ready');
      return;
    }

    const controller = new AbortController();
    setDictionaryDefinition(null);
    setDictionaryStatus('loading');

    void fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(currentDictionaryWord)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          setDictionaryStatus(response.status === 404 ? 'missing' : 'error');
          return;
        }

        const definition = extractDictionaryDefinition(await response.json(), currentDictionaryWord);
        if (!definition) {
          setDictionaryStatus('missing');
          return;
        }

        writeDictionaryCache(currentDictionaryWord, definition);
        setDictionaryDefinition(definition);
        setDictionaryStatus('ready');
      })
      .catch((error) => {
        if ((error as Error).name !== 'AbortError') {
          setDictionaryStatus('error');
        }
      });

    return () => {
      controller.abort();
    };
  }, [currentDictionaryWord, showQuickActions]);

  // Break reminder timer
  useEffect(() => {
    if (settings.breakReminders && isPlaying && !isPaused) {
      breakReminderTimer.current = setTimeout(() => {
        setShowBreakReminder(true);
      }, settings.breakReminderMinutes * 60 * 1000);
    }

    return () => {
      if (breakReminderTimer.current) {
        clearTimeout(breakReminderTimer.current);
      }
    };
  }, [settings.breakReminders, settings.breakReminderMinutes, isPlaying, isPaused]);

  // When frozen becomes true, actually pause the engine
  useEffect(() => {
    if (isFrozen) {
      wasPlayingBeforeFreeze.current = isPlaying && !isPaused;
      pause();
    } else if (wasPlayingBeforeFreeze.current) {
      play();
      wasPlayingBeforeFreeze.current = false;
    }
  }, [isFrozen, pause, play, isPlaying, isPaused]);

  // Focus mode: auto-hide controls after 3 seconds of playing
  useEffect(() => {
    if (settings.focusMode && isPlaying && !isPaused && !isFrozen) {
      setShowControls(false);
      if (hideControlsTimer.current) {
        clearTimeout(hideControlsTimer.current);
      }
      hideControlsTimer.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    } else if (!settings.focusMode || isFrozen) {
      setShowControls(true);
    }

    return () => {
      if (hideControlsTimer.current) {
        clearTimeout(hideControlsTimer.current);
      }
    };
  }, [settings.focusMode, isPlaying, isPaused, isFrozen]);

  const dismissBreakReminder = () => {
    setShowBreakReminder(false);
    if (settings.breakReminders && isPlaying && !isPaused) {
      breakReminderTimer.current = setTimeout(() => {
        setShowBreakReminder(true);
      }, settings.breakReminderMinutes * 60 * 1000);
    }
  };

  const renderWord = () => {
    if (!currentWord) {
      if (isRestoringSession) {
        return <span className="text-gray-500"> Restoring your last session...</span>;
      }
      return <span className="text-gray-500"> Select a book to start</span>;
    }

    const word = currentWord.text;
    const orpIndex = currentWord.orpIndex;
    const before = word.slice(0, orpIndex);
    const orp = word[orpIndex] || '';
    const after = word.slice(orpIndex + 1);
    const highlightColor = HIGHLIGHT_COLORS[settings.highlightColor] || HIGHLIGHT_COLORS.red;

    const fontFamily =
      settings.fontFamily === 'OpenDyslexic' ? "'OpenDyslexic', sans-serif" :
      settings.fontFamily === 'Atkinson Hyperlegible' ? "'Atkinson Hyperlegible', sans-serif" :
      'monospace';

    return (
      <span
        className={`font-mono ${isFrozen ? 'animate-pulse' : ''}`}
        style={{
          fontSize: `${settings.fontSize}px`,
          fontFamily,
        }}
      >
        {before}
        <span className="font-bold" style={{ color: highlightColor }}>{orp}</span>
        {after}
      </span>
    );
  };

  const getPhantomWords = () => {
    if (!currentWord || !currentBook?.content) return { prev: '', next: '' };

    const words = currentBook.content.split(/\s+/);
    const prevWord = currentIndex > 0 ? words[currentIndex - 1] : '';
    const nextWord = currentIndex < words.length - 1 ? words[currentIndex + 1] : '';

    return { prev: prevWord, next: nextWord };
  };

  const formatTime = () => {
    if (!currentBook || totalWords === 0) return '0:00';
    const wordsRemaining = Math.max(totalWords - currentIndex, 0);
    const minutes = Math.ceil(wordsRemaining / wpm);
    return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    seekToProgress(percentage);
  };

  const handleBack = async () => {
    await closeBook();
    navigate('/library');
  };

  const handleTouchStart = () => {
    if (!settings.tapToFreeze || !currentWord || !isPlaying || isPaused) return;

    if (freezeTimer.current) {
      clearTimeout(freezeTimer.current);
    }

    freezeTimer.current = setTimeout(() => {
      setIsFrozen(true);
      setShowControls(true);
    }, 400);
  };

  const handleTouchEnd = () => {
    if (freezeTimer.current) {
      clearTimeout(freezeTimer.current);
      freezeTimer.current = null;
    }

    if (isFrozen) {
      setIsFrozen(false);
    }
  };

  const handleTouchCancel = () => {
    if (freezeTimer.current) {
      clearTimeout(freezeTimer.current);
      freezeTimer.current = null;
    }
    setIsFrozen(false);
  };

  const handleTap = () => {
    if (settings.focusMode) {
      setShowControls(true);
      if (hideControlsTimer.current) {
        clearTimeout(hideControlsTimer.current);
      }
      hideControlsTimer.current = setTimeout(() => {
        if (isPlaying && !isPaused && !isFrozen) {
          setShowControls(false);
        }
      }, 3000);
    } else {
      setShowControls(!showControls);
    }
  };

  const handleSaveBookmark = async () => {
    await addBookmark(bookmarkLabel);
    setBookmarkLabel('');
  };

  const handleSaveNote = async () => {
    if (!noteInput.trim()) return;
    await addNote(noteInput);
    setNoteInput('');
  };

  const handleJump = () => {
    const value = jumpInput.trim();
    if (!value || !currentBook) return;

    if (value.endsWith('%')) {
      const percentage = Number(value.slice(0, -1));
      if (!Number.isNaN(percentage)) {
        seekToProgress(Math.max(0, Math.min(percentage, 100)));
        setJumpInput('');
      }
      return;
    }

    const wordNumber = Number(value);
    if (!Number.isNaN(wordNumber)) {
      seekToPosition(Math.max(0, Math.min(wordNumber - 1, totalWords - 1)));
      setJumpInput('');
    }
  };

  const handleSearch = () => {
    if (!currentBook?.content) return;

    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      setSearchMessage('');
      return;
    }

    const rawWords = currentBook.content.split(/\s+/);
    const normalizedWords = rawWords.map(normalizeWord);
    const queryWords = query.split(/\s+/).map(normalizeWord).filter(Boolean);
    const matches: SearchResult[] = [];

    for (let i = 0; i < normalizedWords.length; i++) {
      if (queryWords.length === 1) {
        if (!normalizedWords[i].includes(queryWords[0])) {
          continue;
        }
      } else {
        let phraseMatches = true;
        for (let j = 0; j < queryWords.length; j++) {
          if (normalizedWords[i + j] !== queryWords[j]) {
            phraseMatches = false;
            break;
          }
        }
        if (!phraseMatches) {
          continue;
        }
      }

      const snippetStart = Math.max(0, i - 3);
      const snippetEnd = Math.min(rawWords.length, i + queryWords.length + 4);
      matches.push({
        position: i,
        snippet: rawWords.slice(snippetStart, snippetEnd).join(' '),
      });

      if (matches.length >= 12) {
        break;
      }
    }

    setSearchResults(matches);
    setSearchMessage(matches.length === 0 ? 'No matches found' : `Found ${matches.length} match${matches.length === 1 ? '' : 'es'}`);
  };

  const warmFilter = WARM_FILTERS[settings.warmMode] || WARM_FILTERS.off;
  const phantomStyle = { fontSize: `${Math.max(settings.fontSize * 0.5, 20)}px`, color: settings.warmMode !== 'off' ? '#886644' : '#666666' };
  const phantomFontFamily =
    settings.fontFamily === 'OpenDyslexic' ? "'OpenDyslexic', sans-serif" :
    settings.fontFamily === 'Atkinson Hyperlegible' ? "'Atkinson Hyperlegible', sans-serif" :
    'monospace';
  const phantomWords = settings.showPhantomWords && currentWord ? getPhantomWords() : null;

  return (
    <div
      className="flex flex-col h-full bg-black select-none touch-none"
      style={{ filter: warmFilter }}
      onClick={handleTap}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
    >
      <Modal isOpen={showTools} onClose={() => setShowTools(false)} title="Reader Tools">
        <div className="space-y-5">
          {lastSession && (
            <div className="rounded-xl border border-gray-700 bg-gray-900 p-3 text-sm text-gray-300">
              <div className="font-medium text-white">Resume diagnostics</div>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-400">
                <span>{lastSession.progress}% complete</span>
                <span>Saved {formatSavedTime(lastSession.lastSavedAt)}</span>
                <span className="capitalize">{lastSession.lastSavedSource}</span>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-gray-700 bg-gray-900 p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-white">TTS Assist</div>
                <div className="text-xs text-gray-400">Speak each RSVP word in sync with playback</div>
              </div>
              <button
                disabled={!voiceAvailable}
                onClick={() => setTtsEnabled((value) => !value)}
                className={`w-12 h-6 rounded-full transition-colors ${ttsEnabled ? 'bg-blue-500' : 'bg-gray-600'} disabled:opacity-50`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${ttsEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>
            {!voiceAvailable && (
              <div className="mt-2 text-xs text-amber-300">Speech synthesis is not available on this device/browser.</div>
            )}
            {!speechAvailable && nativeDeepgramEnabled && (
              <div className="mt-2 text-xs text-blue-300">Using Deepgram natural voice instead of device speech synthesis.</div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-white">Quick bookmark</h3>
              <button
                onClick={() => { void saveProgressNow(); }}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Save progress now
              </button>
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={bookmarkLabel}
                onChange={(e) => setBookmarkLabel(e.target.value)}
                placeholder={currentWord?.text ? `Default: ${currentWord.text}` : 'Bookmark note'}
                className="flex-1 rounded-lg bg-gray-800 px-3 py-2 text-sm text-white outline-none"
              />
              <button
                onClick={() => { void handleSaveBookmark(); }}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-500"
              >
                Save
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-white">Jump to location</h3>
            <div className="mt-2 flex gap-2">
              <input
                value={jumpInput}
                onChange={(e) => setJumpInput(e.target.value)}
                placeholder="Word number or 45%"
                className="flex-1 rounded-lg bg-gray-800 px-3 py-2 text-sm text-white outline-none"
              />
              <button
                onClick={handleJump}
                className="rounded-lg bg-gray-700 px-3 py-2 text-sm text-white hover:bg-gray-600"
              >
                Jump
              </button>
            </div>
          </div>

          {currentBook && currentBook.chapters.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-white">Chapters</h3>
              <div className="mt-3 max-h-48 space-y-2 overflow-auto">
                {currentBook.chapters.map((chapter) => (
                  <button
                    key={chapter.id}
                    onClick={() => {
                      seekToPosition(chapter.startWord);
                      setShowTools(false);
                    }}
                    className="block w-full rounded-lg bg-gray-900 px-3 py-2 text-left hover:bg-gray-800"
                  >
                    <div className="text-sm text-white">{chapter.title}</div>
                    <div className="text-xs text-gray-500">Word {chapter.startWord + 1}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-medium text-white">Search this book</h3>
            <div className="mt-2 flex gap-2">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search word or phrase"
                className="flex-1 rounded-lg bg-gray-800 px-3 py-2 text-sm text-white outline-none"
              />
              <button
                onClick={handleSearch}
                className="rounded-lg bg-gray-700 px-3 py-2 text-sm text-white hover:bg-gray-600"
              >
                Find
              </button>
            </div>
            {searchMessage && <p className="mt-2 text-xs text-gray-400">{searchMessage}</p>}
            <div className="mt-3 space-y-2">
              {searchResults.map((result) => (
                <button
                  key={`${result.position}-${result.snippet}`}
                  onClick={() => {
                    seekToPosition(result.position);
                    setShowTools(false);
                  }}
                  className="block w-full rounded-lg bg-gray-900 px-3 py-2 text-left hover:bg-gray-800"
                >
                  <div className="text-xs text-blue-400">Word {result.position + 1}</div>
                  <div className="text-sm text-gray-200">{result.snippet}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-white">Bookmarks</h3>
            <div className="mt-3 space-y-2">
              {bookmarks.length === 0 ? (
                <p className="text-sm text-gray-500">No bookmarks yet.</p>
              ) : (
                bookmarks.map((bookmark) => (
                  <div key={bookmark.id} className="flex items-center justify-between gap-3 rounded-lg bg-gray-900 px-3 py-2">
                    <button
                      onClick={() => {
                        seekToPosition(bookmark.position);
                        setShowTools(false);
                      }}
                      className="min-w-0 text-left"
                    >
                      <div className="truncate text-sm text-white">{bookmark.label}</div>
                      <div className="text-xs text-gray-500">Word {bookmark.position + 1}</div>
                    </button>
                    <button
                      onClick={() => { void deleteBookmark(bookmark.id); }}
                      className="rounded-lg bg-gray-800 px-2 py-1 text-xs text-red-300 hover:bg-red-950"
                    >
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-white">Notes & annotations</h3>
            <div className="mt-2 space-y-2">
              <textarea
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="Write a note for this word or passage"
                rows={3}
                className="w-full rounded-lg bg-gray-800 px-3 py-2 text-sm text-white outline-none"
              />
              <button
                onClick={() => { void handleSaveNote(); }}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-500"
              >
                Save note
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {notes.length === 0 ? (
                <p className="text-sm text-gray-500">No notes yet.</p>
              ) : (
                notes.map((note) => (
                  <div key={note.id} className="rounded-lg bg-gray-900 px-3 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <button
                        onClick={() => {
                          seekToPosition(note.position);
                          setShowTools(false);
                        }}
                        className="min-w-0 text-left"
                      >
                        <div className="text-xs text-blue-400">Word {note.position + 1} · {note.anchorText}</div>
                        <div className="mt-1 text-sm text-gray-200 whitespace-pre-wrap">{note.content}</div>
                      </button>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const next = prompt('Edit note', note.content);
                            if (next && next.trim()) {
                              void updateNote(note.id, next);
                            }
                          }}
                          className="rounded-lg bg-gray-800 px-2 py-1 text-xs text-gray-200 hover:bg-gray-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => { void deleteNote(note.id); }}
                          className="rounded-lg bg-gray-800 px-2 py-1 text-xs text-red-300 hover:bg-red-950"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </Modal>

      {showBreakReminder && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-8"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-surface rounded-2xl p-6 text-center max-w-sm">
            <div className="text-4xl mb-4">☕</div>
            <h3 className="text-lg font-semibold mb-2">Time for a Break!</h3>
            <p className="text-gray-400 text-sm mb-4">
              You've been reading for {settings.breakReminderMinutes} minutes.
              Look away, stretch, and rest your eyes.
            </p>
            <div className="flex gap-3">
              <button
                onClick={(e) => { e.stopPropagation(); dismissBreakReminder(); }}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
              >
                Continue Reading
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  dismissBreakReminder();
                  void handleBack();
                }}
                className="flex-1 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm"
              >
                Take a Break
              </button>
            </div>
          </div>
        </div>
      )}

      {isFrozen && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-blue-600/90 text-white text-xs px-3 py-1 rounded-full z-30">
          ⏸️ FROZEN - Lift finger to continue
        </div>
      )}

      <header className={`flex items-center justify-between p-4 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <button onClick={() => { void handleBack(); }} className="p-2">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm text-gray-400 truncate max-w-[200px]">
          {currentBook?.title || 'Reader'}
        </span>
        <button onClick={(e) => { e.stopPropagation(); setShowTools(true); }} className="p-2 opacity-70">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4">
        {phantomWords && (
          <div style={{ ...phantomStyle, fontFamily: phantomFontFamily, height: '30px' }}>
            {phantomWords.prev}
          </div>
        )}

        <div className={`transition-opacity ${settings.fadeEffect ? 'duration-100' : ''}`}>
          {renderWord()}
        </div>

        {phantomWords && (
          <div style={{ ...phantomStyle, fontFamily: phantomFontFamily, height: '30px' }}>
            {phantomWords.next}
          </div>
        )}

        <div className="mt-8 text-gray-500 text-sm">
          {currentIndex + 1} / {totalWords}
        </div>
      </main>

      <footer className={`p-4 transition-opacity duration-300 ${showControls ? 'max-h-[62vh] overflow-y-auto overscroll-contain touch-pan-y opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {settings.showProgressBar && (
          <div
            className="h-1 bg-gray-800 rounded-full cursor-pointer"
            onClick={handleProgressClick}
          >
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>{formatTime()} remaining</span>
          {settings.showWpmIndicator && <span>{wpm} WPM</span>}
        </div>

        <div className="flex items-center justify-center gap-8 mt-6">
          <button
            onClick={(e) => { e.stopPropagation(); skipBackward(10); }}
            className="p-3 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
            </svg>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isFrozen) {
                setIsFrozen(false);
              } else {
                toggle();
              }
            }}
            className="p-4 bg-blue-600 rounded-full text-white hover:bg-blue-500 transition-colors"
          >
            {isPlaying && !isPaused ? (
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); skipForward(10); }}
            className="p-3 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
            </svg>
          </button>
        </div>

        <div className="mt-6 px-2">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
            <span>{wpmPresets[0].value}</span>
            <span className="text-blue-500">Speed: {wpm} WPM</span>
            <span>{wpmPresets[wpmPresets.length - 1].value}</span>
          </div>
          <input
            type="range"
            min="50"
            max="1000"
            value={wpm}
            onChange={(e) => setWpm(Number(e.target.value))}
            onClick={(e) => e.stopPropagation()}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <div className="flex justify-center gap-2 mt-3">
            {wpmPresets.map((preset) => (
              <button
                key={preset.value}
                onClick={(e) => { e.stopPropagation(); setWpm(preset.value); }}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  wpm === preset.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div
          onClick={(e) => e.stopPropagation()}
          className={`mt-4 rounded-2xl border border-gray-900 bg-gray-950/70 px-3 py-3 transition-all ${showQuickActions ? 'opacity-100' : 'pointer-events-none max-h-0 py-0 opacity-0 overflow-hidden'}`}
        >
          <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
            <span>{bookmarks.length} bookmark{bookmarks.length === 1 ? '' : 's'}</span>
            <span>{notes.length} note{notes.length === 1 ? '' : 's'}</span>
            {currentBook?.chapters.length ? <span>{currentBook.chapters.length} chapters</span> : null}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              disabled={!voiceAvailable}
              onClick={(e) => {
                e.stopPropagation();
                setTtsEnabled((value) => !value);
              }}
              className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                ttsEnabled
                  ? 'border-blue-500 bg-blue-600 text-white'
                  : 'border-gray-800 bg-black/80 text-gray-200'
              }`}
            >
              {ttsEnabled ? 'Voice On' : 'Voice'}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setShowTools(true); }}
              className="flex-1 rounded-xl border border-gray-800 bg-black/80 px-3 py-2 text-sm font-medium text-white"
            >
              Tools
            </button>
          </div>
          {voiceStatus && (
            <div className="mt-2 text-center text-[11px] text-blue-300">
              {voiceStatus}
            </div>
          )}
          {currentDictionaryWord && (
            <div className="mt-3 max-h-48 overflow-y-auto overscroll-contain touch-pan-y rounded-xl border border-gray-800 bg-black/70 px-3 py-3 text-left">
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white">{dictionaryDefinition?.word || currentDictionaryWord}</div>
                  {dictionaryDefinition?.phonetic && (
                    <div className="mt-0.5 text-xs text-gray-500">{dictionaryDefinition.phonetic}</div>
                  )}
                </div>
                {dictionaryDefinition?.partOfSpeech && (
                  <div className="shrink-0 text-xs text-blue-400">{dictionaryDefinition.partOfSpeech}</div>
                )}
              </div>
              <div className="mt-2 text-sm leading-6 text-gray-300">
                {dictionaryStatus === 'loading' && 'Looking up definition...'}
                {dictionaryStatus === 'missing' && 'No dictionary definition found.'}
                {dictionaryStatus === 'error' && 'Dictionary lookup is unavailable.'}
                {dictionaryStatus === 'ready' && dictionaryDefinition?.definition}
              </div>
              {dictionaryStatus === 'ready' && dictionaryDefinition?.example && (
                <div className="mt-2 border-l-2 border-gray-800 pl-3 text-xs text-gray-500">
                  {dictionaryDefinition.example}
                </div>
              )}
            </div>
          )}
          <div className="mt-2 text-[11px] text-gray-600">
            {settings.tapToFreeze ? (isFrozen ? 'Lift finger to continue' : 'Hold word to freeze') : 'Tap screen to reveal controls'}
          </div>
        </div>
      </footer>
    </div>
  );
}
