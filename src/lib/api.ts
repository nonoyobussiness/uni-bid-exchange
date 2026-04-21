import type { Auction, Bid, NotificationPrefs, Review, Transaction, User, Wallet } from "./types";

// Centralized JWT storage key (matches requirement)
const TOKEN_KEY = "token";
const UI_PREFS_KEY = "ua_prefs_ui";

type ApiEnvelope<T> =
  | { success: true; data: T; message?: string }
  | { success: false; message?: string; errors?: unknown };

export class ApiError extends Error {
  status: number;
  payload?: unknown;
  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

const apiBaseUrl = () => {
  const raw = import.meta.env.VITE_API_URL as string | undefined;
  if (!raw) return "";
  return raw.replace(/\/+$/, "");
};

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
}

function toMessage(payload: unknown, fallback: string) {
  if (typeof payload === "string" && payload.trim()) return payload;
  if (payload && typeof payload === "object" && "message" in payload) {
    const m = (payload as { message?: unknown }).message;
    if (typeof m === "string" && m.trim()) return m;
  }
  return fallback;
}

async function parseJsonSafely(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const url = `${apiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;

  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const payload = await parseJsonSafely(res);

  if (!res.ok) {
    // Backend often sends JSON { success:false, message }, but may send plain text too.
    if (res.status === 401) {
      clearToken();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("auth:logout"));
      }
    }
    const msg =
      res.status === 413
        ? "Upload too large. Please upload fewer/smaller images and try again."
        : toMessage(payload, `Request failed (${res.status})`);
    throw new ApiError(msg, res.status, payload);
  }

  // If backend uses { success, data }, unwrap automatically.
  if (payload && typeof payload === "object" && "success" in payload) {
    const env = payload as ApiEnvelope<T>;
    if (env.success) return env.data;
    throw new ApiError(toMessage(payload, "Request failed"), res.status, payload);
  }

  return payload as T;
}

// ---------- mapping helpers ----------
const asMs = (d: unknown): number => {
  if (typeof d === "number") return d;
  if (typeof d === "string") {
    const t = Date.parse(d);
    if (!Number.isNaN(t)) return t;
  }
  if (d instanceof Date) return d.getTime();
  return Date.now();
};

// Note: auctions list endpoint does not populate seller details.
// Some seeded auctions may reference missing users; avoid spamming 404s by not enriching here.

function mapAuctionCard(a: any): Auction {
  const sellerId = String(a.sellerId?._id ?? a.sellerId);
  const rawImages = Array.isArray(a.images) ? (a.images as string[]) : [];
  
  const images = rawImages
    .map((src) => {
      if (typeof src === "string") {
        // Keep data URLs and valid HTTP(S) URLs as-is
        if (src.startsWith("data:") || src.startsWith("http://") || src.startsWith("https://")) {
          return src;
        }
        // Only replace mock-cloudinary URLs with a placeholder based on auction ID
        if (src.includes("mock-cloudinary.unibid-exchange.local")) {
          console.log(`[mapAuctionCard] Replacing mock URL for auction ${a._id}`);
          return `https://picsum.photos/seed/${String(a._id ?? a.id)}/800/600`;
        }
      }
      return src;
    })
    .filter((src): src is string => typeof src === "string");

  return {
    id: String(a._id ?? a.id),
    sellerId,
    sellerName: String(a.sellerName ?? a.sellerId?.fullName ?? "Student"),
    sellerTrust: Number(a.sellerTrust ?? a.sellerId?.trustScore ?? 5),
    title: String(a.title ?? ""),
    description: String(a.description ?? ""),
    category: a.category,
    condition: (a.condition ?? "Good") as Auction["condition"], // backend doesn't store condition yet
    images,
    startingPrice: Number(a.startingPrice ?? 0),
    currentBid: Number(a.currentBid ?? 0),
    bidCount: Number(a.bidCount ?? 0),
    endsAt: asMs(a.endsAt),
    createdAt: asMs(a.createdAt),
    status: (a.status === "processing" ? "active" : a.status) as Auction["status"],
    winnerId: a.winnerId ? String(a.winnerId) : undefined,
  };
}

function mapBid(b: any): Bid {
  return {
    id: String(b._id ?? b.id),
    auctionId: String(b.auctionId?._id ?? b.auctionId),
    userId: String(b.userId?._id ?? b.userId),
    userName: String(b.userName ?? b.userId?.fullName ?? "Unknown"),
    amount: Number(b.amount ?? 0),
    createdAt: asMs(b.createdAt),
  };
}

function mapWallet(w: any): Wallet {
  return {
    userId: String(w.userId?._id ?? w.userId),
    balance: Number(w.balance ?? 0),
    held: Number(w.held ?? 0),
    totalDeposited: Number(w.totalDeposited ?? 0),
    totalSpent: Number(w.totalSpent ?? 0),
  };
}

