# 123 · input-control-standard — 입력 컨트롤 디자인 표준 (사용자 지시 "input 쪽 디자인 점검")

배경(전역 input CSS 감사): 입력 컨트롤의 기반 규칙에 구멍 5개.
① **iOS 포커스 줌(실결함급)**: 입력 font가 15px(--fs-md) — iOS는 16px 미만 입력에 포커스
   시 화면을 자동 확대하고 되돌리지 않는다. 설치형 iPhone PWA가 1차 기기인 이 제품에서
   모든 입력마다 화면이 튀는 원인.
② placeholder 색이 브라우저 기본(비표준·Firefox는 반투명) — 토큰 미사용 잔여.
③ textarea가 자유 resize(가로로 늘리면 레이아웃 파손 가능) + 최소 높이 없음.
④ disabled 입력 상태 무정의(버튼만 있음).
⑤ .is-invalid가 등록 스코프에만 — 전역 표준으로 승격해야 모든 폼이 재사용.

할 일: base.css에 — coarse pointer에서 입력류 16px, ::placeholder ink-3(+opacity 1),
textarea vertical resize+min-height 88, disabled 상태(paper/ink-3), input/textarea/select
.is-invalid 전역 규칙(등록 스코프 규칙 제거·통합).

완료 조건: 전 게이트, e2e, 재캡처(placeholder 색).

---

## 이행 노트 (완료)

- base.css 입력 표준 5칙 추가: ① coarse pointer 16px(실측 computed 16px 확인 — iOS 포커스 줌
  차단) ② ::placeholder ink-3+opacity 1 ③ textarea vertical resize+min-height 88
  ④ disabled 입력(paper/ink-3) ⑤ .is-invalid 전역(등록 스코프 규칙 제거·승격).
- 데스크톱은 15px 유지(표 밀도 보존 — 줌 문제는 터치 기기 한정이라 매체 분기).
- 전 게이트 · 15 e2e 통과. 재캡처 /tmp/vis/123-form.png.
