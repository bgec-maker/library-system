# 57 · motion-pass — 등장 모션 방향 사전 이행 (대기업 감각 2)

인터랙션 표준 「등장 방향 사전」 이행 — 전부 transform/opacity만, reduced-motion 무효.

- 스택 push(.m-stack-overlay): 우→좌 슬라이드 인 180ms ease-out.
  **pop 역재생(120ms)은 보류**: 언마운트 지연 상태기계가 popstate 동기화(todo/45~46 계열
  위험 지대)를 건드려서, 입장 모션 현장 검증 뒤 별도 항목으로 승격한다.
- ConfirmDialog 카드: fade + scale(0.96→1) 150ms.
- 토스트·언두바: 아래→위 fade 150ms (같은 사전 항목 = 같은 모션).
- details 펼침 등은 브라우저 기본 유지(과모션 방지, 스펙 그대로).

## 완료 조건: 스택 push 연속 프레임 증빙(58 커밋에서 합성 전달) · e2e 5스펙 통과(확인)
