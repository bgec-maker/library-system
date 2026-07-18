import type { DataTableColumn } from './types';

// CSV는 전부 클라이언트에서 만든다("CSV 내보내기: 클라이언트 생성" — FRONTEND.md) — 백엔드 왕복 0.
//
// todo/32 수식 인젝션 방어: 서명·저자는 사용자 입력이다 — `=HYPERLINK(...)` 같은 값으로
// 시작하는 셀은 엑셀/시트가 수식으로 실행한다(OWASP CSV Injection). 값이 = + - @ 탭 CR로
// 시작하면 선행 작은따옴표로 무력화한다. 단 음수·소수 같은 순수 숫자 문자열("-5", "-1.5")은
// 데이터가 깨지지 않게 제외한다(수식이 될 수 없는 형태).
function defuseFormula(value: string): string {
  if (/^[=+\-@\t\r]/.test(value) && !/^-?\d+(?:[.,]\d+)?$/.test(value)) return `'${value}`;
  return value;
}

function csvEscape(value: string): string {
  const defused = defuseFormula(value);
  return /[",\n\r]/.test(defused) ? `"${defused.replace(/"/g, '""')}"` : defused;
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
