// Dark theme is the default. The choice is remembered in localStorage.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { loadString, saveString } from '../utils/storage.js';

const ThemeContext = createContext({ theme: 'dark', toggleTheme() {} });

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => (loadString('theme', 'dark') === 'light' ? 'light' : 'dark'));

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    saveString('theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
