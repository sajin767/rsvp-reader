import type { NativeAudioSegment } from './nativeTts';

export interface VoiceWordMark {
  wordIndex: number;
  startMs: number;
  endMs?: number;
}

export interface NaturalVoiceManifest {
  audioUrl: string;
  marks: VoiceWordMark[];
  durationMs?: number;
  provider?: string;
}

interface NaturalVoiceRequest {
  bookId: string;
  title: string;
  author: string;
  contentHash: string;
  wpm: number;
  segments: NativeAudioSegment[];
}

function normalizeEndpoint(endpoint: string) {
  const trimmed = endpoint.trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function looksLikeDirectDeepgramKey(value: string) {
  const trimmed = value.trim();
  return !!trimmed && !/^https?:\/\//i.test(trimmed);
}

function isManifest(value: unknown): value is NaturalVoiceManifest {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<NaturalVoiceManifest>;
  return typeof candidate.audioUrl === 'string' && Array.isArray(candidate.marks);
}

export async function fetchNaturalVoiceManifest(endpoint: string, request: NaturalVoiceRequest): Promise<NaturalVoiceManifest> {
  const normalizedEndpoint = normalizeEndpoint(endpoint);
  if (!normalizedEndpoint) {
    throw new Error('Natural voice endpoint is not configured');
  }

  const response = await fetch(normalizedEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Voice endpoint failed with status ${response.status}`);
  }

  const payload: unknown = await response.json();
  if (!isManifest(payload)) {
    throw new Error('Voice endpoint returned an invalid manifest');
  }

  return {
    ...payload,
    marks: payload.marks
      .filter((mark) => Number.isFinite(mark.wordIndex) && Number.isFinite(mark.startMs))
      .sort((a, b) => a.startMs - b.startMs),
  };
}

function estimateMarksFromSegments(segments: NativeAudioSegment[], wpm: number): VoiceWordMark[] {
  const marks: VoiceWordMark[] = [];
  const msPerWord = 60000 / Math.max(wpm, 1);
  let cursorMs = 0;

  for (const segment of segments) {
    const wordCount = Math.max(segment.endWord - segment.startWord + 1, 1);
    const segmentDuration = wordCount * msPerWord;

    for (let offset = 0; offset < wordCount; offset += 1) {
      const startMs = cursorMs + offset * msPerWord;
      marks.push({
        wordIndex: segment.startWord + offset,
        startMs,
        endMs: Math.min(cursorMs + (offset + 1) * msPerWord, cursorMs + segmentDuration),
      });
    }

    cursorMs += segmentDuration + segment.pauseMs;
  }

  return marks;
}

export async function fetchDeepgramVoiceManifest(apiKey: string, request: NaturalVoiceRequest): Promise<NaturalVoiceManifest> {
  const text = request.segments.map((segment) => segment.text).join(' ').trim();
  if (!text) {
    throw new Error('No text available for Deepgram voice');
  }

  const response = await fetch('https://api.deepgram.com/v1/speak?model=aura-2-thalia-en&encoding=mp3', {
    method: 'POST',
    headers: {
      Authorization: `Token ${apiKey.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(`Deepgram voice failed with status ${response.status}`);
  }

  const audioBlob = await response.blob();
  const audioUrl = URL.createObjectURL(audioBlob);

  return {
    audioUrl,
    provider: 'deepgram',
    marks: estimateMarksFromSegments(request.segments, request.wpm),
  };
}

export function findWordAtAudioTime(marks: VoiceWordMark[], currentTimeMs: number) {
  if (marks.length === 0) return null;

  let low = 0;
  let high = marks.length - 1;
  let best = marks[0];

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const mark = marks[mid];

    if (mark.startMs <= currentTimeMs) {
      best = mark;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best.wordIndex;
}
