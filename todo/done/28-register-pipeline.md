# 28 · register-pipeline — 등록 순차 제출 큐 (저장 중에도 다음 스캔)

## 왜
등록 화면이 `saving` 동안 통째로 멈춘다 — GAS doPost 왕복(2~5초)마다 사람이 기다린다.
등록 스프린트의 병목은 서버가 아니라 **사람 대기와 왕복이 직렬로 붙어 있는 것**.
서버는 이미 준비돼 있다: requestId 멱등(executeWrite_), 동시 등록 레이스 흡수(registerByIsbn_
DUPLICATE_ISBN→복본 추가), withWriteLock_ 전역 직렬화.

## 무엇
1. **`services/registerQueue.ts`** — 순차 제출 큐 (싱글턴, 뷰 언마운트에도 생존)
   - FIFO · **동시 전송 1건**(서버 락 경합 회피 — 병렬 전송 금지)
   - 재시도 가능 코드(BUSY_RETRY · NETWORK_ERROR · CLIENT_TIMEOUT · DUPLICATE_REQUEST)는
     **같은 requestId**로 백오프 재전송(2·4·8·15초, 최대 5회) — 서버 멱등이 중복 흡수.
     그 외 코드는 즉시 실패 → 기존 실패 목록(localStorage) 합류, 수동 재시도만.
   - 멱등 재확인 응답(`idempotent:true`, barcodes 없음)은 완료로 처리하되
     "등록번호는 최근 처리에서 확인" 안내 표기
   - localStorage 영속(`lib.register.queue.v1`) — 새로고침 시 미전송분 자동 재개,
     완료 항목은 연필 옮겨적기 전 유실 방지용으로 최근 30건 유지
   - 오늘 카운터·실패 목록의 쓰기 주체를 이 서비스로 일원화(뷰는 구독만)
2. **register 뷰 개편** — 저장 = 큐 적재 후 **즉시 scan 화면 복귀**
   - `saving`·`result` 화면 제거 → **결과 트레이**(최신순): 대기/저장 중/재시도/완료 상태,
     완료 건은 등록번호 크게(mono)+연필 힌트, 복본 일괄 발급(BulkCopyPanel)은 완료 건에서 펼침
   - 실패 재시도(기존 FailedList)는 큐 재적재로 변경(같은 requestId)
3. e2e 스모크 등록 스텝을 새 흐름(저장→scan 복귀→트레이 완료)으로 갱신

## 범위 밖
- Code.gs 무수정·무추가(배치 액션 `registerBatch`는 경합 실측 후 별도 항목)
- 대출·반납의 낙관 반영(정책 거절이 흔해 위험 — DECISIONS 참조)
- offlineQueue.ts 변경(등록은 registerQueue가 전담 — online flush 병렬 전송과 이중 발사 방지)

## 완료 조건
- 저장 직후 scan 화면에서 다음 스캔 가능, 앞 건은 트레이에서 진행 표시
- BUSY_RETRY 유발 시(목) 사용자 개입 없이 지연 성공
- lint · tsc · build · size · i18n 3종 · e2e 통과
