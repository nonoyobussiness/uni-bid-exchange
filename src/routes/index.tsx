import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Sparkles, TrendingUp, Clock, ShoppingBag, Gavel, ArrowRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AuctionCard } from "@/components/auction-card";
import { BidModal } from "@/components/bid-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { listAuctions } from "@/lib/api";
import type { Auction, Category } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Loader2, AlertCircle } from "lucide-react";

const CATEGORIES: (Category | "All")[] = [
  "All",
  "Electronics",
  "Books",
  "Apparel",
  "Dorm",
  "Tickets",
  "Other",
];

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bidId, setBidId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("All");
  const navigate = useNavigate();

  const openBid = (id: string) => {
    setBidId(id);
    setOpen(true);
  };

  const filtered = useMemo(() => {
    return auctions.filter((a) => {
      const matchCat = cat === "All" || a.category === cat;
      const matchQ =
        !q ||
        a.title.toLowerCase().includes(q.toLowerCase()) ||
        a.description.toLowerCase().includes(q.toLowerCase());
      return matchCat && matchQ;
    });
  }, [auctions, q, cat]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    listAuctions({
      category: cat === "All" ? undefined : cat,
      q: q || undefined,
      sort: "endingSoon",
      limit: 100,
      page: 1,
    })
      .then((items) => {
        if (!alive) return;
        setAuctions(items);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Failed to load auctions");
        setAuctions([]);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [cat, q]);

  const active = filtered.filter((a) => a.status === "active");
  const liveBids = [...active].sort((a, b) => a.endsAt - b.endsAt).slice(0, 8);
  const trending = [...active].sort((a, b) => b.bidCount - a.bidCount).slice(0, 8);
  const newest = [...active].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);
  const sold = filtered.filter((a) => a.status === "sold").slice(0, 4);

  const stats = {
    activeCount: auctions.filter((a) => a.status === "active").length,
    bidsCount: auctions.reduce((sum, a) => sum + a.bidCount, 0),
    sellers: new Set(auctions.map((a) => a.sellerId)).size,
  };

  return (
    <AppShell>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-hero text-foreground">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute -left-32 top-10 h-96 w-96 rounded-full bg-primary-glow blur-3xl" />
          <div className="absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-primary blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-24">
          <div className="grid gap-10 md:grid-cols-2 md:items-center">
            <div>
              <Badge className="bg-foreground/15 text-foreground backdrop-blur">
                <Sparkles className="mr-1 h-3 w-3" /> Mahindra University · Live now
              </Badge>
              <h1 className="mt-4 text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl">
                The campus auction floor — bid in <span className="text-primary-glow">Unicoins</span>.
              </h1>
              <p className="mt-5 max-w-lg text-lg text-foreground/80">
                Buy textbooks, tech, and dorm gear from fellow students. Set your own auctions in
                seconds.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  size="lg"
                  className="bg-primary-foreground text-foreground hover:bg-primary-foreground/80"
                  onClick={() => {
                    document.getElementById("browse")?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  <Gavel className="h-4 w-4" /> Browse auctions
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-foreground/30 bg-transparent text-foreground hover:bg-primary-foreground/10"
                  onClick={() => navigate({ to: "/sell" })}
                >
                  Sell an item <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-10 grid grid-cols-3 gap-6 border-t border-foreground/15 pt-6">
                <Stat n={stats.activeCount} label="Active auctions" />
                <Stat n={stats.bidsCount} label="Bids placed" />
                <Stat n={stats.sellers} label="Sellers" />
              </div>
            </div>

            <div className="relative hidden md:block">
              <div className="relative grid gap-3">
                {liveBids.slice(0, 3).map((a, i) => (
                  <div
                    key={a.id}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border border-primary-foreground/10 bg-primary-foreground/10 p-3 backdrop-blur",
                      i === 1 && "ml-8",
                      i === 2 && "ml-16",
                    )}
                  >
                    <img
                      src={a.images[0]}
                      alt=""
                      className="h-14 w-14 rounded-lg object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{a.title}</div>
                      <div className="text-xs text-foreground/70">
                        {a.bidCount} bids · {a.currentBid} Unicoins
                      </div>
                    </div>
                    <div className="rounded-full bg-destructive/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                      Live
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Search + categories */}
      <section id="browse" className="border-b border-border bg-card/40">
        <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by title, item, or seller..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-12 rounded-full bg-background pl-11 text-base shadow-card"
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-sm font-medium transition",
                  cat === c
                    ? "border-primary bg-primary text-primary-foreground shadow-elegant"
                    : "border-border bg-background hover:border-primary/40 hover:bg-accent",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Sections */}
      <div className="mx-auto max-w-7xl space-y-12 px-4 py-10 md:px-6">
        {loading && (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card p-10 text-sm text-muted-foreground shadow-card">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading auctions…
          </div>
        )}
        {!loading && error && (
          <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive shadow-card">
            <AlertCircle className="mt-0.5 h-4 w-4" />
            <div>
              <div className="font-medium">Could not load auctions</div>
              <div className="mt-1 text-destructive/80">{error}</div>
            </div>
          </div>
        )}
        {liveBids.length > 0 && (
          <Section
            icon={<Clock className="h-5 w-5 text-destructive" />}
            title="Ending soon"
            subtitle="Last chance to grab these"
            items={liveBids}
            onBid={openBid}
          />
        )}
        {trending.length > 0 && (
          <Section
            icon={<TrendingUp className="h-5 w-5 text-primary" />}
            title="Trending"
            subtitle="Hottest auctions on campus"
            items={trending}
            onBid={openBid}
          />
        )}
        {newest.length > 0 && (
          <Section
            icon={<Sparkles className="h-5 w-5 text-success" />}
            title="New listings"
            subtitle="Just dropped"
            items={newest}
            onBid={openBid}
          />
        )}
        {sold.length > 0 && (
          <Section
            icon={<ShoppingBag className="h-5 w-5 text-muted-foreground" />}
            title="Recently sold"
            subtitle="Snapped up by other students"
            items={sold}
            onBid={openBid}
          />
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <Search className="mx-auto h-10 w-10 text-muted-foreground" />
            <h3 className="mt-3 text-lg font-semibold">No auctions match your search</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Try a different category or clear your filters.
            </p>
          </div>
        )}
      </div>

      <BidModal auctionId={bidId} open={open} onOpenChange={setOpen} />
    </AppShell>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <div className="text-3xl font-bold">{n.toLocaleString()}</div>
      <div className="mt-1 text-xs uppercase tracking-wider text-foreground/70">{label}</div>
    </div>
  );
}

function Section({
  icon,
  title,
  subtitle,
  items,
  onBid,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  items: Auction[];
  onBid: (id: string) => void;
}) {
  return (
    <section>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {icon}
            <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((a) => (
          <AuctionCard key={a.id} auction={a} onBid={(au) => onBid(au.id)} />
        ))}
      </div>
    </section>
  );
}
