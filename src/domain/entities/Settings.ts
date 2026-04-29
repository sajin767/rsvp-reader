// App Settings entity
export type FontFamily = 'System Default' | 'OpenDyslexic' | 'Atkinson Hyperlegible';
export type HighlightColor = 'red' | 'yellow' | 'cyan' | 'green' | 'blue' | 'white';
export type WarmModeLevel = 'off' | 'low' | 'medium' | 'high';

export interface AppSettings {
  theme: 'dark' | 'light';
  fontSize: number;
  fontFamily: FontFamily;
  wpm: number;
  punctuationPause: boolean;
  punctuationPauseMs: number;
  periodicPause: boolean;
  periodicPauseWords: number;
  fadeEffect: boolean;
  fadeDurationMs: number;
  showProgressBar: boolean;
  showWpmIndicator: boolean;
  // Phantom words feature
  showPhantomWords: boolean;
  // Focus mode (Zen)
  focusMode: boolean;
  // ORP highlight color
  highlightColor: HighlightColor;
  // Intelligent pacing
  intelligentPacing: boolean;
  intelligentPacingExtraDelay: number; // ms extra for difficult words
  // Tap & hold to freeze
  tapToFreeze: boolean;
  // Warm color mode (reduce blue light)
  warmMode: WarmModeLevel;
  // Break reminders
  breakReminders: boolean;
  breakReminderMinutes: number; // minutes between reminders
}

// Default settings
export const defaultSettings: AppSettings = {
  theme: 'dark',
  fontSize: 42,
  fontFamily: 'System Default',
  wpm: 300,
  punctuationPause: true,
  punctuationPauseMs: 300,
  periodicPause: true,
  periodicPauseWords: 20,
  fadeEffect: true,
  fadeDurationMs: 100,
  showProgressBar: true,
  showWpmIndicator: true,
  showPhantomWords: false,
  focusMode: false,
  highlightColor: 'red',
  intelligentPacing: true,
  intelligentPacingExtraDelay: 100,
  tapToFreeze: true,
  warmMode: 'off',
  breakReminders: false,
  breakReminderMinutes: 20,
};
