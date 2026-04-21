import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Gavel, Star, Clock, ShieldCheck, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Countdown } from "./countdown";
import { UnicoinAmount, UnicoinIcon } from "./unicoin";
import { useAuth } from "@/lib/auth-context";
import { getAuction, getWallet, minNextBid, placeBid, type AuctionDetail } from "@/lib/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDistanceToNowStrict } from "date-fns";
import { getSocket, joinAuctionRoom } from "@/lib/socket";
import { ApiError } from "@/lib/api";

export function BidModal({
  auctionId,
  open,
  onOpenChange,
}: {
  auctionId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<AuctionDetail | null>(null);
  const auction = detail?.auction;
  const bids = detail?.bids ?? [];
  const [wallet, setWallet] = useState<Awaited<ReturnType<typeof getWallet>>["wallet"] | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [activeImg, setActiveImg] = useState(0);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setActiveImg(0);
    setCustomAmount("");
  }, [auctionId]);

  const refetch = async () => {
    if (!auctionId) return;
    setLoading(true);
    setLoadErr(null);
    try {
      const d = await getAuction(auctionId);
      setDetail(d);
      if (user) {
        const w = await getWallet();
        setWallet(w.wallet);
      } else {
        setWallet(null);
      }
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Could not load auction");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !auctionId) return;
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, auctionId, user?.id]);

  useEffect(() => {
    if (!open || !auctionId) return;
    const s = getSocket();
    const leave = joinAuctionRoom(auctionId);

    const onUpdate = (payload: any) => {
      if (!payload || String(payload.auctionId) !== String(auctionId)) return;
      setDetail((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          auction: {
            ...prev.auction,
            currentBid: Number(payload.currentBid ?? prev.auction.currentBid),
            bidCount: Number(payload.bidCount ?? prev.auction.bidCount),
          },
        };
      });
    };

    const onConnect = () => {
      // reconnect safety: refresh snapshot from REST
      void refetch();
    };

    s.on("auction:update", onUpdate);
    s.on("connect", onConnect);
    return () => {
      s.off("auction:update", onUpdate);
      s.off("connect", onConnect);
      leave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, auctionId]);

  const minBid = useMemo(() => (auction ? minNextBid(auction) : 0), [auction]);
  const ended = auction ? auction.status !== "active" || auction.endsAt <= Date.now() : true;
  const isOwn = !!user && !!auction && auction.sellerId === user.id;

  const submit = async (amount: number) => {
    if (!user) {
      onOpenChange(false);
      navigate({ to: "/login" });
      return;
    }
    if (!auction) return;
    setSubmitting(true);
    try {
      await placeBid(auction.id, amount);
      toast.success(`Bid placed at ${amount} Unicoins`);
      setCustomAmount("");
      // Re-fetch after bid to avoid relying solely on socket events.
      await refetch();
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 429) {
          toast.error("Bid failed: rate limited. Please wait a few seconds and try again.");
        } else if (e.status === 400) {
          // backend uses 400 for most bid validation cases (ended, insufficient, too low, own auction)
          toast.error(`Bid failed: ${e.message}`);
        } else if (e.status === 409) {
          toast.error(`Bid failed: ${e.message}`);
        } else {
          toast.error(`Bid failed: ${e.message}`);
        }
      } else {
        toast.error(e instanceof Error ? `Bid failed: ${e.message}` : "Bid failed");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!auctionId || loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogTitle>Loading auction…</DialogTitle>
          <p className="text-sm text-muted-foreground">Fetching latest details from the server.</p>
        </DialogContent>
      </Dialog>
    );
  }

  if (!auction) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogTitle>Auction unavailable</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {loadErr ?? "This auction can't be loaded right now."}
          </p>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-0 overflow-hidden p-0 sm:rounded-2xl">
        <div className="grid gap-0 md:grid-cols-2">
          {/* Images */}
          <div className="bg-muted">
            <div className="relative aspect-square overflow-hidden">
              <img
                src={auction.images[activeImg]}
                alt={auction.title}
                className="h-full w-full object-cover"
              />
              {auction.status === "active" && (
                <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1.5 shadow-card backdrop-blur">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  <Countdown endsAt={auction.endsAt} compact />
                </div>
              )}
            </div>
            {auction.images.length > 1 && (
              <div className="flex gap-1.5 p-2">
                {auction.images.map((src, i) => (
                  <button
                    key={src}
                    onClick={() => setActiveImg(i)}
                    className={`relative h-14 w-14 overflow-hidden rounded-md border-2 transition ${
                      i === activeImg ? "border-primary" : "border-transparent opacity-70"
                    }`}
                  >
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex max-h-[80vh] flex-col">
            <DialogHeader className="space-y-2 p-5 pb-3">
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary">{auction.category}</Badge>
                <Badge variant="outline">{auction.condition}</Badge>
              </div>
              <DialogTitle className="text-xl">{auction.title}</DialogTitle>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                Seller: <span className="font-medium text-foreground">{auction.sellerName}</span>
                <Star className="h-3 w-3 fill-warning text-warning" />
                {auction.sellerTrust.toFixed(1)}
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-5">
              <Tabs defaultValue="details">
                <TabsList className="w-full">
                  <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
                  <TabsTrigger value="bids" className="flex-1">
                    Bids ({bids.length})
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="details" className="space-y-3 pt-3">
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {auction.description}
                  </p>
                  <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/30 p-3 text-xs">
                    <div>
                      <div className="text-muted-foreground">Starting price</div>
                      <UnicoinAmount amount={auction.startingPrice} size="sm" />
                    </div>
                    <div>
                      <div className="text-muted-foreground">Current bid</div>
                      <UnicoinAmount amount={auction.currentBid} size="sm" />
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="bids" className="pt-3">
                  {bids.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      No bids yet — be the first!
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Bidder</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-right">When</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bids.slice(0, 12).map((b) => (
                          <TableRow key={b.id}>
                            <TableCell className="text-sm">
                              {b.userName}
                              {user && b.userId === user.id && (
                                <Badge variant="outline" className="ml-1.5 text-[10px]">
                                  You
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <UnicoinAmount amount={b.amount} size="sm" />
                            </TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">
                              {formatDistanceToNowStrict(b.createdAt, { addSuffix: true })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>
              </Tabs>
            </div>

            {/* Bid actions */}
            <div className="border-t border-border bg-card p-4">
              {ended ? (
                <div className="rounded-lg bg-muted p-3 text-center text-sm text-muted-foreground">
                  This auction has ended.
                </div>
              ) : isOwn ? (
                <div className="flex items-center gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                  <AlertCircle className="h-4 w-4" /> You can't bid on your own auction.
                </div>
              ) : (
                <>
                  <div className="mb-3 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Your balance</span>
                    {wallet ? (
                      <UnicoinAmount amount={wallet.balance} size="sm" />
                    ) : (
                      <span className="text-muted-foreground">Sign in to bid</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      onClick={() => submit(minBid)}
                      disabled={submitting || (!!wallet && wallet.balance < minBid)}
                      className="flex-1 bg-gradient-primary text-primary-foreground shadow-elegant"
                    >
                      <Gavel className="h-4 w-4" />
                      Bid minimum ({minBid.toLocaleString()})
                    </Button>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <UnicoinIcon className="absolute left-2 top-1/2 -translate-y-1/2" />
                        <Input
                          type="number"
                          inputMode="numeric"
                          placeholder={`≥ ${minBid}`}
                          min={minBid}
                          value={customAmount}
                          onChange={(e) => setCustomAmount(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      <Button
                        variant="outline"
                        disabled={submitting || !customAmount || Number(customAmount) < minBid}
                        onClick={() => submit(Number(customAmount))}
                      >
                        Custom
                      </Button>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Funds are held in escrow. Outbid? Your Unicoins are refunded automatically.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
