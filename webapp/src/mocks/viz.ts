import type {
  BudgetPictureData,
  CategoryTreemapData,
  ClassParticipationData,
  CollectionAgeData,
  GradeReadingGapData,
  LoanHeatmapData,
  LoanTimeOfDayData,
  MonthlyLoanCurveData,
  OverdueFlowData,
  ReservationPressureData,
  ShelfHeatmapData,
  TurnoverQuadrantData
} from '../services/vizData';

// 「샘플 데이터」 폴백 — mocks/dashboard.ts·mocks/reports.ts와 같은 규약(todo/04·05). Code.gs가
// 아직 viz 액션을 모르는 배포(UNKNOWN_ACTION)이거나 일배치가 한 번도 안 돈 상태(VIZ_NOT_READY)일
// 때 services/vizData.ts가 이 객체들을 대신 내려주고, 화면은 components/SampleDataBadge.tsx로
// "이건 진짜 데이터가 아니다"를 알린다. mocks/는 views/**·shells/**·student/** 밖이라 ADR-023
// i18n 린트 대상이 아니다(카테고리명·서명은 데이터이지 UI 카피가 아니다).

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// #1 대출 잔디 샘플 — 오늘 기준 최근 365일. 평일 > 주말, 방학(7말~8월·1~2월) 골짜기를
// 흉내내는 결정론적 패턴(진짜 난수 대신 요일·월 기반 계산 — 매번 열어도 그럴듯하게 재현).
function buildMockLoanHeatmap(): LoanHeatmapData {
  const days: LoanHeatmapData['days'] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dow = d.getDay(); // 0=일 ... 6=토
    const month = d.getMonth(); // 0=1월
    const isVacation = month === 0 || month === 1 || month === 7; // 방학월 골짜기
    const isWeekend = dow === 0 || dow === 6;
    let base = isWeekend ? 1 : 9;
    if (isVacation) base = Math.round(base * 0.25);
    // 요일별로 약간의 굴곡(수요일 피크) — 순수 장식용, 실데이터가 아니므로 임의로 둬도 무방.
    const wiggle = [0, 1, 2, 3, 2, 1, 0][dow];
    const count = Math.max(0, base + wiggle - 2);
    days.push({ date: toDateKey(d), count });
  }
  return { days };
}

export const mockLoanHeatmap: LoanHeatmapData = buildMockLoanHeatmap();

// #3 장서 vs 대출 트리맵 샘플 — "많이 갖췄는데 안 나가는 분야"를 보여주도록 총류·역사는
// copyCount 대비 loanCount를 의도적으로 낮게 잡았다.
export const mockCategoryTreemap: CategoryTreemapData = {
  categories: [
    { categoryCode: '800', categoryLabel: '문학', copyCount: 1420, loanCount: 2380 },
    { categoryCode: '300', categoryLabel: '사회과학', copyCount: 860, loanCount: 640 },
    { categoryCode: '470', categoryLabel: '과학', copyCount: 610, loanCount: 590 },
    { categoryCode: '000', categoryLabel: '총류', copyCount: 540, loanCount: 90 },
    { categoryCode: '900', categoryLabel: '역사', copyCount: 480, loanCount: 120 },
    { categoryCode: '650', categoryLabel: '예술', copyCount: 410, loanCount: 350 },
    { categoryCode: '100', categoryLabel: '철학', copyCount: 260, loanCount: 70 },
    { categoryCode: '200', categoryLabel: '종교', copyCount: 140, loanCount: 30 }
  ]
};

