import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/** Merge Tailwind class names (shadcn/ui helper). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Gold price without currency symbol, e.g. 4124.17 -> "4,124.17". */
export function formatGoldPrice(price: number | null | undefined): string {
  return (price ?? 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** USD amount, e.g. 1490.9 -> "$1,490.90", -5 -> "-$5.00". */
export function formatUSD(value: number | null | undefined): string {
  const v = value ?? 0
  const abs = Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return v < 0 ? `-$${abs}` : `$${abs}`
}

/** Text color for a signed value: green up, red down. */
export function getValueColor(value: number): string {
  if (value > 0) return "text-success"
  if (value < 0) return "text-danger"
  return "text-muted-foreground"
}

/** Text color for a confidence percentage (0-100). */
export function getConfidenceColor(percent: number): string {
  if (percent >= 70) return "text-success"
  if (percent >= 55) return "text-warning"
  return "text-danger"
}

/** Text color for a trade signal: BUY green, SELL red, anything else muted. */
export function getSignalColor(signal: string | null | undefined): string {
  const s = (signal ?? "").toUpperCase()
  if (s.includes("BUY")) return "text-success"
  if (s.includes("SELL")) return "text-danger"
  return "text-muted-foreground"
}
