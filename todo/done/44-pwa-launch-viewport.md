# 44 · pwa-launch-viewport — 설치형 PWA 콜드 스타트 탭바 위치 (현장 제보 2)

## 증상 (아이폰, 2026-07-17 10:48 스크린샷)
todo/43(dvh) 이후에도 **설치형 PWA를 켠 직후**엔 탭바 아래 죽은 띠가 남고, 조작을 시작하면
정돈됨. 사파리 브라우저 쪽은 dvh로 해소.

## 원인
iOS 설치형(WKWebView standalone) 콜드 스타트의 알려진 버그 부류: 첫 레이아웃이 낡은 뷰포트
높이로 계산되고, 정정 resize 이벤트가 첫 상호작용 전까지 오지 않는 경우가 있다 — dvh도 그
낡은 값 기준이라 CSS만으로는 못 잡는다.

## 수정 (셸 계층 — views/** 아님, window 사용 허용 층)
- MobileShell 마운트 시 visualViewport.height(폴백 innerHeight)를 --app-vh CSS 변수로 주입,
  visualViewport resize·orientationchange·pageshow 구독 + 초기 250ms/1000ms 재측정
  (상호작용 없이도 정정 수렴).
- .m-shell height: var(--app-vh, 100%) / @supports dvh면 var(--app-vh, 100dvh) —
  JS 미실행·구형에서도 기존 폴백 그대로.
- 부작용 검토: 키보드가 열리면 visualViewport가 줄어 탭바가 키보드 위로 올라온다 —
  안드로이드 크롬 기본 동작과 동일 계열이라 수용, 현장에서 불편하면 후속 조정.

## 검증
실기기 전용(콜드 스타트는 e2e 재현 불가) — 배포 후 사용자: 앱 스위처에서 완전히 종료 →
재실행 직후 탭바가 바닥에 붙어 있는지. 로컬은 verify·e2e 회귀 없음만.
