/**
 * Utilidades para exportación segura de archivos CSV.
 * Protege contra inyección de fórmulas en hojas de cálculo (CWE-1236 / CSV Injection).
 */

/**
 * Neutraliza la inyección de fórmulas en hojas de cálculo.
 * Si un campo es de texto y comienza con '=', '+', '-', '@', '\t' o '\r',
 * se le antepone un apóstrofe (') para forzar su interpretación como texto literal en Excel/Calc.
 * Los valores numéricos puros y booleanos se conservan sin alteración.
 */
export function sanitizeCsvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number' || typeof v === 'boolean') {
    return String(v);
  }
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) {
    s = "'" + s;
  }
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Convierte una matriz de filas y columnas en una cadena CSV con BOM UTF-8 para soporte internacional en Excel.
 */
export function formatCsv(rows: unknown[][]): string {
  return '\uFEFF' + rows.map((r) => r.map(sanitizeCsvCell).join(',')).join('\n');
}

/**
 * Dispara la descarga de un archivo CSV en el navegador del usuario.
 */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
