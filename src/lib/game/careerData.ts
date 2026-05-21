// Career system v2 content: skills, shift tasks, side gigs, training,
// workplace perks and projects. Kept separate from data.ts so the broader
// economy content stays untouched.

// ---------------------------------------------------------------------------
// Skills — the six competencies trained through work, gigs and courses.
// A skill's level is derived from its accumulated XP (see career.ts).
// ---------------------------------------------------------------------------

export interface CareerSkill {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export const SKILLS: CareerSkill[] = [
  { id: "focus", name: "Focus", icon: "🎯", description: "Precision and productivity under pressure." },
  { id: "technical", name: "Technical", icon: "🛠️", description: "Hard skills, tools and craft." },
  { id: "teamwork", name: "Teamwork", icon: "🤝", description: "Getting things done with others." },
  { id: "communication", name: "Communication", icon: "🗣️", description: "Persuasion, clarity, presence." },
  { id: "leadership", name: "Leadership", icon: "📊", description: "Direction, judgement, ownership." },
  { id: "networking", name: "Networking", icon: "🌐", description: "Relationships and opportunity." },
];

export const SKILL_IDS = SKILLS.map((s) => s.id);
export const MAX_SKILL_LEVEL = 20;

// ---------------------------------------------------------------------------
// Shift tasks — each track draws from its own themed pool. A shift surfaces
// three of these; the player resolves each as a timed skill-check moment.
// ---------------------------------------------------------------------------

export interface ShiftTask {
  id: string;
  label: string;
  flavor: string;
  skillId: string;
}

export const TRACK_TASKS: Record<string, ShiftTask[]> = {
  service: [
    { id: "svc-rush", label: "Survive the dinner rush", flavor: "Twelve tables seated at once.", skillId: "focus" },
    { id: "svc-customer", label: "Defuse an angry customer", flavor: "Their steak is 'basically raw'.", skillId: "communication" },
    { id: "svc-line", label: "Run the line", flavor: "Keep tickets moving with the team.", skillId: "teamwork" },
    { id: "svc-clean", label: "Deep-clean the station", flavor: "Health inspector is due.", skillId: "focus" },
    { id: "svc-train", label: "Train the new hire", flavor: "Show them the ropes fast.", skillId: "leadership" },
    { id: "svc-prep", label: "Prep for service", flavor: "Mise en place, perfectly.", skillId: "technical" },
  ],
  retail: [
    { id: "rt-floor", label: "Work the sales floor", flavor: "Upsell without being pushy.", skillId: "communication" },
    { id: "rt-stock", label: "Restock and face shelves", flavor: "Beat the truck before open.", skillId: "focus" },
    { id: "rt-register", label: "Balance the register", flavor: "Count it twice.", skillId: "technical" },
    { id: "rt-schedule", label: "Sort the staff schedule", flavor: "Three callouts this week.", skillId: "leadership" },
    { id: "rt-display", label: "Build a window display", flavor: "Make it stop traffic.", skillId: "teamwork" },
    { id: "rt-vendor", label: "Negotiate with a vendor", flavor: "Squeeze the margin.", skillId: "networking" },
  ],
  trades: [
    { id: "tr-install", label: "Complete an install", flavor: "To spec, to code.", skillId: "technical" },
    { id: "tr-diagnose", label: "Diagnose the fault", flavor: "Find it before lunch.", skillId: "focus" },
    { id: "tr-crew", label: "Direct the crew", flavor: "Keep three jobs on track.", skillId: "leadership" },
    { id: "tr-client", label: "Walk the client through it", flavor: "Explain the quote.", skillId: "communication" },
    { id: "tr-safety", label: "Run the safety check", flavor: "Nobody gets hurt today.", skillId: "teamwork" },
    { id: "tr-bid", label: "Win a contract bid", flavor: "Underbid the competition.", skillId: "networking" },
  ],
  corporate: [
    { id: "cp-deck", label: "Build the board deck", flavor: "Forty slides by 9am.", skillId: "technical" },
    { id: "cp-meeting", label: "Run the standup", flavor: "Keep it under fifteen minutes.", skillId: "leadership" },
    { id: "cp-pitch", label: "Pitch the strategy", flavor: "Win over the skeptics.", skillId: "communication" },
    { id: "cp-model", label: "Finish the model", flavor: "The numbers have to tie.", skillId: "focus" },
    { id: "cp-cross", label: "Align cross-functionally", flavor: "Herd four departments.", skillId: "teamwork" },
    { id: "cp-relationship", label: "Work the room at offsite", flavor: "Be seen by the right people.", skillId: "networking" },
  ],
  tech: [
    { id: "tc-ship", label: "Ship the feature", flavor: "Green CI, then deploy.", skillId: "technical" },
    { id: "tc-bug", label: "Hunt the prod bug", flavor: "It only happens at 3am.", skillId: "focus" },
    { id: "tc-review", label: "Review the team's PRs", flavor: "Unblock everyone.", skillId: "teamwork" },
    { id: "tc-design", label: "Lead the design review", flavor: "Defend the architecture.", skillId: "leadership" },
    { id: "tc-demo", label: "Demo to stakeholders", flavor: "Make the magic look easy.", skillId: "communication" },
    { id: "tc-conf", label: "Speak at the meetup", flavor: "Recruit and be recruited.", skillId: "networking" },
  ],
  finance: [
    { id: "fn-trade", label: "Work the order book", flavor: "Fill big without moving price.", skillId: "focus" },
    { id: "fn-model", label: "Stress-test the portfolio", flavor: "What breaks at -30%?", skillId: "technical" },
    { id: "fn-client", label: "Pitch the fund", flavor: "Anchor the round.", skillId: "communication" },
    { id: "fn-desk", label: "Run the trading desk", flavor: "Keep the juniors disciplined.", skillId: "leadership" },
    { id: "fn-deal", label: "Close the deal", flavor: "Two sides, one term sheet.", skillId: "teamwork" },
    { id: "fn-lp", label: "Court the LPs", flavor: "Capital follows relationships.", skillId: "networking" },
  ],
};

// ---------------------------------------------------------------------------
// Side gigs — quick freelance work available even while unemployed. Each is a
// one-moment skill check on a cooldown. Great for early cash and skill XP.
// ---------------------------------------------------------------------------

export interface Gig {
  id: string;
  name: string;
  icon: string;
  description: string;
  skillId: string;
  basePay: number; // pay at a perfect result, scaled by skill + roll
  energyCost: number;
  cooldownTicks: number;
  levelRequired: number;
  skillRequired: number; // min level in `skillId` — gates gigs behind real career progress
}

export const GIGS: Gig[] = [
  { id: "rideshare", name: "Rideshare Driving", icon: "🚗", description: "Surge pricing if you time it right.", skillId: "focus", basePay: 90, energyCost: 6, cooldownTicks: 20, levelRequired: 1, skillRequired: 0 },
  { id: "delivery", name: "Food Delivery", icon: "🛵", description: "Tips reward speed.", skillId: "focus", basePay: 70, energyCost: 5, cooldownTicks: 18, levelRequired: 1, skillRequired: 0 },
  { id: "dogwalk", name: "Dog Walking", icon: "🐕", description: "Low effort, repeat clients.", skillId: "teamwork", basePay: 60, energyCost: 4, cooldownTicks: 16, levelRequired: 1, skillRequired: 0 },
  { id: "tutoring", name: "Tutoring", icon: "📖", description: "Explain it simply, get paid.", skillId: "communication", basePay: 150, energyCost: 6, cooldownTicks: 26, levelRequired: 3, skillRequired: 2 },
  { id: "handyman", name: "Handyman Jobs", icon: "🔧", description: "Fix it, bill for parts.", skillId: "technical", basePay: 180, energyCost: 8, cooldownTicks: 28, levelRequired: 4, skillRequired: 3 },
  { id: "freelance-dev", name: "Freelance Coding", icon: "💻", description: "Ship a small contract.", skillId: "technical", basePay: 420, energyCost: 9, cooldownTicks: 40, levelRequired: 7, skillRequired: 5 },
  { id: "consulting", name: "Weekend Consulting", icon: "📋", description: "Bill by the hour, generously.", skillId: "leadership", basePay: 900, energyCost: 10, cooldownTicks: 55, levelRequired: 11, skillRequired: 7 },
  { id: "speaking", name: "Keynote Speaking", icon: "🎤", description: "Charge for the spotlight.", skillId: "communication", basePay: 2400, energyCost: 12, cooldownTicks: 80, levelRequired: 15, skillRequired: 9 },
  { id: "advisory", name: "Board Advisory", icon: "🏛️", description: "Lend your name to a startup.", skillId: "networking", basePay: 6500, energyCost: 14, cooldownTicks: 120, levelRequired: 20, skillRequired: 12 },
];

// ---------------------------------------------------------------------------
// Workplace perks — one-time cash purchases granting permanent career boosts.
// Effects are interpreted in career.ts (see PERK_EFFECTS).
// ---------------------------------------------------------------------------

export interface Perk {
  id: string;
  name: string;
  icon: string;
  description: string;
  cost: number;
  levelRequired: number;
}

export const PERKS: Perk[] = [
  { id: "ergonomic", name: "Ergonomic Setup", icon: "🪑", description: "−2 energy cost per shift.", cost: 4_000, levelRequired: 1 },
  { id: "coffee", name: "Coffee Habit", icon: "☕", description: "Shifts drain 35% less morale.", cost: 6_000, levelRequired: 2 },
  { id: "mentor", name: "Find a Mentor", icon: "🧑‍🏫", description: "+25% skill XP from all sources.", cost: 18_000, levelRequired: 4 },
  { id: "brand", name: "Personal Brand", icon: "✨", description: "+50% reputation from shifts & gigs.", cost: 40_000, levelRequired: 6 },
  { id: "assistant", name: "Hire an Assistant", icon: "🧑‍💼", description: "+20% passive salary.", cost: 120_000, levelRequired: 9 },
  { id: "coach", name: "Executive Coach", icon: "🎓", description: "+40% performance gain per shift.", cost: 300_000, levelRequired: 12 },
  { id: "headhunter", name: "On a Headhunter's List", icon: "🎯", description: "+15% pay from every shift.", cost: 750_000, levelRequired: 15 },
  { id: "network", name: "Elite Network", icon: "🤝", description: "Gigs ready 30% sooner.", cost: 2_000_000, levelRequired: 18 },
];

export type PerkEffect = {
  shiftEnergy?: number; // additive (negative reduces cost)
  moraleDrainMult?: number;
  skillXpMult?: number;
  reputationMult?: number;
  passiveSalaryMult?: number;
  performanceMult?: number;
  shiftPayMult?: number;
  gigCooldownMult?: number;
};

export const PERK_EFFECTS: Record<string, PerkEffect> = {
  ergonomic: { shiftEnergy: -2 },
  coffee: { moraleDrainMult: 0.65 },
  mentor: { skillXpMult: 1.25 },
  brand: { reputationMult: 1.5 },
  assistant: { passiveSalaryMult: 1.2 },
  coach: { performanceMult: 1.4 },
  headhunter: { shiftPayMult: 1.15 },
  network: { gigCooldownMult: 0.7 },
};

// ---------------------------------------------------------------------------
// Workplace projects — multi-shift assignments for a lump-sum payoff. Accept
// one, then chip away at it by working shifts. Higher tiers gate by level.
// ---------------------------------------------------------------------------

export interface ProjectDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  shifts: number; // shifts of work to complete
  rewardPerShiftSalary: number; // bonus = level salary/tick * this on completion
  reputation: number;
  skillId: string;
  skillXp: number;
  levelRequired: number;
}

export const PROJECTS: ProjectDef[] = [
  { id: "quarter-close", name: "Quarter Close", icon: "📅", description: "Push hard through end of quarter.", shifts: 3, rewardPerShiftSalary: 30, reputation: 25, skillId: "focus", skillXp: 40, levelRequired: 1 },
  { id: "big-client", name: "Land the Big Client", icon: "🏢", description: "Win a marquee account.", shifts: 5, rewardPerShiftSalary: 45, reputation: 60, skillId: "communication", skillXp: 70, levelRequired: 4 },
  { id: "product-launch", name: "Product Launch", icon: "🚀", description: "Take something new to market.", shifts: 7, rewardPerShiftSalary: 60, reputation: 110, skillId: "leadership", skillXp: 120, levelRequired: 8 },
  { id: "turnaround", name: "Department Turnaround", icon: "📈", description: "Fix a failing team.", shifts: 10, rewardPerShiftSalary: 80, reputation: 220, skillId: "leadership", skillXp: 220, levelRequired: 12 },
  { id: "merger", name: "Lead a Merger", icon: "🤝", description: "Two companies, one you.", shifts: 14, rewardPerShiftSalary: 110, reputation: 450, skillId: "networking", skillXp: 400, levelRequired: 16 },
];
