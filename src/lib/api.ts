import type {
  Auction,
  Bid,
  NotificationPrefs,
  Review,
  Transaction,
  User,
  Wallet,
} from "./types";
import { KEYS, storage, uid } from "./storage";
import { eventBus } from "./events";
import { maybeSeed } from "./seed";

// ---------- helpers ----------
const now = () => Date.now();

interface StoredUser extends User {
  passwordHash: string; // mock hash
}

const mockHash = (pwd: string) => `mock_${btoa(pwd)}`;
const verifyHash = (pwd: string, hash: string) => mockHash(pwd) === hash;

function getUsers(): StoredUser[] {
  return storage.get<StoredUser[]>(KEYS.users, []);
}
function setUsers(u: StoredUser[]) {
  storage.set(KEYS.users, u);
}

export function getAuctions(): Auction[] {
  return storage.get<Auction[]>(KEYS.auctions, []);
}
function setAuctions(a: Auction[]) {
  storage.set(KEYS.auctions, a);
}

export function getBids(): Bid[] {
  return storage.get<Bid[]>(KEYS.bids, []);
}
function setBids(b: Bid[]) {
  storage.set(KEYS.bids, b);
}

function getWallets(): Record<string, Wallet> {
  return storage.get<Record<string, Wallet>>(KEYS.wallets, {});
}
function setWallets(w: Record<string, Wallet>) {
  storage.set(KEYS.wallets, w);
}

function getTransactions(): Transaction[] {
  return storage.get<Transaction[]>(KEYS.transactions, []);
}
function setTransactions(t: Transaction[]) {
  storage.set(KEYS.transactions, t);
}

function getReviews(): Review[] {
  return storage.get<Review[]>(KEYS.reviews, []);
}

// ---------- init ----------
export function initMockBackend() {
  maybeSeed();
}

// ---------- auth ----------
const EMAIL_RE = /^([a-zA-Z0-9]+)@mahindrauniversity\.edu\.in$/;

export interface Session {
  token: string;
  userId: string;
}

export function getSession(): Session | null {
  return storage.get<Session | null>(KEYS.session, null);
}

export function getCurrentUser(): User | null {
  const s = getSession();
  if (!s) return null;
  const u = getUsers().find((x) => x.id === s.userId);
  if (!u) return null;
  const { passwordHash: _ph, ...pub } = u;
  void _ph;
  return pub;
}

export async function register(input: {
  fullName: string;
  studentId: string;
  email: string;
  password: string;
}): Promise<User> {
  const m = input.email.match(EMAIL_RE);
  if (!m) throw new Error("Email must be a valid Mahindra University address.");

  const users = getUsers();
  if (users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) {
    throw new Error("An account with this email already exists.");
  }

  const id = `u_${uid()}`;
  const newUser: StoredUser = {
    id,
    fullName: input.fullName,
    studentId: input.studentId,
    email: input.email.toLowerCase(),
    university: "Mahindra University",
    trustScore: 5,
    createdAt: now(),
    passwordHash: mockHash(input.password),
  };
  setUsers([...users, newUser]);

  // Starter wallet with 500 unicoins so user can try bidding
  const wallets = getWallets();
  wallets[id] = {
    userId: id,
    balance: 500,
    held: 0,
    totalDeposited: 500,
    totalSpent: 0,
  };
  setWallets(wallets);

  setTransactions([
    ...getTransactions(),
    {
      id: uid(),
      userId: id,
      type: "purchase",
      amount: 500,
      description: "Welcome bonus — 500 Unicoins",
      status: "completed",
      createdAt: now(),
    },
  ]);

  // Auto-login
  storage.set(KEYS.session, { token: `mock_jwt_${id}`, userId: id });
  const { passwordHash: _ph2, ...pub } = newUser;
  void _ph2;
  return pub;
}

export async function login(email: string, password: string): Promise<User> {
  const u = getUsers().find((x) => x.email.toLowerCase() === email.toLowerCase());
  if (!u || !verifyHash(password, u.passwordHash)) {
    throw new Error("Invalid email or password.");
  }
  storage.set(KEYS.session, { token: `mock_jwt_${u.id}`, userId: u.id });
  const { passwordHash: _ph, ...pub } = u;
  void _ph;
  return pub;
}

export function logout() {
  storage.remove(KEYS.session);
}

export async function updateProfile(patch: Partial<Pick<User, "fullName" | "bio" | "avatarUrl">>) {
  const s = getSession();
  if (!s) throw new Error("Not authenticated");
  const users = getUsers();
  const idx = users.findIndex((u) => u.id === s.userId);
  if (idx < 0) throw new Error("User not found");
  users[idx] = { ...users[idx], ...patch };
  setUsers(users);
}

