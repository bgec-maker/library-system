# 127 · member-forms-bulk — 학생 등록·수정 폼 + 붙여넣기 일괄 등록 + 35명 CSV 전달

배경: 최초 가동 시 35명(Love 5·Hope 14·Faith 16)을 넣어야 한다. 한 명씩도, 명단 붙여넣기로도
가능해야 하고, 이후 일상 운영은 "반 이동·상태 변경" 2가지가 최빈 작업.

할 일:
1. 개별 폼(등록·수정 겸용 카드, 목록 아래 배치 — 좁은 창 1열 흐름):
   이름*(텍스트) · 반*(select — classes) · 출생연도(select: 올해−2 ~ 올해−25 역순 + 미상) ·
   상태(수정 시만: MEMBER_STATUS select) · 비고(textarea). 폼 표준(118~123) 전부 준수:
   .reg-formActions 위계(주 버튼 전폭→취소 ghost), 검증 실패 markInvalid(포커스+scrollIntoView
   +aria-invalid), Enter 제출(enterKeyHint), coarse 16px는 base.css가 이미 보장.
   등록 성공 → 토스트 + 폼 유지·이름만 비움(연속 입력 — 35명 손입력 대비) + 목록 갱신.
   수정 성공 → 토스트 + 카드 닫기. 반 이동이 곧 "수정에서 반 select 변경" — 별도 UI 없음.
2. 일괄 등록 패널(details 접힘, 복본 대량 발권 BulkCopyPanel 관례):
   textarea에 "이름[,반][,출생연도]" 줄 단위(콤마·탭 구분 모두, CSV 헤더 줄 자동 무시) →
   미리보기 표(줄별 파싱 결과·오류 사유) → [n명 등록 시작] → 순차 registerMemberApi(requestId
   멱등, 실패 줄만 남겨 재시도 버튼). 감독하 일회성 작업이라 registerQueue 같은 상주 자동
   재개는 만들지 않는다(선택 근거를 ASSUMPTIONS에).
   기본 반: 파싱 줄에 반이 없으면 현재 반 필터 선택값.
3. 35명 CSV(이름,반,출생연도 — 사진 3장 판독본)를 **레포 밖** 작업 폴더에 생성해 SendUserFile
   로만 전달(아동 PII — 커밋 절대 금지). 일괄 패널에 그대로 붙여넣으면 되는 형식.
4. i18n ko/en 전 키. mockApi memberRegister/memberUpdate 핸들러(멱등: 같은 requestId 재호출
   시 동일 응답).

완료 조건: verify 전 게이트 + 기존 e2e green + 캡처(폼·일괄 미리보기) + 커밋/푸시 + CSV 전달.
