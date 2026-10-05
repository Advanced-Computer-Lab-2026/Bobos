import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { TOKEN_STORAGE_KEY } from '../api/client.js';

const USER_STORAGE_KEY = 'bobos.user';

const AuthContext = createContext(null);

function readStoredUser() {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

function readStoredToken() {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch (err) {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(readStoredToken);
  const [user, setUser] = useState(readStoredUser);

  const login = useCallback((nextToken, nextUser) => {
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextUser));
    } catch (err) {
      /* storage can be unavailable in private mode - the session still works */
    }
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(USER_STORAGE_KEY);
    } catch (err) {
      /* ignore */
    }
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ token, user, login, logout, isAuthenticated: Boolean(token) }),
    [token, user, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an <AuthProvider>');
  return context;
}
