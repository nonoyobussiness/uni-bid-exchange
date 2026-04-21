import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Upload, X, Loader2, Eye } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { AuctionCard } from "@/components/auction-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { createAuction } from "@/lib/api";
import type { Auction, Category, Condition } from "@/lib/types";

const CATS: Category[] = ["Electronics", "Books", "Apparel", "Dorm", "Tickets", "Other"];
const CONDS: Condition[] = ["New", "Like-new", "Good", "Fair"];
const DURATIONS = [
  { v: 60, label: "1 hour" },
  { v: 360, label: "6 hours" },
  { v: 1440, label: "1 day" },
  { v: 4320, label: "3 days" },
  { v: 10080, label: "7 days" },
];

const schema = z.object({
  title: z.string().trim().min(3, "At least 3 characters").max(100),
  description: z.string().trim().min(10, "Tell buyers more").max(2000),
  category: z.enum(["Electronics", "Books", "Apparel", "Dorm", "Tickets", "Other"]),
  condition: z.enum(["New", "Like-new", "Good", "Fair"]),
  startingPrice: z.coerce.number().int().min(1).max(100000),
  durationMinutes: z.coerce.number().int().min(60),
});
type Values = z.infer<typeof schema>;

export const Route = createFileRoute("/sell")({
  component: SellPage,
});

function SellPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      category: "Electronics",
      condition: "Good",
      startingPrice: 50,
      durationMinutes: 1440,
    },
  });

  const v = watch();

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    const remaining = 6 - images.length;
    const next = Array.from(files)
      .slice(0, remaining)
      .map(
        (f) =>
          new Promise<string>((resolve) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result as string);
            r.readAsDataURL(f);
          }),
      );
    Promise.all(next).then((urls) => setImages((prev) => [...prev, ...urls]));
  };

  const onSubmit = async (data: Values) => {
    setSubmitting(true);
    try {
      console.log(`[SellPage] Submitting auction with ${images.length} images:`,
        images.map((img, i) => `[${i}] ${img.substring(0, 100)}...`));
      
      await createAuction({
        ...data,
        images,
      });
      toast.success("Your auction is live!");
      navigate({ to: "/" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create auction");
    } finally {
      setSubmitting(false);
    }
  };

  const previewAuction: Auction = useMemo(
    () => ({
      id: "preview",
      sellerId: user?.id ?? "",
      sellerName: user?.fullName ?? "You",
      sellerTrust: user?.trustScore ?? 5,
      title: v.title || "Your auction title",
      description: v.description || "",
      category: v.category,
      condition: v.condition,
      images: images.length
        ? images
        : ["https://picsum.photos/seed/preview-empty/800/600?blur=2"],
      startingPrice: v.startingPrice || 0,
      currentBid: v.startingPrice || 0,
      bidCount: 0,
      endsAt: Date.now() + (v.durationMinutes || 60) * 60_000,
      createdAt: Date.now(),
      status: "active",
    }),
    [v, images, user],
  );

  return (
    <AppShell requireAuth>
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">List a new auction</h1>
          <p className="mt-1 text-muted-foreground">
            Set your starting price in Unicoins. Bids are held in escrow until the auction ends.
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Photos */}
            <Card title="Photos" subtitle="Up to 6 images. The first will be the cover.">
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {images.map((src, i) => (
                  <div key={i} className="group relative aspect-square overflow-hidden rounded-lg border border-border">
                    <img src={src} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setImages((p) => p.filter((_, idx) => idx !== i))}
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-background/90 opacity-0 shadow-card transition-opacity group-hover:opacity-100"
                      aria-label="Remove"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    {i === 0 && (
                      <div className="absolute bottom-1 left-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                        Cover
                      </div>
                    )}
                  </div>
                ))}
                {images.length < 6 && (
                  <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border text-muted-foreground transition hover:border-primary hover:bg-accent/30">
                    <Upload className="h-5 w-5" />
                    <span className="text-xs">Add</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => onFiles(e.target.files)}
                    />
                  </label>
                )}
              </div>
            </Card>

            <Card title="Item details">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" placeholder="e.g. MacBook Air M2 — barely used" {...register("title")} />
                  {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    rows={5}
                    placeholder="Condition, included accessories, why you're selling..."
                    {...register("description")}
                  />
                  {errors.description && (
                    <p className="text-xs text-destructive">{errors.description.message}</p>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Category</Label>
                    <Select
                      value={v.category}
                      onValueChange={(val) => setValue("category", val as Category)}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATS.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Condition</Label>
                    <Select
                      value={v.condition}
                      onValueChange={(val) => setValue("condition", val as Condition)}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CONDS.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </Card>

            <Card title="Pricing & duration">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="startingPrice">Starting price (Unicoins)</Label>
                  <Input id="startingPrice" type="number" min={1} {...register("startingPrice")} />
                  {errors.startingPrice && (
                    <p className="text-xs text-destructive">{errors.startingPrice.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Duration</Label>
                  <Select
                    value={String(v.durationMinutes)}
                    onValueChange={(val) => setValue("durationMinutes", Number(val))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DURATIONS.map((d) => (
                        <SelectItem key={d.v} value={String(d.v)}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => navigate({ to: "/" })}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-gradient-primary text-primary-foreground shadow-elegant"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Publish auction
              </Button>
            </div>
          </form>

          {/* Live preview */}
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Eye className="h-4 w-4" /> Live preview
            </div>
            <AuctionCard auction={previewAuction} preview />
            <p className="mt-3 text-xs text-muted-foreground">
              This is exactly how your auction card will appear on the home feed.
            </p>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
      <header className="mb-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}
