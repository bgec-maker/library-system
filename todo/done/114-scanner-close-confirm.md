# 114 · scanner-close-confirm — 연속 모드 종료 확인이 OS 네이티브 confirm (시각 감사 13R)

배경(캡처 시도에서 확인): 연속 모드 중 스캐너 창 닫기의 확인이 window.confirm — 앱의
ConfirmDialog(디자인 시스템·포커스 트랩·danger 위계)와 어긋난 유일한 네이티브 다이얼로그.
e2e에선 자동 무시돼 시야에도 안 잡혔다.

할 일: 스토어에 closeConfirmPending 상태 — closeScannerWindow()는 연속 모드면 pending만
세우고(최소화 상태면 복원해 다이얼로그가 보이게), ScannerWindow가 ConfirmDialog 렌더.
확인→강제 닫기(force), 취소→pending 해제. S 단축키 토글 경로도 자동 수렴.
i18n: closeConfirmTitle 신설(본문은 기존 confirmCloseContinuous 재사용).

완료 조건: 다이얼로그 캡처, 전 게이트, e2e.

---

## 이행 노트 (완료)

- scannerWindowStore: closeConfirmPending 상태 + closeScannerWindow(force) 2단계·
  cancelCloseScannerWindow() — 최소화 상태였다면 복원해 다이얼로그 가시 보장. 네이티브
  window.confirm 제거(이 코드베이스 마지막 네이티브 다이얼로그).
- ScannerWindow: ConfirmDialog 렌더(제목 「연속 모드 종료」 신설 키, 본문 기존 문구 재사용,
  확인=닫기 danger). 캡처(/tmp/vis/r15-scanner-close-confirm.png)로 디자인 시스템 일치 확인.
- 전 게이트 · 13 e2e 통과.
