/** Layout helpers for pool-managed card previews (gk-map often sizes after ancestor flex). */

export function measureMapHostLayout(host: HTMLElement): { width: number; height: number } {
  const self = host.getBoundingClientRect();
  if (self.width > 0 && self.height > 0) {
    return { width: self.width, height: self.height };
  }
  let node: HTMLElement | null = host.parentElement;
  for (let depth = 0; depth < 4 && node; depth += 1) {
    const rect = node.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return { width: rect.width, height: rect.height };
    }
    node = node.parentElement;
  }
  return { width: self.width, height: self.height };
}

export function applyMapHostLayoutFromAncestors(host: HTMLElement): void {
  const self = host.getBoundingClientRect();
  if (self.width > 0 && self.height > 0) return;
  const { width, height } = measureMapHostLayout(host);
  if (width <= 0 || height <= 0) return;
  host.style.display = host.style.display || 'block';
  host.style.width = '100%';
  host.style.height = '100%';
  host.style.minHeight = `${height}px`;
}