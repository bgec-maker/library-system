import type { Page, Route } from '@playwright/test';

// todo/27 — services/api.ts의 doPost 계약({ok:true,data,error:null} | {ok:false,data:null,error})을
// 그대로 흉내 내는 목 백엔드. 실제 GAS 배포는 절대 건드리지 않는다(school-patch-v1/Code.gs 무관) —
// SessionGate에 이 URL(MOCK_API_URL)을 입력해 두면 앱의 모든 fetch()가 이 라우트로만 간다.
//
// 명시적으로 다루는 액션만 성공 응답을 준다(체크아웃·반납·조회·등록·카탈로그·리포트 — 이 스위트가
// 실제로 exercise하는 흐름). 그 외(대시보드·예약·수기입력 미처리·viz 등, 셸 부팅 시 백그라운드로
// 함께 호출되는 액션들)는 UNKNOWN_ACTION을 돌려준다 — 이건 "안 만든 목"이 아니라 이 앱 전체가
// 이미 일관되게 지원하는 "재배포 전" 계약(services/dashboardData.ts 등 여러 곳의 UNKNOWN_ACTION→
// 샘플 폴백 주석 참고)이라 콘솔 에러 없이 샘플 데이터로 조용히 대체된다. 라우트 패턴이 이 URL로
// 가는 요청을 전부 가로채므로(모든 action) 실제 네트워크로 새는 요청은 없다 — 미지원 action도
// "처리되지 않고 방치"되는 게 아니라 이 catch-all이 명시적으로 응답한다.
export const MOCK_API_URL = 'https://mock.example.com/exec';

export const CHECKOUT_BARCODE = '0001230';
export const CHECKOUT_STUDENT_CODE = '1001';
export const REGISTER_ISBN = '9788936433598';
export const REGISTER_BARCODE = '9009001';

export interface CatalogRow {
  copyId: string;
  barcode: string;
  titleId: string;
  title: string;
  authors: string;
  classification: string;
  statusCode: string;
  loanCount: number;
  lastLoanAt: string;
  shelfCode: string;
  acquiredAt: string;
  updatedAt: string;
}

// 등록 순서 그대로가 초기(미정렬) 표시 순서다(services/catalog.ts: Map 삽입 순서 보존) — 서명
// 알파벳 오름차순이 아니게 일부러 섞어서, "서명" 열 정렬 클릭이 실제로 행 순서를 바꾸는지
// 의미 있게 검증할 수 있게 한다. 한글이 아니라 ASCII 제목을 쓰는 이유는 이 값이 i18n 문자열이
// 아니라 임의 데이터이기 때문 — localeCompare 결과가 플랫폼·로케일에 흔들리지 않게 한다.
export const CATALOG_ROWS: CatalogRow[] = [
  {
    // todo/115 — 바코드는 Luhn 유효값이어야 한다(6자리 base+체크 1자리, scanBus가 검증):
    // 체크섬 위반 목 데이터는 스캔 주입이 분류 단계에서 조용히 탈락해 점검 세션 같은
    // 스캔 소비 흐름이 e2e 시야 밖이 된다(실제로 그랬다 — inventory.spec의 존재 이유).
    copyId: 'copy-zebra', barcode: '2000008', titleId: 'title-zebra', title: 'Zebra Tales',
    authors: 'Author Z', classification: '800', statusCode: 'AVAILABLE', loanCount: 3,
    lastLoanAt: '2026-06-01', shelfCode: 'A1', acquiredAt: '2024-01-01', updatedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    copyId: 'copy-apple', barcode: '2000016', titleId: 'title-apple', title: 'Apple Season',
    authors: 'Author A', classification: '800', statusCode: 'AVAILABLE', loanCount: 1,
    lastLoanAt: '2026-05-01', shelfCode: 'A2', acquiredAt: '2024-02-01', updatedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    copyId: 'copy-mango', barcode: '2000024', titleId: 'title-mango', title: 'Mango Grove',
    authors: 'Author M', classification: '800', statusCode: 'ON_LOAN', loanCount: 5,
    lastLoanAt: '2026-04-01', shelfCode: 'A3', acquiredAt: '2024-03-01', updatedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    copyId: 'copy-banana', barcode: '2000032', titleId: 'title-banana', title: 'Banana Republic',
    authors: 'Author B', classification: '800', statusCode: 'AVAILABLE', loanCount: 2,
    lastLoanAt: '2026-03-01', shelfCode: 'A4', acquiredAt: '2024-04-01', updatedAt: '2026-01-01T00:00:00.000Z'
  }
];

