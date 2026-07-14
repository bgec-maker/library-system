import type { RecentOpRow } from '../services/recentOpsData';

// 「샘플 데이터」 폴백 — todo/08. Code.gs가 아직 recentOps 액션을 모르는 배포일 때
// (UNKNOWN_ACTION) services/recentOpsData.ts가 이 배열을 대신 내려주고, 화면은
// components/SampleDataBadge.tsx로 알린다. 회원 이름·서명이 아니라 감사 로그 형태(action_code
// 등)라 ADR-023 i18n 리터럴 금지 대상이 아니다 — mocks/dashboard.ts와 같은 이유(views/**·
// shells/**·student/** 밖).
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function fmt(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60000);
}

interface MockEntry {
  minutesAgo: number;
  actionCode: string;
  entityType: string;
  entityId: string;
  summary: string;
  actorId: string;
}

const ENTRIES: MockEntry[] = [
  { minutesAgo: 4, actionCode: 'CHECKOUT', entityType: 'LOAN', entityId: 'LOAN-000512', summary: '아몬드 대출 — 박지호', actorId: 'STF-000001' },
  { minutesAgo: 11, actionCode: 'RETURN', entityType: 'LOAN', entityId: 'LOAN-000498', summary: '완득이 반납 — 김서연', actorId: 'STF-000001' },
  { minutesAgo: 26, actionCode: 'CHECKOUT', entityType: 'LOAN', entityId: 'LOAN-000511', summary: '어린 왕자 대출 — 정유나', actorId: 'STF-000002' },
  { minutesAgo: 47, actionCode: 'REGISTER_BY_ISBN', entityType: 'TITLE', entityId: 'T-000231', summary: '채식주의자 등록(복본 2)', actorId: 'STF-000001' },
  { minutesAgo: 63, actionCode: 'RENEW', entityType: 'LOAN', entityId: 'LOAN-000487', summary: '해리 포터와 마법사의 돌 연장 — 최민준', actorId: 'STF-000002' },
  { minutesAgo: 95, actionCode: 'RETURN', entityType: 'LOAN', entityId: 'LOAN-000480', summary: '나미야 잡화점의 기적 반납 — 한도윤', actorId: 'STF-000001' },
  { minutesAgo: 140, actionCode: 'RESERVE', entityType: 'RESERVATION', entityId: 'RSV-000045', summary: '반갑다 논리야 예약 — 오지안', actorId: 'STF-000002' },
  { minutesAgo: 182, actionCode: 'UPDATE_COPY_STATUS', entityType: 'COPY', entityId: 'C-004512', summary: '상태 변경 AVAILABLE → REPAIR', actorId: 'STF-000001' },
  { minutesAgo: 240, actionCode: 'CANCEL_RESERVATION', entityType: 'RESERVATION', entityId: 'RSV-000041', summary: '예약 취소 — 본인 요청', actorId: 'STF-000002' },
  { minutesAgo: 300, actionCode: 'MARK_LOAN_LOST', entityType: 'LOAN', entityId: 'LOAN-000455', summary: '분실 처리 — 변상 대기', actorId: 'STF-000001' },
  { minutesAgo: 365, actionCode: 'REGISTER_MEMBER', entityType: 'MEMBER', entityId: 'M-000602', summary: '신입 회원 등록 — 3학년 2반', actorId: 'STF-000001' },
  { minutesAgo: 420, actionCode: 'PAY_FINE', entityType: 'FINE', entityId: 'FINE-000012', summary: '변상금 납부 완료', actorId: 'STF-000002' },
  { minutesAgo: 500, actionCode: 'CHECKOUT', entityType: 'LOAN', entityId: 'LOAN-000440', summary: '어린 왕자 대출 — 이하늘', actorId: 'STF-000001' },
  { minutesAgo: 560, actionCode: 'RETURN', entityType: 'LOAN', entityId: 'LOAN-000432', summary: '아몬드 반납 — 박지호', actorId: 'STF-000002' },
  { minutesAgo: 700, actionCode: 'RECONCILE_COPY_STATUS', entityType: 'COPY', entityId: 'C-003301', summary: '장서점검 상태 정합 — AVAILABLE로 복원', actorId: 'SYSTEM' }
];

export const mockRecentOps: RecentOpRow[] = ENTRIES.map((entry, i) => ({
  logId: `LOG-${String(i + 1).padStart(6, '0')}`,
  occurredAt: fmt(minutesAgo(entry.minutesAgo)),
  actionCode: entry.actionCode,
  entityType: entry.entityType,
  entityId: entry.entityId,
  summary: entry.summary,
  actorId: entry.actorId
}));
