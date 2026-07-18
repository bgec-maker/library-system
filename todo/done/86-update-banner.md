# 86 · update-banner — 새 버전 감지 배너

배경: PWA는 사서가 새로고침하지 않으면 옛 번들로 오래 돈다 — 버그 수정 배포가 늦게 닿는다.

할 일: visibilitychange(복귀) 시 index.html HEAD 재조회로 __BUILD_ID__ 비교(마커 규칙 준수,
주기 타이머 금지) → 다르면 상단 배너 '새 버전 — 새로고침'(버튼=reload). 오프라인·실패 무시.

완료 조건: 목 e2e(다른 빌드 응답) 단정, 전 게이트.

---

## 이행 노트 (완료)

- vite.config.ts: transformIndexHtml 플러그인으로 `<meta name="build-id">` 주입(빌드 산출
  index.html에 1개 확인). dev 서버도 동일 변환이라 dev에선 항상 같은 값 → 배너 침묵.
- components/UpdateBanner: visibilitychange(visible 복귀)에서만 index.html no-store 재조회
  → 메타 vs __BUILD_ID__ 비교. 주기 타이머 없음(60초 최소 간격은 시각 비교로만). 오프라인·
  비정상 응답 침묵. 배너: 상단 고정 --deep, role=status, 새로고침 버튼(coarse 44px),
  150ms 슬라이드 + reduced-motion 제거.
- 부착: boot.tsx 사서 분기 전용(학생 QR 페이지는 일회성 열람이라 제외 — 번들 격리 유지).
- e2e/update-banner.spec.ts: ① 같은 빌드 침묵 ② 라우트 목으로 다른 build-id 응답 → 배너
  ③ 버튼 → 실리로드(전역 마커 소멸로 증명) + 새 문서에서 배너 부재. 전 게이트 · 12 e2e 통과.
