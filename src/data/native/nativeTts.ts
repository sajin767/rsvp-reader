import { Capacitor, registerPlugin } from '@capacitor/core';

export interface NativeAudioSegment {
  id: string;
  startWord: number;
  endWord: number;
  text: string;
  pauseMs: number;
}

export interface NativeAudioStatus {
  supported: boolean;
  preparing: boolean;
  ready: boolean;
  playing: boolean;
  currentWord: number;
  generatedSegments: number;
  totalSegments: number;
}

interface NativeTTSPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  speak(options: { text: string; rate?: number; pitch?: number }): Promise<void>;
  stop(): Promise<void>;
  prepareBookAudio(options: {
    bookId: string;
    contentHash: string;
    segments: NativeAudioSegment[];
    wpm: number;
  }): Promise<void>;
  prepareDeepgramAudio(options: {
    apiKey: string;
    bookId: string;
    contentHash: string;
    segments: NativeAudioSegment[];
    wpm: number;
  }): Promise<void>;
  playFromWord(options: { bookId: string; wordIndex: number; wpm: number }): Promise<void>;
  pauseAudio(): Promise<void>;
  resumeAudio(): Promise<void>;
  stopAudio(): Promise<void>;
  seekAudio(options: { wordIndex: number; wpm: number }): Promise<void>;
  setAudioWpm(options: { wpm: number }): Promise<void>;
  getAudioStatus(): Promise<NativeAudioStatus>;
}

const NativeTTS = registerPlugin<NativeTTSPlugin>('NativeTTS');

export function supportsNativeAudioTimeline() {
  return Capacitor.getPlatform() === 'android' && Capacitor.isNativePlatform();
}

export async function isSpeechAvailable() {
  if (Capacitor.getPlatform() === 'android' && Capacitor.isNativePlatform()) {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        const result = await NativeTTS.isAvailable();
        if (result.available) {
          return true;
        }
      } catch {
        return false;
      }

      await new Promise((resolve) => window.setTimeout(resolve, 250));
    }
    return false;
  }

  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

export async function speakText(text: string, wpm: number, _delayMs?: number) {
  // A native/browser speech rate of 1.0 is roughly conversational speed.
  // Keep the cap below the engine's robotic/stuttering range; RSVP can still run faster visually.
  const BASE_WPM = 190;
  const rate = Math.max(0.6, Math.min(2.0, wpm / BASE_WPM));

  if (Capacitor.getPlatform() === 'android' && Capacitor.isNativePlatform()) {
    try {
      await NativeTTS.speak({
        text,
        rate,
        pitch: 1,
      });
    } catch {
      // Ignore transient startup errors from the native TTS engine.
    }
    return;
  }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.pitch = 1;
    utterance.volume = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }
}

export async function prepareBookAudio(options: {
  bookId: string;
  contentHash: string;
  segments: NativeAudioSegment[];
  wpm: number;
}) {
  if (!supportsNativeAudioTimeline()) return;
  try {
    await NativeTTS.prepareBookAudio(options);
  } catch {
    // Fall back to live speech if timeline preparation fails.
  }
}

export async function prepareDeepgramAudio(options: {
  apiKey: string;
  bookId: string;
  contentHash: string;
  segments: NativeAudioSegment[];
  wpm: number;
}) {
  if (!supportsNativeAudioTimeline()) return;
  try {
    await NativeTTS.prepareDeepgramAudio(options);
  } catch {
    // Fall back to device TTS if Deepgram preparation fails.
  }
}

export async function playPreparedAudio(bookId: string, wordIndex: number, wpm: number) {
  if (!supportsNativeAudioTimeline()) return;
  try {
    await NativeTTS.playFromWord({ bookId, wordIndex, wpm });
  } catch {
    // Keep visual RSVP playback independent from audio failures.
  }
}

export async function pausePreparedAudio() {
  if (!supportsNativeAudioTimeline()) return;
  try {
    await NativeTTS.pauseAudio();
  } catch {
    // Ignore pause failures.
  }
}

export async function resumePreparedAudio() {
  if (!supportsNativeAudioTimeline()) return;
  try {
    await NativeTTS.resumeAudio();
  } catch {
    // Ignore resume failures.
  }
}

export async function stopPreparedAudio() {
  if (!supportsNativeAudioTimeline()) return;
  try {
    await NativeTTS.stopAudio();
  } catch {
    // Ignore stop failures.
  }
}

export async function seekPreparedAudio(wordIndex: number, wpm: number) {
  if (!supportsNativeAudioTimeline()) return;
  try {
    await NativeTTS.seekAudio({ wordIndex, wpm });
  } catch {
    // Ignore seek failures.
  }
}

export async function setPreparedAudioWpm(wpm: number) {
  if (!supportsNativeAudioTimeline()) return;
  try {
    await NativeTTS.setAudioWpm({ wpm });
  } catch {
    // Ignore speed failures.
  }
}

export async function getPreparedAudioStatus(): Promise<NativeAudioStatus> {
  if (!supportsNativeAudioTimeline()) {
    return {
      supported: false,
      preparing: false,
      ready: false,
      playing: false,
      currentWord: 0,
      generatedSegments: 0,
      totalSegments: 0,
    };
  }

  try {
    return await NativeTTS.getAudioStatus();
  } catch {
    return {
      supported: true,
      preparing: false,
      ready: false,
      playing: false,
      currentWord: 0,
      generatedSegments: 0,
      totalSegments: 0,
    };
  }
}

export async function stopSpeech() {
  if (Capacitor.getPlatform() === 'android' && Capacitor.isNativePlatform()) {
    try {
      await NativeTTS.stop();
    } catch {
      // Ignore stop failures.
    }
    return;
  }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
