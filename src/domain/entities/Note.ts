export interface Note {
  id: string;
  bookId: string;
  position: number;
  anchorText: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export function createNote(bookId: string, position: number, anchorText: string, content: string): Note {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    bookId,
    position,
    anchorText,
    content,
    createdAt: now,
    updatedAt: now,
  };
}