// todo/126 — 학생 관리 목 명단. ★가짜 이름만 쓴다: 실학생 이름·생년은 공개 레포에 절대 넣지
// 않는다(아동 PII — 난민학교라 더더욱). 이름 반(LOVE/HOPE/FAITH) + 출생연도 혼합 + 상태 다양성
// (재학 3·졸업 1)으로 필터·정렬 계약을 검증할 수 있는 최소 구성.
export const MEMBER_CLASSES = [
  { code: 'LOVE', label: 'Love' },
  { code: 'HOPE', label: 'Hope' },
  { code: 'FAITH', label: 'Faith' }
];

export interface MockMember {
  memberId: string;
  memberNo: string;
  name: string;
  classNo: string;
  classCode: string;
  classLabel: string;
  grade: '';
  birthYear: number | '';
  memberTypeCode: string;
  statusCode: string;
  note: string;
  openLoans: number;
}

export function makeMockMembers(): MockMember[] {
  return [
    { memberId: 'mem-ari', memberNo: '0000001', name: 'Mock Ari', classNo: 'LOVE', classCode: 'LOVE', classLabel: 'Love', grade: '', birthYear: 2021, memberTypeCode: 'STUDENT', statusCode: 'ACTIVE', note: '', openLoans: 0 },
    { memberId: 'mem-bora', memberNo: '0000002', name: 'Mock Bora', classNo: 'HOPE', classCode: 'HOPE', classLabel: 'Hope', grade: '', birthYear: 2018, memberTypeCode: 'STUDENT', statusCode: 'ACTIVE', note: '', openLoans: 1 },
    { memberId: 'mem-chan', memberNo: '0000003', name: 'Mock Chan', classNo: 'HOPE', classCode: 'HOPE', classLabel: 'Hope', grade: '', birthYear: 2019, memberTypeCode: 'STUDENT', statusCode: 'ACTIVE', note: '', openLoans: 0 },
    { memberId: 'mem-dana', memberNo: '0000004', name: 'Mock Dana', classNo: 'FAITH', classCode: 'FAITH', classLabel: 'Faith', grade: '', birthYear: 2014, memberTypeCode: 'STUDENT', statusCode: 'GRADUATED', note: '', openLoans: 0 }
  ];
}

function ok<T>(data: T) {
  return { ok: true, data, error: null };
}

function fail(code: string, message = code) {
  return { ok: false, data: null, error: { code, message } };
}

function jsonResponse(body: unknown) {
  return { status: 200, contentType: 'application/json', body: JSON.stringify(body) };
}

function extractAction(route: Route): { action: string; payload: Record<string, unknown> } {
  const request = route.request();
  if (request.method() === 'POST') {
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(request.postData() ?? '{}');
    } catch {
      payload = {};
    }
    return { action: String(payload.action ?? ''), payload };
  }
  // READ_ONLY_ACTIONS의 GET 재시도 경로(services/api.ts) — POST가 실제로 실패했을 때만 쓰이므로
  // 이 목에서는 이론상 도달하지 않지만, "방치된 요청 없음"을 위해 형태만 맞춰 처리해 둔다.
  const url = new URL(request.url());
  const payload: Record<string, unknown> = {};
  url.searchParams.forEach((value, key) => {
    payload[key] = value;
  });
  return { action: String(payload.action ?? ''), payload };
}

/** 체크아웃 대상 소장본의 대출 상태 — 시나리오(대출→반납)가 순서대로 흘러가도록 이 목만의
 *  최소 상태를 하나 들고 있는다(실제 시트 대신 이 함수 호출 사이 클로저가 "진실"이다). */
