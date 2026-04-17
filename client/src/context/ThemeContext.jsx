import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }) {
  // mode: 'auto' | 'light' | 'dark'
  const [mode, setMode] = useState(() => localStorage.getItem('theme-mode') || 'auto');
  const [resolved, setResolved] = useState(() =>
    mode === 'auto' ? getSystemTheme() : mode
  );

  // Listen to OS theme changes when in auto mode
  useEffect(() => {
    if (mode !== 'auto') {
      setResolved(mode);
      return;
    }

    setResolved(getSystemTheme());

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => setResolved(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [mode]);

  // Apply dark class
  useEffect(() => {
    const root = document.documentElement;
    if (resolved === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [resolved]);

  // Persist mode
  useEffect(() => {
    localStorage.setItem('theme-mode', mode);
  }, [mode]);

  // Cycle: auto → light → dark → auto
  const toggleTheme = () => {
    setMode((m) => {
      if (m === 'auto') return 'light';
      if (m === 'light') return 'dark';
      return 'auto';
    });
  };

  return (
    <ThemeContext.Provider value={{ mode, theme: resolved, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
