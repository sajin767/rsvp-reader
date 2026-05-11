import type { Note } from '../../domain/entities/Note';

const NOTES_KEY = 'rsvp_notes';

export class NoteRepository {
  private getAllFromStorage(): Note[] {
    try {
      const stored = localStorage.getItem(NOTES_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error reading notes:', error);
      return [];
    }
  }

  private saveAllToStorage(notes: Note[]) {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  }

  async getByBookId(bookId: string): Promise<Note[]> {
    return this.getAllFromStorage()
      .filter(note => note.bookId === bookId)
      .sort((a, b) => a.position - b.position);
  }

  async save(note: Note): Promise<void> {
    const notes = this.getAllFromStorage();
    notes.push(note);
    this.saveAllToStorage(notes);
  }

  async update(id: string, content: string): Promise<void> {
    const notes = this.getAllFromStorage();
    const note = notes.find(item => item.id === id);
    if (note) {
      note.content = content;
      note.updatedAt = new Date().toISOString();
      this.saveAllToStorage(notes);
    }
  }

  async delete(id: string): Promise<void> {
    const notes = this.getAllFromStorage().filter(note => note.id !== id);
    this.saveAllToStorage(notes);
  }
}
