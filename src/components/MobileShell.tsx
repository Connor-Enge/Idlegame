"use client";

import { useEffect } from "react";
import { useGame } from "@/lib/store";
import StatBar from "./StatBar";
import BottomNav from "./BottomNav";
import Toast from "./Toast";
import OfflineModal from "./OfflineModal";
import DeathModal from "./DeathModal";
import AchievementPopup from "./AchievementPopup";

export default function MobileShell({ children }: { children: React.ReactNode }) {
  const init = useGame((s) => s.init);
  const state = useGame((s) => s.state);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <>
      <StatBar />
      <main className="flex-1 overflow-y-auto no-scrollbar px-4 pb-28 pt-2">
        {state ? children : <Loading />}
      </main>
      <Toast />
      <AchievementPopup />
      <OfflineModal />
      <DeathModal />
      <BottomNav />
    </>
  );
}

function Loading() {
  return (
    <div className="flex h-[60vh] items-center justify-center text-muted">
      <div className="animate-pulse text-sm">Loading Paradise…</div>
    </div>
  );
}
