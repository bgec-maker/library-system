# CLAUDE.md — 에이전트 진입점

## 당신의 작업 방식 = 루프
**`todo/00-INDEX.md`를 열고 프로토콜대로 최상단 항목부터 완료→커밋→push→done/ 이동을 반복하세요.** 큐가 비면 종료 보고. waiting/은 사용자만 승격합니다.

## 법전 (구현 전 해당 문서 필독 — 어기면 반려)
docs/FRONTEND.md(아키텍처·성능 예산·i18n·DataTable) · docs/DESIGN.md(디자인 법 — 임의 hex/px 금지) · docs/VIZ.md(시각화 원칙) · docs/FEATURES.md(리포트 명세) · docs/DECISIONS.md(ADR 25 — 기각된 대안 재제안 금지) · docs/ROADMAP.md(조감도) · docs/VERIFY.md(검증)

## 🔴 절대 규칙 (요약 — 상세는 DECISIONS)
1. GAS 안 카메라 불가 → 스캔은 Pages · 2. Code.gs 기존 함수·보호·멱등 로직 수정 금지(추가만) · 3. ISBN≠관리ID · 4. 도메인 전 QR 라벨 금지 · 5. 셀프반납 X · 6. 행 삭제 금지(상태 코드) · 7. spike/ 삭제 금지 · 8. 파생 뷰 O(n²) 금지 · 9. views/**에서 셸 접근 금지(린트) · 10. 비밀값 커밋 금지(grep: ttbbgec/alansgk)

## 🟡 사용자만 결정 (혼자 정하지 말 것)
로그인 방식 · 다문화 언어 목록 · 도메인 · waiting/ 승격 · Code.gs 새 버전 배포(→샘플 배지 소멸)

## 검증 원칙
문서보다 더미 데이터 · 수식이 계산된다≠맞다 · 가짜 성공 금지(샘플 배지) · 마일스톤 커밋 = 관전 포인트
