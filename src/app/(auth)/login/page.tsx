"use client";

import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setMessage("Check your email for the login link.");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text">Sign in</h1>
          <p className="text-text-muted text-sm mt-1">
            Access your collections
          </p>
        </div>

        <div className="flex gap-2 text-sm">
          <button
            onClick={() => setMode("password")}
            className={`px-3 py-1.5 rounded-lg border text-sm font-medium ${
              mode === "password"
                ? "bg-bg-surface border-accent text-text"
                : "border-[rgba(255,255,255,0.06)] text-text-muted"
            }`}
          >
            Password
          </button>
          <button
            onClick={() => setMode("magic")}
            className={`px-3 py-1.5 rounded-lg border text-sm font-medium ${
              mode === "magic"
                ? "bg-bg-surface border-accent text-text"
                : "border-[rgba(255,255,255,0.06)] text-text-muted"
            }`}
          >
            Magic link
          </button>
        </div>

        <form
          onSubmit={mode === "password" ? handlePasswordLogin : handleMagicLink}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-bg-surface border border-[rgba(255,255,255,0.06)] rounded-lg px-3 py-2.5 text-sm text-text placeholder:text-text-dim focus:outline-2 focus:outline-accent"
            />
          </div>

          {mode === "password" && (
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-bg-surface border border-[rgba(255,255,255,0.06)] rounded-lg px-3 py-2.5 text-sm text-text placeholder:text-text-dim focus:outline-2 focus:outline-accent"
              />
            </div>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}
          {message && <p className="text-accent text-sm">{message}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent text-white font-semibold text-sm py-2.5 px-4 rounded-lg hover:bg-accent-hover disabled:opacity-50 transition-colors shadow-[0_2px_8px_rgba(59,130,246,0.3)]"
          >
            {loading
              ? "..."
              : mode === "password"
              ? "Sign in"
              : "Send magic link"}
          </button>
        </form>

        <p className="text-sm text-text-muted text-center">
          No account?{" "}
          <Link href="/signup" className="text-accent hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
