"use client";

import { useEffect, useState, type ComponentType, type InputHTMLAttributes } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, User, ArrowRight, Sparkles } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { Logo } from "./Logo";

type IconType = ComponentType<{ size?: number; className?: string }>;

// Labelled input with a leading icon. Local to the auth screen.
function Field({
  icon: Icon,
  label,
  ...input
}: { icon: IconType; label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-on-surface">{label}</label>
      <div className="relative">
        <Icon
          size={18}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
        />
        <input
          {...input}
          className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest py-2.5 pl-10 pr-4 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>
    </div>
  );
}

// Shared UI for the login and register screens. `mode` toggles the extra
// username field and which auth action runs.
export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const { status, login, register } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Already signed in → go to the dashboard.
  useEffect(() => {
    if (status === "authenticated") router.replace("/workflows");
  }, [status, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "register") await register(username, email, password);
      else await login(email, password);
      router.replace("/workflows");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const isRegister = mode === "register";

  return (
    <main className="flex min-h-screen flex-col md:flex-row">
      {/* Left — form */}
      <section className="flex w-full items-center justify-center bg-surface-container-lowest p-6 md:w-[45%] md:p-12 lg:w-[40%]">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center md:items-start">
            <Logo size={48} className="mb-4 rounded-lg" />
            <h1 className="font-display text-3xl font-bold tracking-tight text-primary">
              {isRegister ? "Create your account" : "Welcome back"}
            </h1>
            <p className="mt-2 text-on-surface-variant">
              {isRegister
                ? "Start building your automation workflows."
                : "Log in to manage your automation workflows."}
            </p>
          </div>

          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
            <form onSubmit={onSubmit} className="space-y-4">
              {isRegister && (
                <Field
                  icon={User}
                  label="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="jane"
                  autoComplete="username"
                  required
                />
              )}
              <Field
                icon={Mail}
                label="Email address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                autoComplete="email"
                required
              />
              <Field
                icon={Lock}
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={isRegister ? "new-password" : "current-password"}
                minLength={8}
                required
              />

              {error && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-semibold text-on-primary transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
              >
                {busy ? "Please wait…" : isRegister ? "Create account" : "Sign in"}
                {!busy && <ArrowRight size={18} />}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-sm text-on-surface-variant">
            {isRegister ? (
              <>
                Already have an account?{" "}
                <Link href="/login" className="font-semibold text-primary hover:underline">
                  Sign in
                </Link>
              </>
            ) : (
              <>
                New to WebBot?{" "}
                <Link href="/register" className="font-semibold text-primary hover:underline">
                  Create an account
                </Link>
              </>
            )}
          </p>
        </div>
      </section>

      {/* Right — hero illustration */}
      <section className="relative hidden flex-1 items-center justify-center overflow-hidden border-l border-outline-variant bg-surface-container md:flex">
        <div className="absolute inset-0 bg-gradient-to-tr from-primary-container/30 via-transparent to-primary/10" />
        <div className="relative z-10 w-[90%] max-w-4xl">
          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-2 shadow-2xl">
            {/* Decorative product illustration — drop a PNG at the path below. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/auth/screen.png"
              alt="WebBot automation dashboard"
              className="h-auto w-full rounded-lg object-cover"
            />
          </div>

          <div className="absolute -bottom-8 -left-8 hidden max-w-[240px] rounded-lg border border-outline-variant bg-surface-container-lowest p-4 shadow-xl lg:block">
            <div className="mb-2 flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
                <Sparkles size={18} />
              </span>
              <h3 className="font-display font-semibold text-primary">Smart Scale</h3>
            </div>
            <p className="text-sm text-on-surface-variant">
              Dynamic resource allocation based on real-time traffic.
            </p>
          </div>

          <div className="absolute -right-6 -top-6 hidden rounded-lg border border-outline-variant bg-surface-container-lowest p-4 shadow-xl lg:block">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 animate-pulse rounded-full bg-primary" />
              <span className="text-sm font-medium text-primary">System Healthy</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
