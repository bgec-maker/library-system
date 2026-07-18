# 116 · inventory-isbn-hint — 점검 중 ISBN 오스캔 침묵 (시각 감사 14R 후속)

배경(115 진단의 파생 발견): 점검 세션에서 책 **뒤표지 EAN-13(ISBN)** 을 찍으면 조용히
무시된다 — 현장에서 가장 흔한 오조작(우리 라벨 대신 출판사 바코드)이 무피드백이라
"스캔이 안 먹네"로 읽힌다. 대출·반납엔 이미 isbnHint 관례가 있다(등록 화면으로 안내).

할 일: inventory subscribeScan에 target.kind==='isbn' 분기 — 토스트
「책 뒤 ISBN이 아니라 우리 등록번호 라벨을 스캔하세요」(1회성 안내, 세션당 스로틀 불요 —
토스트 자체가 일시적). i18n ko/en. inventory.spec에 ISBN 주입→토스트 단정 추가.

완료 조건: e2e 단정, 전 게이트.

---

## 이행 노트 (완료)

- inventory subscribeScan에 isbn 분기 — 토스트 「책 뒤 ISBN 바코드가 아니라 우리 등록번호
  라벨을 스캔하세요.」(error 톤 — 시정 필요 신호), ko/en 키 신설.
- inventory.spec ②-b 단정: ISBN 주입 → 토스트 가시 + 집계 불변. 전 게이트 · 14 e2e 통과.
