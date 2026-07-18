# 32 · security-pass — 보안 점검 (GAS·Pages 맞춤 체크리스트)

## 왜
범용 보안 점검(SQLi 등)은 이 구조와 안 맞다. 이 프로젝트 고유 표면을 점검한다.

## 체크리스트
1. CSV 내보내기 인젝션(DataTable csv.ts — =+-@ 시작 셀 이스케이프)
2. dangerouslySetInnerHTML/직접 DOM 주입 0건 확인
3. coverUrl 등 외부 URL이 src로 렌더되는 지점의 스킴 검증(http/https만)
4. 토큰 취급: localStorage 평문(🟡 로그인 결정 전 현행 유지 — 기록만),
   H3 GET 재시도 시 token 쿼리스트링(의도된 설계 — 위험도만 기록)
5. 비밀값 grep 재확인, e2e/mock에 실키 부재
## 원칙: 안전하고 결정 불요한 수정만 적용. 정책 딸린 것(4번)은 발견 기록 + 권고만 —
사용자 결정 목록에 추가하지 않고 이 파일 하단 「발견」 절에 남긴다.
## 완료 조건: 체크 5종 결과 기록, 적용 수정 검증 통과
