# 131 · window-interactions — 창 상호작용 정돈 (플로팅 윈도우 점검 2/3)

배경(코드 정독): ① 도크 클릭이 비단일(single 아님) 뷰에서 매번 새 창을 만든다 — 설정·학생
관리·카탈로그가 클릭마다 중복되고 6창 상한 토스트로 끝난다(도크 아이콘은 is-open 표시까지
하면서 클릭은 복제). ② snapWindow가 persistWindowRect까지 해서 사용자의 자유 배치 저장값을
스냅 rect로 덮는다 — 다음 열기가 항상 절반 창. ③ zCounter가 무한 증가 — 500을 넘는 순간
(포커스 전환 ~500회, 장기 세션에서 실제 도달) 창 z가 도크 z(500)를 추월해 도크를 가린다.
④ 최대화 부재 — 스냅 절반·수동 리사이즈뿐, 타이틀바 더블클릭 관례 미지원. ⑤ 드래그가
setPointerCapture 없이 window 리스너만 써서 브라우저 밖 pointerup 유실 시 스턱 가능,
pointercancel 미처리, 타이틀바·핸들에 touch-action 없음(태블릿에서 스크롤이 가로챔).

할 일:
1. Dock.tsx: 열린 창(비최소화) 있으면 focusWindow, 최소화면 restoreWindow, 없을 때만
   openWindow — shell.open(뷰 간 이동, book-detail 다중 창)은 종전 그대로(스코프 최소).
2. snapWindow에서 persistWindowRect 제거(스냅은 세션 배치 — 저장 rect는 자유 배치 전용).
3. z 재정규화: zCounter > 300이면 다음 focus/open 때 열린 창들을 z 1..n으로 압축(정렬 유지).
   도크 z=500 불변 전제를 코멘트로 명문화.
4. 타이틀바 더블클릭 = 최대화 토글: prevRect를 창 상태에 보관, 최대화=워크스페이스 전체,
   재더블클릭=prevRect 복원. 스냅 버튼과 동일하게 저장 rect는 건드리지 않음.
5. 드래그·리사이즈에 setPointerCapture + pointercancel 정리, .window-titlebar와
   .window-resize에 touch-action: none.
6. e2e: 도크 재클릭 중복 방지(설정 2클릭 → 창 1개), 더블클릭 최대화→복원 rect 왕복,
   스냅 후 재열기 = 자유 rect(절반 아님) 단정 — snap.spec 확장 또는 window-bounds.spec에.

완료 조건: verify 전 게이트 + e2e green + 커밋/푸시.