// #6 회전율 사분면 샘플 — (대출횟수 버킷 6단) × (경과일 버킷 5단) 그리드. Code.gs
// computeTurnoverQuadrantViz_와 같은 라벨을 그대로 쓴다.
export const mockTurnoverQuadrant: TurnoverQuadrantData = {
  loanBuckets: ['0회', '1회', '2회', '3~5회', '6~10회', '11회+'],
  ageBuckets: ['90일 미만', '90일~1년', '1~2년', '2~4년', '4년 이상'],
  cells: [
    { loanBucketIndex: 5, ageBucketIndex: 0, count: 18 }, // 스타 — 신착인데 벌써 많이 나감
    { loanBucketIndex: 4, ageBucketIndex: 1, count: 64 },
    { loanBucketIndex: 3, ageBucketIndex: 1, count: 120 },
    { loanBucketIndex: 1, ageBucketIndex: 0, count: 140 }, // 신참 — 아직 판단 이름
    { loanBucketIndex: 2, ageBucketIndex: 0, count: 96 },
    { loanBucketIndex: 3, ageBucketIndex: 2, count: 210 },
    { loanBucketIndex: 2, ageBucketIndex: 2, count: 260 },
    { loanBucketIndex: 1, ageBucketIndex: 3, count: 340 }, // 잠자는 — 오래됐고 저회전
    { loanBucketIndex: 1, ageBucketIndex: 4, count: 260 },
    { loanBucketIndex: 0, ageBucketIndex: 3, count: 190 }, // 죽은 — 오래됐고 0회전
    { loanBucketIndex: 0, ageBucketIndex: 4, count: 310 },
    { loanBucketIndex: 0, ageBucketIndex: 2, count: 150 }
  ],
  totalCopies: 2158,
  skippedNoAcquiredDate: 12
};

// #7 예약 압력 샘플 — 현재 대기열이 있는 서명만.
export const mockReservationPressure: ReservationPressureData = {
  titles: [
    { titleId: 'T-0001', title: '불편한 편의점', queueLength: 7, trend: [0, 1, 1, 2, 3, 4] },
    { titleId: 'T-0002', title: '아몬드', queueLength: 4, trend: [1, 1, 0, 1, 2, 2] },
    { titleId: 'T-0003', title: '달러구트 꿈 백화점', queueLength: 3, trend: [0, 0, 1, 1, 1, 2] },
    { titleId: 'T-0004', title: '어린 왕자', queueLength: 2, trend: [0, 0, 0, 1, 1, 1] },
    { titleId: 'T-0005', title: '완득이', queueLength: 1, trend: [0, 0, 0, 0, 1, 1] }
  ]
};

// todo/18 — #2 하루의 파도 샘플. 점심(12~13시)·방과후(15~17시) 두 봉우리를 흉내낸 결정론적
// 패턴(등교 전·수업 중 시간대는 낮게).
function buildMockLoanTimeOfDay(): LoanTimeOfDayData {
  const shape = [0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 6, 14, 12, 5, 8, 10, 6, 2, 1, 0, 0, 0, 0];
  return { hours: shape.map((count, hour) => ({ hour, count })) };
}

export const mockLoanTimeOfDay: LoanTimeOfDayData = buildMockLoanTimeOfDay();

// todo/18 — #8 연체 흐름 샘플. 발생이 서서히 줄고 해소가 발생을 바짝 뒤쫓는(정책이 듣고 있는)
// 모양을 흉내낸다.
function buildMockOverdueFlow(): OverdueFlowData {
  const occurred = [22, 20, 21, 18, 17, 15, 14, 13, 11, 10, 9, 8];
  const resolved = [18, 19, 20, 17, 16, 15, 13, 12, 11, 9, 9, 8];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weeks = occurred.map((occurredCount, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (occurred.length - 1 - i) * 7);
    return { weekStart: toDateKey(d), occurredCount, resolvedCount: resolved[i] };
  });
  return { weeks };
}

export const mockOverdueFlow: OverdueFlowData = buildMockOverdueFlow();

// todo/18 — #10 반 참여 링 샘플. 2개 학년 × 3개 반, 참여도가 반마다 다르게 보이도록 무대출
// 비율을 의도적으로 흩어 놓았다.
export const mockClassParticipation: ClassParticipationData = {
  sinceDate: toDateKey(new Date(Date.now() - 90 * 86400000)),
  classes: [
    { grade: 1, classNo: 1, studentCount: 24, noLoanCount: 3, noLoanRatio: 3 / 24 },
    { grade: 1, classNo: 2, studentCount: 23, noLoanCount: 9, noLoanRatio: 9 / 23 },
    { grade: 1, classNo: 3, studentCount: 25, noLoanCount: 14, noLoanRatio: 14 / 25 },
    { grade: 2, classNo: 1, studentCount: 22, noLoanCount: 1, noLoanRatio: 1 / 22 },
    { grade: 2, classNo: 2, studentCount: 24, noLoanCount: 6, noLoanRatio: 6 / 24 },
    { grade: 2, classNo: 3, studentCount: 23, noLoanCount: 18, noLoanRatio: 18 / 23 }
  ]
};

