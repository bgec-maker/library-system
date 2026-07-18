# 91 · undo-bar-geometry — 데스크톱 언두바 기하 실결함 (시각 감사 1R)

배경(증빙 /tmp/vis/d4-crop.png·프로브 실측): 데스크톱 언두바가 `left:16`(뷰 CSS)로 전폭을
잡아 좌측 도크 사이드바(76px, z 상위)에 앞부분이 깔린다 — "대출 처리됨"의 "대출 처"가 잘려
"리됨 — 0001230"으로 보임. 또한 todo/64의 `bottom:72px`(desktop.css)가 뷰 CSS(lazy 주입 —
캐스케이드 후순위)의 `bottom:16px`에 밀려 **무력화**된 상태(computed 16px 실측) — 우측 끝
실행취소 버튼이 스캐너 독과 다시 겹친다. e2e는 dispatchEvent라 이 겹침을 못 본다.

할 일: `.desktop-shell .lr-undo-bar`(특이성 0,2,0 — 로드 순서 무관 승리)로 left(사이드바 폭+16)·
bottom 72 스코프 지정. undo.spec.ts에 기하 단정 추가: 언두바 rect가 사이드바·스캐너 독 rect와
비교차 + computed bottom=72px — 재발 시 게이트가 적발.

완료 조건: 프로브 재실측(computed·비교차), 전 게이트, e2e.
