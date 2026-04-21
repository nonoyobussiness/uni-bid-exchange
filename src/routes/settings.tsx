import { createFileRoute } from "@tanstack/react-router";
import { Sun, Moon, Monitor, Bell, Eye, Globe } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { getPrefs, setPrefs } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { NotificationPrefs } from "@/lib/types";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

const THEMES = [
  { v: "light", label: "Light", icon: Sun },
  { v: "dark", label: "Dark", icon: Moon },
  { v: "system", label: "System", icon: Monitor },
] as const;

const NOTIF_FIELDS: { key: keyof NotificationPrefs; title: string; desc: string }[] = [
  { key: "outbid", title: "You've been outbid", desc: "Get pinged when someone outbids you." },
  { key: "endingSoon", title: "Auction ending soon", desc: "Last 5 minutes warnings." },
  { key: "won", title: "Auction won", desc: "Confirmation when you win." },
  { key: "newBidOnMine", title: "New bid on your listing", desc: "Anyone bids on your item." },
  { key: "marketing", title: "Tips & promotions", desc: "Occasional product news." },
];

function SettingsPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [prefs, setLocalPrefs] = useState<NotificationPrefs | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    setLoading(true);
    getPrefs(user.id)
      .then((p) => {
        if (!alive) return;
        setLocalPrefs(p);
      })
      .catch((e) => {
        if (!alive) return;
        toast.error(e instanceof Error ? e.message : "Failed to load settings");
        setLocalPrefs(null);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [user]);

  if (!user) return <AppShell requireAuth>{null}</AppShell>;
  if (loading && !prefs) return <AppShell requireAuth>{null}</AppShell>;
  if (!prefs) return <AppShell requireAuth>{null}</AppShell>;

  const update = async (patch: Partial<NotificationPrefs>) => {
    const next = { ...prefs, ...patch };
    setLocalPrefs(next);
    try {
      await setPrefs(user.id, next);
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
      setLocalPrefs(prefs);
    }
  };

  return (
    <AppShell requireAuth>
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-12">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="mt-1 text-muted-foreground">Customize how UniBid looks and behaves.</p>
        </header>

        {/* Theme */}
        <Section title="Appearance" icon={<Sun className="h-4 w-4" />}>
          <div className="grid grid-cols-3 gap-3">
            {THEMES.map((t) => {
              const Icon = t.icon;
              const active = theme === t.v;
              return (
                <button
                  key={t.v}
                  onClick={() => setTheme(t.v)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border p-4 transition",
                    active
                      ? "border-primary bg-primary/5 shadow-elegant"
                      : "border-border bg-background hover:border-primary/40",
                  )}
                >
                  <Icon className={cn("h-5 w-5", active && "text-primary")} />
                  <span className="text-sm font-medium">{t.label}</span>
                </button>
              );
            })}
          </div>
        </Section>

        {/* Notifications */}
        <Section title="Notifications" icon={<Bell className="h-4 w-4" />}>
          <div className="space-y-4">
            {NOTIF_FIELDS.map((f) => (
              <div key={f.key} className="flex items-center justify-between gap-4">
                <div>
                  <Label className="text-sm font-medium">{f.title}</Label>
                  <p className="text-xs text-muted-foreground">{f.desc}</p>
                </div>
                <Switch
                  checked={prefs[f.key]}
                  onCheckedChange={(v) => update({ [f.key]: v } as Partial<NotificationPrefs>)}
                />
              </div>
            ))}
          </div>
        </Section>

        {/* Privacy */}
        <Section title="Privacy" icon={<Eye className="h-4 w-4" />}>
          <div className="space-y-4">
            <Toggle
              title="Public profile"
              desc="Allow other students to view your profile."
              checked={prefs.showProfile}
              onChange={(v) => update({ showProfile: v })}
            />
            <Toggle
              title="Show bid history"
              desc="Let others see auctions you've bid on."
              checked={prefs.showBidHistory}
              onChange={(v) => update({ showBidHistory: v })}
            />
          </div>
        </Section>

        {/* Locale */}
        <Section title="Language & region" icon={<Globe className="h-4 w-4" />}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Language</Label>
              <Select defaultValue="en">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="hi" disabled>हिन्दी (coming soon)</SelectItem>
                  <SelectItem value="te" disabled>తెలుగు (coming soon)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Currency display</Label>
              <Select defaultValue="unicoin">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unicoin">Unicoins only</SelectItem>
                  <SelectItem value="inr">Show ₹ equivalent</SelectItem>
                  <SelectItem value="usd">Show $ equivalent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Section>
      </div>
    </AppShell>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6 rounded-2xl border border-border bg-card p-6 shadow-card">
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Toggle({
  title,
  desc,
  checked,
  onChange,
}: {
  title: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <Label className="text-sm font-medium">{title}</Label>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
