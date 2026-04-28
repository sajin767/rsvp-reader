# RSVP Reader - Speed Reading App Specification

## 1. Project Overview

**Project Name:** RSVP Reader
**Type:** Android Mobile Application (via Capacitor)
**Core Functionality:** A speed reading application that displays text one word at a time using Rapid Serial Visual Presentation (RSVP) technique, allowing users to read books and documents at high speeds with optimal comprehension.

## 2. Technology Stack & Choices

### Framework & Language
- **Frontend Framework:** React 18 with TypeScript
- **Mobile Wrapper:** Capacitor 6.x for Android APK generation
- **Build Tool:** Vite 5.x

### Key Libraries/Dependencies
- **PDF Parsing:** pdf.js (mozilla/pdfjs-dist) - for PDF file support
- **EPUB Parsing:** epub.js - for EPUB file support
- **File Handling:** @capacitor/filesystem, @capacitor/share-sheet
- **Storage:** @capacitor/preferences (localStorage wrapper) for offline-first data
- **State Management:** React Context + useReducer (lightweight, no external dependency)
- **Routing:** React Router v6

### Architecture Pattern
- **Clean Architecture** with three layers:
  - **Presentation Layer:** React components, hooks, contexts
  - **Domain Layer:** Business logic, use cases, entities
  - **Data Layer:** Repositories, local storage, file parsers

## 3. Feature List

### Core RSVP Features
- [x] One word at a time display at fixed focal point
- [x] ORP (Optimal Recognition Point) highlighting - red letter at eye focus point
- [x] Speed control: 50-1000 WPM with slider and presets
- [x] Punctuation pauses: 300ms extra delay at `.`, `!`, `?`, `;`, `:`
- [x] Periodic pauses: configurable every N words (default: 20)
- [x] Progress tracking: save and resume exact position
- [x] Jump to position: word number input or percentage slider

### File Handling
- [x] Import from device storage (PDF, EPUB, TXT)
- [x] Import from Google Drive / Dropbox via file picker
- [x] Share from other apps (Android share sheet intent)
- [x] No file size limit (streaming for large files)
- [x] Recent files quick access

### Library System
- [x] Organize books by title, author (extracted from metadata)
- [x] Track reading progress per book (word position, percentage, last read date)
- [x] Favorites system with quick access
- [x] Categories/tags for organization
- [x] Search within library
- [x] Delete books from library

### Flashcard System
- [x] Save words while reading (tap to save highlighted word)
- [x] Simple flashcard deck view
- [x] Export to Anki format (.apkg JSON)
- [x] View saved words in context (surrounding sentence)

### UI/UX
- [x] Dark theme by default (OLED-friendly pure black)
- [x] Light theme toggle
- [x] Customizable monospace font (JetBrains Mono, Fira Code, system mono)
- [x] Adjustable font size (16px - 72px)
- [x] Adjustable word display area size
- [x] Keyboard shortcuts for tablet/Bluetooth keyboard
- [x] Minimal focus mode during reading (hide all UI)
- [x] Fade effect between words (100ms fade)
- [x] Clickable/tappable progress bar
- [x] Swipe gestures for navigation

## 4. UI/UX Design Direction

### Overall Visual Style
- **Minimalist dark-first design** inspired by reading apps like Kindle and Moon+ Reader
- Focus on typography and readability
- High contrast text for speed reading
- Subtle animations for state changes

### Color Scheme
```
Dark Theme (Default):
- Background: #000000 (pure black for OLED)
- Surface: #121212
- Primary Text: #FFFFFF
- ORP Highlight: #FF3B30 (red)
- Accent: #0A84FF (iOS blue)
- Muted Text: #8E8E93

Light Theme:
- Background: #FFFFFF
- Surface: #F2F2F7
- Primary Text: #000000
- ORP Highlight: #FF3B30 (red)
- Accent: #007AFF
- Muted Text: #6C6C70
```

