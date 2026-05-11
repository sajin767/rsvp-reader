import { useEffect, useState } from 'react';
import type { ReadingStats } from '../../domain/entities/ReadingStats';
import { defaultStats } from '../../domain/entities/ReadingStats';
import { AppBackupRepository } from '../../data/repositories/AppBackupRepository';
import { StatsRepository } from '../../data/repositories/StatsRepository';
import { useAuth } from '../contexts/AuthContext';
import { useLibrary } from '../contexts/LibraryContext';
import { useSettings } from '../contexts/SettingsContext';
import { useTheme } from '../contexts/ThemeContext';

const HIGHLIGHT_COLORS = [
  { name: 'Red', value: 'red', color: '#ff4444' },
  { name: 'Yellow', value: 'yellow', color: '#ffdd44' },
  { name: 'Cyan', value: 'cyan', color: '#44ffff' },
  { name: 'Green', value: 'green', color: '#44ff88' },
  { name: 'Blue', value: 'blue', color: '#4488ff' },
  { name: 'White', value: 'white', color: '#ffffff' },
];

const FONT_SIZES = [
  { label: 'S', value: 32 },
  { label: 'M', value: 42 },
  { label: 'L', value: 56 },
  { label: 'XL', value: 72 },
];

const statsRepository = new StatsRepository();
const appBackupRepository = new AppBackupRepository();