function mapTransaction(t: any): Transaction {
  const rawType = String(t.type ?? "unknown");
  const rawAmount = Number(t.amount ?? 0);
  const signedAmount =
    rawType === "debit" || rawType === "hold" ? -Math.abs(rawAmount) : Math.abs(rawAmount);
  return {
    id: String(t._id ?? t.id),
    userId: String(t.userId?._id ?? t.userId),
    type: rawType as Transaction["type"],
    amount: signedAmount,
    description: String(t.description ?? ""),
    status: String(t.status ?? "completed") as Transaction["status"],
    createdAt: asMs(t.createdAt),
  };
}

// ---------- auth ----------
export async function authMe(): Promise<User> {
  const data = await api<{ user: any }>(`/api/auth/me`);
  const u = data.user;
  return {
    id: String(u.id ?? u._id),
    fullName: u.fullName,
    studentId: u.studentId,
    email: u.email,
    university: u.university,
    trustScore: Number(u.trustScore ?? 5),
    avatarUrl: u.avatarUrl ?? undefined,
    bio: u.bio ?? undefined,
    createdAt: asMs(u.createdAt),
  };
}

export async function login(email: string, password: string): Promise<User> {
  const data = await api<{ token: string; user: any }>(`/api/auth/login`, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setToken(data.token);
  const u = data.user;
  return {
    id: String(u.id ?? u._id),
    fullName: u.fullName,
    studentId: u.studentId,
    email: u.email,
    university: u.university,
    trustScore: Number(u.trustScore ?? 5),
    avatarUrl: u.avatarUrl ?? undefined,
    bio: u.bio ?? undefined,
    createdAt: asMs(u.createdAt),
  };
}

export async function register(input: {
  fullName: string;
  studentId: string;
  email: string;
  password: string;
}): Promise<User> {
  const data = await api<{ token: string; user: any }>(`/api/auth/register`, {
    method: "POST",
    body: JSON.stringify({
      ...input,
      university: "Mahindra University",
    }),
  });
  setToken(data.token);
  const u = data.user;
  return {
    id: String(u.id ?? u._id),
    fullName: u.fullName,
    studentId: u.studentId,
    email: u.email,
    university: u.university,
    trustScore: Number(u.trustScore ?? 5),
    avatarUrl: u.avatarUrl ?? undefined,
    bio: u.bio ?? undefined,
    createdAt: asMs(u.createdAt),
  };
}

export function logout() {
  clearToken();
}

export async function updateProfile(patch: Partial<Pick<User, "fullName" | "bio" | "avatarUrl">>) {
  const data = await api<any>(`/api/users/me`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return data as unknown;
}

export async function changePassword(oldPwd: string, newPwd: string) {
  await api(`/api/users/me/password`, {
    method: "POST",
    body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd }),
  });
}

// ---------- auctions ----------
export type ListAuctionsParams = {
  category?: string;
  q?: string;
  sort?: "endingSoon" | "priceLowToHigh" | "priceHighToLow";
  page?: number;
  limit?: number;
};

export async function listAuctions(params: ListAuctionsParams = {}): Promise<Auction[]> {
  const qs = new URLSearchParams();
  if (params.category) qs.set("category", params.category);
  if (params.q) qs.set("q", params.q);
  if (params.sort) qs.set("sort", params.sort);
  qs.set("page", String(params.page ?? 1));
  qs.set("limit", String(params.limit ?? 100));

  const data = await api<{ items: any[] }>(`/api/auctions?${qs.toString()}`);
  return (data.items ?? []).map(mapAuctionCard);
}

export type AuctionDetail = {
  auction: Auction;
  bids: Bid[];
};

export async function getAuction(id: string): Promise<AuctionDetail> {
  const data = await api<any>(`/api/auctions/${id}`);
  const auction = mapAuctionCard(data);
  const bids = Array.isArray(data.bidHistory) ? data.bidHistory.map(mapBid) : [];
  return { auction, bids };
}

export function minNextBid(a: Auction): number {
  if (a.bidCount === 0) return a.startingPrice;
  return a.currentBid + Math.max(1, Math.round(a.currentBid * 0.05));
}

export async function createAuction(input: {
  title: string;
  description: string;
  category: Auction["category"];
  condition: Auction["condition"];
  images: string[];
  startingPrice: number;
  durationMinutes: number;
}): Promise<Auction> {
  const endsAt = new Date(Date.now() + input.durationMinutes * 60_000).toISOString();
  const images =
    (Array.isArray(input.images) ? input.images : [])
      .map((s) => (typeof s === "string" ? s.trim() : ""))
      .filter(Boolean) ?? [];
  const safeImages =
    images.length > 0 ? images : [`https://picsum.photos/seed/${encodeURIComponent(input.title || "auction")}/800/600`];
  
  console.log(`[createAuction] Sending ${safeImages.length} images:`, 
    safeImages.map((img, i) => `[${i}] ${img.substring(0, 100)}...`));

  const data = await api<any>(`/api/auctions`, {
    method: "POST",
    body: JSON.stringify({
      title: input.title,
      description: input.description,
      category: input.category,
      startingPrice: input.startingPrice,
      endsAt,
      images: safeImages,
    }),
  });
  
  console.log(`[createAuction] Response auction created with ID ${data._id}:`, 
    data.images?.map((img: string, i: number) => `[${i}] ${img.substring(0, 100)}...`));
  
  // Backend doesn't store condition; we keep it client-side only in preview.
  return mapAuctionCard(data);
}

