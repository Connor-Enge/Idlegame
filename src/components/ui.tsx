"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-white/5 bg-bg-card p-4 ${className}`}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="mb-3 mt-1">
      <h1 className="text-xl font-bold">{children}</h1>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

type Variant = "primary" | "secondary" | "danger" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-black active:brightness-90",
  secondary: "bg-white/10 text-white active:bg-white/20",
  danger: "bg-danger text-white active:brightness-90",
  ghost: "bg-transparent text-muted active:text-white",
};

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className={`text-base font-semibold ${accent ? "text-accent-2" : ""}`}>{value}</div>
    </div>
  );
}

export function LockedScreen({
  icon,
  title,
  requirement,
}: {
  icon: string;
  title: string;
  requirement: string;
}) {
  return (
    <div className="mt-10 flex flex-col items-center gap-3 px-6 text-center">
      <div className="text-5xl opacity-50">{icon}</div>
      <h1 className="text-xl font-bold">{title}</h1>
      <div className="rounded-xl border border-white/10 bg-bg-card px-4 py-3 text-sm text-muted">
        🔒 {requirement}
      </div>
    </div>
  );
}

export function ProgressBar({ value, className = "" }: { value: number; className?: string }) {
  return (
    <div className={`h-2 overflow-hidden rounded-full bg-white/10 ${className}`}>
      <div className="h-full bg-accent transition-all" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "up" | "down" | "neutral" }) {
  const cls =
    tone === "up"
      ? "bg-accent-2/15 text-accent-2"
      : tone === "down"
        ? "bg-danger/15 text-danger"
        : "bg-white/10 text-muted";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{children}</span>;
}

// Compact "how this section works" panel — three step tiles plus optional
// bullet rules. Used at the top of every major feature page so a new player
// can see the loop at a glance instead of piecing it together.
export function Explainer({
  title = "How it works",
  steps,
  rules,
}: {
  title?: string;
  steps: Array<{ n: string; icon: string; label: string; body: string }>;
  rules?: string[];
}) {
  return (
    <Card className="mb-3 bg-white/[0.03]">
      <div className="text-[11px] uppercase tracking-wider text-muted">{title}</div>
      <div className={`mt-2 grid gap-2 text-[11px] ${steps.length === 3 ? "grid-cols-3" : steps.length === 2 ? "grid-cols-2" : "grid-cols-4"}`}>
        {steps.map((s) => (
          <div key={s.n} className="rounded-lg bg-white/5 p-2">
            <div className="flex items-center gap-1 text-[10px] font-bold text-muted">
              <span>{s.n}</span>
              <span className="text-base">{s.icon}</span>
            </div>
            <div className="mt-1 text-xs font-semibold">{s.label}</div>
            <div className="mt-0.5 text-[10px] text-muted">{s.body}</div>
          </div>
        ))}
      </div>
      {rules && rules.length > 0 && (
        <ul className="mt-3 space-y-0.5 text-[11px] text-muted">
          {rules.map((r, i) => (<li key={i}>• {r}</li>))}
        </ul>
      )}
    </Card>
  );
}
