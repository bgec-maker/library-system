# 30 · perf-audit — 성능 예산 감사 자동화 + 위반 수정

## 왜
DESIGN·FRONTEND의 성능 법(backdrop-filter 금지·그림자 1겹·표지 width/height·초 단위 네트워크
폴링 금지)이 지금은 사람 기억에만 있다 — 기존 grep 이중방어 패턴(경계·i18n)과 같은 방식으로 CI화.

## 무엇
- scripts/check-perf-budget.mjs: ① css의 backdrop-filter 0건 ② box-shadow 다중 겹 검출
  ③ <img>에 width/height(또는 aspect-ratio 클래스) 부재 검출 ④ 60초 미만 setInterval 리터럴
  검출(허용 목록 주석 규약) — 위반 시 exit 1
- npm run verify 체인에 편입 + 현재 위반 전부 수정
## 완료 조건: 스크립트가 실제 위반을 하나 이상 잡아내는 걸 확인(일부러 위반 심어 자기검증) 후
현행 코드 0건, verify 통과

## 발견 (2026-07-17 야간 실행)
- 실위반 5건 수정: register 표지 `<img>` width/height/loading 누락 1건 + setInterval 의도
  마커 부재 4건(전부 네트워크 없음 확인: UI 틱 250ms×2 · 실행취소 1s 틱 · 대시보드 5분).
- backdrop-filter·그림자 다중 겹: 현행 0건.
- **면제 2종을 스크립트에 명시**(상세 ASSUMPTIONS.md): ① @media print 안 소형 폰트(인쇄 위계
  별도 규정) ② SVG 텍스트(fill: 블록 — viewBox 좌표계라 px≠화면px). ⚠️ viz 라벨(8~10 좌표단위)의
  **실제 렌더 크기**는 정적 판정 불가 — 좁은 모바일 폭에서 12px 미만으로 렌더될 수 있음.
  시각 감사(스크린샷 기준) 항목으로 남김 — viz-v2v3 착수 시 함께 볼 것.
