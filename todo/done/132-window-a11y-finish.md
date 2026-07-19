# 132 · window-a11y-finish — 창 접근성·마감 (플로팅 윈도우 점검 3/3)

배경(코드 정독): 창 루트가 순수 div — 보조기술에 "창"이라는 구조가 전혀 전달되지 않는다
(role·aria-label 부재). 최소화 도크 툴팁이 레지스트리 기본 제목만 써서 커스텀 제목(도서
상세의 책 제목)이 사라진다. 리사이즈 가장자리 핸들이 창 밖으로 3px 나가 있는데 .window가
overflow:hidden이라 바깥 절반이 클립돼 유효 표적이 3px뿐이다. 창 등장이 무애니메이션 —
DESIGN.md 인터랙션 표준(등장 사전)과 어긋난다(reduced-motion 존중 필수).

할 일:
1. Window.tsx: role="dialog" aria-label={title}(모달 아님 — aria-modal 없음), 최소화 버튼
   aria-keyshortcuts 불필요, 도크 최소화 항목 툴팁에 창의 현재 제목 전달(스토어에 title
   거울 필드 또는 Dock이 창별 title 조회 — 커스텀 제목 유지).
2. desktop.css: 핸들 유효 표적 확대 — 바깥 돌출 대신 안쪽 6px(모서리 12px)로 재배치(클립
   무효화), 기존 커서 방향 유지.
3. 창 등장 애니메이션: 표준 등장 사전(스케일 0.98→1 + 페이드, 120ms대) 1회 — 스냅·드래그엔
   미적용, prefers-reduced-motion에서 none.
4. 캡처: 다중 창(3개, 포커스 링·스캔 뱃지·최소화 도크), 등장 프레임, 좁은 뷰포트 클램프
   상태 — /tmp/vis에 저장 후 확인.
5. 문서: ASSUMPTIONS todo/130~132 절(좌표 계약·z 재정규화 근거·스냅 비저장 판단),
   HANDOFF §5 스탬프.

완료 조건: verify 전 게이트 + e2e green(기존+130·131 신설분) + 캡처 확인 + 커밋/푸시.
