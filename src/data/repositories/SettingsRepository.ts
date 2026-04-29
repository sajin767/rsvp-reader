// Settings Repository - localStorage implementation
import type { ISettingsRepository } from '../../domain/repositories';
import type { AppSettings } from '../../domain/entities/Settings';
import { defaultSettings } from '../../domain/entities/Settings';

const SETTINGS_KEY = 'rsvp_settings';

export class SettingsRepository implements ISettingsRepository {
  async get(): Promise<AppSettings> {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...defaultSettings, ...parsed };
      }
      return defaultSettings;
    } catch (error) {
      console.error('Error loading settings:', error);
      return defaultSettings;
    }
  }

  async save(settings: AppSettings): Promise<void> {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving settings:', error);
      throw error;
    }
  }
}