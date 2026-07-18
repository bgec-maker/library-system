# 61 · queue-unit-tests — registerQueue 단위 테스트 상주화

배경: 등록 큐(28)·부팅 자동 재개(60)는 e2e로만 보증 — 백오프·이월·상한 같은 미세 로직은
단위층이 맞다. tests/unit 러너(42)에 api 스텁 주입 패턴(writeRetry.test 참고)이 이미 있다.

할 일: 큐 순서 보장(1 in-flight)·백오프 시퀀스·MAX_ATTEMPTS 소진→실패 이월(lastErrorCode 보존)·
부팅 재개 선별(재시도형만·상한 3회·VALIDATION 제외)·done 30건 유지 — 가짜 타이머로.
주의: 모듈 싱글턴이라 테스트 간 localStorage·모듈 상태 리셋 유틸 필요.

완료 조건: npm run test:unit에 포함, 전 게이트.
