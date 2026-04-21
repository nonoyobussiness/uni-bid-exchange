import { type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { AppHeader } from "./app-header";
import { disconnectSocket, getSocket, reconnectSocketWithToken } from "@/lib/socket";
import { toast } from "sonner";

export function AppShell({ children, requireAuth = false }: { children: ReactNode; requireAuth?: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (requireAuth && !user) {
      navigate({ to: "/login" });
    }
  }, [requireAuth, user, navigate]);

  useEffect(() => {
    if (!user) {
      disconnectSocket();
      return;
    }

    reconnectSocketWithToken(localStorage.getItem("token"));
    const s = getSocket();

    const onOutbid = (p: any) => {
      const auctionId = p?.auctionId ? String(p.auctionId) : "";
      const newBid = p?.newBid;
      toast.error(
        `You were outbid${auctionId ? ` on ${auctionId}` : ""}${
          typeof newBid === "number" ? `. New bid: ${newBid}` : ""
        }`,
      );
    };

    s.on("outbid", onOutbid);
    return () => {
      s.off("outbid", onOutbid);
    };
  }, [user?.id]);

  if (requireAuth && !user) return null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border/60 py-6">
        <div className="mx-auto max-w-7xl px-4 text-center text-xs text-muted-foreground md:px-6">
          UniBid · Student auctions powered by Unicoins · Demo build
        </div>
      </footer>
    </div>
  );
}
