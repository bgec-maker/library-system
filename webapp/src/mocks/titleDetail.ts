import type { TitleDetail, TitleDetailQuery } from '../services/titleDetail';

// book-detail(todo/11) 목데이터 — dashboardData.ts/reportData.ts와 같은 UNKNOWN_ACTION 폴백
// 규약(titleDetail 액션 배포 전에만 보인다). mocks/recentOps.ts가 이미 "아몬드"를 반복 등장시켜
// 왔으므로(대출·반납 표본) 같은 서명을 이어서 쓴다 — 여러 목데이터 파일을 넘나들며 봐도 낯설지
// 않도록(우연이 아니라 의도적 재사용).
function fmt(daysOffset: number): string {
  const d = new Date(Date.now() + daysOffset * 86400000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtDate(daysOffset: number): string {
  return fmt(daysOffset).slice(0, 10);
}

const MOCK_TITLE_ID = 'T000231';
const MOCK_COPIES = [
  { copyId: 'C000451', barcode: '0004511', statusCode: 'AVAILABLE', shelfCode: '813-KO-451', conditionCode: 'GOOD' },
  { copyId: 'C000452', barcode: '0004512', statusCode: 'ON_LOAN', shelfCode: '813-KO-452', conditionCode: 'GOOD' },
  { copyId: 'C000453', barcode: '0004513', statusCode: 'REPAIR', shelfCode: '813-KO-453', conditionCode: 'WORN' }
];

export function mockTitleDetail(query: TitleDetailQuery): TitleDetail {
  const titleId = query.titleId || MOCK_TITLE_ID;
  const requested = query.copyKey ? MOCK_COPIES.find((c) => c.barcode === query.copyKey || c.copyId === query.copyKey) : undefined;
  // 요청된 등록번호가 목록 밖이면(딥링크 테스트 등) 대출중인 소장본을 기본 포커스로 보여준다 —
  // "대출자·반납예정" 필드가 실제로 채워진 상태를 데모에서 바로 확인할 수 있도록.
  const focusCopy = requested ?? MOCK_COPIES[1];

  const copies = MOCK_COPIES.map((c) => ({
    copyId: c.copyId,
    barcode: c.barcode,
    statusCode: c.statusCode,
    shelfCode: c.shelfCode,
    conditionCode: c.conditionCode,
    acquiredAt: fmtDate(-620),
    onLoan: c.statusCode === 'ON_LOAN',
    dueAt: c.statusCode === 'ON_LOAN' ? fmt(3) : '',
    memberNo: c.statusCode === 'ON_LOAN' ? 'M-000101' : '',
    memberName: c.statusCode === 'ON_LOAN' ? '박지호' : ''
  }));

  return {
    titleId,
    isbn13: '9788936434267',
    title: '아몬드',
    subtitle: '',
    authors: '손원평',
    publisher: '창비',
    publishedYear: 2017,
    languageCode: 'KOR',
    materialTypeCode: 'BOOK',
    classification: '문학',
    description: '감정을 느끼지 못하는 소년 윤재의 성장을 그린 장편소설.',
    coverUrl: '',
    pageCount: 264,
    titleStatusCode: 'ACTIVE',
    focusCopyId: focusCopy.copyId,
    copies,
    loanHistory: [
      {
        loanId: 'LON-000512',
        barcode: '0004512',
        memberNo: 'M-000101',
        memberName: '박지호',
        checkedOutAt: fmt(-4),
        dueAt: fmt(3),
        returnedAt: '',
        statusCode: 'OPEN'
      },
      {
        loanId: 'LON-000498',
        barcode: '0004511',
        memberNo: 'M-000203',
        memberName: '김서연',
        checkedOutAt: fmt(-25),
        dueAt: fmt(-11),
        returnedAt: fmt(-11),
        statusCode: 'RETURNED'
      },
      {
        loanId: 'LON-000440',
        barcode: '0004512',
        memberNo: 'M-000305',
        memberName: '이하늘',
        checkedOutAt: fmt(-58),
        dueAt: fmt(-44),
        returnedAt: fmt(-46),
        statusCode: 'RETURNED'
      }
    ],
    reservations: {
      waitingCount: 2,
      readyCount: 0,
      items: [
        {
          reservationId: 'RSV-000091',
          memberNo: 'M-000412',
          memberName: '정유나',
          statusCode: 'WAITING',
          queueSeq: 1,
          requestedAt: fmt(-2),
          readyAt: '',
          pickupExpiresAt: ''
        },
        {
          reservationId: 'RSV-000092',
          memberNo: 'M-000418',
          memberName: '최민준',
          statusCode: 'WAITING',
          queueSeq: 2,
          requestedAt: fmt(-1),
          readyAt: '',
          pickupExpiresAt: ''
        }
      ]
    }
  };
}
