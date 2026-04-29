// Repository interfaces for Clean Architecture

import type { Book } from '../entities/Book';
import type { AppSettings } from '../entities/Settings';

export interface IBookRepository {
  getAll(): Promise<Book[]>;
  getById(id: string): Promise<Book | null>;
  save(book: Book): Promise<void>;
  update(book: Book): Promise<void>;
  delete(id: string): Promise<void>;
  updateProgress(id: string, position: number, progress: number): Promise<void>;
}

export interface ISettingsRepository {
  get(): Promise<AppSettings>;
  save(settings: AppSettings): Promise<void>;
}