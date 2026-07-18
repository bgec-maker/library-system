# 66 · backtrap-e2e — 모바일 뒤로가기 트랩·스택 e2e

배경: StackNav의 히스토리 트랩(루트 back=앱 유지, depth 복원)은 iOS PWA 이탈 방지 핵심인데
자동화가 없다 — 57 pop 모션·69 역재생이 이 위를 지나간다.

할 일: 더보기→리포트 push→page.goBack()→루트 유지 단정, 이중 push 후 연속 back, 탭 전환 시
reset. popstate 시퀀스 단정.

완료 조건: e2e 통과(9스펙).
