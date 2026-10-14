import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../services/endpoints.js';
import { useTheme } from './ThemeContext.jsx';
import { useToast } from './ToastContext.jsx';

const AuthContext = createContext(null);

/**
 * Keeps track of who is logged in. The login itself is an httpOnly cookie set by the server,
 * so it survives page reloads and JavaScript cannot read it. On start we simply ask
 * the server "who am I?" (GET /api/auth/me).
 *
 * status: 'loading' | 'authenticated' | 'anonymous' | 'error' (server not reachable)
 */
export function AuthProvider({ children }) {
  const { setTheme } = useTheme();
  const toast = useToast();
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');
  const [bootError, setBootError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  const adopt = useCallback(
    (nextUser) => {
      setUser(nextUser);
      setStatus('authenticated');
      if (nextUser.theme) setTheme(nextUser.theme);
    },
    [setTheme]
  );

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    authApi
      .me({ signal: controller.signal })
      .then((res) => adopt(res.user))
      .catch((err) => {
        if (err && err.name === 'AbortError') return;
        if (err.status === 401) {
          setUser(null);
          setStatus('anonymous');
        } else {
          setBootError(err);
          setStatus('error');
        }
      });
    return () => controller.abort();
  }, [adopt, attempt]);

  // Any protected request that comes back 401 means the session ended.
  useEffect(() => {
    const onExpired = () => {
      setUser((current) => {
        if (current) toast.info('Your session has ended. Please log in again.');
        return null;
      });
      setStatus('anonymous');
    };
    window.addEventListener('smartstudy:unauthorized', onExpired);
    return () => window.removeEventListener('smartstudy:unauthorized', onExpired);
  }, [toast]);

  const login = useCallback(
    async (email, password) => {
      const res = await authApi.login({ email, password });
      adopt(res.user);
      return res.user;
    },
    [adopt]
  );

  const register = useCallback(
    async (form) => {
      const res = await authApi.register(form);
      adopt(res.user);
      return res.user;
    },
    [adopt]
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* even if the request fails we still leave the screen */
    }
    setUser(null);
    setStatus('anonymous');
  }, []);

  const updateProfile = useCallback(
    async (patch) => {
      const res = await authApi.updateProfile(patch);
      setUser(res.user);
      return res.user;
    },
    []
  );

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