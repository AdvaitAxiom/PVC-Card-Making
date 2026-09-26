"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, IdCard, Loader2, LogIn, ShieldCheck } from "lucide-react";
import ForgotPasswordForm from "@/components/ForgotPasswordForm";

function LoginForm() {
  const params = useSearchParams();
  const nextPath = params.get("next") || "/dashboard";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"signin" | "forgot">("signin");
  const [notice, setNotice] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Could not sign you in.");
        setBusy(false);
        return;
      }
      // A full load guarantees the new session cookie is picked up by middleware.
      window.location.assign(nextPath.startsWith("/") ? nextPath : "/dashboard");
    } catch {
      setError("Network problem. Please check your connection and try again.");
      setBusy(false);
    }
  }

  if (mode === "forgot") {
    return (
      <ForgotPasswordForm
        onCancel={() => setMode("signin")}
        onDone={(name) => {
          setMode("signin");
          setUsername(name);
          setPassword("");
          setError("");
          setNotice("Password changed. Sign in with your new details.");
        }}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {notice ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
          {notice}
        </p>
      ) : null}

      <div>
        <label className="label" htmlFor="username">
          Username
        </label>
        <input
          id="username"
          name="username"
          className="input"
          autoComplete="username"
          placeholder="Enter your username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoFocus
        />
      </div>

      <div>
        <label className="label" htmlFor="password">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            className="input pr-11"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}

      <button type="submit" className="btn-primary w-full py-2.5" disabled={busy}>
        {busy ? <Loader2 size={17} className="animate-spin" /> : <LogIn size={17} />}
        {busy ? "Signing in…" : "Sign in"}
      </button>

      <button
        type="button"
        className="w-full text-center text-xs font-semibold text-brand-700 hover:underline"
        onClick={() => {
          setMode("forgot");
          setError("");
          setNotice("");
        }}
      >
        Forgotten your password?
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-900 via-brand-700 to-brand-500 p-4">
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl md:grid md:grid-cols-2">
        <div className="hidden flex-col justify-between bg-gradient-to-br from-brand-800 to-brand-600 p-10 text-white md:flex">
          <div>
            <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/15">
              <IdCard size={26} />
            </div>
            <h1 className="text-3xl font-bold leading-tight">PVC Card Maker</h1>
            <p className="mt-3 text-sm leading-relaxed text-brand-100">
              Pick a template, type the details, drag things into place, then print a
              perfect licence or ID card.
            </p>
          </div>
          <ul className="space-y-3 text-sm text-brand-100">
            <li className="flex items-start gap-2">
              <ShieldCheck size={17} className="mt-0.5 shrink-0" />
              Your cards stay in this browser — nothing is uploaded.
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck size={17} className="mt-0.5 shrink-0" />
              Front and back artwork kept separately as SVG.
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck size={17} className="mt-0.5 shrink-0" />
              Print at exact CR80 size or export a 300 DPI image.
            </li>
          </ul>
        </div>

        <div className="p-8 sm:p-10">
          <div className="mb-7 md:hidden">
            <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white">
              <IdCard size={23} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">PVC Card Maker</h1>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Welcome back</h2>
          <p className="mb-6 mt-1 text-sm text-slate-500">
            Sign in to open your card studio.
          </p>

          <Suspense fallback={<div className="h-64" />}>
            <LoginForm />
          </Suspense>

          {/* <p className="mt-6 rounded-lg bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-500">
            Default sign-in is <span className="font-semibold text-slate-700">admin</span> /{" "}
            <span className="font-semibold text-slate-700">pvc2024</span>. Change it by
            setting the <code className="font-mono">APP_USERNAME</code> and{" "}
            <code className="font-mono">APP_PASSWORD</code> environment variables in Vercel.
          </p> */}
        </div>
      </div>
    </main>
  );
}
