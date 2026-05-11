const BACKUP_KEYS = [
  'rsvp_books',
  'rsvp_settings',
  'rsvp_stats',
  'rsvp_bookmarks',
  'rsvp_last_session',
  'rsvp_notes',
  'rsvp-theme',
] as const;

export interface AppBackupPayload {
  version: 1;
  exportedAt: string;
  data: Record<string, string>;
}

export class AppBackupRepository {
  exportBackup(): AppBackupPayload {
    const data: Record<string, string> = {};

    for (const key of BACKUP_KEYS) {
      const value = localStorage.getItem(key);
      if (value !== null) {
        data[key] = value;
      }
    }

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      data,
    };
  }

  importBackup(payload: AppBackupPayload) {
    if (payload.version !== 1 || !payload.data) {
      throw new Error('Unsupported backup file');
    }

    for (const key of BACKUP_KEYS) {
      localStorage.removeItem(key);
    }

    for (const [key, value] of Object.entries(payload.data)) {
      localStorage.setItem(key, value);
    }
  }
}
