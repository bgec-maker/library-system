# 94 · detail-skeleton — 도서 상세 첫 로딩 스켈레톤 (시각 감사 1R)

배경(증빙 /tmp/vis/d8-detail.png): 도서 상세 첫 로딩이 "불러오는 중…" 텍스트 한 줄 —
인터랙션 표준 「스켈레톤」(첫 로딩=형태 있는 자리표시)의 미적용 잔여 화면. 데스크톱·모바일 공용 뷰.

할 일: 표지 상자(CoverThumb 치수) + 제목/저자 막대 + 섹션 스텁 2개로 구성된 스켈레톤
(opacity 펄스만, aria-busy + sr-only 로딩). 재조회(배경 동기화)에는 미적용 — 첫 로딩 전용.

완료 조건: 지연 주입 캡처 1장, 전 게이트, e2e.

---

## 이행 노트 (완료)

- bd-loading 텍스트 한 줄 → .bd-skeleton: 표지 상자(실제 CoverThumb 치수 120×168 — 도착 시
  레이아웃 점프 없음) + 제목(60%)/저자 막대 + 메타 그리드 스텁 4개 + 섹션 스텁 2개.
  aria-busy + sr-only 로딩 문구, 펄스는 opacity만, reduced-motion 무효화(DataTable.css
  skel 프리미티브 재사용 — 이 뷰가 DataTable을 정적 임포트하므로 동봉 보장).
- 재조회에는 미적용(!detail 분기 전용 — 표준 그대로). 고아가 된 .bd-loading 규칙 제거.
- 증빙: titleDetail 지연 주입 캡처(/tmp/vis/94-skeleton.png). 전 게이트 · 12 e2e 통과.