### Layout Approach
- **Bottom navigation** for main sections: Library, Reader, Flashcards, Settings
- **Full-screen focus mode** during reading (tap to show/hide controls)
- **Modal sheets** for settings and options
- **Swipeable cards** for library browsing

### Typography
- **Reader Display:** JetBrains Mono (primary), Fira Code, system monospace
- **UI Text:** System font (San Francisco on Android)
- **Font Sizes:**
  - Reader word display: 24px - 72px (user configurable)
  - UI text: 14px - 17px
  - Captions: 12px

### Key Screens
1. **Library Screen** - Grid/list of books with cover thumbnails
2. **Reader Screen** - Full-screen RSVP display with minimal controls
3. **Reader Settings Overlay** - Speed, pauses, display options
4. **Flashcards Screen** - List of saved words with export option
5. **Settings Screen** - Theme, fonts, shortcuts, about

## 5. Data Models

### Book
```typescript
interface Book {
  id: string;                    // UUID
  title: string;                 // Extracted from file metadata or filename
  author: string;                // Extracted from file metadata
  fileType: 'pdf' | 'epub' | 'txt';
  filePath: string;              // Local cached path
  fileSize: number;              // Bytes
  totalWords: number;            // Total word count
  currentPosition: number;       // Current word index
  currentProgress: number;       // 0-100 percentage
  lastReadAt: Date | null;      // Timestamp
  addedAt: Date;                 // When imported
  isFavorite: boolean;
  tags: string[];                // User-defined categories
  coverImage?: string;           // Base64 or file path for cover
  content?: string;             // Extracted text content
}
```

### ReadingProgress
```typescript
interface ReadingProgress {
  bookId: string;
  wordPosition: number;
  percentage: number;
  wpm: number;
  lastUpdated: Date;
}
```

### Flashcard
```typescript
interface Flashcard {
  id: string;
  word: string;
  context: string;               // Surrounding sentence
  bookId: string;                // Source book
  wordPosition: number;          // Position in book
  createdAt: Date;
  reviewCount: number;           // For spaced repetition (future)
  lastReviewed: Date | null;
}
```

### Settings
```typescript
interface AppSettings {
  theme: 'dark' | 'light';
  fontSize: number;             // 16-72
  fontFamily: string;
  wpm: number;                   // Default WPM
  punctuationPause: boolean;
  punctuationPauseMs: number;    // Extra ms for punctuation
  periodicPause: boolean;
  periodicPauseWords: number;   // Pause every N words
  fadeEffect: boolean;
  fadeDurationMs: number;
  showProgressBar: boolean;
  showWpmIndicator: boolean;
}
```

## 6. Screen Wireframes

### Library Screen
```
┌─────────────────────────────┐
│  ≡  RSVP Reader       🔍  ⋮ │
├─────────────────────────────┤
│ ┌─────┐ ┌─────┐ ┌─────┐    │
│ │ 📖  │ │ 📖  │ │ 📖  │    │
│ │     │ │     │ │     │    │
│ │Book1│ │Book2│ │Book3│    │
│ │ 45% │ │ 12% │ │ ★   │    │
│ └─────┘ └─────┘ └─────┘    │
│                             │
│ ┌─────┐ ┌─────┐            │
│ │ 📖  │ │ 📖  │            │
│ │Book4│ │Book5│            │
│ │ 78% │ │ NEW │            │
│ └─────┘ └─────┘            │
│                             │
├─────────────────────────────┤
│  📚     ▶️      📝      ⚙️  │
│ Library  Reader Cards  More │
└─────────────────────────────┘
```

### Reader Screen (Focus Mode)
```
┌─────────────────────────────┐
│                         ⋮   │
│                             │
│                             │
│                             │
│        programming          │  ← Word displayed
│             ↓               │
│           [ORP: r]          │  ← Red highlight on 'r'
│                             │
│                             │
│                             │
│ ────────●────────────────── │  ← Progress bar (tap to show)
│ 12:34 / 1:45:00   350 WPM  │  ← Time (tap to show)
└─────────────────────────────┘
```

