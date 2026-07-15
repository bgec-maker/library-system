import { resolvePublicGasUrl } from '../config/publicBackend';
import { mockPublicBookData } from '../mocks/publicBookData';

// 공개 책 페이지(#/b/<barcode>, todo/20) 데이터 계층 — school-patch-v1/Code.gs의 신규
// doGet(e)이 돌려주는 모양을 그대로 옮긴 타입이다. services/titleDetail.ts(사서 전용,
// doPost+토큰)와 자매 파일이지만 완전히 별도 경로다: apiCall()(POST+토큰, services/api.ts)을
// 재사용하지 않고 이 파일이 직접 GET을 부른다 — 토큰이 없는 게 이 표면의 핵심이다(아래 참고).
export type PublicBookAvailability = 'AVAILABLE' | 'ON_LOAN' | 'UNAVAILABLE';

export interface PublicBookData {
  barcode: string;
  title: string;
  subtitle: string;
  authors: string;
  publisher: string;
  coverUrl: string;
  /** 06_CATEGORIES.name_ko(대표 분류) — "권장학년" 데이터가 없어 대신 쓰는 값(문서 하단 참고). */
  classification: string;
  /** 21_BOOK_CACHE 최선노력 값 — 빈 문자열이면 정보 없음(지어내지 않는다, apiWebTitleDetail_과 같은 원칙). */
  pageCount: number | '';
  /** 08_COPIES.status_code 6종을 3단으로 뭉갠 값 — 원본 코드는 절대 내려오지 않는다(Code.gs 참고). */
  availability: PublicBookAvailability;
}

export interface PublicBookFetchResult {
  data: PublicBookData;
  /** true = 아직 doGet이 없는 배포(또는 네트워크 실패)라 mocks/publicBookData.ts로 대체됨. */
  sample: boolean;
}

const TIMEOUT_MS = 20000;

// 이 파일이 apiCall()을 재사용하지 않는 이유(services/api.ts 참고) — doPost의 모든 action은
// assertMobileToken_(MOBILE_REG_TOKEN, 사서 공유 비밀)을 거친다. 공개 책 페이지 번들에 그 토큰을
// 심으면(session.ts를 import하든, 상수로 박든) 네트워크 탭만 열어봐도 누구나 그 값을 추출해
// 대출·반납 같은 사서 전용 쓰기 액션까지 흉내 낼 수 있다 — 토큰의 존재 이유 자체가 무너진다.
// 그래서 백엔드에 완전히 별도의 무인증 읽기 전용 진입점 doGet(e)을 추가했고(Code.gs, doPost는
// 한 글자도 건드리지 않음), 프론트도 그에 맞춰 별도의 GET 호출을 쓴다.
export async function fetchPublicBookData(barcode: string | null): Promise<PublicBookFetchResult> {
  const trimmed = (barcode ?? '').trim();
  const baseUrl = trimmed ? resolvePublicGasUrl() : '';

  if (!trimmed || !baseUrl) {
    // 바코드가 없는 라우트이거나(잘못된 딥링크), 이 브라우저가 아직 공개 백엔드 URL을 모름
    // (config/publicBackend.ts 참고 — 배포 전 기본 상태). 실패가 뻔한 fetch를 던지지 않고
    // services/titleDetail.ts의 UNKNOWN_ACTION 폴백과 같은 취급으로 곧장 샘플로 렌더한다.
    return { data: mockPublicBookData(trimmed || undefined), sample: true };
  }

  const separator = baseUrl.includes('?') ? '&' : '?';
  const url = `${baseUrl}${separator}barcode=${encodeURIComponent(trimmed)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // GET, 커스텀 헤더 없음 — services/api.ts의 CORS 회피 주석과 같은 결론이지만 더 근본적으로
    // 안전하다: POST는 기본 Content-Type(text/plain)을 "유지해야만" 프리플라이트를 피하지만,
    // body가 아예 없는 GET은 Content-Type 헤더 자체가 안 실려 처음부터 "단순 요청"이다 — GAS Web
    // App은 OPTIONS를 처리하지 않으므로(services/api.ts 주석) 프리플라이트가 뜨면 무조건 실패한다.
    const res = await fetch(url, { method: 'GET', signal: controller.signal });
    const json = (await res.json()) as { ok?: boolean; data?: PublicBookData } | null;
    if (json && json.ok === true && json.data) {
      return { data: json.data, sample: false };
    }
    // ok:false(예: 존재하지 않는 바코드의 COPY_NOT_FOUND)까지 포함해 전부 샘플로 폴백한다 —
    // doGet 자체가 아직 없는 배포에서는 GAS가 우리 JSON 계약과 무관한 모양(HTML 오류 페이지 등)을
    // 돌려줄 수 있어 "여기까지 왔다"는 것 자체가 이미 신뢰할 만한 실패 신호를 못 받았다는 뜻이다.
    // services/titleDetail.ts보다 폴백 범위를 의도적으로 넓게 잡았다(todo/20 명시 규약, 사유는
    // docs/ASSUMPTIONS.md todo/20에 기록) — 이 표면은 인증 없는 낯선 방문자용이라 놀란 오류 화면
    // 대신 안전한 샘플을 보여주는 쪽이 낫고, 읽기 전용이라 잘못 보여줘도 되돌릴 데이터가 없다.
    return { data: mockPublicBookData(trimmed), sample: true };
  } catch {
    return { data: mockPublicBookData(trimmed), sample: true };
  } finally {
    clearTimeout(timer);
  }
}
