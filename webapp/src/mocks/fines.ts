import type { UnpaidFineRow } from '../services/loanActionsData';

// 미변상(REPLACEMENT) 목록(todo/13) 목데이터 — dashboardData.ts/reportData.ts와 같은
// UNKNOWN_ACTION 폴백 규약(unpaidFines 액션 배포 전에만 보인다). mocks/titleDetail.ts의
// "아몬드"(T000231)에 추가한 LOST 소장본(C000454/barcode 0004514)을 그대로 가리켜, book-detail을
// 샘플 데이터로 열었을 때도 그 행에서 「변상」 버튼이 실제로 보이도록 한다(여러 목데이터 파일을
// 넘나들며 봐도 낯설지 않도록 — 의도적 재사용, mocks/reservations.ts 헤더 주석과 같은 관례).
function fmt(daysOffset: number): string {
  const d = new Date(Date.now() + daysOffset * 86400000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function mockUnpaidFines(): UnpaidFineRow[] {
  return [
    {
      fineId: 'FIN-000201',
      memberId: 'M-000101',
      memberNo: 'M-000101',
      memberName: '박지호',
      loanId: 'LON-000512',
      copyId: 'C000454',
      barcode: '0004514',
      titleId: 'T000231',
      title: '아몬드',
      amount: 15000,
      paidAmount: 0,
      remainingAmount: 15000,
      statusCode: 'UNPAID',
      assessedAt: fmt(-3)
    },
    {
      fineId: 'FIN-000188',
      memberId: 'M-000203',
      memberNo: 'M-000203',
      memberName: '김서연',
      loanId: 'LON-000440',
      copyId: 'C000512',
      barcode: '0004512',
      titleId: 'T000455',
      title: '완득이',
      amount: 12000,
      paidAmount: 6000,
      remainingAmount: 6000,
      statusCode: 'PARTIAL',
      assessedAt: fmt(-20)
    }
  ];
}
