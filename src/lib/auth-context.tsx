import { createContext, useContext, useEffect, useMemo, useState, useCallback, type ReactNode } from "react";
import { ApiError, authMe, getToken, login as apiLogin, logout as apiLogout, register as apiRegister } from "./api";
import type { User } from "./types";
import { reconnectSocketWithToken } from "./socket";

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    fullName: string;
    studentId: string;
    email: string;
    password: string;
  }) => Promise<void>;
  logout: () => void;
  refresh: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refresh = useCallback(() => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    authMe()
      .then((me) => setUser(me))
      .catch((e: unknown) => {
        const err = e as ApiError;
        // Token expired/invalid -> api() already cleared token + emitted auth:logout
        if (err && typeof err === "object" && "status" in err && (err as any).status === 401) {
          setUser(null);
          return;
        }
        // Any other failure keeps user logged out but doesn't hard-crash the app shell
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
    const onLogout = () => {
      setUser(null);
      setLoading(false);
    };
    window.addEventListener("auth:logout", onLogout);
    return () => {
      window.removeEventListener("auth:logout", onLogout);
    };
  }, [refresh]);

  const isAuthenticated = useMemo(() => !!getToken() && !!user, [user]);

  const value: AuthContextValue = useMemo(
    () => ({
      user,
      isAuthenticated,
      loading,
      login: async (email, password) => {
        const me = await apiLogin(email, password);
        reconnectSocketWithToken(getToken());
        setUser(me);
      },
      register: async (input) => {
        const me = await apiRegister(input);
        reconnectSocketWithToken(getToken());
        setUser(me);
      },
      logout: () => {
        apiLogout();
        reconnectSocketWithToken(null);
        setUser(null);
      },
      refresh,
    }),
    [user, isAuthenticated, loading, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