export async function deleteAuction(auctionId: string): Promise<void> {
  await api<void>(`/api/auctions/${auctionId}`, {
    method: "DELETE",
  });
}

export async function cancelAuction(auctionId: string): Promise<Auction> {
  const data = await api<any>(`/api/auctions/${auctionId}/cancel`, {
    method: "POST",
  });
  return mapAuctionCard(data);
}

// ---------- bids ----------
export async function placeBid(auctionId: string, amount: number): Promise<Auction> {
  const data = await api<any>(`/api/bids`, {
    method: "POST",
    body: JSON.stringify({ auctionId, amount }),
  });
  return mapAuctionCard(data);
}

// ---------- wallet ----------
export async function getWallet(): Promise<{ wallet: Wallet; transactions: Transaction[] }> {
  const data = await api<any>(`/api/wallet?limit=100&page=1`);
  return {
    wallet: mapWallet(data.wallet),
    transactions: Array.isArray(data.transactions) ? data.transactions.map(mapTransaction) : [],
  };
}

export async function buyUnicoins(amount: number) {
  const data = await api<any>(`/api/wallet/buy`, {
    method: "POST",
    body: JSON.stringify({ amount }),
  });
  return mapWallet(data);
}

export async function withdrawUnicoins(amount: number) {
  const data = await api<any>(`/api/wallet/withdraw`, {
    method: "POST",
    body: JSON.stringify({ amount }),
  });
  return mapWallet(data);
}

// ---------- profile ----------
export async function getUserProfile(id: string): Promise<{ user: User; listings: Auction[]; reviews: Review[] }> {
  const data = await api<any>(`/api/users/${id}`);
  const u = data.user;
  const user: User = {
    id: String(u.id ?? u._id),
    fullName: u.fullName,
    studentId: u.studentId ?? "",
    email: u.email ?? "",
    university: u.university,
    trustScore: Number(u.trustScore ?? 5),
    avatarUrl: u.avatarUrl ?? undefined,
    bio: u.bio ?? undefined,
    createdAt: asMs(u.createdAt),
  };
  return {
    user,
    listings: Array.isArray(data.listings) ? data.listings.map(mapAuctionCard) : [],
    reviews: Array.isArray(data.reviews)
      ? data.reviews.map((r: any) => ({
          id: String(r._id ?? r.id),
          sellerId: String(r.sellerId?._id ?? r.sellerId ?? id),
          reviewerName: String(r.reviewerId?.fullName ?? "Anonymous"),
          rating: Number(r.rating ?? 0),
          text: String(r.text ?? ""),
          createdAt: asMs(r.createdAt),
        }))
      : [],
  };
}

export async function getMyListings(): Promise<Auction[]> {
  const data = await api<any>(`/api/users/me/listings`);
  return Array.isArray(data) ? data.map(mapAuctionCard) : [];
}

export async function getMyBids(): Promise<any> {
  return api<any>(`/api/users/me/bids`);
}

// ---------- notification prefs (settings) ----------
const DEFAULT_PREFS: NotificationPrefs = {
  outbid: true,
  endingSoon: true,
  won: true,
  newBidOnMine: true,
  marketing: false,
  showProfile: true,
  showBidHistory: true,
};

function loadUiPrefs(userId: string): Partial<NotificationPrefs> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(`${UI_PREFS_KEY}:${userId}`);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<NotificationPrefs>;
  } catch {
    return {};
  }
}

function saveUiPrefs(userId: string, prefs: Partial<NotificationPrefs>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${UI_PREFS_KEY}:${userId}`, JSON.stringify(prefs));
}

export async function getPrefs(userId: string): Promise<NotificationPrefs> {
  const ui = loadUiPrefs(userId);
  const data = await api<any>(`/api/users/me/prefs`);
  const mapped: Partial<NotificationPrefs> = {
    outbid: !!data.outbidAlerts,
    endingSoon: !!data.auctionReminders,
    marketing: !!data.marketingEmails,
    // backend doesn't have separate "won" and "newBidOnMine"; map from bidUpdates as best-effort
    won: !!data.bidUpdates,
    newBidOnMine: !!data.bidUpdates,
  };
  return { ...DEFAULT_PREFS, ...mapped, ...ui };
}

export async function setPrefs(userId: string, prefs: NotificationPrefs) {
  // Persist what backend supports
  await api(`/api/users/me/prefs`, {
    method: "PATCH",
    body: JSON.stringify({
      outbidAlerts: prefs.outbid,
      auctionReminders: prefs.endingSoon,
      bidUpdates: prefs.won || prefs.newBidOnMine,
      marketingEmails: prefs.marketing,
      emailNotifications: true,
    }),
  });
  // UI-only switches (backend doesn't have fields)
  saveUiPrefs(userId, {
    showProfile: prefs.showProfile,
    showBidHistory: prefs.showBidHistory,
  });
}
