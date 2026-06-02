export const ACCENT_COLORS = [
  "orange",
  "coral",
  "amber",
  "emerald",
  "teal",
  "blue",
  "violet",
  "rose",
] as const;

export type AccentColor = (typeof ACCENT_COLORS)[number];

export const DEFAULT_ACCENT_COLOR: AccentColor = "orange";

export function isAccentColor(value: unknown): value is AccentColor {
  return (
    typeof value === "string" &&
    (ACCENT_COLORS as readonly string[]).includes(value)
  );
}
