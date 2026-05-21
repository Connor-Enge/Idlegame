// Robinhood's signature palette, scoped to the investing experience so it can
// diverge from the app's casino-yellow accent.
export const RH_GREEN = "#00c805";
export const RH_RED = "#ff5000";
export const RH_GOLD = "#e3b341";

export function trendColor(up: boolean): string {
  return up ? RH_GREEN : RH_RED;
}

export interface Period {
  id: string;
  label: string;
  points: number; // how many trailing history points this window shows
}

export const PRICE_PERIODS: Period[] = [
  { id: "live", label: "LIVE", points: 24 },
  { id: "1h", label: "1H", points: 48 },
  { id: "1d", label: "1D", points: 96 },
  { id: "1w", label: "1W", points: 140 },
  { id: "all", label: "ALL", points: Infinity },
];
