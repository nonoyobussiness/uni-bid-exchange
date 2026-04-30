import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

const baseUrl = () => {
  const raw = import.meta.env.VITE_API_URL as string | undefined;
  if (!raw) {
    // Match api.ts dev fallback so sockets work out of the box.
    if (import.meta.env.DEV) return "http://localhost:5000";
    return "";
  }
  return raw.replace(/\/+$/, "");
};

export function getSocket() {
  if (socket) return socket;
  socket = io(baseUrl(), {
    auth: {
      token: typeof window !== "undefined" ? localStorage.getItem("token") : null,
    },
    autoConnect: true,
    transports: ["websocket"],
  });
  return socket;
}

export function updateSocketAuthToken() {
  const s = getSocket();
  s.auth = { token: typeof window !== "undefined" ? localStorage.getItem("token") : null };
}

export function reconnectSocketWithToken(token: string | null) {
  const s = getSocket();
  s.auth = { token };
  if (s.connected) s.disconnect();
  s.connect();
}

export function disconnectSocket() {
  if (!socket) return;
  socket.disconnect();
  socket = null;
}

export function joinAuctionRoom(auctionId: string) {
  const s = getSocket();
  s.emit("joinAuction", { auctionId });
  return () => s.emit("leaveAuction", { auctionId });
}

export function joinUserRoom(userId: string) {
  // backend auto-joins user:<userId> on connect; kept for parity / future use
  void userId;
  return () => {};
}

