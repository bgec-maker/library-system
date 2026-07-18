# 101 · e2e-report-mock-types — e2e 리포트 목의 형 무차별 응답 교정 (시각 감사 6R)

배경(증빙 /tmp/vis/r3-d1-homeroom.png): e2e 목(mockApi)의 'report' 케이스가 type 파라미터와
무관하게 미대출(noLoanFinder) 모양만 돌려줘, 담임 리포트 미리보기가 오류 경계로 떨어진다 —
스모크의 인쇄 스냅샷(미대출)만 살고 나머지 5종 패널은 e2e에서 열어볼 수 없는 상태.
(실환경·샘플 폴백 경로는 무관 — 목의 한계가 감사 시야를 가린 것.)

할 일: mockApi 'report'를 type 인식으로 — noLoanFinder는 현행 유지, 그 외 type은
UNKNOWN_ACTION 반환(각 패널이 자기 샘플 목으로 폴백해 렌더). 시각 감사 캡처로 6종 패널
전부 열림 확인.

완료 조건: 리포트 6종 캡처 전부 렌더(오류 경계 0), 전 게이트, e2e.

---

## 이행 노트 (완료)

- mockApi 'report' 케이스: type 인식 — noLoanFinder만 실모양 응답(스모크 인쇄 스냅샷 유지),
  그 외 type은 UNKNOWN_ACTION → 각 패널이 자기 샘플 목으로 폴백(실환경 계약과 일치).
- 시각 감사 캡처: 6종 패널(담임·죽은장서·회수·기증·연간·미변상) 전부 렌더, 오류 경계 0
  (/tmp/vis/r6-*.png — 교정 전 담임 리포트는 오류 경계로 떨어졌었다).
- 전 게이트 · 12 e2e 통과.