### Reader Controls Overlay
```
┌─────────────────────────────┐
│ ← Back          Book Title  │
├─────────────────────────────┤
│                             │
│        programming          │
│             ↓               │
│           [ORP: r]          │
│                             │
├─────────────────────────────┤
│  ←  │ ▶️/⏸ │  →             │
│  -  │ 350  │  +             │
├─────────────────────────────┤
│  Speed: 350 WPM             │
│  ────●───────────────       │
├─────────────────────────────┤
│  Pause every: 20 words      │
│  Punctuation pause: ON      │
│  Fade effect: ON            │
└─────────────────────────────┘
```

### Flashcards Screen
```
┌─────────────────────────────┐
│  ←  Flashcards      📤 Export│
├─────────────────────────────┤
│ ┌───────────────────────────┐│
│ │ "ephemeral"               ││
│ │ "lasting for a very short ││
│ │  time"                    ││
│ │ From: Programming Book... ││
│ │                    🗑️     ││
│ └───────────────────────────┘│
│ ┌───────────────────────────┐│
│ │ "ubiquitous"              ││
│ │ "present everywhere"      ││
│ │ From: Another Book...     ││
│ └───────────────────────────┘│
├─────────────────────────────┤
│     No cards selected       │
│   Select cards to export    │
└─────────────────────────────┘
```

## 7. Implementation Roadmap

### Phase 1: Foundation (Core Infrastructure)
- [ ] Set up Capacitor + React project with Vite
- [ ] Configure project structure (Clean Architecture)
- [ ] Set up routing with React Router
- [ ] Implement theme system (dark/light)
- [ ] Create base UI components (Button, Card, Modal)
- [ ] Set up local storage persistence

### Phase 2: File Handling & Parsing
- [ ] Implement PDF parsing with pdf.js
- [ ] Implement EPUB parsing with epub.js
- [ ] Implement TXT file reading
- [ ] Create file import flow (local storage)
- [ ] Implement share sheet integration
- [ ] Build file caching system

### Phase 3: Library System
- [ ] Library screen with grid/list view
- [ ] Book metadata extraction
- [ ] Progress tracking and persistence
- [ ] Favorites functionality
- [ ] Tags/categories system
- [ ] Search functionality

### Phase 4: RSVP Core Engine
- [ ] Word tokenization and parsing
- [ ] ORP calculation algorithm
- [ ] Speed controller with WPM adjustment
- [ ] Punctuation pause logic
- [ ] Periodic pause logic
- [ ] Progress tracking during reading

### Phase 5: Reader UI
- [ ] Main reader display component
- [ ] Focus mode with tap-to-show
- [ ] Progress bar with jump-to-position
- [ ] Speed controls overlay
- [ ] Font and display customization

### Phase 6: Flashcard System
- [ ] Word saving during reading
- [ ] Flashcard list view
- [ ] Context display
- [ ] Anki export functionality

### Phase 7: Polish & Platform
- [ ] Keyboard shortcuts for tablet
- [ ] Gesture controls (swipe navigation)
- [ ] Performance optimization
- [ ] Android APK build configuration
- [ ] Final testing and bug fixes

## 8. Project Structure

```
rsvp-reader/
├── src/
│   ├── presentation/
│   │   ├── components/       # Reusable UI components
│   │   ├── screens/          # Screen components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── contexts/        # React contexts
│   │   └── styles/          # CSS/styled components
│   ├── domain/
│   │   ├── entities/        # Business entities
│   │   ├── usecases/        # Business logic
│   │   └── repositories/    # Repository interfaces
│   ├── data/
│   │   ├── repositories/    # Repository implementations
│   │   ├── datasources/     # Local storage, file system
│   │   └── parsers/        # PDF, EPUB, TXT parsers
│   ├── infrastructure/
│   │   ├── capacitor/       # Capacitor-specific code
│   │   └── storage/         # Storage utilities
│   └── App.tsx
├── android/                  # Android native project
├── public/                   # Static assets
├── capacitor.config.ts       # Capacitor configuration
├── vite.config.ts           # Vite configuration
└── package.json
```
