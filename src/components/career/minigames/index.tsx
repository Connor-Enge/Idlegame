"use client";

import { ComponentType } from "react";
import { type Job, minigameById } from "@/lib/game/careerJobs";
import { MinigameProps } from "./shared";
import Clicker from "./Clicker";
import Timing from "./Timing";
import Reaction from "./Reaction";
import Memory from "./Memory";
import Whack from "./Whack";
import QuickMath from "./QuickMath";
import Lemonade from "./Lemonade";
import PaperRoute from "./PaperRoute";
import DogWalker from "./DogWalker";
import LawnMower from "./LawnMower";
import Babysitter from "./Babysitter";
import CarWasher from "./CarWasher";
import Dishwasher from "./Dishwasher";
import Busser from "./Busser";
import FastFood from "./FastFood";
import Barista from "./Barista";

// minigameId -> component. Jobs whose mechanic isn't built yet fall back to the
// clicker, so the chain is always playable. Adding a new mechanic = a new entry.
const COMPONENTS: Record<string, ComponentType<MinigameProps>> = {
  clicker: Clicker,
  timing: Timing,
  reaction: Reaction,
  memory: Memory,
  whack: Whack,
  math: QuickMath,
  lemonade: Lemonade,
  paperroute: PaperRoute,
  dogwalk: DogWalker,
  lawnmower: LawnMower,
  babysitter: Babysitter,
  carwash: CarWasher,
  dishwash: Dishwasher,
  busser: Busser,
  fastfood: FastFood,
  barista: Barista,
};

export function MinigameHost({ job, onFinish, onCancel }: MinigameProps) {
  const mg = minigameById(job.minigameId);
  const Comp = COMPONENTS[job.minigameId] ?? Clicker;
  return (
    <div className="space-y-3">
      <button onClick={onCancel} className="text-sm text-muted active:text-white">
        ← Back to career
      </button>
      <div className="flex items-center gap-3">
        <span className="text-3xl">{job.icon}</span>
        <div className="min-w-0">
          <div className="truncate text-base font-bold">{job.title}</div>
          <div className="text-[11px] text-muted">{mg.name}</div>
        </div>
      </div>
      <Comp job={job} onFinish={onFinish} onCancel={onCancel} />
    </div>
  );
}

export type { Job };
