/** Sort order: Common (0) → Rare (1) → Ultra Rare (2) → unknown (3) */
export function rarityOrder(rate: number | null): number {
  if (rate === null) return 3;
  if (rate > 50) return 0;
  if (rate > 15) return 1;
  return 2;
}

/** "Common (54.2%)" style label for trophy list table */
export function rarityLabel(rate: number | null): string {
  if (rate === null) return "";
  if (rate > 50) return `Common (${rate.toFixed(1)}%)`;
  if (rate > 15) return `Rare (${rate.toFixed(1)}%)`;
  return `Ultra Rare (${rate.toFixed(1)}%)`;
}

/** "`Common 54%`" style tag for suggest output */
export function rarityTag(rate: number | null): string {
  if (rate === null) return "";
  if (rate > 50) return ` \`Common ${rate.toFixed(0)}%\``;
  if (rate > 15) return ` \`Rare ${rate.toFixed(0)}%\``;
  return ` \`Ultra Rare ${rate.toFixed(0)}%\``;
}
