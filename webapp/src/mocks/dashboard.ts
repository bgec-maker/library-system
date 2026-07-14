import type { DashboardData } from '../services/dashboardData';

// 「샘플 데이터」 폴백 — todo/04 완료 조건. Code.gs가 아직 dashboard 액션을 모르는 배포일 때
// (UNKNOWN_ACTION) services/dashboardData.ts가 이 객체를 대신 내려주고, 화면은
// components/SampleDataBadge.tsx로 "이건 진짜 데이터가 아니다"를 알린다.
//
// 여기 담긴 회원 이름·서명은 UI 카피가 아니라 데이터(진짜 배포에서 시트가 채울 값과 같은 자리)
// 이므로 ADR-023 i18n 리터럴 금지 대상이 아니다 — 어차피 이 파일은 views/**·shells/**·student/**
// 밖(src/mocks/)이라 그 린트의 검사 범위에도 들지 않는다.
//
// school-patch-v1/Code.gs getDashboardData_()와 같은 포맷(yyyy-MM-dd HH:mm)으로 날짜 문자열을
// 만들되, 이 모듈이 "언제 열어봐도" 그럴듯하도록 오늘 날짜 기준 상대 오프셋으로 계산한다.
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function fmt(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function daysFromNow(days: number, hour = 15, minute = 0): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

const overdue6 = daysFromNow(-6);
const overdue2 = daysFromNow(-2);
const overdue1 = daysFromNow(-1);
const dueToday = daysFromNow(0);

export const mockDashboardData: DashboardData = {
  libraryName: 'BGEC 도서관 (샘플)',
  actorLabel: '샘플 사서',
  stats: {
    activeTitles: 4821,
    availableCopies: 3765,
    openLoans: 312,
    dueToday: 18,
    overdue: 9,
    activeReservations: 6,
    activeMembers: 587
  },
  dueItems: [
    { type: '연체', memberNo: '10203', memberName: '박지호', title: '아몬드', barcode: '0001234', dueAt: overdue6.getTime(), dueAtText: fmt(overdue6), overdueDays: 6 },
    { type: '연체', memberNo: '20115', memberName: '김서연', title: '완득이', barcode: '0004512', dueAt: overdue2.getTime(), dueAtText: fmt(overdue2), overdueDays: 2 },
    { type: '연체', memberNo: '30042', memberName: '이하늘', title: '채식주의자', barcode: '0007788', dueAt: overdue1.getTime(), dueAtText: fmt(overdue1), overdueDays: 1 },
    { type: '예정', memberNo: '10488', memberName: '최민준', title: '해리 포터와 마법사의 돌', barcode: '0002210', dueAt: dueToday.getTime(), dueAtText: fmt(dueToday), overdueDays: 0 },
    { type: '예정', memberNo: '20977', memberName: '정유나', title: '어린 왕자', barcode: '0000091', dueAt: dueToday.getTime(), dueAtText: fmt(dueToday), overdueDays: 0 }
  ],
  readyItems: [
    { memberNo: '30512', memberName: '한도윤', title: '나미야 잡화점의 기적', pickupExpires: daysFromNow(2).getTime(), pickupExpiresText: fmt(daysFromNow(2)) },
    { memberNo: '10771', memberName: '오지안', title: '반갑다 논리야', pickupExpires: daysFromNow(3).getTime(), pickupExpiresText: fmt(daysFromNow(3)) }
  ],
  refreshedAt: fmt(new Date())
};
