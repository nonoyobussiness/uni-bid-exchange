import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowDownToLine, ArrowUpToLine, Loader2, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import { buyUnicoins, getWallet, withdrawUnicoins } from "@/lib/api";
import { UnicoinAmount } from "@/components/unicoin";
import { cn } from "@/lib/utils";
import type { Transaction, Wallet } from "@/lib/types";

const PACKS = [
  { coins: 100, rs: 100 },
  { coins: 500, rs: 500 },
  { coins: 1000, rs: 1000 },
  { coins: 2500, rs: 2500 },
];

export const Route = createFileRoute("/wallet")({
  component: WalletPage,
});

function WalletPage() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [withdraw, setWithdraw] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getWallet();
      setWallet(data.wallet);
      setTxs(data.transactions);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load wallet");
      setWallet(null);
      setTxs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (!user) return <AppShell requireAuth>{null}</AppShell>;
  if (loading && !wallet) return <AppShell requireAuth>{null}</AppShell>;
  if (!wallet) return <AppShell requireAuth>{null}</AppShell>;

  const buy = async (amount: number) => {
    setBusy(true);
    try {
      await buyUnicoins(amount);
      await refresh();
      toast.success(`Added ${amount} Unicoins to your wallet`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const doWithdraw = async () => {
    const n = Number(withdraw);
    if (!n || n <= 0) return;
    setBusy(true);
    try {
      await withdrawUnicoins(n);
      await refresh();
      toast.success(`Withdrew ${n} Unicoins`);
      setWithdraw("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell requireAuth>
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Wallet</h1>
          <p className="mt-1 text-muted-foreground">Manage your Unicoins and transactions.</p>
        </header>

        {/* Stat cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Spendable balance" hero>
            <UnicoinAmount amount={wallet.balance} size="xl" />
          </StatCard>
          <StatCard label="Active bid holds">
            <UnicoinAmount amount={wallet.held} size="lg" />
          </StatCard>
          <StatCard label="Total deposited">
            <UnicoinAmount amount={wallet.totalDeposited} size="lg" />
          </StatCard>
          <StatCard label="Total spent">
            <UnicoinAmount amount={wallet.totalSpent} size="lg" />
          </StatCard>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {/* Buy */}
          <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Buy Unicoins</h2>
              <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning-foreground">
                Test mode
              </Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {PACKS.map((p) => (
                <button
                  key={p.coins}
                  onClick={() => buy(p.coins)}
                  disabled={busy}
                  className="group flex items-center justify-between rounded-xl border border-border bg-background p-4 text-left transition hover:-translate-y-0.5 hover:border-primary hover:shadow-elegant disabled:opacity-50"
                >
                  <div>
                    <UnicoinAmount amount={p.coins} size="lg" />
                    <div className="mt-1 text-xs text-muted-foreground">₹{p.rs.toFixed(2)} </div>
                  </div>
                  <ArrowDownToLine className="h-5 w-5 text-muted-foreground transition group-hover:text-primary" />
                </button>
              ))}
            </div>
            <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3 w-3" /> Mock checkout — credits instantly. Wire to real
              Stripe later.
            </p>
          </section>

          {/* Withdraw */}
          <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <h2 className="mb-4 text-lg font-semibold">Withdraw to bank</h2>
            <div className="rounded-xl border border-border bg-background p-4">
              <div className="text-xs text-muted-foreground">Available to withdraw</div>
              <UnicoinAmount amount={wallet.balance} size="lg" className="mt-1" />
            </div>
            <div className="mt-4 flex gap-2">
              <Input
                type="number"
                placeholder="Amount in Unicoins"
                value={withdraw}
                onChange={(e) => setWithdraw(e.target.value)}
              />
              <Button onClick={doWithdraw} disabled={busy || !withdraw} variant="outline">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpToLine className="h-4 w-4" />}
                Withdraw
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              1 Unicoin ≈ ₹1.00 — payouts arrive in 2-3 business days (mocked).
            </p>
          </section>
        </div>

        {/* Transactions */}
        <section className="mt-8 rounded-2xl border border-border bg-card shadow-card">
          <header className="border-b border-border p-6">
            <h2 className="text-lg font-semibold">Transaction history</h2>
          </header>
          {txs.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No transactions yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {txs.slice(0, 50).map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Badge variant="outline">{prettyType(t.type)}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{t.description}</TableCell>
                    <TableCell>
                      <span className={cn("font-mono font-semibold", t.amount > 0 ? "text-success" : "text-foreground")}>
                        {t.amount > 0 ? "+" : ""}
                        {t.amount.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn(t.status === "completed" && "bg-success/15 text-success")}
                      >
                        {t.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {format(t.createdAt, "MMM d, h:mm a")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function StatCard({
  label,
  children,
  hero,
}: {
  label: string;
  children: React.ReactNode;
  hero?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-5 shadow-card",
        hero
          ? "border-transparent bg-gradient-primary text-primary-foreground shadow-elegant [&_*]:text-primary-foreground"
          : "border-border bg-card",
      )}
    >
      <div className={cn("text-xs uppercase tracking-wider", hero ? "opacity-80" : "text-muted-foreground")}>
        {label}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function prettyType(t: string) {
  return t.replace(/_/g, " ");
}
