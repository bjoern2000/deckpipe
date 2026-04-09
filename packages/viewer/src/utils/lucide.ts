import iconNodes from 'lucide-static/icon-nodes.json';

const cache = new Map<string, string>();

/** Resolve a Lucide icon name (e.g. "clock", "message-square") to an SVG string. Returns null if not found. */
export function lucideIcon(name: string): string | null {
  const key = name.toLowerCase().trim();
  if (cache.has(key)) return cache.get(key)!;

  const nodes = (iconNodes as Record<string, [string, Record<string, string>][]>)[key];
  if (!nodes) return null;

  const inner = nodes
    .map(([tag, attrs]) => {
      const a = Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ');
      return `<${tag} ${a}/>`;
    })
    .join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  cache.set(key, svg);
  return svg;
}
