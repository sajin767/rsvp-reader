import { Card } from '../components';
import { useTheme } from '../contexts/ThemeContext';

export function SettingsScreen() {
  const { toggleTheme, isDark } = useTheme();

  return (
    <div className="flex flex-col h-full">
      <header className="p-4 border-b border-gray-800">
        <h1 className="text-xl font-semibold">Settings</h1>
      </header>

      <main className="flex-1 p-4 overflow-auto">
        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="text-sm font-medium text-gray-400 mb-3">Appearance</h2>
            <div className="flex items-center justify-between">
              <span>Dark Mode</span>
              <button
                onClick={toggleTheme}
                className={`w-12 h-6 rounded-full transition-colors ${isDark ? 'bg-blue-500' : 'bg-gray-600'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${isDark ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-medium text-gray-400 mb-3">Reading</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span>Default Speed (WPM)</span>
                <span className="text-gray-400">250</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Punctuation Pause</span>
                <span className="text-gray-400">On</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Periodic Pause</span>
                <span className="text-gray-400">Every 20 words</span>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-medium text-gray-400 mb-3">About</h2>
            <div className="space-y-2 text-sm text-gray-400">
              <p>RSVP Reader v1.0.0</p>
              <p>Speed reading with RSVP technology</p>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
