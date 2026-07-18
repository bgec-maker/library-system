# 69 · stack-pop-reverse — 스택 pop 역재생 모션 (57 보류분)

배경: 57에서 입장만 넣고 pop 역재생은 popstate 동기화 위험으로 보류했다. 66의 e2e가 먼저
그 지반을 보증하므로 이제 안전하게 진행 가능.

할 일: leaving 상태(120ms) 후 실제 pop — popstate·reset()·연속 pop 경합에서 상태 꼬임 없게.
reduced-motion 즉시 pop. 66 스펙에 역재생 중 상호작용 차단 단정 추가.

완료 조건: e2e(66 확장) 통과, 3프레임 증빙.