// todo/18 — #12 열두 달 곡선 샘플. 3개년, 방학월(1·2·8월) 골짜기·개학월(3·9월) 산을 흉내낸
// 결정론적 패턴이며 해마다 전체 대출량이 조금씩 늘어나는 모양(최근 연도가 더 높게).
function buildMockMonthlyLoanCurve(): MonthlyLoanCurveData {
  const shape = [40, 55, 90, 80, 75, 70, 60, 20, 95, 85, 78, 35]; // 1~12월 기준 패턴
  const currentYear = new Date().getFullYear();
  const years = [2, 1, 0].map((yearsAgo, i) => {
    const scale = 1 + i * 0.12; // 오래된 해일수록 낮게(최근 해가 더 높게)
    return { year: currentYear - yearsAgo, months: shape.map((v) => Math.round(v * scale)) };
  });
  return { years };
}

export const mockMonthlyLoanCurve: MonthlyLoanCurveData = buildMockMonthlyLoanCurve();

// todo/19 — #4 서가 온도 샘플. 일부러 회전율이 아주 낮은 서가("만화-2"·"참고자료-1")를
// 섞어 "죽은 구역"이 눈에 띄게 했다.
export const mockShelfHeatmap: ShelfHeatmapData = {
  shelves: [
    { shelfCode: '과학-1', copyCount: 68, totalLoanCount: 142, avgLoansPerCopy: 142 / 68 },
    { shelfCode: '만화-1', copyCount: 40, totalLoanCount: 260, avgLoansPerCopy: 260 / 40 },
    { shelfCode: '만화-2', copyCount: 36, totalLoanCount: 9, avgLoansPerCopy: 9 / 36 },
    { shelfCode: '문학-1', copyCount: 92, totalLoanCount: 310, avgLoansPerCopy: 310 / 92 },
    { shelfCode: '문학-2', copyCount: 88, totalLoanCount: 205, avgLoansPerCopy: 205 / 88 },
    { shelfCode: '사회-1', copyCount: 54, totalLoanCount: 96, avgLoansPerCopy: 96 / 54 },
    { shelfCode: '역사-1', copyCount: 46, totalLoanCount: 34, avgLoansPerCopy: 34 / 46 },
    { shelfCode: '참고자료-1', copyCount: 30, totalLoanCount: 2, avgLoansPerCopy: 2 / 30 }
  ],
  skippedNoShelf: 5
};

// todo/19 — #5 장서 나이 샘플. 오래된 연도일수록 WITHDRAWN·LOST 비중이 커지는 모양(자연 감모)과
// staleUncheckedCount(1년 이상 미점검) 요약 숫자를 함께 흉내낸다.
export const mockCollectionAge: CollectionAgeData = {
  statusOrder: ['AVAILABLE', 'ON_LOAN', 'HOLD_READY', 'REPAIR', 'LOST', 'WITHDRAWN'],
  years: [
    { year: 2017, statusCounts: { AVAILABLE: 40, ON_LOAN: 5, HOLD_READY: 0, REPAIR: 2, LOST: 8, WITHDRAWN: 25 } },
    { year: 2018, statusCounts: { AVAILABLE: 55, ON_LOAN: 8, HOLD_READY: 1, REPAIR: 3, LOST: 6, WITHDRAWN: 15 } },
    { year: 2019, statusCounts: { AVAILABLE: 70, ON_LOAN: 10, HOLD_READY: 1, REPAIR: 2, LOST: 5, WITHDRAWN: 8 } },
    { year: 2020, statusCounts: { AVAILABLE: 60, ON_LOAN: 12, HOLD_READY: 0, REPAIR: 1, LOST: 3, WITHDRAWN: 4 } },
    { year: 2021, statusCounts: { AVAILABLE: 90, ON_LOAN: 18, HOLD_READY: 2, REPAIR: 2, LOST: 2, WITHDRAWN: 2 } },
    { year: 2022, statusCounts: { AVAILABLE: 110, ON_LOAN: 22, HOLD_READY: 1, REPAIR: 1, LOST: 1, WITHDRAWN: 1 } },
    { year: 2023, statusCounts: { AVAILABLE: 130, ON_LOAN: 26, HOLD_READY: 2, REPAIR: 1, LOST: 0, WITHDRAWN: 0 } },
    { year: 2024, statusCounts: { AVAILABLE: 150, ON_LOAN: 30, HOLD_READY: 1, REPAIR: 0, LOST: 0, WITHDRAWN: 0 } }
  ],
  skippedNoAcquiredDate: 4,
  staleInspectionDays: 365,
  staleUncheckedCount: 187
};

