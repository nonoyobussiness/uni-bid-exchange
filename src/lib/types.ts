export type Category = "Electronics" | "Books" | "Apparel" | "Dorm" | "Tickets" | "Other";
export type Condition = "New" | "Like-new" | "Good" | "Fair";
export type AuctionStatus = "active" | "sold" | "expired";

export interface User {
  id: string;
  fullName: string;
  studentId: string;
  email: string;
  bio?: string;
  avatarUrl?: string;
  university: string;
  trustScore: number;
  createdAt: number;
}

export interface Bid {
  id: string;
  auctionId: string;
  userId: string;
  userName: string;
  amount: number;
  createdAt: number;
}

export interface Auction {
  id: string;
  sellerId: string;
  sellerName: string;
  sellerTrust: number;
  title: string;
  description: string;
  category: Category;
  condition: Condition;
  images: string[];
  startingPrice: number;
  currentBid: number;
  bidCount: number;
  endsAt: number;
  createdAt: number;
  status: AuctionStatus;
  winnerId?: string;
}

export type TxType =
  | "purchase"
  | "withdrawal"
  | "bid_hold"
  | "bid_release"
  | "sale_credit"
  | "purchase_debit";

export interface Transaction {
  id: string;
  userId: string;
  type: TxType;
  amount: number; // positive = credit, negative = debit
  description: string;
  status: "completed" | "pending" | "failed";
  createdAt: number;
}

export interface Wallet {
  userId: string;
  balance: number; // spendable
  held: number; // in active bids
  totalDeposited: number;
  totalSpent: number;
}

export interface Review {
  id: string;
  sellerId: string;
  reviewerName: string;
  rating: number;
  text: string;
  createdAt: number;
}

export interface NotificationPrefs {
  outbid: boolean;
  endingSoon: boolean;
  won: boolean;
  newBidOnMine: boolean;
  marketing: boolean;
  showProfile: boolean;
  showBidHistory: boolean;
}
