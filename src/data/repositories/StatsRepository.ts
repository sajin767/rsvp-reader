// Stats Repository - localStorage implementation for reading statistics
import type { ReadingStats } from '../../domain/entities/ReadingStats';
import { defaultStats } from '../../domain/entities/ReadingStats';

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
}

// Bookmark interface
export interface Bookmark {
  id: string;
  bookId: string;
  position: number;
  label: string;
  createdAt: string;
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
