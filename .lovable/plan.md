
# Student Auction System — Frontend (Mock Data)

A polished React + TypeScript + Tailwind frontend for a university online auction with Unicoin currency. All data is mocked in-memory (with localStorage persistence) so you can wire up your own Express + MongoDB backend later. Designed around primary `#247B7B` with full light/dark themes.

## Stack note
Lovable runs on TanStack Start (React + TS + Vite + Tailwind). Express/Mongo aren't supported in this environment — you'll get a clean frontend with a typed mock API layer (`src/lib/api/*.ts`) that mirrors realistic REST endpoints, so swapping to your own backend later is a one-file change per resource.

## Design system
- Primary `#247B7B` (teal). Accent gradient teal → deep navy for hero.
- Light theme: warm off-white surfaces, dark text. Dark theme: near-black surfaces, teal glow accents.
- Modern cards with soft shadows, rounded-2xl, subtle borders, smooth hover lifts.
- Typography: Inter for body, tight tracking for headings.
- Theme toggle persisted to localStorage; respects system preference on first load.

## Pages

**Auth**
- `/register` — full name, student ID, university email (validated as `studentid@mahindrauniversity.edu.in`), password, confirm password. Zod validation, strength meter.
- `/login` — university email + password. Mock auth stores a fake JWT in localStorage; protected routes redirect here.
- Bcrypt + JWT noted as backend-side concerns; mock layer simulates the contract so backend swap is trivial.

**Home `/`**
- Hero: bold gradient banner, tagline, CTAs (Browse auctions / Sell an item), live stats (active auctions, bids today), Unicoin balance chip in top nav.
- Search bar with category filter chips (Electronics, Books, Apparel, Dorm, Tickets, Other).
- Sections: **Live Bids** (ending soonest), **Trending**, **New Listings**, **Recently Sold**.
- Auction card: image, title, category, countdown timer (live ticking), current bid in Unicoins, bid count, "Place Bid" button.
- **Bid modal**: blurred backdrop, larger images carousel, full description, seller info + trust score, bid history table, two bid options — "increment to next minimum" or "custom amount". Validates against Unicoin balance.

**Sell `/sell`**
- Multi-step form: photos (drag/drop, up to 6), title, description, category, condition (New / Like-new / Good / Fair), starting price (Unicoins), auction duration (1h / 6h / 24h / 3d / 7d).
- Live preview of the auction card on the right side, updates as you type.

**History `/history`**
- Tabs: **My Bids** (sub-tabs: Winning, Won, Outbid, Lost) and **My Sales** (sub-tabs: Active, Sold, Expired).
- Tables with item thumb, title, your bid / final price, status badge, timestamp.

**Wallet `/wallet`**
- Top stat cards: Unicoin balance, total deposited, total spent, active bid holds.
- Buy Unicoins panel: pick a pack (100 / 500 / 1000 / 2500), pay via mocked Stripe checkout (UI only — credits balance instantly with a "Test mode" badge). Easy to switch to real Stripe later.
- Withdraw panel: convert Unicoins back to currency, mocked payout.
- Transaction history table: type (purchase / withdrawal / bid hold / bid release / sale credit), amount, date, status.

**Profile `/profile`**
- Header card: avatar, name, university, trust score, Unicoin balance.
- Stats row: total bids, auctions won, items sold.
- Edit profile inline (name, avatar, bio).
- Reviews tab (received as seller) and My Listings tab.
- Change password, logout.

**Settings `/settings`**
- Theme: Light / Dark / System.
- Notifications: toggles for outbid alerts, auction ending soon, won auction, new bid on my listing, marketing emails.
- Privacy: show profile to others, show bid history publicly.
- Language (UI only, English default), currency display preference.

## Behavior to mock
- **Realtime feel**: countdown timers tick every second; bid modal subscribes to a local event bus so opening two tabs and bidding in one updates the other (simulating sockets).
- **Auction end**: when timer hits 0, highest bidder is marked winner, Unicoins move from holder to seller in mock ledger, item appears in History for both sides.
- **Bid escrow**: placing a bid holds Unicoins (deducted from spendable balance, shown as "active bid holds"); refunded when outbid.
- **Seed data**: ~20 sample auctions across categories with realistic images so the UI is alive on first load.

## Out of scope (handled by your backend later)
- Real bcrypt password hashing, JWT signing/verification, MongoDB persistence, real Stripe charges, real-time WebSockets, file upload to cloud storage.

The mock API layer will expose typed functions (`login`, `register`, `listAuctions`, `placeBid`, `createListing`, `getWallet`, `buyUnicoins`, etc.) so your Express team only needs to implement matching endpoints and flip a base URL.
