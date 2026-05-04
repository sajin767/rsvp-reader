# RSVP Reader

RSVP Reader is a speed-reading app for web and Android. It displays one word at a time using Rapid Serial Visual Presentation (RSVP), with an Optimal Recognition Point (ORP) highlight so your eyes can stay fixed while the text moves.

The app is built with React, TypeScript, Vite, and Capacitor. It supports importing PDF, EPUB, and TXT files, then reading them in a focused full-screen reader.

## Highlights

- Import PDF, EPUB, and TXT books
- Read one word at a time with ORP letter highlighting
- Control speed from 50 to 1000 WPM
- Resume each book from its saved word position
- Save progress when closing a book or switching to another book
- Jump by tapping the progress bar
- Favorite and delete books in the library
- Use focus mode to auto-hide controls while reading
- Use warm mode, custom font size, punctuation pauses, and break reminders
- Build as a web app or Android APK

## Screens

### Library

The library shows imported books, reading progress, total words, favorite status, and delete controls. Tap any book to open it in the reader. If another book is already open, its current position is saved before the new book loads.

### Reader

The reader shows the current RSVP word, playback controls, skip controls, speed control, progress, and time remaining. In focus mode, controls hide while reading and reappear when tapped.

### Settings

Settings control speed, font size, font family, warm mode, progress display, WPM display, phantom words, tap-to-freeze, intelligent pacing, punctuation pauses, periodic pauses, and break reminders.

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
| Storage | Browser localStorage |
| Android build | Gradle |

## Project Structure

```text
src/
  domain/
    entities/        App data models
    repositories/    Repository interfaces
    usecases/        RSVP engine and word timing logic
  data/
    parsers/         TXT, PDF, and EPUB parsers
    repositories/    localStorage repository implementations
  presentation/
    components/      Shared UI components
    contexts/        React state providers
    screens/         Library, reader, and settings screens

android/             Capacitor Android project
public/              Static assets and PDF worker
dist/                Web build output
```

## How Reading Progress Works

Each book stores:

- `currentPosition`: the current word index
- `currentProgress`: the percentage read
- `lastReadAt`: the latest progress-save timestamp

Progress is saved through `BookRepository.updateProgress()` when:

- the reader back button closes the current book
- another book is selected from the library while a book is open
- the RSVP engine reaches the end of a book

When a book opens, `ReaderContext.openBook()` reloads the latest stored book record, loads the text into `RSVPEngine`, and calls `engine.setPosition(currentPosition)`.

## Local Development

### Requirements

- Node.js 20 or newer recommended
- npm
- Android Studio or Android SDK for APK builds
- Java 21 or newer for Android Gradle builds

### Install

```bash
npm install
```

### Run Web App

```bash
npm run dev
```

### Build Web App

```bash
npm run build
```

### Sync Web Build Into Android

```bash
npx cap sync android
```

### Build Debug APK

```bash
cd android
JAVA_HOME=/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home ./gradlew assembleDebug
```

The debug APK is generated at:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## Quality Checks

Run these before pushing changes:

```bash
npm run lint
npm run build
npm audit --audit-level=moderate
```

For Android changes, also run:

```bash
npx cap sync android
cd android
JAVA_HOME=/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home ./gradlew assembleDebug
```

## Security Notes

- The app stores imported book text and reading progress in browser `localStorage`.
- The app does not include a backend service or API credentials.
- Imported files are parsed locally in the browser/app runtime.
- Android currently declares storage/media permissions for file import support and `INTERNET` for the Capacitor web runtime.
- Android backup is disabled so imported book text and reading progress are not included in device cloud backups.
- Cleartext HTTP traffic is disabled in the Android manifest.
- Dependency vulnerabilities should be checked with `npm audit --audit-level=moderate`.

Latest dependency audit status:

```text
found 0 vulnerabilities
```

## Important Files

- `src/domain/usecases/RSVPEngine.ts`: RSVP parsing, timing, playback, seek, and progress logic
- `src/presentation/contexts/ReaderContext.tsx`: active book, playback state, and resume behavior
- `src/presentation/contexts/LibraryContext.tsx`: imports, deletes, favorites, and library refreshes
- `src/data/repositories/BookRepository.ts`: localStorage persistence for books and progress
- `src/data/parsers/pdfParser.ts`: PDF text extraction
- `src/data/parsers/epubParser.ts`: EPUB text extraction
- `src/data/parsers/txtParser.ts`: TXT file parsing

## License

MIT