export function SettingsScreen() {
  const auth = useAuth();
  const { settings, updateSettings, resetSettings } = useSettings();
  const { isDark, toggleTheme } = useTheme();
  const { refreshLibrary } = useLibrary();
  const [stats, setStats] = useState<ReadingStats>(defaultStats);
  const [syncEmail, setSyncEmail] = useState('');
  const [syncStatus, setSyncStatus] = useState('');
  const [syncError, setSyncError] = useState('');

  useEffect(() => {
    void statsRepository.getStats().then(setStats);
  }, []);

  const handleExportBackup = () => {
    const payload = appBackupRepository.exportBackup();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `rsvp-reader-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      appBackupRepository.importBackup(JSON.parse(content));
      await refreshLibrary();
      window.location.reload();
    } catch (error) {
      alert(`Backup import failed: ${error instanceof Error ? error.message : 'Invalid backup file'}`);
    } finally {
      event.target.value = '';
    }
  };

  const handleSendEmailLink = async () => {
    setSyncError('');
    setSyncStatus('');
    try {
      await auth.sendEmailLink(syncEmail);
      setSyncStatus('Check your email for the sign-in link.');
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Failed to send sign-in link.');
    }
  };

  const handleCompleteEmailLink = async () => {
    setSyncError('');
    setSyncStatus('');
    try {
      await auth.completeEmailLink(syncEmail);
      setSyncStatus('Signed in.');
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Failed to complete sign-in.');
    }
  };

  const handleSignOut = async () => {
    setSyncError('');
    setSyncStatus('');
    try {
      await auth.signOut();
      setSyncStatus('Signed out.');
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Failed to sign out.');
    }
  };

  return (
    <div className="flex flex-col h-full">
      <header className="p-4 border-b border-gray-800">
        <h1 className="text-xl font-semibold">Settings</h1>
      </header>

      <main className="flex-1 p-4 overflow-auto pb-24">
        <div className="mb-6">
          <h2 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wide">Appearance</h2>

          <div className="bg-surface rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Dark Mode</span>
              <button
                onClick={toggleTheme}
                className={`w-12 h-6 rounded-full transition-colors ${isDark ? 'bg-blue-500' : 'bg-gray-600'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${isDark ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <div>
              <span className="text-sm mb-2 block">Font Size</span>
              <div className="flex gap-2">
                {FONT_SIZES.map((size) => (
                  <button
                    key={size.value}
                    onClick={() => { void updateSettings({ fontSize: size.value }); }}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      settings.fontSize === size.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {size.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="text-sm mb-2 block">Font</span>
              <select
                value={settings.fontFamily}
                onChange={(e) => { void updateSettings({ fontFamily: e.target.value as typeof settings.fontFamily }); }}
                className="w-full bg-gray-800 text-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="System Default">System Default</option>
                <option value="OpenDyslexic">OpenDyslexic</option>
                <option value="Atkinson Hyperlegible">Atkinson Hyperlegible</option>
              </select>
            </div>

            <div>
              <span className="text-sm mb-2 block">ORP Highlight Color</span>
              <div className="flex gap-2">
                {HIGHLIGHT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => { void updateSettings({ highlightColor: c.value as typeof settings.highlightColor }); }}
                    className={`w-10 h-10 rounded-full border-2 transition-all ${
                      settings.highlightColor === c.value
                        ? 'border-white scale-110'
                        : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c.color }}
                    title={c.name}
                  />
                ))}
              </div>
            </div>

            <div>
              <span className="text-sm mb-2 block">Warm Mode (Reduce Blue Light)</span>
              <div className="flex gap-2">
                {['off', 'low', 'medium', 'high'].map((level) => (
                  <button
                    key={level}
                    onClick={() => { void updateSettings({ warmMode: level as typeof settings.warmMode }); }}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                      settings.warmMode === level
                        ? 'bg-orange-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wide">Reading</h2>

          <div className="bg-surface rounded-xl p-4 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm">Default Speed</span>
                <span className="text-blue-500 font-medium">{settings.wpm} WPM</span>
              </div>
              <input
                type="range"
                min="50"
                max="1000"
                value={settings.wpm}
                onChange={(e) => { void updateSettings({ wpm: Number(e.target.value) }); }}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>50</span>
                <span>1000</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm block">Phantom Words</span>
                <span className="text-xs text-gray-500">Show word before & after</span>
              </div>
              <button
                onClick={() => { void updateSettings({ showPhantomWords: !settings.showPhantomWords }); }}
                className={`w-12 h-6 rounded-full transition-colors ${settings.showPhantomWords ? 'bg-blue-500' : 'bg-gray-600'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.showPhantomWords ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm block">Focus Mode</span>
                <span className="text-xs text-gray-500">Hide controls while reading</span>
              </div>
              <button
                onClick={() => { void updateSettings({ focusMode: !settings.focusMode }); }}
                className={`w-12 h-6 rounded-full transition-colors ${settings.focusMode ? 'bg-blue-500' : 'bg-gray-600'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.focusMode ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm block">Punctuation Pause</span>
                <span className="text-xs text-gray-500">Pause at punctuation marks</span>
              </div>
              <button
                onClick={() => { void updateSettings({ punctuationPause: !settings.punctuationPause }); }}
                className={`w-12 h-6 rounded-full transition-colors ${settings.punctuationPause ? 'bg-blue-500' : 'bg-gray-600'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.punctuationPause ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm block">Intelligent Pacing</span>
                <span className="text-xs text-gray-500">Slow for names & difficult words</span>
              </div>
              <button
                onClick={() => { void updateSettings({ intelligentPacing: !settings.intelligentPacing }); }}
                className={`w-12 h-6 rounded-full transition-colors ${settings.intelligentPacing ? 'bg-blue-500' : 'bg-gray-600'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.intelligentPacing ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {settings.intelligentPacing && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm">Extra Delay</span>
                  <span className="text-blue-500 font-medium">{settings.intelligentPacingExtraDelay}ms</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="300"
                  step="10"
                  value={settings.intelligentPacingExtraDelay}
                  onChange={(e) => { void updateSettings({ intelligentPacingExtraDelay: Number(e.target.value) }); }}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm block">Tap & Hold to Freeze</span>
                <span className="text-xs text-gray-500">Hold word to stop on it</span>
              </div>
              <button
                onClick={() => { void updateSettings({ tapToFreeze: !settings.tapToFreeze }); }}
                className={`w-12 h-6 rounded-full transition-colors ${settings.tapToFreeze ? 'bg-blue-500' : 'bg-gray-600'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.tapToFreeze ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm block">Break Reminders</span>
                <span className="text-xs text-gray-500">Remind to rest your eyes</span>
              </div>
              <button
                onClick={() => { void updateSettings({ breakReminders: !settings.breakReminders }); }}
                className={`w-12 h-6 rounded-full transition-colors ${settings.breakReminders ? 'bg-blue-500' : 'bg-gray-600'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.breakReminders ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {settings.breakReminders && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm">Reminder Every</span>
                  <span className="text-blue-500 font-medium">{settings.breakReminderMinutes} min</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="45"
                  step="5"
                  value={settings.breakReminderMinutes}
                  onChange={(e) => { void updateSettings({ breakReminderMinutes: Number(e.target.value) }); }}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
            )}
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wide">Voice</h2>

          <div className="bg-surface rounded-xl p-4 space-y-4">
            <div>
              <label className="text-sm text-white" htmlFor="natural-voice-endpoint">Natural voice endpoint or Deepgram key</label>
              <input
                id="natural-voice-endpoint"
                value={settings.naturalVoiceEndpoint}
                onChange={(e) => { void updateSettings({ naturalVoiceEndpoint: e.target.value }); }}
                placeholder="Deepgram API key or https://your-service/manifest"
                className="mt-2 w-full rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-200 outline-none ring-1 ring-gray-700 focus:ring-blue-500"
              />
              <div className="mt-2 text-xs text-gray-500">
                Paste a Deepgram key for direct Aura voice, or a manifest endpoint for exact word timestamps. Without this, Voice uses device TTS.
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wide">Display</h2>

          <div className="bg-surface rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Fade Effect</span>
              <button
                onClick={() => { void updateSettings({ fadeEffect: !settings.fadeEffect }); }}
                className={`w-12 h-6 rounded-full transition-colors ${settings.fadeEffect ? 'bg-blue-500' : 'bg-gray-600'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.fadeEffect ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm">Show Progress Bar</span>
              <button
                onClick={() => { void updateSettings({ showProgressBar: !settings.showProgressBar }); }}
                className={`w-12 h-6 rounded-full transition-colors ${settings.showProgressBar ? 'bg-blue-500' : 'bg-gray-600'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.showProgressBar ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm">Show WPM Indicator</span>
              <button
                onClick={() => { void updateSettings({ showWpmIndicator: !settings.showWpmIndicator }); }}
                className={`w-12 h-6 rounded-full transition-colors ${settings.showWpmIndicator ? 'bg-blue-500' : 'bg-gray-600'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.showWpmIndicator ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wide">Statistics</h2>

          <div className="bg-surface rounded-xl p-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-500">{stats.totalWordsRead.toLocaleString()}</div>
                <div className="text-xs text-gray-500">Words Read</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-500">{stats.booksCompleted}</div>
                <div className="text-xs text-gray-500">Books Done</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-500">{stats.currentStreak}</div>
                <div className="text-xs text-gray-500">Day Streak</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-500">{stats.todayMinutes.toFixed(1)}m</div>
                <div className="text-xs text-gray-500">Today</div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-gray-900 p-3">
                <div className="text-lg font-semibold text-white">{stats.averageWpm}</div>
                <div className="text-[11px] text-gray-500">Avg WPM</div>
              </div>
              <div className="rounded-lg bg-gray-900 p-3">
                <div className="text-lg font-semibold text-white">{stats.totalMinutes.toFixed(1)}m</div>
                <div className="text-[11px] text-gray-500">All Time</div>
              </div>
              <div className="rounded-lg bg-gray-900 p-3">
                <div className="text-lg font-semibold text-white">{stats.totalSessions}</div>
                <div className="text-[11px] text-gray-500">Sessions</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wide">Cloud Backup</h2>

          <div className="bg-surface rounded-xl p-4 space-y-4">
            <div>
              <div className="text-sm text-white">Account sync</div>
              <div className="text-xs text-gray-500 mt-1">
                Sign in only when you want to sync app state across devices.
              </div>
            </div>

            {auth.configError ? (
              <div className="rounded-lg bg-red-950/60 p-3 text-xs text-red-200">
                {auth.configError}
              </div>
            ) : auth.isAuthenticated ? (
              <div className="space-y-3">
                <div className="rounded-lg bg-gray-900 p-3">
                  <div className="text-xs text-gray-500">Signed in as</div>
                  <div className="mt-1 text-sm text-white break-all">{auth.email}</div>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled
                    className="flex-1 rounded-lg bg-gray-800 py-2 text-sm text-gray-500"
                  >
                    Sync Coming Next
                  </button>
                  <button
                    type="button"
                    onClick={() => { void handleSignOut(); }}
                    className="flex-1 rounded-lg bg-gray-800 py-2 text-sm text-gray-200 hover:bg-gray-700"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="email"
                  value={syncEmail}
                  onChange={(event) => { setSyncEmail(event.target.value); }}
                  placeholder="Email address"
                  className="w-full rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-200 outline-none ring-1 ring-gray-700 focus:ring-blue-500"
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { void handleSendEmailLink(); }}
                    disabled={auth.isLoading}
                    className="flex-1 rounded-lg bg-blue-600 py-2 text-sm text-white hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500"
                  >
                    Send Sign-In Link
                  </button>
                  <button
                    type="button"
                    onClick={() => { void handleCompleteEmailLink(); }}
                    disabled={auth.isLoading}
                    className="flex-1 rounded-lg bg-gray-800 py-2 text-sm text-gray-200 hover:bg-gray-700 disabled:text-gray-500"
                  >
                    Complete Login
                  </button>
                </div>
              </div>
            )}

            {syncStatus && (
              <div className="rounded-lg bg-blue-950/60 p-3 text-xs text-blue-200">{syncStatus}</div>
            )}
            {syncError && (
              <div className="rounded-lg bg-red-950/60 p-3 text-xs text-red-200">{syncError}</div>
            )}

            <div>
              <div className="text-sm text-white">Portable sync file</div>
              <div className="text-xs text-gray-500 mt-1">
                Export your full app state and store it in iCloud Drive, Google Drive, Dropbox, or any other cloud folder.
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleExportBackup}
                className="flex-1 rounded-lg bg-blue-600 py-2 text-sm text-white hover:bg-blue-500"
              >
                Export Backup
              </button>
              <label className="flex-1 rounded-lg bg-gray-800 py-2 text-center text-sm text-gray-200 hover:bg-gray-700 cursor-pointer">
                Import Backup
                <input type="file" accept=".json,application/json" onChange={(e) => { void handleImportBackup(e); }} className="hidden" />
              </label>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <button
            onClick={() => { void resetSettings(); }}
            className="w-full py-3 bg-gray-800 text-gray-400 rounded-xl text-sm hover:bg-gray-700 transition-colors"
          >
            Reset to Defaults
          </button>
        </div>

        <div className="text-center text-xs text-gray-600">
          <p>RSVP Reader v1.0.0</p>
          <p>Speed reading with RSVP technology</p>
        </div>
      </main>
    </div>
  );
}
