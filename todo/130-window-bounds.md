# 130 · window-bounds — 창 좌표 격리: 화면 밖 유실 방지 (플로팅 윈도우 점검 1/3)

배경(코드 정독): Window.tsx 드래그 클램프가 좌·상 2방향뿐이다 — 우·하로는 무제한이라 창을
화면 밖으로 완전히 던질 수 있고, onDragEnd의 persistWindowRect가 그 좌표를 localStorage에
저장해 **재열기해도 화면 밖에서 열린다**(loadRect는 x,y≥0만 보정 — 영구 유실, 복구는
localStorage 삭제뿐). 좌측 클램프는 `DOCK_WIDTH - w + MIN_VISIBLE`로 워크스페이스 좌표에
도크 폭을 이중 가산(todo/108과 같은 좌표계 혼동 — 의도보다 76px 일찍 멈춤). 모니터 교체·
브라우저 축소 시에도 클램프가 없다. 서/북 리사이즈는 최소 크기에 닿으면 반대 변이 고정되지
않고 창이 통째로 미끄러진다(뼈대 앵커 버그).

할 일:
1. useWindowStore에 clampRectToWorkspace(rect) 단일 원천: 워크스페이스(availW=innerWidth−
   DOCK_WIDTH, availH=innerHeight) 기준 — w,h ≤ avail 캡, x ∈ [MIN_VISIBLE−w, availW−
   MIN_VISIBLE], y ∈ [0, availH−TITLEBAR_H]. 타이틀바 일부(잡을 곳)가 4방향 어디서든 남는
   계약. MIN_VISIBLE·타이틀바 높이 상수는 Window.tsx와 공유.
2. 적용 지점: openWindow의 stored rect 복원(오염 좌표 즉시 교정), onDragMove(4방향),
   onResizeMove 결과, 브라우저 resize 리스너(디바운스 setTimeout — setInterval 금지 게이트)
   로 전 창 재클램프.
3. 서/북 리사이즈 앵커 교정(Window.tsx): w=max(minW, rect.w−dx) 먼저 확정 후 x=rect.x+
   rect.w−w (우변 고정), 북도 동일(하변 고정) — 최소 크기에서 창이 밀리지 않는다.
4. e2e/window-bounds.spec.ts: ① 우하단으로 과도 드래그 → 타이틀바 잔존(경계 단정) + 재열기
   가시 ② localStorage에 x:5000,y:5000 오염 주입 후 열기 → 뷰포트 안 ③ 서 핸들 과축소 →
   우변 고정(±2px) ④ setViewportSize 축소 → 전 창 재클램프.

완료 조건: verify 전 게이트 + e2e 17본 green + 커밋/푸시.
