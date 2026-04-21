import { Link } from "@tanstack/react-router";
import { Gavel, Clock, Users, TrendingUp, Trash2, X } from "lucide-react";
import type { Auction } from "@/lib/types";
import { Countdown } from "./countdown";
import { UnicoinAmount } from "./unicoin";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Props {
  auction: Auction;
  onBid?: (a: Auction) => void;
  preview?: boolean;
  currentUserId?: string;
  onDelete?: (auctionId: string) => void;
  onCancel?: (auctionId: string) => void;
}

export function AuctionCard({ auction, onBid, preview = false, currentUserId, onDelete, onCancel }: Props) {
  const ended = auction.status !== "active" || auction.endsAt <= Date.now();
  const isSeller = currentUserId && auction.sellerId === currentUserId;
  const canDelete = isSeller && auction.bidCount === 0;
  const canCancel = isSeller && auction.bidCount > 0 && auction.status === "active";
  
  // Log auction image info for debugging
  if (auction.images.length > 0) {
    console.log(`[AuctionCard] Rendering auction ${auction.id} with image: ${auction.images[0].substring(0, 100)}...`);
  }

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-all",
        !preview && "hover:-translate-y-1 hover:shadow-elegant",
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <img
          src={auction.images[0] || "https://via.placeholder.com/800x600?text=No+Image"}
          alt={auction.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute left-2 top-2 flex gap-1.5">
          <Badge variant="secondary" className="backdrop-blur">{auction.category}</Badge>
          {auction.condition === "New" && (
            <Badge className="bg-success text-success-foreground">New</Badge>
          )}
        </div>
        {auction.status === "sold" && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm">
            <Badge className="bg-foreground text-background text-base">SOLD</Badge>
          </div>
        )}
        {auction.status === "cancelled" && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm">
            <Badge className="bg-foreground text-background text-base">CANCELLED</Badge>
          </div>
        )}
        {auction.status === "active" && !ended && (
          <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-background/90 px-2.5 py-1 backdrop-blur">
            <Clock className="h-3 w-3 text-primary" />
            <Countdown endsAt={auction.endsAt} compact />
          </div>
        )}
        {(canDelete || canCancel) && (
          <div className="absolute top-2 right-14 flex gap-1.5">
            {canDelete && (
              <Button
                size="sm"
                variant="destructive"
                className="h-8 w-8 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.(auction.id);
                }}
                title="Delete auction"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            {canCancel && (
              <Button
                size="sm"
                variant="destructive"
                className="h-8 w-8 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onCancel?.(auction.id);
                }}
                title="Cancel auction"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex-1">
          <h3 className="line-clamp-2 font-semibold leading-snug">{auction.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">by {auction.sellerName}</p>
        </div>

        <div className="flex items-end justify-between gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Current bid
            </div>
            <UnicoinAmount amount={auction.currentBid} size="lg" />
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3 w-3" /> {auction.bidCount}
          </div>
        </div>

        {!preview && !isSeller && (
          <Button
            disabled={ended}
            onClick={() => onBid?.(auction)}
            className="w-full bg-gradient-primary text-primary-foreground shadow-elegant hover:opacity-90"
          >
            {ended ? (
              <>
                <TrendingUp className="h-4 w-4" /> Auction ended
              </>
            ) : (
              <>
                <Gavel className="h-4 w-4" /> Place a bid
              </>
            )}
          </Button>
        )}
        {!preview && isSeller && (
          <div className="text-xs text-center text-muted-foreground">
            {auction.status === "active" && !ended ? (
              <span>You're selling this</span>
            ) : (
              <span className="capitalize">{auction.status}</span>
            )}
          </div>
        )}
      </div>

      {preview && (
        <div className="absolute inset-x-0 bottom-0 border-t border-dashed border-primary/40 bg-primary/5 px-3 py-1 text-center text-[10px] uppercase tracking-wider text-primary">
          Live preview
        </div>
      )}

      {!preview && !isSeller && (
        <Link
          to="/"
          aria-label={auction.title}
          className="absolute inset-0 -z-0"
          onClick={(e) => {
            e.preventDefault();
            onBid?.(auction);
          }}
        />
      )}
    </article>
  );
}
