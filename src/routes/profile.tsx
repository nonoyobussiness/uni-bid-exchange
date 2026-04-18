import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Star, LogOut, Loader2, Pencil, Trophy, Gavel, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { useStore } from "@/lib/hooks";
import { changePassword, getBids, getWallet, listMyListings, listReviewsFor, updateProfile } from "@/lib/api";
import { UnicoinAmount } from "@/components/unicoin";
import { AuctionCard } from "@/components/auction-card";
import { format } from "date-fns";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user, logout, refresh } = useAuth();
  const navigate = useNavigate();
  const wallet = useStore(() => (user ? getWallet(user.id) : null));
  const listings = useStore(() => (user ? listMyListings(user.id) : []));
  const reviews = useStore(() => (user ? listReviewsFor(user.id) : []));
  const myBids = useStore(() => (user ? getBids().filter((b) => b.userId === user.id) : []));

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.fullName ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);

  if (!user || !wallet) return <AppShell requireAuth>{null}</AppShell>;

  const totalBids = new Set(myBids.map((b) => b.auctionId)).size;
  const won = listings.filter((a) => a.winnerId === user.id).length; // own won — usually 0
  const sold = listings.filter((a) => a.status === "sold").length;

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await updateProfile({ fullName: name, bio });
      refresh();
      setEditing(false);
      toast.success("Profile updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSavingProfile(false);
    }
  };

  const doChangePwd = async () => {
    setPwdBusy(true);
    try {
      await changePassword(oldPwd, newPwd);
      toast.success("Password changed");
      setOldPwd("");
      setNewPwd("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setPwdBusy(false);
    }
  };

  return (
    <AppShell requireAuth>
      <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-12">
        {/* Header card */}
        <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-elegant">
          <div className="h-32 bg-gradient-hero" />
          <div className="px-6 pb-6">
            <div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-end gap-4">
                <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-card bg-gradient-primary text-3xl font-bold text-primary-foreground shadow-elegant">
                  {user.fullName.charAt(0).toUpperCase()}
                </div>
                <div className="pb-1">
                  <h1 className="text-2xl font-bold">{user.fullName}</h1>
                  <p className="text-sm text-muted-foreground">{user.university}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setEditing((e) => !e)}>
                  <Pencil className="h-4 w-4" /> Edit profile
                </Button>
              </div>
            </div>

            {editing && (
              <div className="mt-6 grid gap-4 rounded-xl border border-border bg-background p-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Full name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Bio</Label>
                  <Textarea
                    rows={3}
                    placeholder="A short intro for buyers..."
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2 sm:col-span-2">
                  <Button variant="ghost" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                  <Button onClick={saveProfile} disabled={savingProfile}>
                    {savingProfile && <Loader2 className="h-4 w-4 animate-spin" />} Save
                  </Button>
                </div>
              </div>
            )}

            {!editing && user.bio && (
              <p className="mt-4 text-sm text-muted-foreground">{user.bio}</p>
            )}

            {/* Stats */}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat icon={<Gavel className="h-4 w-4" />} label="Total bids" value={totalBids} />
              <Stat icon={<Trophy className="h-4 w-4" />} label="Auctions won" value={won} />
              <Stat icon={<ShoppingBag className="h-4 w-4" />} label="Items sold" value={sold} />
              <Stat
                icon={<Star className="h-4 w-4 fill-warning text-warning" />}
                label="Trust score"
                value={user.trustScore.toFixed(1)}
              />
            </div>
            <div className="mt-3 flex items-center justify-between rounded-xl border border-border bg-background p-3">
              <span className="text-sm text-muted-foreground">Unicoin balance</span>
              <UnicoinAmount amount={wallet.balance} size="lg" />
            </div>
          </div>
        </section>

        {/* Tabs */}
        <Tabs defaultValue="listings" className="mt-8">
          <TabsList>
            <TabsTrigger value="listings">My Listings ({listings.length})</TabsTrigger>
            <TabsTrigger value="reviews">Reviews ({reviews.length})</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>

          <TabsContent value="listings" className="mt-4">
            {listings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
                You haven't listed anything yet.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {listings.map((a) => (
                  <AuctionCard key={a.id} auction={a} preview />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="reviews" className="mt-4 space-y-3">
            {reviews.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
                No reviews yet — sell something to get rated!
              </div>
            ) : (
              reviews.map((r) => (
                <div key={r.id} className="rounded-xl border border-border bg-card p-4 shadow-card">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-medium">{r.reviewerName}</span>
                    <div className="flex">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3.5 w-3.5 ${i < r.rating ? "fill-warning text-warning" : "text-muted"}`}
                        />
                      ))}
                    </div>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {format(r.createdAt, "MMM d, yyyy")}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{r.text}</p>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="security" className="mt-4 space-y-4">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
              <h3 className="text-lg font-semibold">Change password</h3>
              <div className="mt-4 grid max-w-md gap-3">
                <div className="space-y-1.5">
                  <Label>Current password</Label>
                  <Input type="password" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>New password</Label>
                  <Input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
                </div>
                <Button
                  onClick={doChangePwd}
                  disabled={pwdBusy || !oldPwd || newPwd.length < 6}
                  className="w-fit"
                >
                  {pwdBusy && <Loader2 className="h-4 w-4 animate-spin" />} Update password
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 shadow-card">
              <h3 className="text-lg font-semibold text-destructive">Sign out</h3>
              <p className="mt-1 text-sm text-muted-foreground">End your session on this device.</p>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="destructive" className="mt-3">
                    <LogOut className="h-4 w-4" /> Logout
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle>Log out of UniBid?</DialogTitle>
                  </DialogHeader>
                  <DialogFooter>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        logout();
                        navigate({ to: "/login" });
                      }}
                    >
                      Yes, log me out
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}
