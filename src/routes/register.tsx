import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Gavel, User, Hash, Mail, Lock, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name").max(80),
    studentId: z.string().trim().min(3, "Enter your student ID").max(40),
    email: z
      .string()
      .trim()
      .email("Invalid email")
      .regex(
        /^[A-Za-z0-9]+@mahindrauniversity\.edu\.in$/,
        "Must be studentid@mahindrauniversity.edu.in",
      ),
    password: z.string().min(8, "At least 8 characters"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

type Values = z.infer<typeof schema>;

function strength(pwd: string) {
  let s = 0;
  if (pwd.length >= 8) s++;
  if (pwd.length >= 10) s++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) s++;
  if (/\d/.test(pwd)) s++;
  if (/[^A-Za-z0-9]/.test(pwd)) s++;
  return s; // 0..5
}

export const Route = createFileRoute("/register")({
  component: RegisterPage,
});

function RegisterPage() {
  const { register: signup } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), mode: "onBlur" });

  const pwd = watch("password") ?? "";
  const sc = strength(pwd);

  const onSubmit = async (data: Values) => {
    setLoading(true);
    try {
      await signup({
        fullName: data.fullName,
        studentId: data.studentId,
        email: data.email,
        password: data.password,
      });
      toast.success("Account created — 500 Unicoins added!");
      navigate({ to: "/" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <Link to="/" className="mb-8 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
              <Gavel className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold">UniBid</span>
          </Link>

          <h2 className="text-3xl font-bold tracking-tight">Create your account</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Get 500 free Unicoins to start bidding.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Full name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="fullName" className="pl-9" {...register("fullName")} />
              </div>
              {errors.fullName && (
                <p className="text-xs text-destructive">{errors.fullName.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="studentId">Student ID</Label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="studentId" className="pl-9" placeholder="se21ucse123" {...register("studentId")} />
              </div>
              {errors.studentId && (
                <p className="text-xs text-destructive">{errors.studentId.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">University email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  className="pl-9"
                  placeholder="se21ucse123@mahindrauniversity.edu.in"
                  {...register("email")}
                />
              </div>
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="password" type="password" className="pl-9" {...register("password")} />
              </div>
              {pwd && (
                <div className="flex gap-1 pt-1">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        i < sc
                          ? sc <= 2
                            ? "bg-destructive"
                            : sc <= 3
                              ? "bg-warning"
                              : "bg-success"
                          : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
              )}
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm password</Label>
              <div className="relative">
                <Check className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="confirm" type="password" className="pl-9" {...register("confirm")} />
              </div>
              {errors.confirm && (
                <p className="text-xs text-destructive">{errors.confirm.message}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-primary text-primary-foreground shadow-elegant"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Create account
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      <div className="relative hidden overflow-hidden bg-gradient-hero lg:block">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute right-10 top-20 h-72 w-72 rounded-full bg-primary-glow blur-3xl" />
          <div className="absolute bottom-10 left-10 h-80 w-80 rounded-full bg-primary blur-3xl" />
        </div>
        <div className="relative flex h-full flex-col justify-center p-12 text-foreground">
          <h1 className="text-5xl font-bold leading-tight tracking-tight">
            Join your campus marketplace.
          </h1>
          <p className="mt-4 max-w-md text-lg text-foreground/80">
            Auctions powered by Unicoins. Sell what you don't need. Snag what you do.
          </p>
          <ul className="mt-8 space-y-3 text-foreground/90">
            {[
              "500 Unicoins on signup",
              "Verified university emails only",
              "Escrow protects every bid",
            ].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <Check className="h-4 w-4" /> {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
