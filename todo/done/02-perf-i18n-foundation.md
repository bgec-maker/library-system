# 02 · 성능 CI + i18n 기반
참조: docs/FRONTEND.md 「성능 예산」·「다국어」, ADR-023
- 번들 size 체크 CI(초과=실패, work 180/student 70KB gz) + `npm run size`
- `t()` 유틸 + src/i18n/ko.json·en.json 골격 + **JSX 한글 리터럴 린트**(views/shells/student)
- 기존 화면 문자열을 사전 키로 이관 (이후 모든 항목은 사전 키로만 작성)
완료 조건: 린트가 하드코딩 검출 · 언어 토글로 en 전환 동작(미번역 키는 ko 폴백)
