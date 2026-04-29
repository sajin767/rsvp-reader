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

export function SettingsScreen() {
  const { settings, updateSettings, resetSettings } = useSettings();
  const { isDark, toggleTheme } = useTheme();

  return (
    <div className="flex flex-col h-full">
      <header className="p-4 border-b border-gray-800">
        <h1 className="text-xl font-semibold">Settings</h1>
      </header>

      <main className="flex-1 p-4 overflow-auto pb-24">
        {/* Appearance Section */}
        <div className="mb-6">
          <h2 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wide">Appearance</h2>
          
          <div className="bg-surface rounded-xl p-4 space-y-4">
            {/* Dark Mode Toggle */}
            <div className="flex items-center justify-between">
              <span className="text-sm">Dark Mode</span>
              <button
                onClick={toggleTheme}
                className={`w-12 h-6 rounded-full transition-colors ${isDark ? 'bg-blue-500' : 'bg-gray-600'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${isDark ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* Font Size */}
            <div>
              <span className="text-sm mb-2 block">Font Size</span>
              <div className="flex gap-2">
                {FONT_SIZES.map((size) => (
                  <button
                    key={size.value}
                    onClick={() => updateSettings({ fontSize: size.value })}
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

            {/* Font Family */}
            <div>
              <span className="text-sm mb-2 block">Font</span>
              <select
                value={settings.fontFamily}
                onChange={(e) => updateSettings({ fontFamily: e.target.value as any })}
                className="w-full bg-gray-800 text-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="System Default">System Default</option>
                <option value="OpenDyslexic">OpenDyslexic</option>
                <option value="Atkinson Hyperlegible">Atkinson Hyperlegible</option>
              </select>
            </div>

            {/* ORP Highlight Color */}
            <div>
              <span className="text-sm mb-2 block">ORP Highlight Color</span>
              <div className="flex gap-2">
                {HIGHLIGHT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => updateSettings({ highlightColor: c.value as any })}
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

            {/* Warm Mode */}
            <div>
              <span className="text-sm mb-2 block">Warm Mode (Reduce Blue Light)</span>
              <div className="flex gap-2">
                {['off', 'low', 'medium', 'high'].map((level) => (
                  <button
                    key={level}
                    onClick={() => updateSettings({ warmMode: level as any })}
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

        {/* Reading Section */}
        <div className="mb-6">
          <h2 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wide">Reading</h2>
          
          <div className="bg-surface rounded-xl p-4 space-y-4">
            {/* Default Speed */}
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
                onChange={(e) => updateSettings({ wpm: Number(e.target.value) })}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>50</span>
                <span>1000</span>
              </div>
            </div>

            {/* Phantom Words Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm block">Phantom Words</span>
                <span className="text-xs text-gray-500">Show word before & after</span>
              </div>
              <button
                onClick={() => updateSettings({ showPhantomWords: !settings.showPhantomWords })}
                className={`w-12 h-6 rounded-full transition-colors ${settings.showPhantomWords ? 'bg-blue-500' : 'bg-gray-600'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.showPhantomWords ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* Focus Mode Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm block">Focus Mode</span>
                <span className="text-xs text-gray-500">Hide controls while reading</span>
              </div>
              <button
                onClick={() => updateSettings({ focusMode: !settings.focusMode })}
                className={`w-12 h-6 rounded-full transition-colors ${settings.focusMode ? 'bg-blue-500' : 'bg-gray-600'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.focusMode ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* Punctuation Pause */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm block">Punctuation Pause</span>
                <span className="text-xs text-gray-500">Pause at punctuation marks</span>
              </div>
              <button
                onClick={() => updateSettings({ punctuationPause: !settings.punctuationPause })}
                className={`w-12 h-6 rounded-full transition-colors ${settings.punctuationPause ? 'bg-blue-500' : 'bg-gray-600'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.punctuationPause ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* Intelligent Pacing Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm block">Intelligent Pacing</span>
                <span className="text-xs text-gray-500">Slow for names & difficult words</span>
              </div>
              <button
                onClick={() => updateSettings({ intelligentPacing: !settings.intelligentPacing })}
                className={`w-12 h-6 rounded-full transition-colors ${settings.intelligentPacing ? 'bg-blue-500' : 'bg-gray-600'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.intelligentPacing ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* Intelligent Pacing Extra Delay */}
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
                  onChange={(e) => updateSettings({ intelligentPacingExtraDelay: Number(e.target.value) })}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
            )}

            {/* Tap to Freeze */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm block">Tap & Hold to Freeze</span>
                <span className="text-xs text-gray-500">Hold word to stop on it</span>
              </div>
              <button
                onClick={() => updateSettings({ tapToFreeze: !settings.tapToFreeze })}
                className={`w-12 h-6 rounded-full transition-colors ${settings.tapToFreeze ? 'bg-blue-500' : 'bg-gray-600'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.tapToFreeze ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* Break Reminders */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm block">Break Reminders</span>
                <span className="text-xs text-gray-500">Remind to rest your eyes</span>
              </div>
              <button
                onClick={() => updateSettings({ breakReminders: !settings.breakReminders })}
                className={`w-12 h-6 rounded-full transition-colors ${settings.breakReminders ? 'bg-blue-500' : 'bg-gray-600'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.breakReminders ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* Break Reminder Interval */}
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
                  onChange={(e) => updateSettings({ breakReminderMinutes: Number(e.target.value) })}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
            )}
          </div>
        </div>

        {/* Display Section */}
        <div className="mb-6">
          <h2 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wide">Display</h2>
          
          <div className="bg-surface rounded-xl p-4 space-y-4">
            {/* Fade Effect */}
            <div className="flex items-center justify-between">
              <span className="text-sm">Fade Effect</span>
              <button
                onClick={() => updateSettings({ fadeEffect: !settings.fadeEffect })}
                className={`w-12 h-6 rounded-full transition-colors ${settings.fadeEffect ? 'bg-blue-500' : 'bg-gray-600'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.fadeEffect ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* Progress Bar */}
            <div className="flex items-center justify-between">
              <span className="text-sm">Show Progress Bar</span>
              <button
                onClick={() => updateSettings({ showProgressBar: !settings.showProgressBar })}
                className={`w-12 h-6 rounded-full transition-colors ${settings.showProgressBar ? 'bg-blue-500' : 'bg-gray-600'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.showProgressBar ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* WPM Indicator */}
            <div className="flex items-center justify-between">
              <span className="text-sm">Show WPM Indicator</span>
              <button
                onClick={() => updateSettings({ showWpmIndicator: !settings.showWpmIndicator })}
                className={`w-12 h-6 rounded-full transition-colors ${settings.showWpmIndicator ? 'bg-blue-500' : 'bg-gray-600'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.showWpmIndicator ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="mb-6">
          <h2 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wide">Statistics</h2>
          
          <div className="bg-surface rounded-xl p-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-500">0</div>
                <div className="text-xs text-gray-500">Words Read</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-500">0</div>
                <div className="text-xs text-gray-500">Books Done</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-500">0</div>
                <div className="text-xs text-gray-500">Day Streak</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-500">0m</div>
                <div className="text-xs text-gray-500">Today</div>
              </div>
            </div>
          </div>
        </div>

        {/* Reset */}
        <div className="mb-6">
          <button
            onClick={resetSettings}
            className="w-full py-3 bg-gray-800 text-gray-400 rounded-xl text-sm hover:bg-gray-700 transition-colors"
          >
            Reset to Defaults
          </button>
        </div>

        {/* About */}
        <div className="text-center text-xs text-gray-600">
          <p>RSVP Reader v1.0.0</p>
          <p>Speed reading with RSVP technology</p>
        </div>
      </main>
    </div>
  );
}