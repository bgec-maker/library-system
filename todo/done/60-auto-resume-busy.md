# 60 · auto-resume-busy — BUSY류 등록 실패, 다음 부팅 자동 재개 (사용자 승인 — 실사례)

실사례: 서버 락 혼잡 지속 → 백오프 5회 소진 → 실패 2건 → 사서가 수동 재시도.
todo/28의 "자동 재시도 없음" 원칙을 **서버 일시 장애류에 한해** 개정한다(사용자 승인).

- FailedEntry에 lastErrorCode·autoResumes 보존(moveToFailed에서 이월). 구버전 저장분은
  코드가 없어 분류 불가 → 보수적으로 자동 재개 제외(수동 버튼 유지).
- 부팅 시 resumeRetryableFailuresAtBoot_: 재시도형 코드(BUSY_RETRY·NETWORK_ERROR·
  CLIENT_TIMEOUT·DUPLICATE_REQUEST)만 같은 requestId로 재큐 — 서버 멱등이 중복 흡수.
  VALIDATION류(내용 문제)는 계속 수동: 다시 보내도 같은 이유로 실패하는 부류.
- 부팅당 1회 · 항목 생애 상한 3회(autoResumes) — 영구 장애 시 무한 되살림 방지,
  실패 목록+탭 배지로 수렴.
- 데스크톱 셸에 registerQueue 사이드이펙트 임포트 — 재개 시점을 모바일(TabBar 적재)과
  동일하게 "셸 부팅 즉시"로. (기존엔 등록 창을 열어야 모듈이 깨어났다.)
- e2e 추가(6번째 스펙): BUSY 실패 시딩 → 부팅만으로 같은 requestId 전송 1회 → 트레이 완료,
  VALIDATION 시딩 건은 실패 목록에 그대로 — 선별 기준까지 단정.

## 완료 조건: e2e 6스펙 통과 · 전 게이트 통과
