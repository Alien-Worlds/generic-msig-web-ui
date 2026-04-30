import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import type { Session } from '@wharfkit/session';
import { sessionKit } from '../wharf/sessionKit';

interface SessionContextValue {
  session: Session | undefined;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sessionKit
      .restore()
      .then((restored) => {
        setSession(restored ?? undefined);
      })
      .catch(() => {
        setSession(undefined);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const login = useCallback(async () => {
    const result = await sessionKit.login();
    if (result?.session) {
      setSession(result.session);
    }
  }, []);

  const logout = useCallback(async () => {
    if (session) {
      await sessionKit.logout(session);
      setSession(undefined);
    }
  }, [session]);

  const value: SessionContextValue = {
    session,
    loading,
    login,
    logout,
  };

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (ctx == null) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return ctx;
}
