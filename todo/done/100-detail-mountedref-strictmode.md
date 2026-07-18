# 100 · detail-mountedref-strictmode — 도서 상세 StrictMode 영구 로딩 실결함 (시각 감사 5R)

배경(증빙 /tmp/vis/r5-d2-scanner.png — 클릭 1.8초 뒤에도 스켈레톤): 도서 상세가 dev/e2e
(StrictMode)에서 **영원히** 로딩 상태다. 원인: `mountedRef = useRef(true)` + 클린업에서만
false — StrictMode 이중 마운트(mount→cleanup→remount)가 지나가면 ref가 false로 굳고, 이후
모든 `if (!mountedRef.current) return;` 가드가 setDetail/setLoading을 삼킨다. 프로덕션
(이중 호출 없음)은 무관하지만 dev 육안 검증·e2e가 전부 이 화면을 못 본다(기존 e2e들은 상세
"데이터"를 단정한 적이 없어 통과해 왔다 — 가짜 안심).

할 일: effect 본문에서 true 재설정(mount마다) + 클린업 false — 표준 패턴으로 교정.
e2e: backtrap 또는 스모크 쪽에 상세 "데이터 도착" 단정 1개 추가(서명 텍스트 가시).

완료 조건: dev 재캡처(상세 데이터 렌더), 전 게이트, e2e.

---

## 이행 노트 (완료)

- mountedRef 패턴 교정: effect 본문에서 true 재설정 + 클린업 false — StrictMode 이중 마운트
  후에도 가드가 산다. 코드베이스 전수 grep: useRef(true)+클린업-only 패턴은 이 한 곳뿐.
- e2e(backtrap ③): 상세 진입 시 .bd-title 가시 + .bd-skeleton 부재 단정 추가 — "제목만 보고
  지나가던" 가짜 안심 제거. dev 재캡처로 서지·소장본·다이얼로그 전부 실렌더 확인.
- 참고: 프로덕션(StrictMode 없음)은 애초에 무관 — dev 육안 검증·e2e 신뢰성 회복이 본질.
