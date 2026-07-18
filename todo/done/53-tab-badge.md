# 53 · tab-badge — 등록 탭 실패 배지 + 실패 사유 사람 말로 (레퍼런스 점검 2-1)

근거: HIG Badging("그 섹션에 확인할 게 있다"는 신호) + NN/g(개입 필요 신호에만 배지 — 남용 시 무감각화).

- TabBar가 registerQueue 실패 건수를 useSyncExternalStore로 구독 → 등록 탭 아이콘 우상단
  `--fail` 배지(9+ 캡, sr-only 문장 동반). 성공/대기엔 배지 없음.
- 덤 발견(시안 캡처 중): 실패 목록이 "NETWORK_ERROR" 원시 코드 노출 — 「시스템 내부어 금지」 위반.
  → 렌더 시 코드→문장 치환(FAIL_REASON_LABELS 4종), 서버가 준 한글 메시지는 그대로.
- styles/base.css에 .sr-only 유틸 신설(표준 clip 패턴).

## 완료 조건: 다른 탭에서 실패 2건 배지 확인 컷 · 전 게이트 통과
