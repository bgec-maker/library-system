// todo/42 — todo/32 CSV 수식 인젝션 방어 하네스의 정식판.
import { toCsvBlob } from '../../src/components/DataTable/csv';
import type { DataTableColumn } from '../../src/components/DataTable/types';

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  console.log('ok —', msg);
}

interface Row { title: string; n: number }
const cols = [
  { key: 'title', header: '서명' },
  { key: 'n', header: '수' }
] as DataTableColumn<Row>[];
const rows: Row[] = [
  { title: '=HYPERLINK("http://evil","x")', n: -5 },
  { title: '+SUM(A1:A9)', n: 3 },
  { title: '@cmd', n: -1.5 },
  { title: '정상 서명, 쉼표', n: 0 },
  { title: '-마이너스로 시작하는 서명', n: 7 }
];
const valueOf = (r: Row, c: DataTableColumn<Row>) => (r as unknown as Record<string, string | number>)[c.key];

(async () => {
  const txt = await toCsvBlob(cols, rows, valueOf).text();
  const lines = txt.split('\r\n').slice(1);
  assert(lines.every((l) => !/^[=+@]/.test(l) && !/,[=+@]/.test(l)), '수식 시작 셀 전부 무력화');
  assert(txt.includes(',-5') && txt.includes(',-1.5'), '음수·소수 데이터 무손상');
  assert(txt.includes("'-마이너스로"), '문자열 - 시작은 방어됨');
  assert(txt.includes('"정상 서명, 쉼표"'), '쉼표 인용 규칙 유지');
  console.log('csv ALL PASS');
})();

// todo/76 — 전체 컬럼 내보내기도 같은 defuse 경로를 지나는지: 표시 컬럼엔 없는 필드(note)에
// 수식 시작 값을 넣고 전체 컬럼 정의로 내보냈을 때 무력화되는지 단정.
{
  const fullCols = [
    { key: 'barcode', header: 'barcode' },
    { key: 'note', header: 'note' }
  ] as import('../../src/components/DataTable/types').DataTableColumn<{ barcode: string; note: string }>[];
  const rows = [{ barcode: '0001230', note: '=HYPERLINK("https://evil")' }];
  const blob = toCsvBlob(fullCols, rows, (row, col) => String((row as Record<string, unknown>)[col.key] ?? ''));
  const text = await blob.text();
  assert(text.includes(`'=HYPERLINK`), '전체 컬럼 경로에서도 수식 셀 무력화');
}
console.log('csv(todo/76) full-column defuse PASS');
