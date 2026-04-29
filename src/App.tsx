import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { ThemeProvider } from './presentation/contexts/ThemeContext';
import { SettingsProvider } from './presentation/contexts/SettingsContext';
import { LibraryProvider } from './presentation/contexts/LibraryContext';
import { ReaderProvider } from './presentation/contexts/ReaderContext';
import { LibraryScreen, ReaderScreen, SettingsScreen } from './presentation/screens';

function BottomNav() {
  const navItems = [
    { path: '/library', label: 'Library', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
    { path: '/reader', label: 'Reader', icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { path: '/settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-gray-800 z-40">
      <div className="flex justify-around items-center h-16 px-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 py-2 text-xs transition-colors ${
                isActive ? 'text-blue-500' : 'text-gray-500 hover:text-gray-300'
              }`
            }
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
            </svg>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

function App() {
  return (
    <ThemeProvider>
      <SettingsProvider>
        <LibraryProvider>
          <ReaderProvider>
            <BrowserRouter>
              <div className="min-h-screen bg-background pb-16">
                <Routes>
                  <Route path="/library" element={<LibraryScreen />} />
                  <Route path="/reader" element={<ReaderScreen />} />
                  <Route path="/settings" element={<SettingsScreen />} />
                  <Route path="*" element={<LibraryScreen />} />
                </Routes>
                <BottomNav />
              </div>
            </BrowserRouter>
          </ReaderProvider>
        </LibraryProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}

export default App;
