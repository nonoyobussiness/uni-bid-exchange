import { type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { AppHeader } from "./app-header";

export function AppShell({ children, requireAuth = false }: { children: ReactNode; requireAuth?: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (requireAuth && !user) {
      navigate({ to: "/login" });
    }
  }, [requireAuth, user, navigate]);

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
