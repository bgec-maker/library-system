import { apiCall, type ApiResult } from './api';

// 학생(회원) 관리 데이터 서비스 — todo/126. 서버 계약은 school-patch-v1/Code.gs의
// apiWebMemberList_/apiWebMemberRegister_/apiWebMemberUpdate_/apiWebClassCodes_(todo/125).
//
// 필터·정렬·검색은 전부 로컬에서 한다(ADR-024와 같은 원칙 — 전교 수십 명 규모라 memberList를
// status:'ALL' 한 번으로 다 받아 두는 쪽이 왕복보다 싸다). 서버의 filter 파라미터는 규모가
// 커지는 미래를 위한 것이고 웹앱은 지금 쓰지 않는다.
//
// 캐시 없음(cachedApiCall 미사용) — 관리 화면은 "방금 등록한 학생이 바로 보인다"가 신뢰의
// 전부다. 60초 캐시가 그걸 깨면 사서는 등록이 실패했다고 읽는다.

export interface ClassCodeEntry {
  code: string;
  label: string;
}

export interface MemberRow {
  memberId: string;
  memberNo: string;
  name: string;
  /** 시트 원값(이름 반 학교면 코드 문자열, 숫자 반 학교면 숫자) */
  classNo: string | number;
  classCode: string;
  /** 코드북 라벨 폴백 포함(코드북에 없으면 원값 문자열) — 표시는 항상 이 값 */
  classLabel: string;
  grade: number | '';
  birthYear: number | '';
  memberTypeCode: string;
  statusCode: string;
  note: string;
  openLoans: number;
}

export interface MemberListData {
  members: MemberRow[];
  totalCount: number;
  classes: ClassCodeEntry[];
  memberStatuses: ClassCodeEntry[];
  /** 09_MEMBERS에 birth_year 열이 있는가 — 스키마 업그레이드(반·생년) 실행 여부 신호 */
  birthYearReady: boolean;
}

export type MemberListOutcome =
  | { ok: true; data: MemberListData }
  | { ok: false; unavailable: true }
  | { ok: false; unavailable?: false; message: string };

/** 재배포 전(UNKNOWN_ACTION)은 settingsData.fetchSchemaReport와 같은 unavailable 신호 —
 *  뷰가 샘플로 폴백하지 않고 "서버 업데이트 필요" 안내를 그린다(가짜 명단은 관리 화면에서
 *  샘플 대조표보다 더 위험하다 — 실학생과 혼동된다). */
export async function fetchMemberList(): Promise<MemberListOutcome> {
  const res = await apiCall<MemberListData>('memberList', { status: 'ALL' });
  if (res.ok) return { ok: true, data: res.data };
  if (res.error.code === 'UNKNOWN_ACTION') return { ok: false, unavailable: true };
  return { ok: false, message: res.error.message || res.error.code };
}

export interface RegisterMemberInput {
  requestId: string;
  name: string;
  classNo: string;
  birthYear?: number | '';
  note?: string;
}

export interface RegisterMemberResult {
  memberId: string;
  memberNo: string;
  name: string;
}

/** 등록 — 서버 registerMember_(학생 기본값 STUDENT, 반 필수·학년 선택은 todo/124 완화 계약).
 *  requestId 멱등은 executeWrite_가 보장(같은 ID 재호출 = 같은 응답, 중복 행 없음). */
export function registerMemberApi(input: RegisterMemberInput): Promise<ApiResult<RegisterMemberResult>> {
  return apiCall<RegisterMemberResult>('memberRegister', { ...input });
}

export interface UpdateMemberInput {
  requestId: string;
  /** member_no 또는 member_id — 서버 findMemberByKey_ 계약 */
  memberKey: string;
  name?: string;
  classNo?: string;
  birthYear?: number | '';
  status?: string;
  note?: string;
}

export interface UpdateMemberResult {
  memberId: string;
  memberNo: string;
  name: string;
  status: string;
}

export function updateMemberApi(input: UpdateMemberInput): Promise<ApiResult<UpdateMemberResult>> {
  return apiCall<UpdateMemberResult>('memberUpdate', { ...input });
}

export type ClassCodesOutcome =
  | { ok: true; classes: ClassCodeEntry[] }
  | { ok: false; unavailable: true }
  | { ok: false; unavailable?: false; message: string };

/** 반 코드 목록(가벼운 옵션 소스 — 담임 리포트 반 선택 등). 코드군이 비어 있으면 숫자 반
 *  학교라는 뜻이므로 호출측은 종전 숫자 입력 UI를 유지한다(이중 모드). */
export async function fetchClassCodes(): Promise<ClassCodesOutcome> {
  const res = await apiCall<{ classes: ClassCodeEntry[] }>('classCodes', {});
  if (res.ok) return { ok: true, classes: res.data.classes };
  if (res.error.code === 'UNKNOWN_ACTION') return { ok: false, unavailable: true };
  return { ok: false, message: res.error.message || res.error.code };
}
