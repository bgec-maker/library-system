# 79 · recall-slip-pages — 회수 쪽지 페이지 나눔 검증

배경: 절취 쪽지가 페이지 경계에서 잘리면 안 된다는 규칙(page-break-inside)이 CSS로만 있고
실측 검증이 없다.

할 일: 30·60·120명 시나리오로 print PDF 생성(e2e pdf) → 쪽지 분할 0건 단정 스크립트.

완료 조건: 검증 스크립트가 e2e 또는 unit에 상주.
