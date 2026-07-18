// todo/63 — 스캔 판별·버스·라우팅 힌트 단위 테스트. parseScan은 전 화면 스캔 UX의 관문:
// 등록번호(자체 Luhn)·ISBN(EAN-13)·학생 접두·책 URL·미인식이 여기서 갈린다.
// (카메라 쪽 DEDUPE_MS·비프는 가짜 카메라 e2e(todo/46)의 영역 — DOM 없는 단위층에선 안 다룬다.)
import {
  isValidCopyBarcode,
  isValidEan13,
  parseScan,
  publishScan,
  subscribeScan,
  setScanRoute,
  pinScanRoute,
  unpinScanRoute,
  getEffectiveScanRoute
} from '../../src/services/scanBus';

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  console.log('ok —', msg);
}

// ── 검증기 ──────────────────────────────────────────────────────────────
// 0001230: base 000123의 Luhn 합 10 → 체크 0 (e2e CHECKOUT_BARCODE와 동일 — 계약 일관성 증거)
assert(isValidCopyBarcode('0001230'), '등록번호 Luhn — 유효(0001230)');
assert(!isValidCopyBarcode('0001231'), '등록번호 Luhn — 체크 불일치 거부');
assert(!isValidCopyBarcode('001230'), '등록번호 — 7자리 아님 거부');
assert(isValidEan13('9788932917245'), 'EAN-13 — 유효(실제 ISBN)');
assert(!isValidEan13('9788932917246'), 'EAN-13 — 체크 불일치 거부');

// ── parseScan 분기 ──────────────────────────────────────────────────────
assert(parseScan('').kind === 'unknown', '빈 입력 → unknown');
const bookUrl = parseScan('https://lib.example/b/0001230?src=qr');
assert(bookUrl.kind === 'book-url' && bookUrl.barcode === '0001230', '책 QR URL → book-url + 번호 추출');
assert(parseScan('https://lib.example/b/123').kind === 'unknown', 'URL이지만 7자리 아님 → unknown');
const student = parseScan('s:1001');
assert(student.kind === 'student' && student.studentCode === '1001', "'S:' 접두(대소문자 무관) → student");
const isbn = parseScan('978-89-329-1724-5');
assert(isbn.kind === 'isbn' && isbn.isbn === '9788932917245', '하이픈 섞인 ISBN → 숫자만 추려 isbn');
const book = parseScan(' 0001230 ');
assert(book.kind === 'book' && book.barcode === '0001230', '공백 낀 등록번호 → book');
assert(parseScan('2001234567893').kind === 'unknown', '978/979 아닌 13자리 → unknown(ISBN 아님)');
assert(parseScan('안녕하세요').kind === 'unknown', '문자열 → unknown');

// ── publishScan 버스 ────────────────────────────────────────────────────
let received: string[] = [];
const off = subscribeScan((evt) => received.push(evt.target.kind + ':' + evt.raw));
const evt = publishScan('0001230');
assert(evt.target.kind === 'book' && received.length === 1 && received[0] === 'book:0001230', '발행 → 구독자 수신 + 반환 이벤트 동일');
off();
publishScan('0001230');
assert(received.length === 1, '구독 해제 후 미수신');

// ── 라우팅 힌트(핀 우선) ────────────────────────────────────────────────
setScanRoute('search');
assert(getEffectiveScanRoute() === 'search', '활성 라우트 반영');
pinScanRoute('loan-return');
assert(getEffectiveScanRoute() === 'loan-return', '핀이 활성 라우트를 이긴다');
setScanRoute('register');
assert(getEffectiveScanRoute() === 'loan-return', '핀 유지 중 활성 변경은 무시');
unpinScanRoute();
assert(getEffectiveScanRoute() === 'register', '언핀 → 마지막 활성 라우트 복원');

console.log('scanBus ALL PASS');
