# 69 · stack-pop-reverse — 스택 pop 역재생 모션 (57 보류분)

배경: 57에서 입장만 넣고 pop 역재생은 popstate 동기화 위험으로 보류했다. 66의 e2e가 먼저
그 지반을 보증하므로 이제 안전하게 진행 가능.

할 일: leaving 상태(120ms) 후 실제 pop — popstate·reset()·연속 pop 경합에서 상태 꼬임 없게.
reduced-motion 즉시 pop. 66 스펙에 역재생 중 상호작용 차단 단정 추가.

완료 조건: e2e(66 확장) 통과, 3프레임 증빙.

## 이행 노트(구현 시점)
- 지연 슬라이스 상태기계: popstate→pendingDepth 기록·is-leaving 120ms 후 확정(flushLeave),
  연속 pop은 목표 깊이 갱신, push 레이스는 flushLeave 선행으로 깊이 보전(e2e ③-b 단정).
- pop으로 드러난 아래층의 입장 모션 재생은 no-enter로 억제 — "앞으로 가는" 착시 방지
  (57의 잠복 어색함을 여기서 함께 해소).
- reduced-motion: 상태기계 자체를 건너뛰어 기존 즉시-pop 경로 그대로.
- 시각 증빙은 JS 타이머 특성상 프레임 캡처가 비결정적이라 e2e 불변식(레이스 포함)으로 갈음.
