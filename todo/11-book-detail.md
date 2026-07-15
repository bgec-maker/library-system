# 11 · book-detail 완성 (현 28줄 스텁)
서지(표지·페이지·분류) + 소장본 목록(상태·대출자·반납예정) + 최근 이력 + 예약 현황.
데이터: catalog 미러 + copyStatus + recentOps(entityId 필터 — 액션 파라미터 추가는 '추가'만).
진입: catalog 행·검색 결과·스캔(핀 시). 조작 버튼은 12·13이 얹는다 — 여기선 자리만.
완료: 등록번호로 딥링크 #/w/book-detail?copy=… 동작 · 두 셸 렌더
