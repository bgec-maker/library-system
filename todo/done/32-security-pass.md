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

## 발견 (2026-07-17 야간 실행)
| # | 항목 | 결과 |
|---|---|---|
| 1 | CSV 수식 인젝션 | **갭 실존 → 수정**: csv.ts에 defuseFormula(=+-@·탭·CR 시작 셀 `'` 접두, 순수 숫자 제외). 하네스로 무력화+음수 보존 검증 |
| 2 | HTML 주입 | ✅ 0건 (dangerouslySetInnerHTML·innerHTML·insertAdjacentHTML·document.write 전무 — React 이스케이프 일관) |
| 3 | 외부 URL src | **보강**: services/urlGuard.safeCoverUrl(http/https만) — register·book-detail·student BookPage 3곳 경유 |
| 4 | 토큰 취급 | 기록만(수정 없음): ① 토큰 localStorage 평문 — 🟡 로그인 방식 결정 전 현행 유지가 맞음. 공용 PC 사용 시 브라우저 프로필 분리 권고. ② H3 GET 폴백 시 token이 쿼리스트링에 노출(READ_ONLY_ACTIONS 한정) — 의도된 설계(iOS PWA 네트워크 실패 폴백). 위험: 프록시/서버 로그 잔존. 커스텀 도메인+로그인 개편 시 재검토 항목 |
| 5 | 비밀값 grep | ✅ 실키 0건 (규칙 문구 자기매치 제외), e2e 목은 'e2e-token' 더미만 |

수정 없이 기록만 한 4번을 waiting/으로 승격할지는 사용자 판단 — 로그인 결정과 한 몸이다.
