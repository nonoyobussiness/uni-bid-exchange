import type { Auction, Bid, Category, Condition, Review, User, Wallet } from "./types";
import { KEYS, storage, uid } from "./storage";

const IMG = (seed: string, w = 800, h = 600) =>
  `https://picsum.photos/seed/${seed}/${w}/${h}`;

const SELLERS = [
  { id: "u_demo_alex", name: "Alex Reddy", trust: 4.8 },
  { id: "u_demo_priya", name: "Priya Sharma", trust: 4.9 },
  { id: "u_demo_kiran", name: "Kiran Patel", trust: 4.6 },
  { id: "u_demo_meera", name: "Meera Nair", trust: 4.7 },
  { id: "u_demo_arjun", name: "Arjun Singh", trust: 4.5 },
];

interface SeedItem {
  title: string;
  description: string;
  category: Category;
  condition: Condition;
  startingPrice: number;
  currentBid: number;
  bidCount: number;
  endsInMin: number;
  imgs: string[];
  status?: "active" | "sold" | "expired";
}

const ITEMS: SeedItem[] = [
  {
    title: "MacBook Air M2 — barely used",
    description:
      "Bought 6 months ago for coursework. 256GB SSD, 8GB RAM, midnight. Comes with original box, charger, and a clear hardshell case. No scratches, battery cycles under 80.",
    category: "Electronics",
    condition: "Like-new",
    startingPrice: 1200,
    currentBid: 1850,
    bidCount: 14,
    endsInMin: 42,
    imgs: [IMG("macbook1"), IMG("macbook2"), IMG("macbook3")],
  },
  {
    title: "Sony WH-1000XM4 Headphones",
    description: "Industry-leading noise cancellation. Original case + cable included.",
    category: "Electronics",
    condition: "Good",
    startingPrice: 250,
    currentBid: 380,
    bidCount: 9,
    endsInMin: 120,
    imgs: [IMG("sony1"), IMG("sony2")],
  },
  {
    title: "Calculus Early Transcendentals — Stewart 9e",
    description: "Used for MA1110. Highlights in chapters 1-4, otherwise pristine.",
    category: "Books",
    condition: "Good",
    startingPrice: 30,
    currentBid: 55,
    bidCount: 6,
    endsInMin: 8,
    imgs: [IMG("book1")],
  },
  {
    title: "Mini Fridge — perfect for dorm",
    description: "1.7 cu ft, single door, energy efficient. Cleaned and sanitized.",
    category: "Dorm",
    condition: "Good",
    startingPrice: 80,
    currentBid: 145,
    bidCount: 11,
    endsInMin: 360,
    imgs: [IMG("fridge1"), IMG("fridge2")],
  },
  {
    title: "Nike Air Force 1 — Size 9 US",
    description: "Worn maybe 5 times. Still has the box. Triple white.",
    category: "Apparel",
    condition: "Like-new",
    startingPrice: 60,
    currentBid: 95,
    bidCount: 7,
    endsInMin: 240,
    imgs: [IMG("shoes1"), IMG("shoes2")],
  },
  {
    title: "Coldplay Concert Ticket — Hyderabad",
    description: "Pit B section. Verified ticket, transferable.",
    category: "Tickets",
    condition: "New",
    startingPrice: 200,
    currentBid: 480,
    bidCount: 23,
    endsInMin: 18,
    imgs: [IMG("concert1")],
  },
  {
    title: "iPad Pro 11\" 2022 + Apple Pencil",
    description: "M2 chip, 128GB Wi-Fi. Always in case. Pencil included.",
    category: "Electronics",
    condition: "Like-new",
    startingPrice: 700,
    currentBid: 950,
    bidCount: 12,
    endsInMin: 90,
    imgs: [IMG("ipad1"), IMG("ipad2")],
  },
  {
    title: "Royal Enfield Helmet — XL",
    description: "ISI certified, full face. Used for one semester.",
    category: "Other",
    condition: "Good",
    startingPrice: 40,
    currentBid: 70,
    bidCount: 4,
    endsInMin: 720,
    imgs: [IMG("helmet1")],
  },
  {
    title: "Study Desk Lamp — Philips LED",
    description: "Adjustable brightness, USB charging port at base.",
    category: "Dorm",
    condition: "Like-new",
    startingPrice: 15,
    currentBid: 28,
    bidCount: 3,
    endsInMin: 60,
    imgs: [IMG("lamp1")],
  },
  {
    title: "Wireless Mechanical Keyboard",
    description: "Keychron K2, brown switches, RGB. Mac and Windows compatible.",
    category: "Electronics",
    condition: "Good",
    startingPrice: 50,
    currentBid: 85,
    bidCount: 8,
    endsInMin: 30,
    imgs: [IMG("kb1"), IMG("kb2")],
  },
  {
    title: "Intro to Algorithms — CLRS 4th edition",
    description: "The bible. Hardcover, no markings.",
    category: "Books",
    condition: "New",
    startingPrice: 60,
    currentBid: 110,
    bidCount: 9,
    endsInMin: 1440,
    imgs: [IMG("clrs1")],
  },
  {
    title: "Bean Bag Chair — XXL",
    description: "Faux leather, refilled last month. Great for gaming nights.",
    category: "Dorm",
    condition: "Good",
    startingPrice: 35,
    currentBid: 60,
    bidCount: 5,
    endsInMin: 480,
    imgs: [IMG("bean1")],
  },
  {
    title: "GoPro HERO 11 Black",
    description: "Shoots 5.3K. Includes 64GB card and chest mount.",
    category: "Electronics",
    condition: "Like-new",
    startingPrice: 300,
    currentBid: 425,
    bidCount: 10,
    endsInMin: 75,
    imgs: [IMG("gopro1"), IMG("gopro2")],
  },
  {
    title: "Vintage Levi's Denim Jacket",
    description: "Size M, oversized fit. Authentic 90s.",
    category: "Apparel",
    condition: "Good",
    startingPrice: 25,
    currentBid: 48,
    bidCount: 6,
    endsInMin: 200,
    imgs: [IMG("denim1")],
  },
  {
    title: "Football Match Pass — Hyderabad FC",
    description: "Season pass remainder, 8 home games left.",
    category: "Tickets",
    condition: "New",
    startingPrice: 80,
    currentBid: 140,
    bidCount: 4,
    endsInMin: 12,
    imgs: [IMG("hfc1")],
  },
  {
    title: "Logitech MX Master 3 Mouse",
    description: "Best productivity mouse. Charges via USB-C.",
    category: "Electronics",
    condition: "Like-new",
    startingPrice: 50,
    currentBid: 78,
    bidCount: 7,
    endsInMin: 25,
    imgs: [IMG("mouse1")],
  },
  {
    title: "Engineering Drawing Kit",
    description: "Compass, set squares, scale ruler — full kit.",
    category: "Other",
    condition: "Good",
    startingPrice: 8,
    currentBid: 14,
    bidCount: 2,
    endsInMin: 600,
    imgs: [IMG("drawing1")],
  },
  {
    title: "Yoga Mat + Block Set",
    description: "6mm thick, anti-slip. Used twice — gym membership won.",
    category: "Other",
    condition: "Like-new",
    startingPrice: 12,
    currentBid: 22,
    bidCount: 3,
    endsInMin: 180,
    imgs: [IMG("yoga1")],
  },
  {
    title: "Rubik's Speed Cube — GAN 11 M Pro",
    description: "Pre-tensioned. Includes lube and stand.",
    category: "Other",
    condition: "Like-new",
    startingPrice: 20,
    currentBid: 38,
    bidCount: 5,
    endsInMin: 95,
    imgs: [IMG("cube1")],
  },
  {
    title: "Casio FX-991ES Plus Calculator",
    description: "Programmable scientific calc. Required for ECE coursework.",
    category: "Electronics",
    condition: "Good",
    startingPrice: 15,
    currentBid: 26,
    bidCount: 4,
    endsInMin: 50,
    imgs: [IMG("calc1")],
  },
  {
    title: "Acer Nitro 5 Gaming Laptop — SOLD",
    description: "GTX 1650, i5-11th gen.",
    category: "Electronics",
    condition: "Good",
    startingPrice: 600,
    currentBid: 920,
    bidCount: 18,
    endsInMin: -120,
    imgs: [IMG("nitro1")],
    status: "sold",
  },
  {
    title: "Microwave Oven — Samsung 20L",
    description: "Compact, perfect for hostel kitchen.",
    category: "Dorm",
    condition: "Good",
    startingPrice: 70,
    currentBid: 110,
    bidCount: 6,
    endsInMin: -60,
    imgs: [IMG("micro1")],
    status: "sold",
  },
];

