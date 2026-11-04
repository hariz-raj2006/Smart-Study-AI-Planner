import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { authApi } from '../services/endpoints.js';
import { useTheme } from './ThemeContext.jsx';
import { useToast } from './ToastContext.jsx';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { setTheme } = useTheme();
  const toast = useToast();
  const setThemeRef = useRef(setTheme);
  const toastRef = useRef(toast);

  setThemeRef.current = setTheme;
  toastRef.current = toast;

  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');
  const [bootError, setBootError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  const adopt = useCallback((nextUser) => {
    setUser(nextUser);
    setStatus('authenticated');
    if (nextUser?.theme) setThemeRef.current(nextUser.theme);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setStatus('loading');
    setBootError(null);

    authApi.me({ signal: controller.signal })
      .then((res) => {
        if (active) adopt(res.user);
      })
      .catch((err) => {
        if (!active || err?.name === 'AbortError') return;

        if (err?.status === 401) {
          setUser(null);
          setStatus('anonymous');
        } else {
          setBootError(err);
          setStatus('error');
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [adopt, attempt]);

  useEffect(() => {
    const onExpired = () => {
      setUser((current) => {
        if (current) toastRef.current.info('Your session has ended. Please log in again.');
        return null;
      });
      setStatus('anonymous');
    };

    window.addEventListener('smartstudy:unauthorized', onExpired);
    return () => window.removeEventListener('smartstudy:unauthorized', onExpired);
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await authApi.login({ email, password });
    adopt(res.user);
    return res.user;
  }, [adopt]);

  const register = useCallback(async (form) => {
    const res = await authApi.register(form);
    adopt(res.user);
    return res.user;
  }, [adopt]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Leave the screen even if the logout request fails.
    }
    setUser(null);
    setStatus('anonymous');
  }, []);

  const updateProfile = useCallback(async (patch) => {
    const res = await authApi.updateProfile(patch);
    setUser(res.user);
    return res.user;
  }, []);

  const retry = useCallback(() => {
    setBootError(null);
    setAttempt((n) => n + 1);
  }, []);

  const value = useMemo(
    () => ({ user, status, bootError, login, register, logout, updateProfile, retry }),
    [user, status, bootError, login, register, logout, updateProfile, retry]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
