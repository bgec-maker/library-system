# 110 · fail-reason-code-first — 실패 사유가 영어 원문으로 노출 (시각 감사 10R)

배경(증빙 /tmp/vis/r12-register-failed.png): 네트워크 실패 주입 시 실패 목록이
「E2E New Title — Failed to fetch」 — 사서에게 브라우저 원문 영어가 그대로 보인다.
todo/53의 사람 말 사유(FAIL_REASON_LABELS)는 reason **문자열 머리**를 파싱하는데, 큐가
저장하는 reason은 메시지 원문이라 매핑이 빗나감. todo/60부터 엔트리에 lastErrorCode가
있으므로 코드 우선이 옳다.

할 일: FailedList 표기를 `lastErrorCode 우선 → reason 폴백`으로. 원문 메시지는 title 속성
(호버 상세)으로 보존. 재캡처로 한국어 사유 확인.

완료 조건: 재캡처, 전 게이트, e2e(register-pipeline 실패 사유 단정 보강 가능하면).

---

## 이행 노트 (완료)

- failReasonLabel에 lastErrorCode 우선 조회 추가(reason 머리 파싱은 폴백 유지), 원문 메시지는
  행 title 속성으로 보존(호버 상세).
- 재캡처: 「서버에 연결하지 못했어요 — 네트워크 확인 후 재시도해 주세요」 한국어 사유
  (/tmp/vis/110-crop.png). 도크 배지 1 표시도 동일 캡처로 재확인.
- 전 게이트 · 13 e2e 통과.
