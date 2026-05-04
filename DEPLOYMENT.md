# UniBid Exchange Deployment Guide (Beginner Friendly)

This project is split into:
- `frontend` at repo root (Vite + React)
- `backend` in `backend/` (Express + Socket.IO + MongoDB)

Recommended deployment:
- Frontend: Vercel
- Backend: Render (Web Service)
- Database: MongoDB Atlas
- Optional (for scaling): Upstash Redis

## 1) Prerequisites

- GitHub account
- Vercel account
- Render account
- MongoDB Atlas account
- Node.js 20+ locally

## 2) Prepare environment variables

### Backend variables (Render)

Use `backend/.env.example` as reference. Set these in Render:

- `MONGODB_URI` = your Atlas connection string
- `JWT_SECRET` = long random secret (at least 32 chars)
- `PORT` = `5000`
- `CORS_ORIGINS` = comma-separated frontend URLs
  - Example: `https://your-app.vercel.app,http://localhost:5173`
- `REDIS_URL` (optional) = Upstash Redis URL

### Frontend variables (Vercel)

- `VITE_API_URL` = your Render backend URL
  - Example: `https://unibid-backend.onrender.com`

## 3) Deploy MongoDB Atlas first

1. Create a new Atlas project and cluster (free tier is fine to start).
2. Create a database user (username/password).
3. In Network Access, allow Render's outgoing IPs or use temporary `0.0.0.0/0` while testing.
4. Copy connection string and replace `<password>` with your DB user password.
5. Save this as `MONGODB_URI` in Render later.

## 4) Deploy backend to Render

1. Push your code to GitHub.
2. In Render, click **New +** -> **Web Service** -> connect your repo.
3. Configure:
   - Root Directory: `backend`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm run start`
4. Add environment variables from section 2.
5. Deploy the service.
6. Open: `https://<your-backend>.onrender.com/health`
   - Expected response:
     - `success: true`
     - `message: "UniBid Exchange backend is healthy"`

## 5) Deploy frontend to Vercel

1. In Vercel, import the same GitHub repository.
2. Configure:
   - Root directory: repository root
   - Build command: `npm run build`
   - Output: default Vite output
3. Add env var:
   - `VITE_API_URL=https://<your-backend>.onrender.com`
4. Deploy.

## 6) Connect frontend and backend CORS

After Vercel gives you a URL:

1. Copy your frontend URL.
2. Go to Render service env vars and update:
   - `CORS_ORIGINS=https://<your-app>.vercel.app,http://localhost:5173`
3. Redeploy backend.

Without this, browser requests can fail with CORS errors.

## 7) Post-deploy smoke tests

Run these checks in order:

1. Health check:
   - `GET /health` returns success.
2. Auth flow:
   - Register a new account.
   - Log out, then log in.
3. Core marketplace flow:
   - Create an auction.
   - Open app in 2 browser windows with different users.
   - Place a bid from one window.
   - Confirm real-time update appears in the other window.
4. Wallet endpoints:
   - Buy and withdraw UniCoins.
5. Auction settlement:
   - Create a short-duration auction and wait for end.
   - Verify settlement behavior is applied correctly.

## 8) Optional: Redis for multi-instance Socket.IO

If you scale backend beyond one instance:

1. Create Upstash Redis database.
2. Add `REDIS_URL` in Render.
3. Redeploy backend.

This enables Socket.IO Redis adapter and improves real-time consistency across instances.

## 9) Common beginner issues

- `Unexpected HTML response`: usually wrong `VITE_API_URL`.
- CORS blocked in browser: `CORS_ORIGINS` missing your Vercel domain.
- Backend fails on boot: invalid `MONGODB_URI` or `JWT_SECRET`.
- Socket not connecting: backend URL unreachable or CORS not updated.

## 10) Security basics before sharing publicly

- Never commit real `.env` values.
- Rotate `JWT_SECRET` if it was exposed.
- Restrict Atlas network access once deployment is stable.
- Keep `CORS_ORIGINS` limited to real frontend origins only.
