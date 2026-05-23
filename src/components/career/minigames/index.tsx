"use client";

import { ComponentType, useCallback, useEffect, useRef } from "react";
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
import Cashier from "./Cashier";
import StockClerk from "./StockClerk";
import Bagger from "./Bagger";
import Kiosk from "./Kiosk";
import Usher from "./Usher";
import PizzaDelivery from "./PizzaDelivery";
import Rideshare from "./Rideshare";
import Mover from "./Mover";
import WarehousePicker from "./WarehousePicker";
import Forklift from "./Forklift";
import LineCook from "./LineCook";
import Waiter from "./Waiter";
import Bartender from "./Bartender";
import Barback from "./Barback";
import ShiftLead from "./ShiftLead";
import AssistantManager from "./AssistantManager";
import StoreManager from "./StoreManager";
import SalesAssociate from "./SalesAssociate";
import Telemarketer from "./Telemarketer";
import CallCenter from "./CallCenter";
import Receptionist from "./Receptionist";
import DataEntry from "./DataEntry";
import BankTeller from "./BankTeller";
import LoanOfficer from "./LoanOfficer";
import InsuranceAgent from "./InsuranceAgent";
import RealEstate from "./RealEstate";
import Paralegal from "./Paralegal";
import Accountant from "./Accountant";

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
  cashier: Cashier,
  stockclerk: StockClerk,
  bagger: Bagger,
  kiosk: Kiosk,
  usher: Usher,
  pizza: PizzaDelivery,
  rideshare: Rideshare,
  mover: Mover,
  picker: WarehousePicker,
  forklift: Forklift,
  linecook: LineCook,
  waiter: Waiter,
  bartender: Bartender,
  barback: Barback,
  shiftlead: ShiftLead,
  asstmgr: AssistantManager,
  storemgr: StoreManager,
  salesassoc: SalesAssociate,
  telemarket: Telemarketer,
  callcenter: CallCenter,
  recep: Receptionist,
  dataentry: DataEntry,
  teller: BankTeller,
  loan: LoanOfficer,
  insurance: InsuranceAgent,
  realestate: RealEstate,
  paralegal: Paralegal,
  accountant: Accountant,
};

export function MinigameHost({ job, onFinish, onCancel }: MinigameProps) {
  // The parent re-creates these callbacks every store tick. Without stabilizing
  // them, every minigame's useEffect deps would change every tick, tearing down
  // and restarting its interval with a fresh start time — so the on-screen
  // timer would never decrement. Stable refs let effects run exactly once.
  const finishRef = useRef(onFinish);
  const cancelRef = useRef(onCancel);
  useEffect(() => { finishRef.current = onFinish; cancelRef.current = onCancel; }, [onFinish, onCancel]);
  const stableFinish = useCallback((p: number) => finishRef.current(p), []);
  const stableCancel = useCallback(() => cancelRef.current(), []);

  const mg = minigameById(job.minigameId);
  const Comp = COMPONENTS[job.minigameId] ?? Clicker;
  return (
    <div className="space-y-3">
      <button onClick={stableCancel} className="text-sm text-muted active:text-white">
        ← Back to career
      </button>
      <div className="flex items-center gap-3">
        <span className="text-3xl">{job.icon}</span>
        <div className="min-w-0">
          <div className="truncate text-base font-bold">{job.title}</div>
          <div className="text-[11px] text-muted">{mg.name}</div>
        </div>
      </div>
      <Comp job={job} onFinish={stableFinish} onCancel={stableCancel} />
    </div>
  );
}

export type { Job };
