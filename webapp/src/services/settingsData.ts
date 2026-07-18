import { apiCall, newRequestId } from './api';
import { cachedApiCall } from './readCache';
import { publishDataChange } from './dataChangeBus';
import { mockIntegrityCheckResult, mockSettingsOverview } from '../mocks/settings';

// 설정 뷰(todo/26) 데이터 계층 — school-patch-v1/Code.gs의 신규 액션 2개를 소비한다:
//   apiWebSettingsOverview_ — 읽기(13_POLICIES·17_CONFIG·트리거 설치 여부).
//     dashboardData.ts/reportData.ts와 같은 UNKNOWN_ACTION→샘플 폴백 규약(SampleDataBadge)을
//     따른다.
//   apiWebIntegrityCheck_ — 읽기(integrityCheck_() 그대로 반환, 상태 변경 없음). "실행" 버튼이지만
//     실제로는 조회일 뿐이라 이 역시 샘플 폴백 대상이다(사이드바 apiRunIntegrityCheck()와 동일한
//     함수를 재사용 — 결과가 배포 여부에 따라 달라질 이유가 없다).
//
// apiWebEnrichBibliographic_(action='enrichBibliographic')는 todo/17에서 이미 배포·wiring된
// 실제 쓰기 액션이다 — 이 파일은 새 서버 로직을 추가하지 않고 그 액션을 호출하는 첫 웹앱 UI만
// 제공한다. 쓰기이므로 CLAUDE.md 검증 원칙("가짜 성공 금지")에 따라 UNKNOWN_ACTION이어도 샘플로
// "성공한 척"하지 않는다 — reservationData.ts의 createReservation/cancelReservation과 같은
// ok/code/message 모양을 그대로 따른다.

export interface PolicyRow {
  policyId: string;
  memberTypeCode: string;
  materialTypeCode: string;
  loanDays: number;
  maxOpenLoans: number;
  maxRenewals: number;
  renewalDays: number;
  maxReservations: number;
  holdDays: number;
  overdueFeePerDay: number;
  /** yyyy-MM-dd, 없으면 빈 문자열(서버가 formatDate_로 이미 포맷) */
  activeFromText: string;
  activeToText: string;
  statusCode: string;
  /** yyyy-MM-dd HH:mm */
  updatedAtText: string;
  updatedBy: string;
}

export interface ConfigRow {
  settingKey: string;
  settingValue: string;
  valueType: string;
  description: string;
  updatedAtText: string;
  updatedBy: string;
}

export interface TriggerStatus {
  handlerFunction: string;
  installed: boolean;
}

export interface SettingsOverview {
  policies: PolicyRow[];
  config: ConfigRow[];
  triggers: TriggerStatus[];
}

export type SettingsOverviewOutcome = { ok: true; data: SettingsOverview; sample: boolean } | { ok: false; message: string };

export async function fetchSettingsOverview(): Promise<SettingsOverviewOutcome> {
  // todo/29: 정책·설정은 느리게 변한다 — 60초 캐시(무결성 점검 버튼은 캐시 없이 그대로).
  const res = await cachedApiCall<SettingsOverview>('settingsOverview', {}, 60000);
  if (res.ok) return { ok: true, data: res.data, sample: false };
  if (res.error.code === 'UNKNOWN_ACTION') {
    // 아직 settingsOverview 액션이 없는 배포(재배포 전) — 다른 읽기 화면과 같은 정상 상태.
    return { ok: true, data: mockSettingsOverview, sample: true };
  }
  return { ok: false, message: res.error.message || res.error.code };
}

export interface IntegrityIssue {
  code: string;
  sheet: string;
  row: number;
  message: string;
}

export interface IntegrityCheckResult {
  /** yyyy-MM-dd HH:mm */
  checkedAt: string;
  issueCount: number;
  issues: IntegrityIssue[];
  truncated: boolean;
}

export type IntegrityCheckOutcome = { ok: true; data: IntegrityCheckResult; sample: boolean } | { ok: false; message: string };

/** 무결성 점검 실행 — integrityCheck_()는 읽기 전용이라 실패해도 데이터에 영향이 없다. */
export async function runIntegrityCheck(): Promise<IntegrityCheckOutcome> {
  const res = await apiCall<IntegrityCheckResult>('runIntegrityCheck', {});
  if (res.ok) return { ok: true, data: res.data, sample: false };
  if (res.error.code === 'UNKNOWN_ACTION') {
    return { ok: true, data: mockIntegrityCheckResult, sample: true };
  }
  return { ok: false, message: res.error.message || res.error.code };
}

export interface EnrichBibliographicFailure {
  titleId: string;
  isbn: string;
  code: string;
  message: string;
}

export interface EnrichBibliographicResult {
  targetType: string;
  targetId: string;
  blankBeforeCount: number;
  processedCount: number;
  enrichedCount: number;
  skippedCacheHitCount: number;
  failedCount: number;
  remainingBlankCount: number;
  failures: EnrichBibliographicFailure[];
}

export type EnrichBibliographicOutcome = { ok: true; data: EnrichBibliographicResult } | { ok: false; code: string; message: string };

/** 서지 일괄 보강 실행(todo/17 액션을 그대로 호출) — 실제 쓰기(cover_url 갱신)이므로 샘플
 *  폴백이 없다. 성공하면 다른 화면(catalog·book-detail)도 새 cover_url을 보도록 알린다. */
export async function runBibliographicEnrichment(): Promise<EnrichBibliographicOutcome> {
  const res = await apiCall<EnrichBibliographicResult>('enrichBibliographic', { requestId: newRequestId() });
  if (res.ok) {
    publishDataChange();
    return { ok: true, data: res.data };
  }
  return { ok: false, code: res.error.code, message: res.error.message || res.error.code };
}
