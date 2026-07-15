// 공개 책 페이지(#/b/<barcode>, todo/20)가 school-patch-v1/Code.gs의 신규 doGet(e)을 부르기
// 위한 백엔드 URL 해석. 이 파일이 존재하는 이유(설계 배경은 docs/ASSUMPTIONS.md todo/20 참고):
//
// 사서 표면의 apiUrl(services/session.ts)은 register.html 흐름으로 "기기별로" localStorage에
// 저장된다 — 사서 폰을 등록한 사람만 아는 값이라, 책 QR을 처음 찍어보는 낯선 방문자·학생의
// 브라우저에는 애초에 존재하지 않는다. 그렇다고 student/**가 services/session.ts를 import하면
// StudentRoot.tsx가 이미 명시한 번들 격리 원칙(사서 셸·zustand 세션 스토어 미로딩, "로그인 방식은
// CLAUDE.md 🟡 미결"이라는 이유로 그 모듈을 일부러 피해온 관례)이 깨진다.
//
// 그래서 이 값은 두 단계로 해석한다:
//   1) 빌드 시 채워 넣는 상수 PUBLIC_GAS_EXEC_URL — 기본값은 빈 문자열. 실제 학교 도메인·GAS
//      배포 URL은 CLAUDE.md 🟡 "도메인"·"Code.gs 새 버전 배포"가 아직 사용자 결정 대기 상태라
//      이 라운드에서 하드코딩하지 않는다 — 배포 담당자가 이 한 줄만 채우면 된다.
//   2) 로컬 스토리지 lib.session.apiUrl — services/session.ts를 import하지 않고 원시 키 이름만
//      재사용한다(zustand 스토어·그 의존성은 전혀 딸려오지 않는다, 문자열 하나를 읽는 것뿐).
//      이 프로젝트는 "1교 1시트" 단일 배포라 사서 기기에 이미 저장된 apiUrl과 공개 페이지가
//      불러야 할 URL이 사실상 같은 값이다 — 같은 브라우저로 사서 화면·공개 페이지를 둘 다 켜보는
//      로컬 테스트 편의용 폴백일 뿐, 실제 방문자(다른 사람 폰)에는 이 값이 없다.
//
// (1)이 채워지기 전까지 공개 페이지는 항상 샘플 데이터 + SampleDataBadge로 렌더된다
// (services/publicBookData.ts) — "배포 전 = 샘플" 관례를 그대로 따른다, 하드 실패가 아니다.
const SESSION_API_URL_KEY = 'lib.session.apiUrl';

/** 배포 시 이 값만 채우면 된다 — 비워두면 공개 페이지는 항상 샘플 데이터로 렌더된다. */
export const PUBLIC_GAS_EXEC_URL = '';

export function resolvePublicGasUrl(): string {
  if (PUBLIC_GAS_EXEC_URL) return PUBLIC_GAS_EXEC_URL;
  try {
    return localStorage.getItem(SESSION_API_URL_KEY) ?? '';
  } catch {
    // localStorage 접근 불가(사생활 모드 등) — 빈 문자열로 폴백, 샘플 데이터로 처리된다.
    return '';
  }
}
