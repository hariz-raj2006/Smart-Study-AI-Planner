    import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

    const STORAGE_KEY = 'smartstudy.theme';
    const THEMES = ['light', 'dark', 'system'];

    function readStored() {
    try {
        const value = window.localStorage.getItem(STORAGE_KEY);
        return THEMES.includes(value) ? value : 'system';
    } catch {
        return 'system';
    }
    }

    function applyToDocument(theme) {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    }

    /** Called once before React renders, so the right theme is on screen from the first frame. */
    export function applyStoredTheme() {
    applyToDocument(readStored());
    }

    const ThemeContext = createContext(null);

    export function ThemeProvider({ children }) {
    const [theme, setThemeState] = useState(readStored);
    const [systemDark, setSystemDark] = useState(
        () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches
    );

    useEffect(() => {
        if (typeof window.matchMedia !== 'function') return undefined;
        const query = window.matchMedia('(prefers-color-scheme: dark)');
        const onChange = (e) => setSystemDark(e.matches);
        query.addEventListener('change', onChange);
        return () => query.removeEventListener('change', onChange);
    }, []);

    const setTheme = useCallback((next) => {
        if (!THEMES.includes(next)) return;
        applyToDocument(next);
        try {
        window.localStorage.setItem(STORAGE_KEY, next);
        } catch {
        /* ignore */
        }
        setThemeState(next);
    }, []);

    const resolved = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
    const value = useMemo(() => ({ theme, resolved, setTheme }), [theme, resolved, setTheme]);
    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
    }

    export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
    return ctx;
    }