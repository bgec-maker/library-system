import type { IntegrityCheckResult, PolicyRow, SettingsOverview } from '../services/settingsData';

// 설정 뷰(todo/26) 목데이터 — dashboardData.ts/reportData.ts와 같은 UNKNOWN_ACTION 폴백 규약
// (settingsOverview/runIntegrityCheck 액션 배포 전에만 보인다). 값은 school-patch-v1/Code.gs가
// 실제로 검증 배열에 두는 코드(member_type_code: GENERAL/CHILD/STAFF, material_type_code: BOOK —
// 205·211행)와 실제 getConfig_ 호출부(SCHEMA_VERSION·LIBRARY_NAME·DEFAULT_POLICY_ID·
// BLOCK_CHECKOUT_WHEN_OVERDUE·OVERDUE_SUSPEND_MULTIPLIER·MAX_SEARCH_RESULTS·GRADUATION_GRADE)에
// 실제로 등장하는 키를 그대로 써서, 재배포 전에도 화면이 "그럴듯한" 데이터로 보이게 한다.

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
function fmtDateTime(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}
function fmtDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}
function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

const mockPolicies: PolicyRow[] = [
  {
    policyId: 'POL-0001',
    memberTypeCode: 'GENERAL',
    materialTypeCode: 'BOOK',
    loanDays: 14,
    maxOpenLoans: 3,
    maxRenewals: 2,
    renewalDays: 7,
    maxReservations: 3,
    holdDays: 3,
    overdueFeePerDay: 50,
    activeFromText: fmtDate(daysAgo(180)),
    activeToText: '',
    statusCode: 'ACTIVE',
    updatedAtText: fmtDateTime(daysAgo(30)),
    updatedBy: 'admin@school.kr'
  },
  {
    policyId: 'POL-0002',
    memberTypeCode: 'CHILD',
    materialTypeCode: 'BOOK',
    loanDays: 10,
    maxOpenLoans: 2,
    maxRenewals: 1,
    renewalDays: 7,
    maxReservations: 2,
    holdDays: 3,
    overdueFeePerDay: 0,
    activeFromText: fmtDate(daysAgo(180)),
    activeToText: '',
    statusCode: 'ACTIVE',
    updatedAtText: fmtDateTime(daysAgo(30)),
    updatedBy: 'admin@school.kr'
  },
  {
    policyId: 'POL-0003',
    memberTypeCode: 'STAFF',
    materialTypeCode: 'BOOK',
    loanDays: 30,
    maxOpenLoans: 5,
    maxRenewals: 3,
    renewalDays: 14,
    maxReservations: 5,
    holdDays: 5,
    overdueFeePerDay: 50,
    activeFromText: fmtDate(daysAgo(180)),
    activeToText: '',
    statusCode: 'ACTIVE',
    updatedAtText: fmtDateTime(daysAgo(30)),
    updatedBy: 'admin@school.kr'
  }
];

export const mockSettingsOverview: SettingsOverview = {
  policies: mockPolicies,
  config: [
    { settingKey: 'LIBRARY_NAME', settingValue: 'MVP 초등학교 도서관', valueType: 'STRING', description: '인쇄물·대시보드 머리에 쓰이는 학교 도서관 이름', updatedAtText: fmtDateTime(daysAgo(60)), updatedBy: 'admin@school.kr' },
    { settingKey: 'SCHEMA_VERSION', settingValue: '1.0.0', valueType: 'STRING', description: '스프레드시트 스키마 버전', updatedAtText: fmtDateTime(daysAgo(200)), updatedBy: 'admin@school.kr' },
    { settingKey: 'DEFAULT_POLICY_ID', settingValue: 'POL-0001', valueType: 'STRING', description: '정책 미지정 대출에 적용되는 기본 정책', updatedAtText: fmtDateTime(daysAgo(180)), updatedBy: 'admin@school.kr' },
    { settingKey: 'BLOCK_CHECKOUT_WHEN_OVERDUE', settingValue: 'TRUE', valueType: 'BOOLEAN', description: '연체 중인 회원의 추가 대출 차단 여부', updatedAtText: fmtDateTime(daysAgo(180)), updatedBy: 'admin@school.kr' },
    { settingKey: 'OVERDUE_SUSPEND_MULTIPLIER', settingValue: '1', valueType: 'NUMBER', description: '연체일수 대비 정지일수 배수', updatedAtText: fmtDateTime(daysAgo(120)), updatedBy: 'admin@school.kr' },
    { settingKey: 'MAX_SEARCH_RESULTS', settingValue: '50', valueType: 'NUMBER', description: '통합 검색 최대 결과 건수', updatedAtText: fmtDateTime(daysAgo(90)), updatedBy: 'admin@school.kr' },
    { settingKey: 'GRADUATION_GRADE', settingValue: '6', valueType: 'NUMBER', description: '연간 리셋 시 졸업 처리 기준 학년', updatedAtText: fmtDateTime(daysAgo(90)), updatedBy: 'admin@school.kr' }
  ],
  triggers: [
    { handlerFunction: 'dailyLibraryMaintenance', installed: true },
    { handlerFunction: 'dailyVizBatch', installed: true }
  ]
};

export const mockIntegrityCheckResult: IntegrityCheckResult = {
  checkedAt: fmtDateTime(daysAgo(0)),
  issueCount: 0,
  issues: [],
  truncated: false
};
