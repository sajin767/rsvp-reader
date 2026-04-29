import { useState, useEffect, useRef } from 'react';
import { useReader } from '../contexts/ReaderContext';
import { useSettings } from '../contexts/SettingsContext';

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

export function ReaderScreen() {
  const {
    currentBook,
    currentWord,
    currentIndex,
    totalWords,
    progress,
    isPlaying,
    isPaused,
    wpm,
    wpmPresets,
    toggle,
    pause,
    play,
    skipForward,
    skipBackward,
    setWpm,
    seekToProgress,
    closeBook,
  } = useReader();

  const { settings } = useSettings();
  const [showControls, setShowControls] = useState(true);
  const [isFrozen, setIsFrozen] = useState(false);
  const [showBreakReminder, setShowBreakReminder] = useState(false);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const freezeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const breakReminderTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasPlayingBeforeFreeze = useRef(false);

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
      // Remember if we were playing before freeze
      wasPlayingBeforeFreeze.current = isPlaying && !isPaused;
      // Actually pause the engine
      pause();
    } else {
      // Resume playing if we were playing before freeze
      if (wasPlayingBeforeFreeze.current) {
        play();
      }
    }
  }, [isFrozen, pause, play, isPlaying, isPaused]);

  // Dismiss break reminder
  const dismissBreakReminder = () => {
    setShowBreakReminder(false);
    // Reset timer
    if (settings.breakReminders && isPlaying && !isPaused) {
      breakReminderTimer.current = setTimeout(() => {
        setShowBreakReminder(true);
      }, settings.breakReminderMinutes * 60 * 1000);
    }
  };

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

  // Word display with ORP highlighting
  const renderWord = () => {
    if (!currentWord) {
      return <span className="text-gray-500"> Select a book to start</span>;
    }

    const word = currentWord.text;
    const orpIndex = currentWord.orpIndex;
    const before = word.slice(0, orpIndex);
    const orp = word[orpIndex] || '';
    const after = word.slice(orpIndex + 1);
    const highlightColor = HIGHLIGHT_COLORS[settings.highlightColor] || HIGHLIGHT_COLORS.red;

    // Font family style
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

  // Get phantom words (previous and next words)
  const getPhantomWords = () => {
    if (!currentWord || !currentBook?.content) return { prev: '', next: '' };
    
    const words = currentBook.content.split(/\s+/);
    const prevWord = currentIndex > 0 ? words[currentIndex - 1] : '';
    const nextWord = currentIndex < words.length - 1 ? words[currentIndex + 1] : '';
    
    return { prev: prevWord, next: nextWord };
  };

  // Format time remaining
  const formatTime = () => {
    if (!currentBook || totalWords === 0) return '0:00';
    const wordsRemaining = totalWords - currentIndex;
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
    window.location.hash = '/library';
  };

  // Tap & hold to freeze word - using touch events for better mobile support
  const handleTouchStart = (_e: React.TouchEvent) => {
    if (!settings.tapToFreeze || !currentWord || !isPlaying || isPaused) return;
    
    // Cancel any existing timer
    if (freezeTimer.current) {
      clearTimeout(freezeTimer.current);
    }
    
    // Start freeze timer - hold for 400ms to activate
    freezeTimer.current = setTimeout(() => {
      setIsFrozen(true);
      // Show controls when frozen
      setShowControls(true);
    }, 400);
  };

  const handleTouchEnd = (_e: React.TouchEvent) => {
    // Cancel freeze timer if finger lifted before 400ms
    if (freezeTimer.current) {
      clearTimeout(freezeTimer.current);
      freezeTimer.current = null;
    }
    
    // If was frozen, unfreeze
    if (isFrozen) {
      setIsFrozen(false);
    }
  };

  const handleTouchCancel = (_e: React.TouchEvent) => {
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

  const warmFilter = WARM_FILTERS[settings.warmMode] || WARM_FILTERS.off;
  const phantomStyle = { fontSize: `${Math.max(settings.fontSize * 0.5, 20)}px`, color: settings.warmMode !== 'off' ? '#886644' : '#666666' };
  const phantomFontFamily = 
    settings.fontFamily === 'OpenDyslexic' ? "'OpenDyslexic', sans-serif" :
    settings.fontFamily === 'Atkinson Hyperlegible' ? "'Atkinson Hyperlegible', sans-serif" :
    'monospace';

  return (
    <div 
      className="flex flex-col h-full bg-black select-none touch-none"
      style={{ filter: warmFilter }}
      onClick={handleTap}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
    >
      {/* Break Reminder Overlay */}
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
                onClick={(e) => { e.stopPropagation(); dismissBreakReminder(); handleBack(); }}
                className="flex-1 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm"
              >
                Take a Break
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Frozen indicator */}
      {isFrozen && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-blue-600/90 text-white text-xs px-3 py-1 rounded-full z-30">
          ⏸️ FROZEN — Lift finger to continue
        </div>
      )}

      {/* Header */}
      <header className={`flex items-center justify-between p-4 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <button onClick={handleBack} className="p-2">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm text-gray-400 truncate max-w-[200px]">
          {currentBook?.title || 'Reader'}
        </span>
        <button className="p-2">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
        </button>
      </header>

      {/* Main word display */}
      <main className="flex-1 flex flex-col items-center justify-center px-4">
        {/* Phantom word - previous */}
        {settings.showPhantomWords && currentWord && (
          <div style={{ ...phantomStyle, fontFamily: phantomFontFamily, height: '30px' }}>
            {getPhantomWords().prev}
          </div>
        )}

        {/* Main word */}
        <div className={`transition-opacity ${settings.fadeEffect ? 'duration-100' : ''}`}>
          {renderWord()}
        </div>

        {/* Phantom word - next */}
        {settings.showPhantomWords && currentWord && (
          <div style={{ ...phantomStyle, fontFamily: phantomFontFamily, height: '30px' }}>
            {getPhantomWords().next}
          </div>
        )}

        {/* Progress indicator */}
        <div className="mt-8 text-gray-500 text-sm">
          {currentIndex + 1} / {totalWords}
        </div>
      </main>

      {/* Controls */}
      <footer className={`p-4 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {/* Progress bar */}
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

        {/* Time and WPM */}
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>{formatTime()} remaining</span>
          {settings.showWpmIndicator && <span>{wpm} WPM</span>}
        </div>

        {/* Playback controls */}
        <div className="flex items-center justify-center gap-8 mt-6">
          {/* Skip back */}
          <button
            onClick={(e) => { e.stopPropagation(); skipBackward(10); }}
            className="p-3 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
            </svg>
          </button>

          {/* Play/Pause */}
          <button
            onClick={(e) => { e.stopPropagation(); 
              // If frozen, unfreeze first
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

          {/* Skip forward */}
          <button
            onClick={(e) => { e.stopPropagation(); skipForward(10); }}
            className="p-3 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
            </svg>
          </button>
        </div>

        {/* Speed control */}
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

        {/* Tap to freeze hint */}
        {settings.tapToFreeze && currentWord && (
          <div className="text-center text-xs text-gray-600 mt-3">
            {isFrozen ? '👆 Lift finger to continue' : '👆 Hold word to freeze'}
          </div>
        )}
      </footer>
    </div>
  );
}