// todo/19 — #9 학년 독서 격차 샘플. 저학년일수록 0회 버킷 비중이 크고, 고학년으로 갈수록
// 11회+ 비중이 커지는 모양을 흉내낸다("어느 학년이 비어 있나"에 바로 답하는 대비).
export const mockGradeReadingGap: GradeReadingGapData = {
  sinceDate: toDateKey(new Date(Date.now() - 180 * 86400000)),
  windowDays: 180,
  buckets: ['0회', '1~3회', '4~10회', '11회+'],
  grades: [
    { grade: 1, studentCount: 90, bucketCounts: [40, 30, 15, 5] },
    { grade: 2, studentCount: 88, bucketCounts: [28, 32, 20, 8] },
    { grade: 3, studentCount: 95, bucketCounts: [18, 30, 32, 15] },
    { grade: 4, studentCount: 92, bucketCounts: [12, 25, 35, 20] },
    { grade: 5, studentCount: 86, bucketCounts: [8, 18, 34, 26] },
    { grade: 6, studentCount: 80, bucketCounts: [22, 20, 24, 14] }
  ]
};

// todo/19 — #11 예산 그림 샘플. 상위 5개 출처 + "그 외 출처" 계열, 연도별로 총 예산이 조금씩
// 늘어나는 모양(적층 영역이 위로 갈수록 두꺼워짐).
export const mockBudgetPicture: BudgetPictureData = {
  sourceOrder: ['도서관 예산(구매)', '학교 운영비', '학부모회 기증', '개인 기증', '외부 공모 지원', '그 외 출처'],
  years: [
    {
      year: 2021,
      total: 4200000,
      sources: [
        { sourceLabel: '도서관 예산(구매)', amount: 2200000 },
        { sourceLabel: '학교 운영비', amount: 900000 },
        { sourceLabel: '학부모회 기증', amount: 600000 },
        { sourceLabel: '개인 기증', amount: 300000 },
        { sourceLabel: '외부 공모 지원', amount: 0 },
        { sourceLabel: '그 외 출처', amount: 200000 }
      ]
    },
    {
      year: 2022,
      total: 4800000,
      sources: [
        { sourceLabel: '도서관 예산(구매)', amount: 2500000 },
        { sourceLabel: '학교 운영비', amount: 1000000 },
        { sourceLabel: '학부모회 기증', amount: 650000 },
        { sourceLabel: '개인 기증', amount: 350000 },
        { sourceLabel: '외부 공모 지원', amount: 100000 },
        { sourceLabel: '그 외 출처', amount: 200000 }
      ]
    },
    {
      year: 2023,
      total: 5300000,
      sources: [
        { sourceLabel: '도서관 예산(구매)', amount: 2700000 },
        { sourceLabel: '학교 운영비', amount: 1100000 },
        { sourceLabel: '학부모회 기증', amount: 700000 },
        { sourceLabel: '개인 기증', amount: 400000 },
        { sourceLabel: '외부 공모 지원', amount: 200000 },
        { sourceLabel: '그 외 출처', amount: 200000 }
      ]
    },
    {
      year: 2024,
      total: 5900000,
      sources: [
        { sourceLabel: '도서관 예산(구매)', amount: 3000000 },
        { sourceLabel: '학교 운영비', amount: 1150000 },
        { sourceLabel: '학부모회 기증', amount: 750000 },
        { sourceLabel: '개인 기증', amount: 450000 },
        { sourceLabel: '외부 공모 지원', amount: 300000 },
        { sourceLabel: '그 외 출처', amount: 250000 }
      ]
    },
    {
      year: 2025,
      total: 6400000,
      sources: [
        { sourceLabel: '도서관 예산(구매)', amount: 3200000 },
        { sourceLabel: '학교 운영비', amount: 1250000 },
        { sourceLabel: '학부모회 기증', amount: 800000 },
        { sourceLabel: '개인 기증', amount: 500000 },
        { sourceLabel: '외부 공모 지원', amount: 350000 },
        { sourceLabel: '그 외 출처', amount: 300000 }
      ]
    }
  ],
  skippedNoSource: 12,
  skippedNoAcquiredDate: 3
};
