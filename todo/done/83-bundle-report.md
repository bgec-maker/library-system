# 83 · bundle-report — 번들 리포트 세분화

배경: size 게이트는 총량만 본다 — 회귀가 어느 청크에서 왔는지 즉시 보이면 수리 빠르다.

할 일: npm run size가 상위 5 청크(gzip)와 직전 기록 대비 증감을 출력(기록은 scripts/size-baseline.json,
커밋 포함). 예산 초과 규칙은 기존 유지.

완료 조건: 출력 샘플 기록, verify 무영향.
