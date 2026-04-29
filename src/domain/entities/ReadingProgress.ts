// Reading Progress entity
export interface ReadingProgress {
  bookId: string;
  wordPosition: number;
  percentage: number;
  wpm: number;
  lastUpdated: string;
}

// Factory function to create reading progress
export function createReadingProgress(bookId: string, wordPosition: number, totalWords: number, wpm: number): ReadingProgress {
  const percentage = totalWords > 0 ? Math.round((wordPosition / totalWords) * 100) : 0;
  return {
    bookId,
    wordPosition,
    percentage,
    wpm,
    lastUpdated: new Date().toISOString(),
  };
}