export function money(n: number): string {
  const abs = Math.abs(n);
  let formatted: string;
  if (abs >= 1_000_000_000) formatted = (n / 1_000_000_000).toFixed(2) + "B";
  else if (abs >= 1_000_000) formatted = (n / 1_000_000).toFixed(2) + "M";
  else if (abs >= 10_000) formatted = (n / 1_000).toFixed(1) + "K";
  else formatted = n.toFixed(0);
  return "$" + formatted;
}

export function pct(n: number, digits = 1): string {
  return (n >= 0 ? "+" : "") + n.toFixed(digits) + "%";
}

export function shortNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toFixed(0);
}
