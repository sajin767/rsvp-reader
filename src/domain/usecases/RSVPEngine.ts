// RSVP Engine - Core speed reading logic
import type { AppSettings } from '../entities/Settings';
import { isDifficultWord } from './commonWords';

export interface RSVPWord {
  text: string;
  orpIndex: number; // Optimal Recognition Point character index
  delay: number; // Calculated delay in ms
  isPunctuation: boolean;
  isDifficult: boolean; // Word needs more time
  isCapitalized: boolean; // Capitalized word (likely a name)
}

export interface RSVPState {
  words: RSVPWord[];
  currentIndex: number;
  isPlaying: boolean;
  isPaused: boolean;
}

// Calculate ORP (Optimal Recognition Point) for a word
// ORP is typically at about 35% of the word length, or slightly left of center
export function calculateORP(word: string): number {
  const len = word.length;
  if (len <= 1) return 0;
  if (len <= 5) return Math.floor(len / 2) - 1;
  if (len <= 9) return Math.floor(len * 0.35);
  if (len <= 13) return Math.floor(len * 0.3);
  return Math.floor(len * 0.25);
}

// Check if word ends with punctuation that requires pause
export function hasPunctuationPause(word: string): boolean {
  if (!word || word.length === 0) return false;
  const lastChar = word[word.length - 1];
  return ['.', '!', '?', ';', ':'].includes(lastChar);
}

// Check if word is capitalized (likely a proper noun/name)
export function isCapitalizedWord(word: string): boolean {
  if (!word || word.length === 0) return false;
  const cleanWord = word.replace(/[^a-zA-Z]/g, '');
  if (cleanWord.length === 0) return false;
  // First letter is uppercase, rest is lowercase = likely a name
  return /^[A-Z][a-z]+$/.test(cleanWord);
}

// Pre-parse text to analyze sentences for complexity
interface SentenceAnalysis {
  startIndex: number;
  endIndex: number;
  capitalizedCount: number;
  isComplex: boolean; // 3+ capitalized words
}

function analyzeSentences(words: string[]): SentenceAnalysis[] {
  const sentences: SentenceAnalysis[] = [];
  let currentSentence = { startIndex: 0, capitalizedCount: 0, words: [] as string[] };
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    currentSentence.words.push(word);
    
    if (isCapitalizedWord(word)) {
      currentSentence.capitalizedCount++;
    }
    
    // Sentence ends at punctuation
    if (hasPunctuationPause(word)) {
      sentences.push({
        startIndex: currentSentence.startIndex,
        endIndex: i,
        capitalizedCount: currentSentence.capitalizedCount,
        isComplex: currentSentence.capitalizedCount >= 3,
      });
      currentSentence = { startIndex: i + 1, capitalizedCount: 0, words: [] };
    }
  }
  
  // Handle last sentence without punctuation
  if (currentSentence.words.length > 0) {
    sentences.push({
      startIndex: currentSentence.startIndex,
      endIndex: words.length - 1,
      capitalizedCount: currentSentence.capitalizedCount,
      isComplex: currentSentence.capitalizedCount >= 3,
    });
  }
  
  return sentences;
}

// Calculate delay for a word based on WPM and settings
export function calculateDelay(
  word: string, 
  wpm: number, 
  settings: AppSettings,
  inComplexSentence: boolean = false
): number {
  // Base delay from WPM: 60000ms / WPM = ms per word
  const baseDelay = 60000 / wpm;
  
  // Length adjustment: longer words get slightly more time
  const lengthBonus = Math.max(0, (word.length - 5) * 5);
  
  // Intelligent pacing: difficult words get more time
  let difficultBonus = 0;
  if (settings.intelligentPacing && isDifficultWord(word)) {
    difficultBonus = settings.intelligentPacingExtraDelay;
  }
  
  // Auto-slow for complex sentences (3+ capitalized words like names)
  let complexBonus = 0;
  if (inComplexSentence && isCapitalizedWord(word)) {
    complexBonus = Math.round(settings.intelligentPacingExtraDelay * 1.5); // Extra slow for names in complex sentences
  }
  
  // Punctuation pause
  let pauseBonus = 0;
  if (settings.punctuationPause && hasPunctuationPause(word)) {
    pauseBonus = settings.punctuationPauseMs;
  }
  
  return Math.round(baseDelay + lengthBonus + difficultBonus + complexBonus + pauseBonus);
}

// Parse text into RSVP words with calculated delays
export function parseText(text: string, settings: AppSettings): RSVPWord[] {
  // Split into words, preserving whitespace info
  const rawWords = text.trim().split(/\s+/);
  
  // Analyze sentence complexity
  const sentences = analyzeSentences(rawWords);
  
  // Build a map of word index -> isComplex
  const complexWords = new Set<number>();
  for (const sentence of sentences) {
    if (sentence.isComplex) {
      for (let i = sentence.startIndex; i <= sentence.endIndex; i++) {
        complexWords.add(i);
      }
    }
  }
  
  return rawWords.map((word, index) => {
    const inComplex = complexWords.has(index);
    return {
      text: word,
      orpIndex: calculateORP(word),
      delay: calculateDelay(word, settings.wpm, settings, inComplex),
      isPunctuation: hasPunctuationPause(word),
      isDifficult: settings.intelligentPacing && isDifficultWord(word),
      isCapitalized: isCapitalizedWord(word),
    };
  });
}

// RSVP Engine class
export class RSVPEngine {
  private words: RSVPWord[] = [];
  private currentIndex: number = 0;
  private isPlaying: boolean = false;
  private isPaused: boolean = false;
  private settings: AppSettings;
  private timerId: number | null = null;
  private wordCallback: ((word: RSVPWord, index: number, total: number) => void) | null = null;
  private endCallback: (() => void) | null = null;
  private periodicCounter: number = 0;
  // Track names encountered
  private namesEncountered: Set<string> = new Set();

