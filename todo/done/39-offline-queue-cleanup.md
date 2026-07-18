# 39 · offline-queue-cleanup — 죽은 offlineQueue 정리 + 문서 정합

## 왜 (전수 검토 발견 #1 — 죽은 코드 확정)
services/offlineQueue.ts의 enqueueAndSend/flushQueue/onQueueChange/getPending*는 import 0건
(주석 언급뿐). 큐는 영원히 비어 있는데 전역 online 리스너만 상주한다. FRONTEND.md 「서비스
계약」의 "offlineQueue: 실패 요청 적재→재전송" 문구는 어떤 쓰기 경로도 소비하지 않는 계약 —
문서와 코드가 서로 거짓말 중.

## 무엇
1. offlineQueue.ts 삭제 (registerQueue가 등록 쓰기의 실질 큐 — todo/28)
2. FRONTEND.md 서비스 계약 절 개정: offlineQueue 항목을 registerQueue(등록 전담·순차·백오프·
   멱등 재개)로 교체하고, "대출·반납 오프라인 적재"는 미구현·정책 결정 필요임을 명기
3. waiting/offline-loans.md 신설: 대출·반납 오프라인 큐잉은 스테이션 셀프대출 화면과 얽힌
   UX 정책(확정 지연 표시)이라 🟡 사용자 결정 게이트로 기록 — 승격은 사용자만
## 완료 조건: grep으로 잔존 참조 0건, verify·build·e2e 통과
