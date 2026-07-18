# 63 · scan-route-tests — 스캔 라우팅 단위 테스트

배경: publishScan의 대상 판별(book/book-url/student/isbn/unknown)과 DEDUPE_MS 가드는 전 화면
스캔 UX의 심장인데 테스트가 없다.

할 일: scanBus/카메라 handleDecodedText 판별 규칙 단위 테스트 — 등록번호 형식·학생 S: 접두·
URL 딥링크·ISBN(EAN-13 체크섬)·미인식 + 버스 구독/해제 + 라우팅 힌트(핀 우선).
스코프 조정: DEDUPE_MS·비프는 카메라 파이프라인(DOM·워커) 소관 — 가짜 카메라 e2e(46)가
이미 보증하므로 단위층에선 다루지 않는다(사유 기록).

완료 조건: test:unit 포함, 전 게이트.
