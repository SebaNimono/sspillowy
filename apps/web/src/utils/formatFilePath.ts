/** Quita prefijos temporales de clone Semgrep al mostrar hallazgos. */
export function formatFilePath(path?: string | null): string {
  if (!path) return '';
  const s = path.replace(/\\/g, '/');
  for (const marker of ['/repo/', '/vuln_sample/']) {
    if (s.includes(marker)) return s.split(marker).slice(1).join(marker);
  }
  if (s.includes('sspillowy-scan-')) {
    const parts = s.split('/');
    const idx = parts.indexOf('repo');
    if (idx >= 0) return parts.slice(idx + 1).join('/');
  }
  return s;
}
