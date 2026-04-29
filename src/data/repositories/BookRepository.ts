// Book Repository - localStorage implementation
import type { IBookRepository } from '../../domain/repositories';
import type { Book } from '../../domain/entities/Book';
import { createBook } from '../../domain/entities/Book';

const BOOKS_KEY = 'rsvp_books';

// Demo books for testing
const DEMO_BOOKS: Partial<Book>[] = [
  {
    title: 'Speed Reading Mastery',
    author: 'RSVP App',
    fileType: 'txt',
    filePath: 'demo://speed-reading',
    totalWords: 2450,
    content: `Speed reading is a collection of techniques designed to increase reading speed without significantly reducing comprehension or retention. The basic idea behind speed reading is simple: by reducing the time your eyes spend on each word and training them to move more efficiently across the page, you can dramatically increase your reading rate.

However, speed reading is not just about reading faster. It's about reading smarter. The most effective speed reading techniques involve actively engaging with the text, minimizing subvocalization (the habit of silently pronouncing words as you read), and training your brain to process information more efficiently.

One of the most popular speed reading methods is RSVP, or Rapid Serial Visual Presentation. This technique displays words one at a time in a fixed position on the screen, eliminating the need for eye movement and allowing your brain to focus entirely on processing the information.

The key to successful speed reading is practice. Like any skill, the more you practice, the better you become. Start with easier texts and gradually increase the complexity as your speed and comprehension improve.

Remember that not every text requires the same reading speed. Novels and leisure reading can be enjoyed at a comfortable pace, while technical manuals or academic papers might require more careful, slower reading. The goal of speed reading is not to rush through everything, but to match your reading speed to the demands of the material.

With consistent practice, most people can double or even triple their reading speed while maintaining good comprehension. This can save hours of valuable time and make reading a more enjoyable and efficient activity. Start your speed reading journey today and discover the benefits of reading faster and smarter.`,
  },
  {
    title: 'The Art of Focus',
    author: 'Productivity Expert',
    fileType: 'txt',
    filePath: 'demo://focus',
    totalWords: 1820,
    content: `In our modern world of constant distractions, the ability to focus has become a superpower. Deep work, a concept popularized by productivity author Cal Newport, refers to professional activities performed in a state of distraction-free concentration that push your cognitive capabilities to their limit.

The foundation of deep work is focus. Without the ability to concentrate deeply on a single task, you cannot achieve the flow states necessary for producing your best work. In today's information-rich environment, this ability is becoming increasingly rare and increasingly valuable.

Building focus is like building a muscle. It requires regular practice and gradual increases in difficulty. Start by setting aside dedicated time for focused work, free from interruptions. Turn off notifications, close unnecessary browser tabs, and create an environment conducive to concentration.

The Pomodoro Technique is one effective method for building focus. Work in focused 25-minute sessions followed by 5-minute breaks. After completing four sessions, take a longer 15-30 minute break. This structure helps maintain concentration while preventing mental fatigue.

Another key aspect of focus is eliminating decision fatigue. When you spend mental energy deciding what to work on, you have less energy available for the actual work. Batch similar tasks together and create routines that reduce the number of decisions you need to make each day.

Remember that focus is a finite resource. Treat it as such by prioritizing your most important tasks during your peak energy hours. Protect your focus time as fiercely as you would protect any other valuable resource. By developing strong focus skills, you can produce better work in less time and achieve your professional and personal goals more efficiently.`,
  },
  {
    title: 'Memory Techniques',
    author: 'Learning Lab',
    fileType: 'txt',
    filePath: 'demo://memory',
    totalWords: 2100,
    content: `Your memory is more powerful than you might think. The ancient Greeks developed sophisticated memory techniques thousands of years ago, and modern neuroscience has confirmed that these methods engage the brain's natural learning processes more effectively than simple repetition.

The method of loci, also known as the memory palace technique, is one of the most powerful memory methods available. To use it, you visualize a familiar location, such as your home, and place mental images representing the items you want to remember along a path through that location. When you need to recall the information, you mentally walk through your palace and encounter each image in sequence.

Another powerful technique is spaced repetition. Instead of cramming information into a single study session, you review material at gradually increasing intervals. This leverages the psychological spacing effect, which shows that information is better retained when study sessions are spaced apart rather than massed together.

Chunking is another essential memory technique. Working memory can typically hold about seven items at once, but by grouping information into meaningful chunks, you can dramatically increase what you can remember. For example, rather than memorizing a string of twelve random numbers, you might chunk them into three groups of four.

Active recall, the practice of actively testing your memory rather than passively reviewing material, significantly improves retention. When you struggle to recall information, the act of retrieval itself strengthens the memory trace, making future recall easier.

Finally, elaborate encoding involves connecting new information to existing knowledge in meaningful ways. The more connections you create between new material and what you already know, the more firmly the new information will be encoded in your memory. Use these techniques to transform your memory from a limitation into a superpower.`,
  },
];

