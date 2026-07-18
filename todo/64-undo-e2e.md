# 64 · undo-e2e — 언두바 회귀 e2e

배경: 언두(대출 직후 실행취소)는 NN/g 원칙의 축인데 e2e 무방비 — 리스킨·모션이 계속 이 위를
지나간다.

할 일: 대출 1건 → 언두바 노출 단정 → 실행취소 → copyStatus 재조회가 AVAILABLE 복귀 단정 +
같은 requestId 재사용 없는지(언두는 새 requestId) 확인. 목은 installApiMock 확장.

완료 조건: e2e 스위트 통과(7스펙).
