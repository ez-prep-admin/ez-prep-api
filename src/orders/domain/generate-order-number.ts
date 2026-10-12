export function generateOrderNumber(now: Date = new Date()): string {
  const time = now.getTime().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 36 ** 4)
    .toString(36)
    .toUpperCase()
    .padStart(4, '0');
  return `ORD-${time}-${rand}`;
}
