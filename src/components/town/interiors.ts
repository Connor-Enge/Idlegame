// Interior configs for every "step inside" building. The generic
// <Interior> component (Interior.tsx) renders any of these by reading
// floor/wall colours, accent lighting, the list of stations the player can
// walk up to, and the exit pad position. Each station gets a typed geometry
// so the casino feels different from the markets feels different from the
// real-estate showroom.

export type StationGeometry = "machine" | "desk" | "screen" | "cubicle" | "pedestal";

// Some stations can be played directly in 3D mode without routing to the full
// menu page. For now this is only the casino — pure-RNG games have no
// minigame component so a single button press = a single spin at a default
// wager. The menu page remains the deep / configurable surface; in-world is
// the casual quick-play surface.
export type StationAction =
  | { kind: "slots"; wager: number }
  | { kind: "coinflip"; wager: number; callHeads: boolean }
  | { kind: "dice"; wager: number; target: number }
  | { kind: "roulette"; wager: number; bet: "red" | "black" };

export interface Station {
  id: string;
  pos: [number, number];
  label: string;
  icon: string;
  color: string;
  geometry: StationGeometry;
  // Route to push when the player presses "Play / Open" on this station.
  // All current interiors route to a single feature page; future work could
  // deep-link to a specific game/asset via query params.
  route: string;
  // If set, the dev page fires this action in-world instead of routing.
  action?: StationAction;
}

export interface InteriorConfig {
  id: string; // matches the Spot.interior key
  title: string;
  floor: string;
  wall: string;
  pointLights: Array<{ pos: [number, number, number]; color: string; intensity?: number; distance?: number }>;
  ambient: number;
  stations: Station[];
  exitPos: [number, number];
  // Soft player bounds inside the room (xMin, xMax, zMin, zMax)
  bounds: [number, number, number, number];
}

// ---------------------------------------------------------------------------

export const CASINO: InteriorConfig = {
  id: "casino",
  title: "Casino",
  floor: "#7f1d1d",
  wall: "#1f2937",
  ambient: 0.3,
  pointLights: [
    { pos: [-8, 6, 0], color: "#fde047", intensity: 0.8, distance: 20 },
    { pos: [8, 6, 0], color: "#f97316", intensity: 0.8, distance: 20 },
    { pos: [0, 6, -4], color: "#a855f7", intensity: 0.9, distance: 18 },
  ],
  stations: [
    { id: "slots", pos: [-6, -4], label: "Slots", icon: "🎰", color: "#a16207", geometry: "machine", route: "/gambling", action: { kind: "slots", wager: 50 } },
    { id: "roulette", pos: [-3, -4], label: "Roulette (Red)", icon: "🎡", color: "#a16207", geometry: "machine", route: "/gambling", action: { kind: "roulette", wager: 50, bet: "red" } },
    { id: "blackjack", pos: [0, -4], label: "Blackjack", icon: "🃏", color: "#a16207", geometry: "machine", route: "/gambling" },
    { id: "dice", pos: [3, -4], label: "Dice (Under 50)", icon: "🎲", color: "#a16207", geometry: "machine", route: "/gambling", action: { kind: "dice", wager: 50, target: 50 } },
    { id: "coinflip", pos: [6, -4], label: "Coin Flip", icon: "🪙", color: "#a16207", geometry: "machine", route: "/gambling", action: { kind: "coinflip", wager: 50, callHeads: true } },
  ],
  exitPos: [0, 8],
  bounds: [-11, 11, -7, 11],
};

export const CAREER: InteriorConfig = {
  id: "career",
  title: "Career Office",
  floor: "#1e293b",
  wall: "#334155",
  ambient: 0.45,
  pointLights: [
    { pos: [-8, 5, 0], color: "#a3e635", intensity: 0.5, distance: 16 },
    { pos: [8, 5, 0], color: "#60a5fa", intensity: 0.5, distance: 16 },
  ],
  stations: [
    { id: "frontdesk", pos: [-6, -4], label: "Front Desk", icon: "📋", color: "#334155", geometry: "desk", route: "/jobs" },
    { id: "marketing", pos: [-2, -4], label: "Marketing", icon: "📣", color: "#334155", geometry: "desk", route: "/jobs" },
    { id: "engineering", pos: [2, -4], label: "Engineering", icon: "💻", color: "#334155", geometry: "desk", route: "/jobs" },
    { id: "finance", pos: [6, -4], label: "Finance", icon: "💼", color: "#334155", geometry: "desk", route: "/jobs" },
  ],
  exitPos: [0, 8],
  bounds: [-11, 11, -7, 11],
};

