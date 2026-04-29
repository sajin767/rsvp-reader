# RSVP Reader

A speed reading mobile app that displays text one word at a time using **Rapid Serial Visual Presentation (RSVP)** — eliminating eye movement and letting your brain focus entirely on each word. Built with React + TypeScript + Capacitor.

**Supports:** PDF, EPUB, TXT files  
**Platforms:** Android (Capacitor), Web (Vite)

---

## Features

- **RSVP Engine** — One word at a time at a fixed focal point with ORP (Optimal Recognition Point) highlighting
- **Speed control** — 50–1000 WPM with slider and presets (Slow → Max)
- **Smart pauses** — Extra delay at punctuation (`.`, `!`, `?`, etc.) and configurable periodic breaks
- **Progress persistence** — Resume exactly where you left off, per book
- **Clickable progress bar** — Jump to any position in the book
- **Library management** — Import, organize, favorite, and track reading progress
- **Focus mode** — Auto-hide controls while reading for distraction-free sessions
- **Tap-to-freeze** — Long-press to pause on a word (mobile)
- **Dark theme** — OLED-friendly pure black by default, with warm mode filters

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build tool | Vite 6 |
| Mobile | Capacitor 6 (Android APK) |
| Architecture | Clean Architecture |
| State | React Context + useReducer |
| Routing | React Router v6 |
| PDF parsing | pdf.js |
| EPUB parsing | epub.js |
| Storage | localStorage (via Repository pattern) |

---

## Project Structure

```
src/
├── domain/                  # Business logic (no React dependencies)
│   ├── entities/            # Book, Settings, Flashcard, ReadingProgress
│   ├── repositories/        # IBookRepository, ISettingsRepository interfaces
│   └── usecases/            # RSVPEngine, parseText, calculateORP
├── data/                    # Data access layer
│   ├── repositories/       # BookRepository, SettingsRepository (localStorage)
│   └── parsers/            # txtParser, pdfParser, epubParser
└── presentation/            # UI layer
    ├── screens/            # LibraryScreen, ReaderScreen, SettingsScreen
    ├── contexts/           # LibraryContext, ReaderContext, SettingsContext
    ├── hooks/              # Custom hooks
    └── components/         # Reusable UI components

android/                     # Capacitor Android project (auto-generated)
```

---

## Key Concepts

### RSVP Engine

The core speed-reading engine lives in `domain/usecases/RSVPEngine.ts`. It tokenizes text into words, calculates per-word display delays, and drives a word-display loop using `setTimeout`.

**Important classes/functions:**
- `RSVPEngine` — Main engine class. Handles play/pause/seek/progress tracking.
- `parseText(text, settings)` — Converts raw text to `RSVPWord[]` array with ORP indices and per-word delays.
- `calculateORP(word)` — Returns the character index of the "optimal recognition point" (where the eye should focus). Falls roughly at 25–35% of word length from the left.
- `calculateDelay(word, wpm, settings)` — Computes ms to display each word, factoring in WPM, punctuation pauses, and intelligent pacing.

### ORP Highlighting

RSVP readers fix the eye at a single point. Instead of moving across the word, the word appears with one letter highlighted in red at its **ORP index**. The brain perceives this as eye fixation. ORP is typically left of center (not the geometric center), matching natural reading eye movement patterns.

### Clean Architecture

The three-layer separation:

1. **Domain** — Pure TypeScript business logic, no framework imports. Entities are plain interfaces. Use cases are pure functions/classes.
2. **Data** — Repository implementations that read/write localStorage, IndexedDB, or file system. Also houses file parsers.
3. **Presentation** — React components, contexts, and hooks. Depends on Domain (for types/interfaces) but not on Data concretions.

### Progress Persistence

Reading progress is saved to `localStorage` via `BookRepository.updateProgress()` whenever:
- The user closes a book (back button)
- The app goes to background (visibility change)
- Reading ends (last word reached)

The saved fields are `currentPosition` (word index) and `currentProgress` (0–100). On re-opening a book, `openBook()` loads content and calls `engine.setPosition(book.currentPosition)` to resume.

---

## Building

```bash
# Install dependencies
npm install

# Development (web)
npm run dev

# Build for web
npm run build

# Sync to Android
npx cap sync android

# Build Android APK
cd android && ./gradlew assembleDebug
```

The APK ends up at `android/app/build/outputs/apk/debug/app-debug.apk`.

---

## Screens

### Library Screen
Grid of imported books showing title, author, and reading progress bar. Tap a book to open it in the reader. Long-press for delete/favorite options.

### Reader Screen
Full-screen RSVP display. Controls auto-hide in focus mode. Tap anywhere to toggle controls. Progress bar is clickable — tap any point to jump there.

### Settings Screen
Adjust WPM, font size, theme, warm mode filter, punctuation pause, periodic pause, and intelligent pacing options.

---

## Data Models

### Book
```typescript
interface Book {
  id: string;
  title: string;
  author: string;
  fileType: 'pdf' | 'epub' | 'txt';
  filePath: string;        // Object URL or file path
  fileSize: number;
  totalWords: number;
  currentPosition: number; // Word index (0-based)
  currentProgress: number; // 0-100
  lastReadAt: string | null;
  addedAt: string;
  isFavorite: boolean;
  tags: string[];
  coverImage?: string;
  content?: string;       // Extracted text (stored in localStorage)
}
```

### AppSettings
```typescript
interface AppSettings {
  theme: 'dark' | 'light';
  fontSize: number;       // 16-72px
  fontFamily: 'monospace' | 'OpenDyslexic' | 'Atkinson Hyperlegible';
  wpm: number;            // 50-1000
  showProgressBar: boolean;
  showWpmIndicator: boolean;
  focusMode: boolean;
  warmMode: 'off' | 'low' | 'medium' | 'high';
  fadeEffect: boolean;
  showPhantomWords: boolean;
  tapToFreeze: boolean;
  intelligentPacing: boolean;
  intelligentPacingExtraDelay: number;
  punctuationPause: boolean;
  punctuationPauseMs: number;
  periodicPause: boolean;
  periodicPauseWords: number;
  breakReminders: boolean;
  breakReminderMinutes: number;
}
```

---

## Configuration

### Capacitor (`capacitor.config.ts`)
- App name, ID, web build directory
- Android-specific settings (package name, version code)
- Plugins: Filesystem, Share Sheet, Preferences

### Vite (`vite.config.ts`)
- Build output to `dist/`
- TypeScript strict mode
- PDF.js worker bundling

---

## License

MIT
