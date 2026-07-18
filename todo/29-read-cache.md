# 29 · read-cache — 읽기 API 캐시·중복제거 (GAS 할당량 절감)

## 왜
publishDataChange 후 열려 있는 모든 소비자(대시보드·최근 처리·예약·리포트…)가 각자 재조회
→ 같은 읽기 doPost가 짧은 순간 중복 발사. GAS 호출 할당량은 이 프로젝트의 가장 귀한 자원.

## 무엇
- services/readCache.ts: cachedApiCall(action, payload, ttl) — ① 동일 키 in-flight 공유
  ② 짧은 TTL(기본 15s) ③ dataChangeBus 발행 시 전체 무효화
- 읽기 서비스 배선(대상: dashboard·recentOps·manualEntryPendingCount·viz·report·titleDetail·
  reservations·unpaidFines·settingsOverview·copyStatus 중 코드 확인 후 적합한 것만)
- 제외: catalogSync(델타 프로토콜 자체가 캐시), lookupIsbn(등록 중복 판정 신선도 필요)
- 쓰기 액션 캐시 금지. FRONTEND.md 「진실은 시트」 유지 — TTL은 초 단위로 짧게.

## 완료 조건
- 같은 tick에 두 소비자가 같은 읽기를 요청하면 fetch 1회(더미로 실측)
- publishDataChange 직후엔 반드시 재조회(신선도 회귀 없음, e2e 통과)
- lint·tsc·build·size·e2e 통과
