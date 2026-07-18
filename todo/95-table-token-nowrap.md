# 95 · table-token-nowrap — 표 토큰값(ID·날짜) 중간 꺾임 잔여 전수 (시각 감사 2R)

배경(증빙 /tmp/vis/r2-d1-settings.png·r2-d2-recentops.png): 좁은 창에서 "POL-/0001"(정책 ID),
"2026-/07-18/16:20"(처리 시각 3줄) 등 토큰값이 하이픈 뒤에서 꺾인다 — todo/47 nowrap 계약의
미지정 잔여. 표는 가로 스크롤(.data-table-scroll)이 있으므로 꺾임보다 스크롤이 옳다.

할 일: mono 토큰 열 전수 점검 — 꺾이면 안 되는 것(ID·바코드·날짜·시각)에 nowrap 지정:
settings policyId/activeFrom/activeTo/updatedAt×2, recent-ops occurredAt/entityId,
book-detail acquiredAt/dueDate류 잔여, inventory·search barcode. 자연 개행이 맞는 것(요약·
설정값 등)은 제외.

완료 조건: 좁은 창 재캡처(꺾임 없음), 전 게이트, e2e.
