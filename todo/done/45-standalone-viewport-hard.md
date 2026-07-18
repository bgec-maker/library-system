# 45 · standalone-viewport-hard — 설치형 콜드 스타트 최종 보정 + 빌드 표식 (현장 제보 3)

## 증상·근거
todo/44(visualViewport 주입 + 재측정) 배포 후에도 설치형 첫 화면은 그대로(사용자 3:18
스크린샷) — 이 iOS 버그에선 **visualViewport·innerHeight 둘 다** 첫 제스처 전까지 낡은
값을 반환한다. 시간 지연 재측정은 같은 거짓을 다시 읽을 뿐.

## 수정
1. standalone(display-mode 또는 navigator.standalone)에서는 **하드웨어 화면 크기**(screen.*)
   를 하한으로 사용: h = max(visualViewport, 방향 보정한 screen 치수). black-translucent
   전체화면이라 화면 높이 = 진짜 뷰포트. screen.*은 이 버그의 영향을 받지 않는 유일한 소스.
   단 입력 포커스 중(키보드)엔 visualViewport 우선(줄어든 값이 정답).
2. 첫 페인트 직후 합성 스크롤 넛지(scrollTo 0,1→0,0) — WebKit 뷰포트 재계산 유도.
3. **빌드 ID 표식**: vite define(git short sha) → 설정 화면 하단 mono 표기. 실기기에서
   "지금 어떤 빌드인가"를 즉시 확인(이번처럼 배포/캐시 의심을 1초에 끝내기 위한 운영 장치).
## 검증: 실기기 콜드 스타트(사용자) — 빌드 ID로 버전 확인부터. 로컬은 전 게이트 회귀 없음.
