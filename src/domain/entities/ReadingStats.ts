// Reading statistics entity
export interface ReadingStats {
  totalWordsRead: number;
  booksCompleted: number;
  currentStreak: number;
  todayMinutes: number;
  totalMinutes: number;
  totalSessions: number;
  averageWpm: number;
  lastSessionWpm: number;
  lastReadDate: string | null;
}

// Default stats
export const defaultStats: ReadingStats = {
  totalWordsRead: 0,
  booksCompleted: 0,
  currentStreak: 0,
  todayMinutes: 0,
  totalMinutes: 0,
  totalSessions: 0,
  averageWpm: 0,
  lastSessionWpm: 0,
  lastReadDate: null,
};
