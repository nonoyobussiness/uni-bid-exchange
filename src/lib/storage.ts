import { eventBus } from "./events";

const isBrowser = typeof window !== "undefined";

export const storage = {
  get<T>(key: string, fallback: T): T {
    if (!isBrowser) return fallback;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },
  set<T>(key: string, value: T) {
    if (!isBrowser) return;
    localStorage.setItem(key, JSON.stringify(value));
    eventBus.emit();
  },
  remove(key: string) {
    if (!isBrowser) return;
    localStorage.removeItem(key);
    eventBus.emit();
  },
};

export const KEYS = {
  users: "ua_users",
  session: "ua_session",
  auctions: "ua_auctions",
  bids: "ua_bids",
  wallets: "ua_wallets",
  transactions: "ua_transactions",
  reviews: "ua_reviews",
  prefs: "ua_prefs",
  theme: "ua_theme",
  seeded: "ua_seeded_v1",
} as const;

export const uid = () => Math.random().toString(36).slice(2, 11);
