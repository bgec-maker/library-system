import type {
  AnnualOperationsReport,
  DonorThanksReport,
  HomeroomReport,
  NoLoanFinderReport,
  RecallNoticeReport,
  WeedingRecommendReport
} from '../services/reportData';

// 「샘플 데이터」 폴백 — mocks/dashboard.ts와 같은 규약(todo/04). Code.gs가 아직 report 액션을
// 모르는 배포(UNKNOWN_ACTION)일 때 services/reportData.ts가 이 객체들을 대신 내려주고, 화면은
// components/SampleDataBadge.tsx로 "이건 진짜 데이터가 아니다"를 알린다.
//
// 여기 담긴 학생 이름·책 제목은 UI 카피가 아니라 데이터(진짜 배포에서 시트가 채울 값과 같은 자리)
// 이므로 ADR-023 i18n 리터럴 금지 대상이 아니다 — mocks/는 애초에 그 린트가 보는
// views/**·shells/**·student/** 밖이다.
export const mockNoLoanFinderReport: NoLoanFinderReport = {
  libraryName: 'BGEC 도서관 (샘플)',
  generatedAt: '2026-07-15 09:00',
  sinceDate: '2026-04-15',
  totalCount: 7,
  classes: [
    {
      grade: 1,
      classNo: 2,
      students: [
        { memberNo: '10203', name: '박지호', studentNo: 3 },
        { memberNo: '10207', name: '이수민', studentNo: 7 }
      ]
    },
    {
      grade: 2,
      classNo: 1,
      students: [
        { memberNo: '20101', name: '김도윤', studentNo: 1 },
        { memberNo: '20112', name: '최하은', studentNo: 12 },
        { memberNo: '20119', name: '정민준', studentNo: 19 }
      ]
    },
    {
      grade: 3,
      classNo: 4,
      students: [
        { memberNo: '30405', name: '오서연', studentNo: 5 },
        { memberNo: '30409', name: '한지우', studentNo: 9 }
      ]
    }
  ]
};

export const mockHomeroomReport: HomeroomReport = {
  libraryName: 'BGEC 도서관 (샘플)',
  generatedAt: '2026-07-15 09:00',
  grade: 2,
  classNo: 1,
  month: '2026-07',
  studentCount: 5,
  loanStatus: [
    { memberNo: '20101', name: '김도윤', studentNo: 1, loanCount: 2 },
    { memberNo: '20105', name: '서지안', studentNo: 5, loanCount: 0 },
    { memberNo: '20112', name: '최하은', studentNo: 12, loanCount: 1 },
    { memberNo: '20115', name: '강태오', studentNo: 15, loanCount: 3 },
    { memberNo: '20119', name: '정민준', studentNo: 19, loanCount: 0 }
  ],
  noLoanList: [
    { memberNo: '20105', name: '서지안', studentNo: 5, loanCount: 0 },
    { memberNo: '20119', name: '정민준', studentNo: 19, loanCount: 0 }
  ],
  overdueList: [{ memberNo: '20112', name: '최하은', title: '완득이', dueAtText: '2026-07-08', overdueDays: 7 }],
  popularBooks: [
    { title: '아몬드', loanCount: 3 },
    { title: '어린 왕자', loanCount: 2 },
    { title: '해리 포터와 마법사의 돌', loanCount: 1 }
  ]
};

export const mockWeedingRecommendReport: WeedingRecommendReport = {
  libraryName: 'BGEC 도서관 (샘플)',
  generatedAt: '2026-07-15 09:00',
  minAgeYears: 2,
  weedingCandidates: [
    { copyId: 'CPY-0142', barcode: '0000142', title: '1998년 컴퓨터 상식', author: '김철수', shelfCode: 'A-3', acquiredAtText: '2019-03-12' },
    { copyId: 'CPY-0198', barcode: '0000198', title: '오래된 위인전 전집 3권', author: '박영희', shelfCode: 'B-1', acquiredAtText: '2020-09-01' },
    { copyId: 'CPY-0231', barcode: '0000231', title: '낡은 백과사전', author: '이민호', shelfCode: 'C-2', acquiredAtText: '2021-05-20' }
  ],
  purchaseCandidates: [
    { titleId: 'TTL-2001', title: '아몬드', queueLength: 5, copyCount: 1, ratio: 5 },
    { titleId: 'TTL-2002', title: '어린 왕자', queueLength: 3, copyCount: 2, ratio: 1.5 },
    { titleId: 'TTL-2003', title: '해리 포터와 마법사의 돌', queueLength: 4, copyCount: 3, ratio: 1.33 }
  ]
};

