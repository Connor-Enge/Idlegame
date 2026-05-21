"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/gambling", label: "Casino", icon: "🎰" },
  { href: "/jobs", label: "Career", icon: "💼" },
  { href: "/invest", label: "Markets", icon: "📈" },
  { href: "/realestate", label: "Estate", icon: "🏘️" },
  { href: "/business", label: "Biz", icon: "🏢" },
];

export default function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed bottom-0 left-1/2 z-30 w-full max-w-[480px] -translate-x-1/2 border-t border-white/10 bg-bg-elev/95 backdrop-blur">
      <ul className="flex items-stretch justify-between px-1 pb-[max(env(safe-area-inset-bottom),8px)] pt-1.5">
        {TABS.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                className={`flex flex-col items-center gap-0.5 rounded-lg py-1 text-[10px] transition-colors ${
                  active ? "text-accent" : "text-muted"
                }`}
              >
                <span className={`text-lg ${active ? "scale-110" : ""} transition-transform`}>
                  {t.icon}
                </span>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
