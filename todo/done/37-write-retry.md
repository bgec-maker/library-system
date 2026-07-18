# 37 · write-retry — 쓰기 액션 BUSY_RETRY 자동 흡수 (공유 헬퍼)

## 왜 (전수 검토 발견 #2)
서버 락 경합(BUSY_RETRY)은 일시 오류인데 등록 큐만 흡수하고, 나머지 쓰기(대출·반납·실행취소·
장서점검·예약·연장·분실·변상)는 사용자에게 그냥 실패로 보인다 — 특히 undo·inventoryScan·
reserve는 재시도 버튼도 없이 토스트뿐. 같은 requestId 재전송은 executeWrite_ 멱등이 흡수하므로
안전하다(todo/28에서 확립).

## 무엇
- services/writeRetry.ts: apiCallWithRetry(action, payload{requestId}) — BUSY_RETRY·
  NETWORK_ERROR·CLIENT_TIMEOUT·DUPLICATE_REQUEST에 한해 같은 requestId로 1.5s·3s 백오프
  후 재시도(최대 3회 시도), 그 외 코드는 즉시 반환. **UX 불변**(호출부는 여전히 await —
  블로킹 스피너 유지, 백그라운드화 아님. 그건 등록 큐만의 정책).
- 죽은 export retryApiCall 제거(사용처 0건 확인됨), 이 헬퍼가 그 관례의 실체가 된다.
- 적용: loan-return(checkout/return/undo/redirect 계열)·inventoryScan·reserve/cancel·
  renew/markLost/payFine. 읽기는 대상 아님(readCache 관할).
- e2e: 대출 BUSY_RETRY 1회 → 자동 성공 케이스 1개 추가.
## 완료 조건: 하네스(재시도 코드별)·e2e·verify 통과