export const mockRecallNoticeReport: RecallNoticeReport = {
  libraryName: 'BGEC 도서관 (샘플)',
  generatedAt: '2026-07-15 09:00',
  asOfDate: '2026-07-15',
  totalCount: 5,
  classes: [
    {
      grade: 1,
      classNo: 2,
      items: [
        { studentNo: 3, name: '박지호', title: '아기 돼지 삼형제', dueAtText: '2026-06-20', overdueDays: 25 },
        { studentNo: 7, name: '이수민', title: '구름빵', dueAtText: '2026-07-01', overdueDays: 14 }
      ]
    },
    {
      grade: 2,
      classNo: 1,
      items: [{ studentNo: 12, name: '최하은', title: '완득이', dueAtText: '2026-07-08', overdueDays: 7 }]
    },
    {
      grade: 3,
      classNo: 4,
      items: [
        { studentNo: 5, name: '오서연', title: '어린 왕자', dueAtText: '2026-06-25', overdueDays: 20 },
        { studentNo: 9, name: '한지우', title: '해리 포터와 마법사의 돌', dueAtText: '2026-06-30', overdueDays: 15 }
      ]
    }
  ]
};

export const mockDonorThanksReport: DonorThanksReport = {
  libraryName: 'BGEC 도서관 (샘플)',
  generatedAt: '2026-07-15 09:00',
  donorGroups: [
    {
      sourceLabel: '기증-학부모회',
      totalPrice: 84000,
      items: [
        { copyId: 'CPY-0301', title: '아몬드', price: 13000, acquiredAtText: '2026-03-02' },
        { copyId: 'CPY-0302', title: '어린 왕자', price: 12000, acquiredAtText: '2026-03-02' },
        { copyId: 'CPY-0303', title: '해리 포터와 마법사의 돌', price: 15800, acquiredAtText: '2026-03-02' }
      ]
    },
    {
      sourceLabel: '기증-졸업생 홍길동',
      totalPrice: 27000,
      items: [{ copyId: 'CPY-0310', title: '구름빵', price: 27000, acquiredAtText: '2026-02-14' }]
    }
  ],
  skippedNoSource: 12
};

// R3 연간 운영 보고서(todo/24) — 완결된 한 해(2025년)를 기본 샘플로 든다(진행 중인 해보다
// "제출용 연간 보고서"라는 성격에 더 잘 맞는 예시). 12개월 전부 값이 있어야 인쇄 화면에서
// 월별 표/예산 차트가 비어 보이지 않는다.
export const mockAnnualOperationsReport: AnnualOperationsReport = {
  libraryName: 'BGEC 도서관 (샘플)',
  generatedAt: '2026-07-15 09:00',
  year: 2025,
  periodStartText: '2025-01-01',
  periodEndText: '2025-12-31',
  loanStats: {
    totalCount: 615,
    byMonth: [
      { month: '2025-01', count: 32 },
      { month: '2025-02', count: 40 },
      { month: '2025-03', count: 55 },
      { month: '2025-04', count: 48 },
      { month: '2025-05', count: 66 },
      { month: '2025-06', count: 70 },
      { month: '2025-07', count: 42 },
      { month: '2025-08', count: 50 },
      { month: '2025-09', count: 60 },
      { month: '2025-10', count: 58 },
      { month: '2025-11', count: 44 },
      { month: '2025-12', count: 50 }
    ]
  },
  collection: {
    startCount: 4820,
    endCount: 5000,
    acquiredInPeriodCount: 180,
    netChange: 180,
    skippedNoAcquiredDate: 3
  },
  budget: {
    sourceOrder: ['예산-도서관운영비', '기증-학부모회', '그 외 출처'],
    years: [
      {
        year: 2023,
        total: 1200000,
        sources: [
          { sourceLabel: '예산-도서관운영비', amount: 900000 },
          { sourceLabel: '기증-학부모회', amount: 200000 },
          { sourceLabel: '그 외 출처', amount: 100000 }
        ]
      },
      {
        year: 2024,
        total: 1500000,
        sources: [
          { sourceLabel: '예산-도서관운영비', amount: 1080000 },
          { sourceLabel: '기증-학부모회', amount: 280000 },
          { sourceLabel: '그 외 출처', amount: 140000 }
        ]
      },
      {
        year: 2025,
        total: 1800000,
        sources: [
          { sourceLabel: '예산-도서관운영비', amount: 1300000 },
          { sourceLabel: '기증-학부모회', amount: 350000 },
          { sourceLabel: '그 외 출처', amount: 150000 }
        ]
      }
    ],
    skippedNoSource: 5,
    skippedNoAcquiredDate: 2,
    periodAcquisitionTotal: 1800000
  },
  topLoans: [
    { title: '아몬드', loanCount: 28 },
    { title: '어린 왕자', loanCount: 24 },
    { title: '해리 포터와 마법사의 돌', loanCount: 21 },
    { title: '완득이', loanCount: 18 },
    { title: '구름빵', loanCount: 15 },
    { title: '아기 돼지 삼형제', loanCount: 12 },
    { title: '나무를 심은 사람', loanCount: 10 },
    { title: '마당을 나온 암탉', loanCount: 9 },
    { title: '괴물들이 사는 나라', loanCount: 7 },
    { title: '이상한 나라의 앨리스', loanCount: 6 }
  ],
  overdueSummary: {
    openOverdueCount: 9,
    unpaidFineAmount: 45000,
    unpaidFineCount: 3
  }
};