export const MARKETS: InteriorConfig = {
  id: "markets",
  title: "Markets Floor",
  floor: "#0f172a",
  wall: "#020617",
  ambient: 0.25,
  pointLights: [
    { pos: [0, 5, -5], color: "#22c55e", intensity: 1.2, distance: 22 },
    { pos: [-9, 4, 0], color: "#60a5fa", intensity: 0.6, distance: 14 },
    { pos: [9, 4, 0], color: "#60a5fa", intensity: 0.6, distance: 14 },
  ],
  stations: [
    { id: "tech", pos: [-7, -3], label: "Tech", icon: "💻", color: "#22c55e", geometry: "screen", route: "/invest" },
    { id: "crypto", pos: [-3, -3], label: "Crypto", icon: "₿", color: "#f59e0b", geometry: "screen", route: "/invest" },
    { id: "energy", pos: [1, -3], label: "Energy", icon: "🛢️", color: "#ef4444", geometry: "screen", route: "/invest" },
    { id: "finance", pos: [5, -3], label: "Finance", icon: "🏦", color: "#3b82f6", geometry: "screen", route: "/invest" },
    { id: "bonds", pos: [9, -3], label: "Bonds", icon: "🏛️", color: "#94a3b8", geometry: "screen", route: "/invest" },
  ],
  exitPos: [0, 8],
  bounds: [-11, 11, -6, 11],
};

export const BUSINESS: InteriorConfig = {
  id: "business",
  title: "Business HQ",
  floor: "#3b0764",
  wall: "#1e1b4b",
  ambient: 0.4,
  pointLights: [
    { pos: [-7, 5, -2], color: "#c4b5fd", intensity: 0.6, distance: 14 },
    { pos: [7, 5, -2], color: "#c4b5fd", intensity: 0.6, distance: 14 },
  ],
  stations: [
    { id: "food", pos: [-7, -3], label: "Food", icon: "🍔", color: "#a855f7", geometry: "cubicle", route: "/business" },
    { id: "tech", pos: [-3, -3], label: "Tech", icon: "💻", color: "#a855f7", geometry: "cubicle", route: "/business" },
    { id: "retail", pos: [1, -3], label: "Retail", icon: "🛒", color: "#a855f7", geometry: "cubicle", route: "/business" },
    { id: "entertain", pos: [5, -3], label: "Entertainment", icon: "🎬", color: "#a855f7", geometry: "cubicle", route: "/business" },
    { id: "holding", pos: [9, -3], label: "Holdings", icon: "🏛️", color: "#a855f7", geometry: "cubicle", route: "/business" },
  ],
  exitPos: [0, 8],
  bounds: [-11, 11, -6, 11],
};

export const REALESTATE: InteriorConfig = {
  id: "realestate",
  title: "Showroom",
  floor: "#7c2d12",
  wall: "#451a03",
  ambient: 0.5,
  pointLights: [
    { pos: [0, 5, 0], color: "#fef3c7", intensity: 0.8, distance: 18 },
    { pos: [-8, 4, -2], color: "#fbbf24", intensity: 0.5, distance: 12 },
    { pos: [8, 4, -2], color: "#fbbf24", intensity: 0.5, distance: 12 },
  ],
  stations: [
    { id: "house", pos: [-6, -3], label: "Suburban Home", icon: "🏠", color: "#f59e0b", geometry: "pedestal", route: "/realestate" },
    { id: "apt", pos: [-2, -3], label: "Apartment", icon: "🏢", color: "#f59e0b", geometry: "pedestal", route: "/realestate" },
    { id: "office", pos: [2, -3], label: "Office", icon: "🏬", color: "#f59e0b", geometry: "pedestal", route: "/realestate" },
    { id: "resort", pos: [6, -3], label: "Resort", icon: "🏝️", color: "#f59e0b", geometry: "pedestal", route: "/realestate" },
  ],
  exitPos: [0, 8],
  bounds: [-11, 11, -6, 11],
};

export const INTERIORS: Record<string, InteriorConfig> = {
  casino: CASINO,
  career: CAREER,
  markets: MARKETS,
  business: BUSINESS,
  realestate: REALESTATE,
};
