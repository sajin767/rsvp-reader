# RSVP Reader

RSVP Reader is a speed-reading app for web and Android. It displays one word at a time using Rapid Serial Visual Presentation (RSVP), adds ORP highlighting, and now includes restore/resume tooling, search/jump, bookmarks, notes, chapter navigation, TTS assist, and portable backup sync.

## Feature Checklist

### Core reading

- [x] Import `PDF`, `EPUB`, `TXT`, and article URLs
- [x] Read one word at a time with RSVP playback
- [x] ORP letter highlighting
- [x] Play, pause, resume
- [x] Skip backward and forward
- [x] Seek by progress bar
- [x] Jump to exact word number
- [x] Jump to percentage
- [x] Search inside the current book and jump to matches
- [x] Chapter navigation
- [x] Time-remaining display
- [x] WPM presets and slider

### Resume and persistence

- [x] Per-book saved position
- [x] Last-session restore
- [x] Continue-reading card in the library
- [x] Autosave while reading
- [x] Save on app background / hide / unload
- [x] Save on close / switch / completion
- [x] Resume diagnostics showing save source and timestamp

### Reader tools

- [x] Bookmarks
- [x] Delete bookmarks
- [x] Notes / annotations beyond bookmark labels
- [x] Quick manual progress save
- [x] TTS assist synced to displayed RSVP words
- [x] Native Android TTS support in the APK
- [x] Native Android Deepgram audio cache/player support
- [x] Natural voice manifest endpoint support

### Reading comfort

- [x] Adjustable font size
- [x] Font family selection
- [x] ORP highlight color selection
- [x] Phantom previous/next words
- [x] Dictionary lookup for the paused/stopped word
- [x] Focus mode with auto-hidden controls
- [x] Fade effect
- [x] Punctuation pause
- [x] Intelligent pacing
- [x] Adjustable intelligent-pacing delay
- [x] Tap-and-hold freeze
- [x] Warm mode / reduced blue light
- [x] Break reminders
- [x] Wake lock while actively reading

### Library and metadata

- [x] Favorite books
- [x] Delete books
- [x] Progress bars in the library
- [x] Last-read timestamps
- [x] EPUB cover extraction when available
- [x] Richer title/author cleanup during import
- [x] Chapter extraction from EPUB/TXT and page sections for PDF

### Stats

- [x] Total words read
- [x] Books completed
- [x] Current streak
- [x] Today minutes
- [x] Total reading minutes
- [x] Total sessions
- [x] Average WPM

### Backup / sync

- [x] Export full app-state backup as JSON
- [x] Import full app-state backup from JSON
- [x] Portable sync workflow for iCloud Drive / Google Drive / Dropbox
- [ ] True account-based cloud sync
  Requires a backend plus authentication. This repo does not include either.

### Android delivery

- [x] Debug APK build
- [x] Release signing support through `android/keystore.properties`
- [x] Release APK/AAB Gradle tasks

## Screens

### Library

- Continue-reading card for the last session
- Grid of imported books
- Favorite and delete actions
- Progress, word count, last-read time, and chapter count
- Cover art for books that provide it

### Reader

- Full-screen RSVP reader
- Tools modal for chapters, search, jump, bookmarks, notes, TTS assist, and save-now
- Playback controls, speed controls, progress, and time remaining
- Focus-mode hide/show controls

### Settings

- Reader appearance and pacing controls
- Reading statistics
- Backup export/import for portable sync

## Tech Stack

| Area | Technology |
| --- | --- |
| UI | React 18, TypeScript |
| Build | Vite 6 |
| Mobile shell | Capacitor 6 |
| Routing | React Router |
| Styling | Tailwind CSS |
| PDF parsing | pdf.js |
| EPUB parsing | epub.js |
| Storage | Browser `localStorage` |
| Android build | Gradle |
| TTS assist | Native Android TTS + Web Speech fallback |

## Natural Voice Endpoint

