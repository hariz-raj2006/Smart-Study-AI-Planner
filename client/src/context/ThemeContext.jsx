
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

const ThemeContext = createContext(null);

export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const set = useCallback(
    (next) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;

        try {
          window.localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          // Storage may be unavailable.
        }

        return resolved;
      });
    },
    [key]
  );

  return [value, set];
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useLocalStorage('smartstudy.theme', 'system');

  useEffect(() => {
    const root = document.documentElement;
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const dark = theme === 'dark' ||
        (theme === 'system' && systemDark.matches);

      root.classList.toggle('dark', dark);
      root.style.colorScheme = dark ? 'dark' : 'light';
    };

    applyTheme();

    if (theme !== 'system') return undefined;

    systemDark.addEventListener('change', applyTheme);
    return () => systemDark.removeEventListener('change', applyTheme);
  }, [theme]);

  const value = { theme, setTheme };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }

  return context;
}
