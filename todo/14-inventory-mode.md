# 14 · 장서점검 + ZXing Worker (부채 상환 세트)
- Worker: 디코드를 Web Worker로 이전(메인 스레드 해방) — 크롭·10fps 유지, camera.ts 단일 호출점 불변
- inventory 뷰: 「점검 세션 시작」→ 연속 모드 강제 → 스캔마다 최근점검일 갱신(doPost inventoryScan — 쓰기지만 단순 갱신, executeWrite_ 경유) + 진행 카운터 + 미점검 잔여
- 세션 종료: 미점검+보관중 = 분실 후보 목록 → reports 인쇄
완료: 100권 연속 스캔 시뮬레이션(목)에서 프레임 드랍 없음 · 후보 목록 인쇄