Natural Voice Mode accepts either a Deepgram API key or a configured HTTPS manifest endpoint in Settings under `Voice`.

When a Deepgram key is entered directly in the Android APK, the native layer calls Deepgram Aura TTS, caches larger natural sentence/paragraph audio segments, and plays them through Android `MediaPlayer` so WPM changes can speed up or slow down playback. Word timing is estimated from the RSVP timeline because Deepgram Speak returns audio, not word-level speech marks. For exact word timing, use a manifest endpoint that returns speech marks.

When running in a browser, direct Deepgram-key mode still depends on browser network rules. If the browser blocks direct API-key requests, use a manifest endpoint instead. The APK path is the intended direct-key path.

The app sends a `POST` request with JSON:

```json
{
  "bookId": "book-id",
  "title": "Book title",
  "author": "Author",
  "contentHash": "stable-content-hash",
  "wpm": 300,
  "segments": [
    {
      "id": "segment-0",
      "startWord": 0,
      "endWord": 7,
      "text": "Text to synthesize.",
      "pauseMs": 300
    }
  ]
}
```

The endpoint should return:

```json
{
  "audioUrl": "https://example.com/generated-audio.mp3",
  "provider": "polly",
  "durationMs": 120000,
  "marks": [
    { "wordIndex": 0, "startMs": 0, "endMs": 180 },
    { "wordIndex": 1, "startMs": 190, "endMs": 320 }
  ]
}
```

The reader uses `marks` as the source of truth for RSVP word position while the audio plays. If this endpoint is not configured or fails, the app falls back to device TTS.

## Project Structure

```text
src/
  domain/
    entities/        App data models
    repositories/    Repository interfaces
    usecases/        RSVP engine and word timing logic
  data/
    parsers/         TXT, PDF, EPUB, and article parsers
    repositories/    localStorage, notes, stats, and backup repositories
  presentation/
    components/      Shared UI components
    contexts/        React state providers
    screens/         Library, reader, and settings screens

android/             Capacitor Android project
public/              Static assets and PDF worker
dist/                Web build output
```

## Local Development

### Requirements

- Node.js 20 or newer recommended
- npm
- Android SDK / Gradle toolchain for APK builds
- Java 17 available locally for Android builds in this repo

### Install

```bash
npm install
```

### Run web app

```bash
npm run dev
```

### Build web app

```bash
npm run build
```

### Android sync

```bash
npm run android:sync
```

### Build debug APK

```bash
npm run android:debug
```

Output:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

### Build signed release APK + AAB

1. Copy `android/keystore.properties.example` to `android/keystore.properties`
2. Fill in your keystore path and passwords
3. Run:

```bash
npm run android:release
```

Outputs:

```text
android/app/build/outputs/apk/release/
android/app/build/outputs/bundle/release/
```

## Quality Checks

```bash
npm run lint
npm run build
```

For Android:

```bash
npm run android:sync
npm run android:debug
```

## Important Files

- `src/presentation/contexts/ReaderContext.tsx`: active book, autosave, restore, bookmarks, notes, stats wiring
- `src/presentation/screens/ReaderScreen.tsx`: reader UI, tools modal, search, jump, notes, TTS assist
- `src/presentation/screens/LibraryScreen.tsx`: library grid and continue-reading entry point
- `src/presentation/screens/SettingsScreen.tsx`: reader settings, stats, backup export/import
- `src/data/repositories/AppBackupRepository.ts`: portable backup export/import
- `src/data/repositories/NoteRepository.ts`: note persistence
- `src/data/repositories/StatsRepository.ts`: stats and bookmark persistence
- `src/data/parsers/pdfParser.ts`: PDF text + metadata extraction
- `src/data/parsers/epubParser.ts`: EPUB text + metadata + cover extraction
- `src/data/parsers/txtParser.ts`: TXT parsing, metadata cleanup, chapter detection
- `android/app/build.gradle`: Android app config and release-signing support

## License

MIT
