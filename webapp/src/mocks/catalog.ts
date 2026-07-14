import type { CatalogCopyRow } from '../services/catalog';

// catalog 뷰(todo/08) 목데이터 — dashboardData.ts와 같은 UNKNOWN_ACTION 폴백 규약이지만, 완료
// 조건("5,000행 목데이터에서 정렬/페이지 즉답")을 실제로 검증할 수 있도록 정확히 5,000행 규모로
// 생성한다(catalogSync 서버 액션 배포 전 임시 표시 + 성능 확인 겸용).
//
// 시드 고정 PRNG(mulberry32)로 재실행해도 같은 데이터가 나오게 한다 — 암호학적 품질은 필요
// 없고, 디버깅 중 "방금 본 그 행"을 다시 찾을 수 있으면 충분하다.
function mulberry32(seed: number) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CATEGORY_NAMES = ['문학', '과학', '역사', '예술', '사회', '만화', '외국어', '철학'];
const STATUS_CODES = ['AVAILABLE', 'AVAILABLE', 'AVAILABLE', 'ON_LOAN', 'ON_LOAN', 'HOLD_READY', 'REPAIR', 'LOST'];
const AUTHOR_SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤'];
const AUTHOR_GIVEN = ['민준', '서연', '지호', '하늘', '유나', '도윤', '지안', '은우'];
const TITLE_WORDS_A = ['어린', '푸른', '작은', '빛나는', '고요한', '뜨거운', '먼', '숨은'];
const TITLE_WORDS_B = ['왕자', '바다', '겨울', '노래', '숲', '편지', '별', '이야기'];

function pad6(n: number): string {
  return String(n).padStart(6, '0');
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}

function dateOnlyDaysAgo(days: number): string {
  return isoDaysAgo(days).slice(0, 10);
}

export function generateMockCatalog(count: number): CatalogCopyRow[] {
  const rng = mulberry32(20260715);
  // 복본 존재(ADR-003 — ISBN은 "한 권"이 아니라 "책의 종류") 반영: 서명 수 < 소장본 수.
  const titleCount = Math.max(1, Math.round(count * 0.6));
  const titles = Array.from({ length: titleCount }, (_, i) => ({
    titleId: `T${pad6(i + 1)}`,
    title: `${TITLE_WORDS_A[i % TITLE_WORDS_A.length]} ${TITLE_WORDS_B[(i * 3) % TITLE_WORDS_B.length]} ${i + 1}`,
    authors: `${AUTHOR_SURNAMES[i % AUTHOR_SURNAMES.length]}${AUTHOR_GIVEN[(i * 7) % AUTHOR_GIVEN.length]}`,
    classification: CATEGORY_NAMES[i % CATEGORY_NAMES.length]
  }));

  const rows: CatalogCopyRow[] = [];
  for (let i = 0; i < count; i++) {
    const title = titles[Math.floor(rng() * titles.length)];
    const loanCount = Math.floor(rng() * 40);
    const hasLoan = loanCount > 0 && rng() < 0.8;
    const lastLoanDaysAgo = Math.floor(rng() * 700) + 1;
    const acquiredDaysAgo = lastLoanDaysAgo + Math.floor(rng() * 800);
    rows.push({
      copyId: `C${pad6(i + 1)}`,
      barcode: pad6(i + 1),
      titleId: title.titleId,
      title: title.title,
      authors: title.authors,
      classification: title.classification,
      statusCode: STATUS_CODES[Math.floor(rng() * STATUS_CODES.length)],
      loanCount,
      lastLoanAt: hasLoan ? dateOnlyDaysAgo(lastLoanDaysAgo) : '',
      shelfCode: `${String.fromCharCode(65 + (i % 6))}-${1 + (i % 12)}`,
      acquiredAt: dateOnlyDaysAgo(acquiredDaysAgo),
      updatedAt: isoDaysAgo(Math.floor(rng() * 30))
    });
  }
  return rows;
}
