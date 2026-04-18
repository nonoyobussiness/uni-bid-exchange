import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Trophy, TrendingDown, XCircle, Activity, ShoppingBag, Clock4, Ban } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { AppShell } from "@/components/app-shell";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import { useStore } from "@/lib/hooks";
import { listAuctions, listMyBids, listMyListings } from "@/lib/api";
import { UnicoinAmount } from "@/components/unicoin";
import type { Auction } from "@/lib/types";

export const Route = createFileRoute("/history")({
  component: HistoryPage,
});

function HistoryPage() {
  const { user } = useAuth();
  useStore(listAuctions); // reactivity

  const myBids = useMemo(
    () => (user ? listMyBids(user.id) : []),
    [user],
  );
  const myListings = useMemo(
    () => (user ? listMyListings(user.id) : []),
    [user],
  );

  if (!user) return <AppShell requireAuth>{null}</AppShell>;

  // Bid buckets
  const winning = myBids.filter(
    (b) => b.auction.status === "active" && b.topBid.userId === user.id,
  );
  const won = myBids.filter(
    (b) => b.auction.status === "sold" && b.auction.winnerId === user.id,
  );
  const outbid = myBids.filter(
    (b) => b.auction.status === "active" && b.topBid.userId !== user.id,
  );
  const lost = myBids.filter(
    (b) =>
      (b.auction.status === "sold" && b.auction.winnerId !== user.id) ||
      b.auction.status === "expired",
  );

  // Sales buckets
  const active = myListings.filter((a) => a.status === "active");
  const sold = myListings.filter((a) => a.status === "sold");
  const expired = myListings.filter((a) => a.status === "expired");

  return (
    <AppShell requireAuth>
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Your activity</h1>
          <p className="mt-1 text-muted-foreground">Track your bids and listings.</p>
        </header>

        <Tabs defaultValue="bids">
          <TabsList>
            <TabsTrigger value="bids">My Bids</TabsTrigger>
            <TabsTrigger value="sales">My Sales</TabsTrigger>
          </TabsList>

          <TabsContent value="bids" className="mt-6">
            <Tabs defaultValue="winning">
              <TabsList>
                <TabsTrigger value="winning">
                  <Activity className="h-4 w-4" /> Winning ({winning.length})
                </TabsTrigger>
                <TabsTrigger value="won">
                  <Trophy className="h-4 w-4" /> Won ({won.length})
                </TabsTrigger>
                <TabsTrigger value="outbid">
                  <TrendingDown className="h-4 w-4" /> Outbid ({outbid.length})
                </TabsTrigger>
                <TabsTrigger value="lost">
                  <XCircle className="h-4 w-4" /> Lost ({lost.length})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="winning"><BidsTable rows={winning} userId={user.id} /></TabsContent>
              <TabsContent value="won"><BidsTable rows={won} userId={user.id} /></TabsContent>
              <TabsContent value="outbid"><BidsTable rows={outbid} userId={user.id} /></TabsContent>
              <TabsContent value="lost"><BidsTable rows={lost} userId={user.id} /></TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="sales" className="mt-6">
            <Tabs defaultValue="active">
              <TabsList>
                <TabsTrigger value="active">
                  <Clock4 className="h-4 w-4" /> Active ({active.length})
                </TabsTrigger>
                <TabsTrigger value="sold">
                  <ShoppingBag className="h-4 w-4" /> Sold ({sold.length})
                </TabsTrigger>
                <TabsTrigger value="expired">
                  <Ban className="h-4 w-4" /> Expired ({expired.length})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="active"><SalesTable rows={active} /></TabsContent>
              <TabsContent value="sold"><SalesTable rows={sold} /></TabsContent>
              <TabsContent value="expired"><SalesTable rows={expired} /></TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function StatusBadge({ status, isWinner }: { status: Auction["status"]; isWinner?: boolean }) {
  if (status === "active")
    return isWinner ? (
      <Badge className="bg-success text-success-foreground">Winning</Badge>
    ) : (
      <Badge variant="outline">Outbid</Badge>
    );
  if (status === "sold")
    return isWinner ? (
      <Badge className="bg-success text-success-foreground">Won</Badge>
    ) : (
      <Badge variant="secondary">Sold to other</Badge>
    );
  return <Badge variant="outline">Expired</Badge>;
}

function BidsTable({
  rows,
  userId,
}: {
  rows: ReturnType<typeof listMyBids>;
  userId: string;
}) {
  if (rows.length === 0) return <Empty msg="Nothing here yet." />;
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>Your top bid</TableHead>
            <TableHead>Current</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ auction, myTop, topBid }) => (
            <TableRow key={auction.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <img src={auction.images[0]} alt="" className="h-10 w-10 rounded-md object-cover" />
                  <div>
                    <div className="font-medium">{auction.title}</div>
                    <div className="text-xs text-muted-foreground">{auction.category}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell><UnicoinAmount amount={myTop.amount} size="sm" /></TableCell>
              <TableCell><UnicoinAmount amount={topBid.amount} size="sm" /></TableCell>
              <TableCell>
                <StatusBadge status={auction.status} isWinner={topBid.userId === userId} />
              </TableCell>
              <TableCell className="text-right text-xs text-muted-foreground">
                {formatDistanceToNowStrict(myTop.createdAt, { addSuffix: true })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SalesTable({ rows }: { rows: Auction[] }) {
  if (rows.length === 0) return <Empty msg="No listings here." />;
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Bids</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((a) => (
            <TableRow key={a.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <img src={a.images[0]} alt="" className="h-10 w-10 rounded-md object-cover" />
                  <div className="font-medium">{a.title}</div>
                </div>
              </TableCell>
              <TableCell><UnicoinAmount amount={a.currentBid} size="sm" /></TableCell>
              <TableCell>{a.bidCount}</TableCell>
              <TableCell>
                <Badge
                  variant={a.status === "sold" ? "default" : "outline"}
                  className={a.status === "sold" ? "bg-success text-success-foreground" : ""}
                >
                  {a.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right text-xs text-muted-foreground">
                {formatDistanceToNowStrict(a.createdAt, { addSuffix: true })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
      {msg}
    </div>
  );
}
