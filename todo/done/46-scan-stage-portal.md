# 46 · scan-stage-portal — 카메라 스테이지가 탭바 뒤에 갇히는 문제 (현장 제보 4)

## 증상 (아이폰 3:55 스크린샷)
카메라 활성 시 풀스크린 스캔 무대가 헤더 아래에서 시작하고, 하단 컨트롤(종료·토치)이
탭바 뒤에 깔려 눌 수 없음.

## 원인
.scan-stage는 position:fixed·inset:0·z-index 9200의 풀스크린 오버레이로 설계됐지만(H1),
마운트 위치가 뷰 트리 안(register/loan-return 뷰 → .m-shell-main)이다. iOS WebKit은
-webkit-overflow-scrolling:touch 스크롤 컨테이너 안의 fixed 요소를 컨테이너에 가두는
버그 부류가 있어, 무대가 .m-shell-main 박스에 갇히고 z-index도 그 스택 컨텍스트에 갇혀
DOM상 뒤에 오는 탭바가 위에 그려진다. (안드로이드 크롬은 표준대로라 증상 없을 가능성 —
미확인, 수정은 양쪽 모두 무해)

## 수정
MobileScanStage 루트를 createPortal(…, document.body)로 이동 — fixed 오버레이의 표준
탈출로. React 트리는 그대로라 상태·구독 무영향. components/** 계층이라 뷰 경계 린트와
무관. 데스크톱 ScannerWindow는 별도 구현이라 범위 밖.

## 검증
모바일 e2e에 "카메라 시작 → 무대가 body 직속 + 탭바 위 z" 단정은 카메라 스트림이 없어
제한적 — getUserMedia 목 없이 무대만 띄우는 경로가 없으므로, 포털 자체는 DOM 구조
단정(스테이지 부모=body)으로 검증 불가 시 실기기 확인을 완료 조건으로 한다.
로컬은 전 게이트 회귀 없음.
