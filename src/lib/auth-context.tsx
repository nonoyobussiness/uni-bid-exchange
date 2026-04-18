import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { getCurrentUser, getSession, initMockBackend, login as apiLogin, logout as apiLogout, register as apiRegister } from "./api";
import type { User } from "./types";
import { eventBus } from "./events";

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
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

  const refresh = useCallback(() => {
    setUser(getCurrentUser());
  }, []);

  useEffect(() => {
    initMockBackend();
    refresh();
    const unsub = eventBus.subscribe(refresh);
    return () => {
      unsub();
    };
  }, [refresh]);

  const value: AuthContextValue = {
    user,
    isAuthenticated: !!getSession(),
    login: async (email, password) => {
      await apiLogin(email, password);
      refresh();
    },
    register: async (input) => {
      await apiRegister(input);
      refresh();
    },
    logout: () => {
      apiLogout();
      refresh();
    },
    refresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
