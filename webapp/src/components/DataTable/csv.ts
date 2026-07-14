import type { DataTableColumn } from './types';

// CSV는 전부 클라이언트에서 만든다("CSV 내보내기: 클라이언트 생성" — FRONTEND.md) — 백엔드 왕복 0.
function csvEscape(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsvBlob<T>(
  columns: DataTableColumn<T>[],
  rows: T[],
  valueOf: (row: T, column: DataTableColumn<T>) => string | number
): Blob {
  const header = columns.map((c) => csvEscape(c.header)).join(',');
  const lines = rows.map((row) => columns.map((c) => csvEscape(String(valueOf(row, c) ?? ''))).join(','));
  const csv = [header, ...lines].join('\r\n');
  // 선행 BOM(U+FEFF) — 엑셀이 UTF-8 CSV를 열 때 한글이 깨지지 않도록.
  return new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
