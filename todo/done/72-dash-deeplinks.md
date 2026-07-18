# 72 · dash-deeplinks — 대시보드 카드 딥링크 전수 점검

배경: 예약 도착 카드·최근 처리 더 보기 등 대시보드의 진입점이 최신 뷰 구조(스택/창)와 전부
올바르게 연결되는지 리스킨 이후 전수 확인이 없다.

할 일: 카드별 클릭 → 기대 뷰 매핑 표 작성 → 어긋난 것 수정(shell.open 파라미터), e2e 스모크에
대표 1경로 단정 추가.

완료 조건: 매핑 표(todo 파일에), e2e 통과.

## 매핑 표(전수 점검 결과)

| 진입점 | 목적지(params) | 소비 확인 |
|---|---|---|
| 조용한 신호 5종 | reports {type} | ReportsView requestedType(isSelectedPanelId) ✓ |
| 최근 처리 더 보기 | recent-ops | 단순 열기 ✓ |
| 예약 도착 카드 | reservations {filter:'READY'} | initialBucket ✓ |
| 시각화 6종 onNavigate | 각 뷰 (viewId, params) | 기존 todo/35 계약 그대로 ✓ |
| KPI 타일(데스크톱) | (비인터랙티브) | 1:1 대응 화면 없음 — 가짜 어포던스 금지로 유지 |
| 모바일 요약 스트립 | (기존 전부 정적) | **개선**: 예약 대기 타일 → 예약 관리(패리티 신설) |

loan-return single 창의 params 미갱신 한계는 뷰 주석의 기존 문서화 유지(이 항목 범위 밖).
