import type {
  CategoryTreemapData,
  ClassParticipationData,
  LoanHeatmapData,
  LoanTimeOfDayData,
  MonthlyLoanCurveData,
  OverdueFlowData,
  ReservationPressureData,
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
