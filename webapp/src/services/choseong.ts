// 초성 검색(todo/15) — 한글 음절을 초성 자모로 분해해 "ㅊㅅㅈ" 같은 입력이 "채식주의자"에
// 매칭되게 하는 순수 문자열 유틸. services/ 아래 있지만 catalog.ts 같은 GAS 왕복 로직은 전혀
// 없다 — scanBus.ts(parseScan/isValidEan13 등 순수 파싱·검증 함수)와 같은 성격이라 같은 폴더에
// 둔다. views/search가 첫 소비자지만 화면에 묶인 상태가 전혀 없어(book-detail의 createReservation
// 재사용과 같은 이유) 다른 목록 화면도 그대로 가져다 쓸 수 있다.
//
// DataTable(components/DataTable/index.tsx)은 건드리지 않았다 — catalog·recent-ops·reports·
// reservations·book-detail 5곳이 공유하는 컴포넌트라 그 안의 검색 상자를 초성 인식으로 바꾸면
// 5곳 전부의 동작을 다시 검증해야 한다. 대신 views/reservations/index.tsx가 이미 쓰고 있는
// 패턴(대기/도착/임박 탭이 `items`를 `filteredRows`로 미리 걸러 DataTable에 넘기고, DataTable
// 자신의 검색 상자는 그 결과 안에서 한 번 더 좁히는 보조 역할로 남는다)을 그대로 재사용한다 —
// search 뷰도 자기 자신의 검색어·필터로 미리 걸러진 배열만 DataTable에 넘긴다
// (docs/ASSUMPTIONS.md `## todo/15` 참고).
//
// 알고리즘(유니코드 한글 음절 블록 U+AC00 "가" ~ U+D7A3 "힣"): 코드 포인트에서 0xAC00을 뺀
// offset을 (중성 21종 × 종성 28종 = 588)로 나눈 몫이 초성 인덱스(0~18)다.
//
// node -e로 실제 실행해 확인한 값(암산이 아니라 실행 결과 — docs/ASSUMPTIONS.md `## todo/15`에
// 전체 로그를 남겼다):
//   '채' U+CC44 → offset 8260 → floor(8260/588)=14 → CHOSEONG_JAMO[14] = 'ㅊ'
//   '식' U+C2DD → offset 5853 → floor(5853/588)=9  → 'ㅅ'
//   '주' U+C8FC → offset 7420 → floor(7420/588)=12 → 'ㅈ'
//   '의' U+C758 → offset 7000 → floor(7000/588)=11 → 'ㅇ'
//   '자' U+C790 → offset 7056 → floor(7056/588)=12 → 'ㅈ'
//   ⇒ "채식주의자" → "ㅊㅅㅈㅇㅈ", 쿼리 "ㅊㅅㅈ"는 그 앞부분과 일치(includes) → 매칭 성공
//   '아' U+C544 → offset 6468 → floor(6468/588)=11 → 'ㅇ'
//   '몬' U+BAAC → offset 3756 → floor(3756/588)=6  → 'ㅁ'
//   '드' U+B4DC → offset 2268 → floor(2268/588)=3  → 'ㄷ'
//   ⇒ "아몬드" → "ㅇㅁㄷ", 쿼리 "ㅇㅁㄷ"와 완전히 일치 → 매칭 성공
const CHOSEONG_JAMO = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
] as const;

const HANGUL_SYLLABLE_START = 0xac00; // '가'
const HANGUL_SYLLABLE_END = 0xd7a3; // '힣'
const JUNGSEONG_COUNT = 21;
const JONGSEONG_COUNT = 28;

// 검색어가 "초성만으로 이루어졌는지" 판정할 때 쓰는 집합 — 19개 초성 자모 그 자체(위 배열)로만
// 판정한다. 호환 자모 블록(U+3131~U+314E)에는 겹받침(ㄳ·ㄵ 등) 같은 초성으로 쓰이지 않는 문자도
// 섞여 있어, 그 블록 전체를 기준으로 삼으면 오탐(예: 겹받침 하나만 친 검색어도 "초성 검색"으로
// 오판)이 생긴다 — 그래서 실제 초성 19자만의 Set을 별도로 둔다.
const CHOSEONG_SET = new Set<string>(CHOSEONG_JAMO);

/** 한글 음절 한 글자의 초성을 반환한다. 음절 블록 밖 문자(영문·숫자·공백·이미 자모인 문자 등)는
 *  그대로 통과시킨다 — 혼합 문자열에서 한글이 아닌 부분도 원문 그대로 남아 일반 부분 문자열
 *  매칭에 계속 참여한다(변환으로 소실되지 않음). */
function choseongOfChar(ch: string): string {
  const code = ch.codePointAt(0) ?? 0;
  if (code < HANGUL_SYLLABLE_START || code > HANGUL_SYLLABLE_END) return ch;
  const offset = code - HANGUL_SYLLABLE_START;
  const choseongIndex = Math.floor(offset / (JUNGSEONG_COUNT * JONGSEONG_COUNT));
  return CHOSEONG_JAMO[choseongIndex] ?? ch;
}

/** 문자열 전체를 초성 문자열로 변환한다("채식주의자" → "ㅊㅅㅈㅇㅈ"). 행 하나당 한 번만 계산해
 *  캐시해 두고 재사용하는 용도 — 호출측(views/search)이 useMemo로 rows가 바뀔 때만 다시 부른다,
 *  키 입력마다 5,000행 전체를 다시 변환하지 않는다(완료 조건 "100ms 내"). */
export function toChoseongString(text: string): string {
  return Array.from(text).map(choseongOfChar).join('');
}

/** 검색어가 초성 전용(19개 초성 자모로만 구성)인지 판정한다. 빈 문자열은 거짓. */
export function isChoseongQuery(query: string): boolean {
  if (!query) return false;
  return Array.from(query).every((ch) => CHOSEONG_SET.has(ch));
}

/**
 * 검색어 하나를 대상 텍스트에 매칭한다 — 일반 부분 문자열 매칭(대소문자 무시) **또는** 초성
 * 매칭(검색어가 초성 전용일 때만) 중 하나라도 성립하면 참. 초성 매칭을 일반 매칭의 대체가
 * 아니라 추가 경로로 둬서, 초성이 아닌 보통 검색어(예: "김민준", "0001234")는 지금까지와
 * 똑같이 부분 문자열로만 판정된다 — 이 함수를 쓰는 화면이 하나뿐이라 다른 소비자에 대한 회귀
 * 위험은 없지만(DataTable 자체는 이 함수를 모른다), 그래도 "기존 동작 위에 얹기"라는 원칙은
 * 지킨다.
 */
export function matchesQuery(plainText: string, choseongText: string, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  if (plainText.toLowerCase().includes(q.toLowerCase())) return true;
  return isChoseongQuery(q) && choseongText.includes(q);
}
