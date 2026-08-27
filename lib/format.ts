const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** Formats an amount stored in paise (smallest INR unit) as a rupee string. */
export function formatPaise(paise: number): string {
  return inrFormatter.format(paise / 100);
}

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}
