# 129 · members-e2e-docs — members e2e 회귀 + ADR·문서 마감

배경: 124~128이 만든 새 표면(회원 API·학생 관리 뷰·이중 모드)을 상주 회귀로 봉인하고,
난민학교 대응 설계 판단을 문서 정본에 남긴다.

할 일:
1. e2e/members.spec.ts: ① 목록 로드(픽스처 n명·반 라벨 표시) ② 검색(이름 부분일치)
   ③ 반 필터 칩 ④ 반 이동(행 선택→수정 카드→반 select 변경→저장 → memberUpdate 요청 본문
   단정) ⑤ 신규 등록(폼→저장→토스트+목록 증가) ⑥ 일괄 미리보기(3줄 붙여넣기→2 유효·1 오류
   표시). 스캔 상호작용은 registry scan 결정(126)에 따름.
2. 기존 15본 무손상 green(하드 게이트 — tail 파이프 금지).
3. docs/DECISIONS.md ADR-028 「난민학교 대응 — 반 코드북 이중 모드·생년·회원 웹 API」:
   신원=member_no+QR(학번 무의존)이 전제라 스키마 대수술 없이 검증 완화+코드북으로 흡수한
   판단, 전원 진급이 자연 무력화되는 구조, PII 비커밋 원칙.
4. docs/ASSUMPTIONS.md todo/124~128 절, docs/FEATURES.md 학생 관리 절, HANDOFF.md §5 스탬프
   + §6 실기기 체크리스트에 회원 항목 추가, 재배포 대장 최종 상태 확인(90·124·125 3건).
5. 최종 검증: verify 전 게이트 + build + e2e 전본 + 라이브 배포 build-id 대조(WebFetch).

완료 조건: 전부 green + 커밋/푸시 + done/ 이동 + INDEX 갱신 + 사용자 보고(대장 요약 포함).
