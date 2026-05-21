"use client";

import { useState } from "react";
import Link from "next/link";
import { useGame } from "@/lib/store";
import { Button, Card, SectionTitle } from "@/components/ui";

export default function AccountPage() {
  const account = useGame((s) => s.account);
  const applyAuth = useGame((s) => s.applyAuth);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      await applyAuth(data.user);
      setEmail("");
      setPassword("");
    } catch {
      setError("Network error — try again");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      await applyAuth(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <SectionTitle sub="Sync your empire across devices">Account</SectionTitle>

      {account ? (
        <Card>
          <div className="flex items-center gap-3">
            <span className="text-3xl">👤</span>
            <div>
              <div className="font-semibold">Signed in</div>
              <div className="text-xs text-muted">{account.email}</div>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-muted">
            Your progress saves to this account automatically. Sign in on any device to continue.
          </p>
          <Button variant="danger" className="mt-4 w-full" disabled={busy} onClick={logout}>
            Sign out
          </Button>
        </Card>
      ) : (
        <Card>
          <div className="mb-3 flex gap-2">
            <Tab active={mode === "login"} onClick={() => setMode("login")}>
              Sign in
            </Tab>
            <Tab active={mode === "register"} onClick={() => setMode("register")}>
              Create account
            </Tab>
          </div>

          <label className="text-[11px] uppercase tracking-wider text-muted">Email</label>
          <input
            type="email"
            inputMode="email"
            autoCapitalize="none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg bg-white/5 px-3 py-2 outline-none"
            placeholder="you@example.com"
          />

          <label className="mt-3 block text-[11px] uppercase tracking-wider text-muted">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="mt-1 w-full rounded-lg bg-white/5 px-3 py-2 outline-none"
            placeholder="At least 8 characters"
          />

          {error && <div className="mt-2 text-xs text-danger">{error}</div>}

          <Button className="mt-4 w-full" disabled={busy} onClick={submit}>
            {busy ? "…" : mode === "login" ? "Sign in" : "Create account"}
          </Button>

          <p className="mt-3 text-[11px] text-muted">
            {mode === "register"
              ? "Creating an account claims your current anonymous progress."
              : "Playing without an account? Progress is saved on this device only."}
          </p>
        </Card>
      )}

      <Link href="/" className="block text-center text-xs text-muted underline">
        Back to game
      </Link>
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
        active ? "bg-accent text-black" : "bg-white/5 text-muted"
      }`}
    >
      {children}
    </button>
  );
}
