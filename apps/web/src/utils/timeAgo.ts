export function timeAgo(ts: number | string | null | undefined): string {
  if (!ts) return '—';
  const diff = Date.now() - (typeof ts === 'number' ? ts : new Date(ts).getTime());
  const min = Math.round(diff / 60_000);
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ayer' : `hace ${d} días`;
}