export async function installApiMock(page: Page): Promise<void> {
  let loaned = false;
  const mockMembers = makeMockMembers(); // todo/126 — 호출 간 클로저가 진실(등록/수정이 이 배열을 변이)
  // todo/127 — memberRegister 멱등: 같은 requestId 재호출은 같은 응답(executeWrite_ 계약).
  const memberRegisterByRequest = new Map<string, { memberId: string; memberNo: string; name: string }>();

  await page.route(`${MOCK_API_URL}**`, async (route) => {
    const { action, payload } = extractAction(route);

    switch (action) {
      case 'copyStatus': {
        const barcode = String(payload.copyKey ?? '');
        const body = loaned
          ? ok({
              copyId: 'copy-e2e', barcode, statusCode: 'ON_LOAN', title: 'E2E Test Book',
              titleStatusCode: 'ACTIVE', onLoan: true, loanId: 'loan-e2e-1', dueAt: '2026-07-22',
              memberNo: CHECKOUT_STUDENT_CODE, memberName: 'E2E Student'
            })
          : ok({
              copyId: 'copy-e2e', barcode, statusCode: 'AVAILABLE', title: 'E2E Test Book',
              titleStatusCode: 'ACTIVE', onLoan: false, loanId: '', dueAt: '',
              memberNo: '', memberName: ''
            });
        await route.fulfill(jsonResponse(body));
        return;
      }
      case 'checkout': {
        loaned = true;
        await route.fulfill(jsonResponse(ok({ memberName: 'E2E Student', dueAt: '2026-07-22' })));
        return;
      }
      case 'return': {
        loaned = false;
        await route.fulfill(jsonResponse(ok({})));
        return;
      }
      case 'lookupIsbn': {
        await route.fulfill(
          jsonResponse(
            ok({
              isbn: String(payload.isbn ?? REGISTER_ISBN),
              title: 'E2E New Title',
              subtitle: '',
              authors: 'E2E Author',
              publisher: 'E2E Press',
              publishedYear: '2024',
              pageCount: '180',
              coverUrl: '',
              source: 'ALADIN',
              isDuplicate: false
            })
          )
        );
        return;
      }
      case 'registerByIsbn': {
        await route.fulfill(
          jsonResponse(
            ok({
              titleId: 'title-e2e-new',
              barcodes: [REGISTER_BARCODE],
              title: String(payload.title ?? 'E2E New Title'),
              created: true,
              copyCount: Number(payload.copyCount ?? 1)
            })
          )
        );
        return;
      }
      case 'catalogSync': {
        await route.fulfill(
          jsonResponse(ok({ rows: CATALOG_ROWS, hasMore: false, serverTime: '2026-07-15T00:00:00.000Z', totalCopies: CATALOG_ROWS.length }))
        );
        return;
      }
      case 'report': {
        // todo/101 — 이 목은 type을 인식한다: 'no-loan-finder'(와이어 표기는 케밥 — 아래
        // 후속 수정 참고)만 실데이터 모양으로 응답하고, 나머지 type은 UNKNOWN_ACTION을
        // 돌려줘 각 패널이 자기 샘플 목(src/mocks/reports.ts)으로 폴백해 렌더되게 한다.
        // (교정 전엔 type 무관하게 미대출 모양만 줘서 담임 리포트 미리보기가 오류 경계로
        // 떨어졌다 — 시각 감사 3R 증빙. 실환경 계약(UNKNOWN_ACTION→샘플)과도 이쪽이 일치.)
        if (payload.type !== 'no-loan-finder') {
          await route.fulfill(jsonResponse(fail('UNKNOWN_ACTION', `e2e mock: report type "${String(payload.type ?? '(none)')}" not stubbed`)));
          return;
        }
        // NoLoanFinderReport 모양(services/reportData.ts) — 인쇄 스냅샷 스텝은 언어 토글 이후
        // 영어 로케일에서 실행되므로(순서: 카탈로그 정렬 → 언어 토글 → 인쇄 스냅샷) 여기 데이터도
        // 처음부터 ASCII만 써서, 로케일 전환과 무관하게(그리고 CI 러너의 한글 폰트 설치 여부와
        // 무관하게) 스크린샷 렌더링이 플랫폼에 흔들리지 않게 한다.
        await route.fulfill(
          jsonResponse(
            ok({
              libraryName: 'BGEC Library',
              generatedAt: '2026-07-15 09:00',
              sinceDate: '2026-04-15',
              totalCount: 2,
              classes: [
                {
                  grade: 1,
                  classNo: 1,
                  students: [
                    { memberNo: 'S1', name: 'Alex Kim', studentNo: 1 },
                    { memberNo: 'S2', name: 'Jordan Lee', studentNo: 2 }
                  ]
                }
              ]
            })
          )
        );
        return;
      }
      case 'memberList': {
        // 서버 계약(apiWebMemberList_): 웹앱은 status:'ALL' 한 번으로 다 받아 로컬 필터한다.
        // 목도 필터를 흉내 내지 않고 전량을 준다 — 필터 검증은 클라이언트 몫이 맞다.
        await route.fulfill(
          jsonResponse(
            ok({
              members: mockMembers,
              totalCount: mockMembers.length,
              classes: MEMBER_CLASSES,
              memberStatuses: [
                { code: 'ACTIVE', label: '재학' },
                { code: 'GRADUATED', label: '졸업' }
              ],
              birthYearReady: true
            })
          )
        );
        return;
      }
      case 'memberRegister': {
        const requestId = String(payload.requestId ?? '');
        const seen = memberRegisterByRequest.get(requestId);
        if (seen) {
          await route.fulfill(jsonResponse(ok({ ...seen, idempotent: true })));
          return;
        }
        const name = String(payload.name ?? '').trim();
        const classCode = String(payload.classNo ?? '').toUpperCase();
        if (!name) {
          await route.fulfill(jsonResponse(fail('VALIDATION_ERROR', '이름은(는) 필수입니다.')));
          return;
        }
        const cls = MEMBER_CLASSES.find((c) => c.code === classCode);
        if (!cls) {
          await route.fulfill(jsonResponse(fail('INVALID_CODE', `정의되지 않은 반입니다: ${classCode}`)));
          return;
        }
        const seq = mockMembers.length + 1;
        const created: MockMember = {
          memberId: `mem-new-${seq}`,
          memberNo: String(seq).padStart(7, '0'),
          name,
          classNo: cls.code,
          classCode: cls.code,
          classLabel: cls.label,
          grade: '',
          birthYear: payload.birthYear ? Number(payload.birthYear) : '',
          memberTypeCode: 'STUDENT',
          statusCode: 'ACTIVE',
          note: String(payload.note ?? ''),
          openLoans: 0
        };
        mockMembers.push(created);
        const result = { memberId: created.memberId, memberNo: created.memberNo, name: created.name };
        memberRegisterByRequest.set(requestId, result);
        await route.fulfill(jsonResponse(ok(result)));
        return;
      }
      case 'memberUpdate': {
        const key = String(payload.memberKey ?? '');
        const target = mockMembers.find((m) => m.memberNo === key || m.memberId === key);
        if (!target) {
          await route.fulfill(jsonResponse(fail('NOT_FOUND', `회원을 찾을 수 없습니다: ${key}`)));
          return;
        }
        if (payload.name) target.name = String(payload.name);
        if (payload.classNo) {
          const nextCode = String(payload.classNo).toUpperCase();
          const cls = MEMBER_CLASSES.find((c) => c.code === nextCode);
          if (!cls) {
            await route.fulfill(jsonResponse(fail('INVALID_CODE', `정의되지 않은 반입니다: ${nextCode}`)));
            return;
          }
          target.classNo = cls.code;
          target.classCode = cls.code;
          target.classLabel = cls.label;
        }
        if (payload.birthYear) target.birthYear = Number(payload.birthYear);
        if (payload.status) target.statusCode = String(payload.status);
        // 서버 updateMember_의 appendNote_ 계약과 동일 — note는 덮어쓰기가 아니라 덧붙이기
        if (payload.note) target.note = target.note ? `${target.note} · ${String(payload.note)}` : String(payload.note);
        await route.fulfill(
          jsonResponse(ok({ memberId: target.memberId, memberNo: target.memberNo, name: target.name, status: target.statusCode }))
        );
        return;
      }
      case 'classCodes': {
        await route.fulfill(jsonResponse(ok({ classes: MEMBER_CLASSES })));
        return;
      }
      default: {
        await route.fulfill(jsonResponse(fail('UNKNOWN_ACTION', `e2e mock: action "${action || '(none)'}" not stubbed`)));
      }
    }
  });
}
