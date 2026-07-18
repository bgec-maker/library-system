# 108 · snap-offset — 창 스냅 좌표 이중 오프셋 실결함 (시각 감사 8R)

배경(증빙 /tmp/vis/r11-snap.png): 좌측 절반 스냅이 도크에서 76px 떨어져 앉고(뒤 대시보드가
띠로 노출), 우측 절반 스냅은 뷰포트를 76px 넘어가 **최소화·닫기 버튼이 화면 밖**. 원인:
창 left는 .desktop-workspace(margin-left: DOCK_WIDTH) 내부 좌표인데 snapWindow가 화면 좌표
의도로 x에 DOCK_WIDTH를 더함 — 이중 오프셋.

할 일: snapWindow를 워크스페이스 좌표로(left=0 / right=half). e2e 신설(snap.spec):
좌스냅 화면상 x==DOCK_WIDTH 플러시 + 우스냅 오른끝 ≤ viewport + 닫기 버튼 가시.

완료 조건: 재캡처(갭·잘림 소멸), 전 게이트, e2e 13본.

---

## 이행 노트 (완료)

- useWindowStore.snapWindow: 워크스페이스 좌표로 교정(좌=0, 우=half) — 좌스냅 도크 플러시·
  우스냅 뷰포트 내 완결(닫기 버튼 가시 복귀). availW 하한도 화면 좌표 잔재(DOCK_WIDTH+320→320) 정리.
- e2e 13본째 snap.spec 신설: 플러시(±1px)·뷰포트 내(±1px)·나란히 이어짐·닫기 버튼 가시 4단정.
- 재캡처(/tmp/vis/r11-snap.png): 좌우 절반이 정확히 맞물림. 재캡처가 덤으로 적발한
  검색 결과 "대출가/능" 꺾임도 동일 계약(nowrap)으로 함께 수리(status·shelf 열).
- 전 게이트 · 13 e2e(하드 게이트) 통과.
