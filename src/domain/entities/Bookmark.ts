// Bookmark entity
export interface Bookmark {
  id: string;
  bookId: string;
  position: number;
  label: string;
  createdAt: string;
}

// Factory function to create a bookmark
export function createBookmark(bookId: string, position: number, label: string): Bookmark {
  return {
    id: crypto.randomUUID(),
    bookId,
    position,
    label,
    createdAt: new Date().toISOString(),
  };
}
