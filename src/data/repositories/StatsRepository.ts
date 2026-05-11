// Stats Repository - localStorage implementation for reading statistics
import type { ReadingStats } from '../../domain/entities/ReadingStats';
import { defaultStats } from '../../domain/entities/ReadingStats';
import type { Bookmark } from '../../domain/entities/Bookmark';

const STATS_KEY = 'rsvp_stats';
const BOOKMARK_KEY = 'rsvp_bookmarks';

export class StatsRepository {
  private getStatsFromStorage(): ReadingStats {
    try {
      const stored = localStorage.getItem(STATS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...defaultStats, ...parsed };
      }
      return defaultStats;
    } catch (error) {
      console.error('Error reading stats:', error);
      return defaultStats;
    }
  }

  private saveStatsToStorage(stats: ReadingStats): void {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  }

  async getStats(): Promise<ReadingStats> {
    return this.getStatsFromStorage();
  }

  async saveStats(stats: ReadingStats): Promise<void> {
    this.saveStatsToStorage(stats);
  }

  async addWordsRead(wordCount: number): Promise<void> {
    const stats = this.getStatsFromStorage();
    stats.totalWordsRead += wordCount;
    this.saveStatsToStorage(stats);
  }

  async markBookCompleted(): Promise<void> {
    const stats = this.getStatsFromStorage();
    stats.booksCompleted += 1;
    this.saveStatsToStorage(stats);
  }

  async updateTodayMinutes(minutes: number): Promise<void> {
    const stats = this.getStatsFromStorage();
    const today = new Date().toISOString().split('T')[0];
    
    if (stats.lastReadDate === today) {
      stats.todayMinutes = minutes;
    } else {
      stats.todayMinutes = minutes;
      stats.lastReadDate = today;
    }
    this.saveStatsToStorage(stats);
  }

  async updateStreak(): Promise<void> {
    const stats = this.getStatsFromStorage();
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    if (stats.lastReadDate === today) {
      // Already read today, no change
    } else if (stats.lastReadDate === yesterday) {
      // Continued streak
      stats.currentStreak += 1;
      stats.lastReadDate = today;
    } else if (!stats.lastReadDate || stats.lastReadDate < yesterday) {
      // Streak broken, start new
      stats.currentStreak = 1;
      stats.lastReadDate = today;
    }
    this.saveStatsToStorage(stats);
  }

  async recordReadingActivity(params: {
    minutesRead: number;
    wpm: number;
    completedBook?: boolean;
    countSession?: boolean;
  }): Promise<void> {
    const stats = this.getStatsFromStorage();
    const minutesRead = Math.max(0, params.minutesRead);
    const roundedMinutes = Math.round(minutesRead * 10) / 10;
    const wordsRead = Math.round(minutesRead * params.wpm);
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    if (stats.lastReadDate === today) {
      stats.todayMinutes = Math.round((stats.todayMinutes + roundedMinutes) * 10) / 10;
    } else {
      if (stats.lastReadDate === yesterday) {
        stats.currentStreak += 1;
      } else {
        stats.currentStreak = 1;
      }
      stats.todayMinutes = roundedMinutes;
      stats.lastReadDate = today;
    }

    stats.totalMinutes = Math.round((stats.totalMinutes + roundedMinutes) * 10) / 10;
    stats.totalWordsRead += wordsRead;
    stats.lastSessionWpm = params.wpm;

    if (params.countSession && minutesRead > 0) {
      const totalWeightedWpm = (stats.averageWpm * stats.totalSessions) + params.wpm;
      stats.totalSessions += 1;
      stats.averageWpm = Math.round(totalWeightedWpm / stats.totalSessions);
    } else if (stats.totalSessions === 0 && params.wpm > 0) {
      stats.averageWpm = params.wpm;
    }

    if (params.completedBook) {
      stats.booksCompleted += 1;
    }

    this.saveStatsToStorage(stats);
  }
}

export class BookmarkRepository {
  private getAllFromStorage(): Bookmark[] {
    try {
      const stored = localStorage.getItem(BOOKMARK_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
      return [];
    } catch (error) {
      console.error('Error reading bookmarks:', error);
      return [];
    }
  }

  private saveAllToStorage(bookmarks: Bookmark[]): void {
    localStorage.setItem(BOOKMARK_KEY, JSON.stringify(bookmarks));
  }

  async getAll(): Promise<Bookmark[]> {
    return this.getAllFromStorage();
  }

  async getByBookId(bookId: string): Promise<Bookmark[]> {
    const all = this.getAllFromStorage();
    return all.filter(b => b.bookId === bookId);
  }

  async save(bookmark: Bookmark): Promise<void> {
    const bookmarks = this.getAllFromStorage();
    bookmarks.push(bookmark);
    this.saveAllToStorage(bookmarks);
  }

  async delete(id: string): Promise<void> {
    const bookmarks = this.getAllFromStorage();
    const filtered = bookmarks.filter(b => b.id !== id);
    this.saveAllToStorage(filtered);
  }

  async update(id: string, label: string): Promise<void> {
    const bookmarks = this.getAllFromStorage();
    const bookmark = bookmarks.find(b => b.id === id);
    if (bookmark) {
      bookmark.label = label;
      this.saveAllToStorage(bookmarks);
    }
  }
}
