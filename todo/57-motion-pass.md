# 57 · motion-pass — 등장 모션 방향 사전 이행 ("대기업 감각" 2)

지금 스택 push·다이얼로그·토스트가 등장 모션 없이 즉시 나타난다(뚝 끊기는 느낌).
DESIGN.md 「인터랙션 표준」의 방향 사전을 코드로:

- 스택 push(.m-stack-overlay): 우→좌 슬라이드 인 180ms ease-out, pop은 역재생 120ms.
  iOS 뒤로가기 제스처와 시각적으로 일치. transform만 사용(레이아웃 무영향).
- ConfirmDialog: fade + scale(0.96→1) 150ms.
- 토스트·언두바: 아래→위 fade 150ms(이미 있으면 타이밍만 표준화).
- 시트/트레이 류(수동 입력 펼침 등 details)는 제외 — 브라우저 기본에 맡긴다(과모션 방지).
- prefers-reduced-motion이면 전부 무효(기존 원칙 그대로).
- e2e 주의: 애니메이션 대기 셀렉터가 흔들리지 않는지 5스펙 전체 확인.

## 완료 조건: 스택 push 3프레임 연속 컷(모션 증빙) · reduced-motion 무효 확인 · 전 게이트·e2e
