# 113 · bulk-dual-title — 복본 추가 발급 이중 제목 (시각 감사 12R)

배경(증빙 /tmp/vis/r14-bulk-partial.png): 접힘 summary 「복본 추가 발급」을 펼치면 패널
안 h2가 같은 문구를 또 쓴다 — DESIGN.md 이중 제목 금지(뷰 h1 sr-only 결과 같은 원칙)의
잔여 위반. 유일 사용처가 details 내부라 패널 h2는 sr 전용으로 강등이 맞다.

할 일: BulkCopyPanel h2를 sr-only로(스크린리더 문맥은 유지 — details 밖 재사용 대비),
시각적으론 summary 한 줄만. 재캡처 확인.

완료 조건: 재캡처, 전 게이트, e2e.

---

## 이행 노트 (완료)

- BulkCopyPanel h2를 sr-only로 — summary 한 줄만 시각 노출(재캡처 /tmp/vis/113-crop.png:
  「▼ 복본 추가 발급」 아래 바로 오류 배너·재시도 버튼). 부분 실패 상태(2/5+나머지 3권
  재시도)의 시각도 이번 라운드에서 건전 확인.
- 전 게이트 · 13 e2e 통과.
