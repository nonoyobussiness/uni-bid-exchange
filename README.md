# Uni-Bid-Exchange 🏷️

A full-stack peer-to-peer auction and bidding platform designed for university communities. Students can list items for auction, place bids, and trade with other students using virtual currency (UniCoins).

## Table of Contents
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Setup & Installation](#setup--installation)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Deployment](#deployment)
- [Project Structure Details](#project-structure-details)
- [Team & Contributions](#team--contributions)

---

## Features

- **Auction Management**: Create, list, and manage auctions with automatic settlement
- **Bidding System**: Real-time bidding with WebSocket support for live updates
- **User Authentication**: Secure login/registration with JWT
- **Wallet System**: UniCoin wallet for transactions and bid placement
- **User Profiles**: Edit profile, view bidding history, seller reviews
- **Real-time Notifications**: Live auction updates via WebSocket
- **Image Upload**: Cloudinary integration for auction item images
- **Reviews & Ratings**: Post-transaction reviews for buyers and sellers
- **Automated Expiry**: Background jobs to settle expired auctions
- **Redis Caching**: Performance optimization for frequently accessed data

---

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** - build tool
- **TanStack Router** - routing
- **Shadcn/ui** - UI components
- **Socket.io Client** - real-time updates
- **Axios** - HTTP client

### Backend
- **Node.js** with Express.js
- **TypeScript** - type safety
- **MongoDB** - primary database
- **Redis** - caching & sessions
- **Socket.io** - WebSocket support
- **JWT** - authentication
- **Cloudinary** - image storage
- **Bun** - package manager (optional)

### Deployment
- **Cloudflare Workers** - serverless backend (wrangler config)
- **MongoDB Atlas** (cloud hosted)

---

## Project Structure

```
uni-bid-exchange/
├── frontend (React + TypeScript)
│   ├── src/
│   │   ├── components/          # Reusable React components
│   │   ├── routes/              # Page components & routing
│   │   ├── lib/                 # Utilities, API, hooks, contexts
│   │   ├── hooks/               # Custom React hooks
│   │   └── styles.css           # Global styles
│   ├── vite.config.ts           # Vite configuration
│   ├── tsconfig.json            # TypeScript config
│   └── package.json
│
├── backend (Express.js + TypeScript)
│   ├── src/
│   │   ├── routes/              # API endpoints (auctions, bids, users, etc.)
│   │   ├── models/              # MongoDB schemas
│   │   ├── services/            # Business logic (AuctionService, BidService, etc.)
│   │   ├── middleware/          # Express middleware (authGuard, etc.)
│   │   ├── sockets/             # WebSocket handlers
│   │   ├── jobs/                # Background jobs (settleExpired, etc.)
│   │   ├── config/              # Configuration (DB, env)
│   │   ├── utils/               # Utilities (errors, cloudinary, redis)
│   │   ├── app.ts               # Express app setup
│   │   └── server.ts            # Server entry point
│   ├── wrangler.jsonc           # Cloudflare Workers config
│   ├── tsconfig.json
│   └── package.json
│
├── index.html                   # Entry point for frontend
├── vite.config.ts               # Root Vite config
├── bunfig.toml                  # Bun configuration
└── package.json                 # Root package.json
```

---

## Prerequisites

- **Node.js** v18+ or **Bun** runtime
- **MongoDB** instance (local or Atlas cloud)
- **Redis** instance (for caching)
- **Cloudinary Account** (for image uploads)
- Git

---

## Setup & Installation

### 1. Clone the repository
```bash
git clone <repository-url>
cd uni-bid-exchange
```

### 2. Install root dependencies
```bash
npm install
# or
bun install
```

### 3. Install frontend dependencies
```bash
cd src
npm install
cd ..
```

### 4. Install backend dependencies
```bash
cd backend
npm install
cd ..
```

### 5. Configure environment variables

**Backend** - Create `.env` in the `backend/` folder:
```env
# Database
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<db>
REDIS_URL=redis://<host>:<port>

# Cloudinary
CLOUDINARY_CLOUD_NAME=<your-cloud-name>
CLOUDINARY_API_KEY=<your-api-key>
CLOUDINARY_API_SECRET=<your-api-secret>

# JWT
JWT_SECRET=<your-jwt-secret>

# Server
PORT=3000
NODE_ENV=development
```

**Frontend** - Create `.env` in the root folder:
```env
VITE_API_URL=http://localhost:3000
VITE_SOCKET_URL=http://localhost:3000
```

---

## Running the Application

### Development Mode

**Terminal 1 - Backend**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend**
```bash
npm run dev
```

The application will be available at `http://localhost:5173` (Vite default)

### Production Build

**Frontend**
```bash
npm run build
```

**Backend**
```bash
cd backend
npm run build
```

---

## API Documentation

Full API documentation is available in [POSTMAN_TEST_CASES.md](POSTMAN_TEST_CASES.md).

### Key Endpoints

#### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user

#### Auctions
- `GET /api/auctions` - List all auctions
- `POST /api/auctions` - Create new auction
- `GET /api/auctions/:id` - Get auction details
- `PUT /api/auctions/:id` - Update auction
- `DELETE /api/auctions/:id` - Delete auction

#### Bids
- `POST /api/bids` - Place a bid
- `GET /api/bids/:auctionId` - Get bids for auction
- `DELETE /api/bids/:id` - Withdraw bid

#### Users
- `GET /api/users/:id` - Get user profile
- `PUT /api/users/:id` - Update user profile
- `GET /api/users/:id/history` - Get user's auction history

#### Wallet
- `GET /api/wallet` - Get wallet balance
- `POST /api/wallet/transaction` - Record transaction
- `GET /api/wallet/transactions` - Get transaction history

#### WebSocket Events
- `auction:update` - Real-time auction updates
- `bid:placed` - New bid notification
- `auction:settled` - Auction settlement

---

## Testing

### Manual Testing
API test cases are available in [POSTMAN_TEST_CASES.md](POSTMAN_TEST_CASES.md). Import these into Postman for testing all endpoints.

### Running Tests (if available)
```bash
cd backend
npm run test
```

---

## Deployment

### Cloudflare Workers Deployment

Backend can be deployed to Cloudflare Workers:

```bash
cd backend
npm run deploy
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.

---

## Project Structure Details

### Frontend Components
- **app-header.tsx** - Navigation header
- **auction-card.tsx** - Auction item card display
- **bid-modal.tsx** - Modal for placing bids
- **auction-action-modal.tsx** - Modal for auction actions
- **countdown.tsx** - Real-time countdown timer
- **unicoin.tsx** - UniCoin balance display

### Backend Services
- **AuctionService** - Auction creation, updates, settlement
- **BidService** - Bid placement, validation, history
- **UserService** - User profile, authentication
- **WalletService** - Balance management, transactions

### Database Models
- **User** - User profiles, authentication
- **Auction** - Auction listings, status
- **Bid** - Individual bids with amounts
- **Transaction** - Wallet transactions
- **Review** - User reviews and ratings
- **Wallet** - User account balances

