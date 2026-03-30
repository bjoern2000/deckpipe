export function focalPointToObjectPosition(focus: { x: number; y: number } | null | undefined): string {
  if (!focus) return '50% 50%';
  return `${(focus.x * 100).toFixed(1)}% ${(focus.y * 100).toFixed(1)}%`;
}