export function maybeSeed() {
  if (storage.get(KEYS.seeded, false)) return;
  const now = Date.now();

  const auctions: Auction[] = ITEMS.map((it, i) => {
    const seller = SELLERS[i % SELLERS.length];
    return {
      id: `a_seed_${i}`,
      sellerId: seller.id,
      sellerName: seller.name,
      sellerTrust: seller.trust,
      title: it.title,
      description: it.description,
      category: it.category,
      condition: it.condition,
      images: it.imgs,
      startingPrice: it.startingPrice,
      currentBid: it.currentBid,
      bidCount: it.bidCount,
      endsAt: now + it.endsInMin * 60_000,
      createdAt: now - 1000 * 60 * 60 * 24 * 2,
      status: it.status ?? "active",
      winnerId: it.status === "sold" ? "u_demo_alex" : undefined,
    };
  });

  // Generate a few past bids per active auction
  const bids: Bid[] = [];
  auctions.forEach((a) => {
    let amount = a.startingPrice;
    const steps = Math.max(1, a.bidCount);
    const inc = Math.max(1, Math.round((a.currentBid - a.startingPrice) / steps));
    for (let i = 0; i < Math.min(steps, 6); i++) {
      amount += inc;
      const seller = SELLERS[(i + 1) % SELLERS.length];
      bids.push({
        id: uid(),
        auctionId: a.id,
        userId: seller.id,
        userName: seller.name,
        amount: Math.min(amount, a.currentBid),
        createdAt: now - (6 - i) * 60_000,
      });
    }
  });

  // Demo seller users (so profile lookups don't break)
  const users: User[] = SELLERS.map((s) => ({
    id: s.id,
    fullName: s.name,
    studentId: s.id.slice(-7),
    email: `${s.id.slice(-7)}@mahindrauniversity.edu.in`,
    university: "Mahindra University",
    trustScore: s.trust,
    createdAt: now - 1000 * 60 * 60 * 24 * 90,
  }));

  // Demo wallets for sellers
  const wallets: Record<string, Wallet> = {};
  users.forEach((u) => {
    wallets[u.id] = {
      userId: u.id,
      balance: 500,
      held: 0,
      totalDeposited: 1000,
      totalSpent: 500,
    };
  });

  const reviews: Review[] = SELLERS.flatMap((s, i) => [
    {
      id: uid(),
      sellerId: s.id,
      reviewerName: "Rohan M.",
      rating: 5,
      text: "Smooth handover, item was exactly as described.",
      createdAt: now - 1000 * 60 * 60 * 24 * (i + 2),
    },
    {
      id: uid(),
      sellerId: s.id,
      reviewerName: "Sneha K.",
      rating: 4,
      text: "Good seller, slight delay but all good.",
      createdAt: now - 1000 * 60 * 60 * 24 * (i + 8),
    },
  ]);

  storage.set(KEYS.auctions, auctions);
  storage.set(KEYS.bids, bids);
  storage.set(KEYS.users, users);
  storage.set(KEYS.wallets, wallets);
  storage.set(KEYS.transactions, []);
  storage.set(KEYS.reviews, reviews);
  storage.set(KEYS.seeded, true);
}
