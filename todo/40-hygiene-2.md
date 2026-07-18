# 40 · hygiene-2 — 소형 위생 4건 (전수 검토 발견 #7·8·10 + aria)

1. book-detail 「운영 기록」 fetchRecentOps 실패 시 조용히 빈 표 → 오류 한 줄 표시
2. recent-ops columns 배열 useMemo(동급 뷰 관례 정렬 — DataTable 메모 무효화 방지)
3. DataTable 데스크톱 클릭행 role="button" (모바일 카드에는 이미 있음)
4. inventory 진행바 role="progressbar" + aria-valuenow/max
## 완료 조건: verify·e2e 통과 (각 건 구현 시 재검증 — 미확정 표기였던 것은 실코드로 확인 후 적용)