export class BookRepository implements IBookRepository {
  private initializeDemoBooks(): void {
    const existing = localStorage.getItem(BOOKS_KEY);
    if (!existing) {
      const books = DEMO_BOOKS.map(b => createBook({
        title: b.title!,
        author: b.author!,
        fileType: b.fileType!,
        filePath: b.filePath!,
        totalWords: b.totalWords!,
        content: b.content!,
      }));
      localStorage.setItem(BOOKS_KEY, JSON.stringify(books));
    }
  }

  private getAllFromStorage(): Book[] {
    this.initializeDemoBooks();
    try {
      const stored = localStorage.getItem(BOOKS_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
      return [];
    } catch (error) {
      console.error('Error reading books:', error);
      return [];
    }
  }

  private saveAllToStorage(books: Book[]): void {
    try {
      const jsonStr = JSON.stringify(books);
      console.log('[BookRepository] Total storage size:', jsonStr.length, 'bytes');
      localStorage.setItem(BOOKS_KEY, jsonStr);
    } catch (err) {
      console.error('[BookRepository] localStorage error:', err);
      if (err instanceof Error && err.name === 'QuotaExceededError') {
        throw new Error('Storage quota exceeded. Please delete some books to free up space.');
      }
      throw err;
    }
  }

  async getAll(): Promise<Book[]> {
    return this.getAllFromStorage();
  }

  async getById(id: string): Promise<Book | null> {
    const books = this.getAllFromStorage();
    return books.find(b => b.id === id) || null;
  }

  async save(book: Book): Promise<void> {
    try {
      console.log('[BookRepository.save] Saving book:', book.id, 'content length:', book.content?.length);
      const books = this.getAllFromStorage();
      const totalSize = JSON.stringify(books).length + JSON.stringify(book).length;
      console.log('[BookRepository.save] Estimated storage size:', totalSize, 'bytes');
      
      books.push(book);
      this.saveAllToStorage(books);
      console.log('[BookRepository.save] Success');
    } catch (err) {
      console.error('[BookRepository.save] Error:', err);
      if (err instanceof Error && err.name === 'QuotaExceededError') {
        throw new Error('Storage quota exceeded. The book is too large to save.');
      }
      throw err;
    }
  }

  async update(book: Book): Promise<void> {
    const books = this.getAllFromStorage();
    const index = books.findIndex(b => b.id === book.id);
    if (index !== -1) {
      books[index] = book;
      this.saveAllToStorage(books);
    }
  }

  async delete(id: string): Promise<void> {
    const books = this.getAllFromStorage();
    const filtered = books.filter(b => b.id !== id);
    this.saveAllToStorage(filtered);
  }

  async updateProgress(id: string, position: number, progress: number): Promise<void> {
    const books = this.getAllFromStorage();
    const book = books.find(b => b.id === id);
    if (book) {
      book.currentPosition = position;
      book.currentProgress = progress;
      book.lastReadAt = new Date().toISOString();
      this.saveAllToStorage(books);
    }
  }
}