  constructor(settings: AppSettings) {
    this.settings = settings;
  }

  loadText(text: string): void {
    this.words = parseText(text, this.settings);
    this.currentIndex = 0;
    this.periodicCounter = 0;
    this.namesEncountered.clear();
  }

  loadWords(words: string[]): void {
    this.words = words.map(word => ({
      text: word,
      orpIndex: calculateORP(word),
      delay: calculateDelay(word, this.settings.wpm, this.settings),
      isPunctuation: hasPunctuationPause(word),
      isDifficult: this.settings.intelligentPacing && isDifficultWord(word),
      isCapitalized: isCapitalizedWord(word),
    }));
    this.currentIndex = 0;
    this.periodicCounter = 0;
    this.namesEncountered.clear();
  }

  setSettings(settings: AppSettings): void {
    this.settings = settings;
    // Recalculate delays for all words
    this.words = this.words.map(word => ({
      ...word,
      delay: calculateDelay(word.text, settings.wpm, settings),
      isPunctuation: hasPunctuationPause(word.text),
      isDifficult: settings.intelligentPacing && isDifficultWord(word.text),
    }));
  }

  setPosition(position: number): void {
    this.currentIndex = Math.max(0, Math.min(position, this.words.length - 1));
  }

  getPosition(): number {
    return this.currentIndex;
  }

  getTotalWords(): number {
    return this.words.length;
  }

  getProgress(): number {
    if (this.words.length === 0) return 0;
    return Math.round((this.currentIndex / this.words.length) * 100);
  }

  getCurrentWord(): RSVPWord | null {
    if (this.currentIndex >= 0 && this.currentIndex < this.words.length) {
      return this.words[this.currentIndex];
    }
    return null;
  }

  getNamesEncountered(): string[] {
    return Array.from(this.namesEncountered);
  }

  isPlayingState(): boolean {
    return this.isPlaying;
  }

  isPausedState(): boolean {
    return this.isPaused;
  }

  onWord(callback: (word: RSVPWord, index: number, total: number) => void): void {
    this.wordCallback = callback;
  }

  onEnd(callback: () => void): void {
    this.endCallback = callback;
  }

  play(): void {
    if (this.isPlaying && !this.isPaused) return;
    if (this.currentIndex >= this.words.length) {
      this.currentIndex = 0;
    }
    
    this.isPlaying = true;
    this.isPaused = false;
    this.scheduleNext();
  }

  pause(): void {
    this.isPaused = true;
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  resume(): void {
    if (!this.isPlaying) return;
    this.isPaused = false;
    this.scheduleNext();
  }

  stop(): void {
    this.isPlaying = false;
    this.isPaused = false;
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  toggle(): void {
    if (!this.isPlaying) {
      this.play();
    } else if (this.isPaused) {
      this.resume();
    } else {
      this.pause();
    }
  }

  skipForward(count: number = 1): void {
    this.currentIndex = Math.min(this.currentIndex + count, this.words.length - 1);
    if (this.isPlaying && !this.isPaused && this.wordCallback) {
      this.wordCallback(this.words[this.currentIndex], this.currentIndex, this.words.length);
    }
  }

  skipBackward(count: number = 1): void {
    this.currentIndex = Math.max(this.currentIndex - count, 0);
    if (this.isPlaying && !this.isPaused && this.wordCallback) {
      this.wordCallback(this.words[this.currentIndex], this.currentIndex, this.words.length);
    }
  }

  jumpToProgress(percentage: number): void {
    const position = Math.floor((percentage / 100) * this.words.length);
    this.setPosition(position);
    if (this.isPlaying && !this.isPaused && this.wordCallback) {
      this.wordCallback(this.words[this.currentIndex], this.currentIndex, this.words.length);
    }
  }

  private scheduleNext(): void {
    if (!this.isPlaying || this.isPaused) return;
    
    if (this.currentIndex >= this.words.length) {
      this.isPlaying = false;
      if (this.endCallback) {
        this.endCallback();
      }
      return;
    }

    const word = this.words[this.currentIndex];
    
    // Track names encountered
    if (word.isCapitalized && word.text.length > 2) {
      const cleanName = word.text.replace(/[^a-zA-Z]/g, '');
      if (cleanName === cleanName.toUpperCase() || /^[A-Z][a-z]+$/.test(cleanName)) {
        this.namesEncountered.add(cleanName);
      }
    }
    
    // Notify callback
    if (this.wordCallback) {
      this.wordCallback(word, this.currentIndex, this.words.length);
    }

    // Calculate actual delay including periodic pause
    let delay = word.delay;
    this.periodicCounter++;
    
    if (this.settings.periodicPause && this.periodicCounter >= this.settings.periodicPauseWords) {
      // Add extra pause for periodic break
      delay += this.settings.punctuationPauseMs;
      this.periodicCounter = 0;
    }

    // Schedule next word
    this.currentIndex++;
    
    this.timerId = window.setTimeout(() => {
      this.scheduleNext();
    }, delay);
  }

  destroy(): void {
    this.stop();
    this.wordCallback = null;
    this.endCallback = null;
  }
}

// Pre-defined speed presets
export const WPM_PRESETS = [
  { label: 'Slow', value: 150 },
  { label: 'Normal', value: 250 },
  { label: 'Fast', value: 350 },
  { label: 'Speed', value: 450 },
  { label: 'Turbo', value: 600 },
  { label: 'Max', value: 800 },
];
