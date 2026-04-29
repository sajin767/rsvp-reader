// Theme Context - provides theme settings throughout the app
import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('rsvp-theme');
    return (saved as Theme) || 'dark';
  });

  useEffect(() => {
    localStorage.setItem('rsvp-theme', theme);
    document.documentElement.classList.toggle('light', theme === 'light');
    
    // Pure OLED black for dark theme
    if (theme === 'dark') {
      document.documentElement.style.setProperty('--color-background', '#000000');
      document.documentElement.style.setProperty('--color-surface', '#000000');
      document.documentElement.style.setProperty('--color-card', '#0a0a0a');
      document.documentElement.style.setProperty('--color-border', '#1a1a1a');
      document.body.style.backgroundColor = '#000000';
    } else {
      document.documentElement.style.setProperty('--color-background', '#ffffff');
      document.documentElement.style.setProperty('--color-surface', '#f5f5f5');
      document.documentElement.style.setProperty('--color-card', '#ffffff');
      document.documentElement.style.setProperty('--color-border', '#e5e5e5');
      document.body.style.backgroundColor = '#ffffff';
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}