export async function changePassword(oldPwd: string, newPwd: string) {
  const s = getSession();
  if (!s) throw new Error("Not authenticated");
  const users = getUsers();
  const idx = users.findIndex((u) => u.id === s.userId);
  if (idx < 0) throw new Error("User not found");
  if (!verifyHash(oldPwd, users[idx].passwordHash))
    throw new Error("Current password is incorrect.");
  users[idx] = { ...users[idx], passwordHash: mockHash(newPwd) };
  setUsers(users);
}

// ---------- wallet ----------
export function getWallet(userId: string): Wallet {
  const wallets = getWallets();
  if (!wallets[userId]) {
    wallets[userId] = {
      userId,
      balance: 0,
      held: 0,
      totalDeposited: 0,
      totalSpent: 0,
    };
    setWallets(wallets);
  }
  return wallets[userId];
}

export function listTransactions(userId: string): Transaction[] {
  return getTransactions()
    .filter((t) => t.userId === userId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function buyUnicoins(userId: string, amount: number) {
  const wallets = getWallets();
  const w = getWallet(userId);
  wallets[userId] = {
    ...w,
    balance: w.balance + amount,
    totalDeposited: w.totalDeposited + amount,
  };
  setWallets(wallets);
  setTransactions([
    ...getTransactions(),
    {
      id: uid(),
      userId,
      type: "purchase",
      amount,
      description: `Purchased ${amount} Unicoins (Test mode)`,
      status: "completed",
      createdAt: now(),
    },
  ]);
}

export async function withdrawUnicoins(userId: string, amount: number) {
  const wallets = getWallets();
  const w = getWallet(userId);
  if (w.balance < amount) throw new Error("Insufficient balance.");
  wallets[userId] = { ...w, balance: w.balance - amount };
  setWallets(wallets);
  setTransactions([
    ...getTransactions(),
    {
      id: uid(),
      userId,
      type: "withdrawal",
      amount: -amount,
      description: `Withdrew ${amount} Unicoins to bank (Test mode)`,
      status: "completed",
      createdAt: now(),
    },
  ]);
}

// ---------- auctions / bids ----------
export function listAuctions(): Auction[] {
  // Settle expired ones lazily
  settleExpired();
  return getAuctions();
}

export function getAuction(id: string): Auction | undefined {
  settleExpired();
  return getAuctions().find((a) => a.id === id);
}

export function listBidsFor(auctionId: string): Bid[] {
  return getBids()
    .filter((b) => b.auctionId === auctionId)
    .sort((a, b) => b.amount - a.amount);
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
  const me = getCurrentUser();
  if (!me) throw new Error("Not authenticated");
  const a: Auction = {
    id: `a_${uid()}`,
    sellerId: me.id,
    sellerName: me.fullName,
    sellerTrust: me.trustScore,
    title: input.title,
    description: input.description,
    category: input.category,
    condition: input.condition,
    images: input.images.length ? input.images : [`https://picsum.photos/seed/${uid()}/800/600`],
    startingPrice: input.startingPrice,
    currentBid: input.startingPrice,
    bidCount: 0,
    endsAt: now() + input.durationMinutes * 60_000,
    createdAt: now(),
    status: "active",
  };
  setAuctions([a, ...getAuctions()]);
  return a;
}

export async function placeBid(auctionId: string, amount: number) {
  const me = getCurrentUser();
  if (!me) throw new Error("Not authenticated");

  const auctions = getAuctions();
  const idx = auctions.findIndex((a) => a.id === auctionId);
  if (idx < 0) throw new Error("Auction not found");
  const a = auctions[idx];
  if (a.status !== "active" || a.endsAt <= now()) throw new Error("Auction has ended.");
  if (a.sellerId === me.id) throw new Error("You can't bid on your own auction.");

  const min = minNextBid(a);
  if (amount < min) throw new Error(`Minimum bid is ${min} Unicoins.`);

  const wallets = getWallets();
  const w = getWallet(me.id);
  if (w.balance < amount) throw new Error("Not enough Unicoins. Top up your wallet.");

  // Refund previous highest bidder if it's not the same user
  const prevBids = getBids().filter((b) => b.auctionId === auctionId);
  const prevHigh = prevBids.sort((x, y) => y.amount - x.amount)[0];
  if (prevHigh && prevHigh.userId !== me.id) {
    const pw = getWallet(prevHigh.userId);
    wallets[prevHigh.userId] = {
      ...pw,
      balance: pw.balance + prevHigh.amount,
      held: Math.max(0, pw.held - prevHigh.amount),
    };
    setTransactions([
      ...getTransactions(),
      {
        id: uid(),
        userId: prevHigh.userId,
        type: "bid_release",
        amount: prevHigh.amount,
        description: `Outbid on "${a.title}" — refund`,
        status: "completed",
        createdAt: now(),
      },
    ]);
  } else if (prevHigh && prevHigh.userId === me.id) {
    // increasing own bid: release the prior hold
    wallets[me.id] = {
      ...w,
      balance: w.balance + prevHigh.amount,
      held: Math.max(0, w.held - prevHigh.amount),
    };
  }

  // Hold new bid amount
  const w2 = wallets[me.id] ?? w;
  if (w2.balance < amount) throw new Error("Not enough Unicoins.");
  wallets[me.id] = {
    ...w2,
    balance: w2.balance - amount,
    held: w2.held + amount,
  };
  setWallets(wallets);

  setTransactions([
    ...getTransactions(),
    {
      id: uid(),
      userId: me.id,
      type: "bid_hold",
      amount: -amount,
      description: `Bid placed on "${a.title}"`,
      status: "completed",
      createdAt: now(),
    },
  ]);

  const newBid: Bid = {
    id: uid(),
    auctionId,
    userId: me.id,
    userName: me.fullName,
    amount,
    createdAt: now(),
  };
  setBids([newBid, ...getBids()]);

  auctions[idx] = {
    ...a,
    currentBid: amount,
    bidCount: a.bidCount + 1,
  };
  setAuctions(auctions);
}

function settleExpired() {
  const auctions = getAuctions();
  const wallets = getWallets();
  let walletsChanged = false;
  let auctionsChanged = false;
  const txAdds: Transaction[] = [];
  const t = now();

  auctions.forEach((a, i) => {
    if (a.status === "active" && a.endsAt <= t) {
      auctionsChanged = true;
      const top = getBids()
        .filter((b) => b.auctionId === a.id)
        .sort((x, y) => y.amount - x.amount)[0];

      if (top) {
        // Transfer held coins from winner to seller
        const wWinner = wallets[top.userId] ?? {
          userId: top.userId,
          balance: 0,
          held: 0,
          totalDeposited: 0,
          totalSpent: 0,
        };
        wallets[top.userId] = {
          ...wWinner,
          held: Math.max(0, wWinner.held - top.amount),
          totalSpent: wWinner.totalSpent + top.amount,
        };
        const wSeller = wallets[a.sellerId] ?? {
          userId: a.sellerId,
          balance: 0,
          held: 0,
          totalDeposited: 0,
          totalSpent: 0,
        };
        wallets[a.sellerId] = {
          ...wSeller,
          balance: wSeller.balance + top.amount,
        };
        walletsChanged = true;

        txAdds.push(
          {
            id: uid(),
            userId: top.userId,
            type: "purchase_debit",
            amount: -top.amount,
            description: `Won "${a.title}" — final purchase`,
            status: "completed",
            createdAt: t,
          },
          {
            id: uid(),
            userId: a.sellerId,
            type: "sale_credit",
            amount: top.amount,
            description: `Sold "${a.title}"`,
            status: "completed",
            createdAt: t,
          },
        );
        auctions[i] = { ...a, status: "sold", winnerId: top.userId };
      } else {
        auctions[i] = { ...a, status: "expired" };
      }
    }
  });

  if (auctionsChanged) setAuctions(auctions);
  if (walletsChanged) setWallets(wallets);
  if (txAdds.length) setTransactions([...getTransactions(), ...txAdds]);
  if (auctionsChanged) eventBus.emit();
}

// ---------- profile / reviews ----------
export function listReviewsFor(sellerId: string): Review[] {
  return getReviews()
    .filter((r) => r.sellerId === sellerId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function listMyListings(userId: string): Auction[] {
  return getAuctions()
    .filter((a) => a.sellerId === userId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function listMyBids(userId: string): { auction: Auction; topBid: Bid; myTop: Bid }[] {
  const myBids = getBids().filter((b) => b.userId === userId);
  const auctionIds = Array.from(new Set(myBids.map((b) => b.auctionId)));
  const all = getAuctions();
  const out: { auction: Auction; topBid: Bid; myTop: Bid }[] = [];
  auctionIds.forEach((aid) => {
    const a = all.find((x) => x.id === aid);
    if (!a) return;
    const bidsFor = getBids().filter((b) => b.auctionId === aid);
    const topBid = [...bidsFor].sort((x, y) => y.amount - x.amount)[0];
    const myTop = [...bidsFor]
      .filter((b) => b.userId === userId)
      .sort((x, y) => y.amount - x.amount)[0];
    if (topBid && myTop) out.push({ auction: a, topBid, myTop });
  });
  return out;
}

// ---------- prefs ----------
const DEFAULT_PREFS: NotificationPrefs = {
  outbid: true,
  endingSoon: true,
  won: true,
  newBidOnMine: true,
  marketing: false,
  showProfile: true,
  showBidHistory: true,
};

export function getPrefs(userId: string): NotificationPrefs {
  return storage.get<NotificationPrefs>(`${KEYS.prefs}_${userId}`, DEFAULT_PREFS);
}
export function setPrefs(userId: string, prefs: NotificationPrefs) {
  storage.set(`${KEYS.prefs}_${userId}`, prefs);
}

// Periodic settlement so the UI reflects ended auctions even without user actions
if (typeof window !== "undefined") {
  setInterval(() => settleExpired(), 5000);
}
