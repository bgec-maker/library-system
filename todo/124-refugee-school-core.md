# 124 · refugee-school-core — GAS 코어: 반 코드북·생년·검증 완화 + 재배포 대장

배경(사용자 제보 — 명렬표 사진 3장): 학교는 난민학교. 반은 이름 반(Love/Hope/Faith), 학년·
학번·출석번호가 아예 없고, 한 반 안에 출생연도가 최대 7년 섞인다(2018년생이 Hope·Faith 양쪽에
존재 — 배정은 나이순이 아니라 수준별 개별 판단). 같은 반에 Aisyah/Aisyah star/Alisyah 동거 —
이름 매칭 위험, member_no+QR 중심 설계가 정답임이 실증됨.

현 스키마 충돌: registerMember_(737행)가 STUDENT에 학년·반 **필수 + 양의 정수**를 강제
(positiveIntegerOrBlank_) — 이 학교 35명은 등록 자체가 불가.

사전 조사로 확정된 안전 조건:
- ensureSchema_는 setupLibraryMvp(수동 메뉴)에서만 호출 → HEADERS에 열 추가해도 배포만으론
  아무것도 안 깨짐. 헤더 검사도 존재 여부만 봄(순서 무관).
- appendRecord_는 record의 모르는 키를 **조용히 버림** → 마이그레이션 전 birthYear가 무음
  유실될 수 있음 — 명시 실패로 승격해야 함.
- updateKnownRow_는 없는 열 patch에 SCHEMA_MISMATCH로 이미 시끄럽게 실패.
- grade/class_no에는 시트 데이터 검증이 없음 → 반 텍스트 라벨 저장 무해.
- 16_CODEBOOK(code_group/code/label_ko/label_en/sort_order/status_code)이 이미 존재 —
  CLASS 코드군만 시드하면 "반 추가 = 시트 한 줄"로 확장 가능.

할 일 (Code.gs — 추가 위주, 수정은 registerMember_/updateMember_/reportHomeroomClass_/검증 리스트 4곳만):
1. HEADERS '09_MEMBERS' 말미에 'birth_year' 추가(맨 뒤 = 기존 데이터 무이동 append 마이그레이션).
2. 마이그레이션: upgradeSchemaClassBirth_() — ① 09_MEMBERS에 birth_year 헤더 없으면 마지막 열
   뒤에 추가(+헤더 서식·캐시 무효화) ② CODEBOOK에 CLASS 코드군 0행이면 LOVE/HOPE/FAITH 시드
   (label_ko=label_en=Love/Hope/Faith, sort 1..3, ACTIVE) ③ applyDataValidations_() 재적용.
   관리 메뉴에 'ⓢ 스키마 업그레이드(반·생년)' 항목 + UI 래퍼 runSchemaUpgradeClassBirth().
3. classValueOrBlank_(): CLASS 코드군 비어 있으면 종전 양의 정수(숫자 학교 모드), 있으면
   cleanCode_ 후 코드 존재 검증(라벨 학교 모드) — 이중 모드가 확장성의 핵심.
   birthYearOrBlank_(): 공백 허용, 1900~올해 정수.
4. registerMember_: 학생 필수 조건을 「반만」으로 완화(학년은 항상 선택·숫자면 검증),
   classNo→classValueOrBlank_, birthYear 수용(+열 없으면 SCHEMA_MISMATCH로 업그레이드 안내),
   record에 birth_year 기록. updateMember_: classNo 동일 완화 + birthYear patch(같은 안내).
5. reportHomeroomClass_: payload.classCode 모드 추가(STUDENT·ACTIVE·cleanCode_(class_no)===
   classCode 필터, grade 불요, 응답에 classCode/classLabel) — 기존 grade/classNo 경로 무수정
   유지. loanStatus 정렬에 이름 2차 키(출석번호 전무 시 안정 정렬).
6. 검증 리스트 교정: MEMBERS member_type_code에 STUDENT·TEACHER 추가(현행 GENERAL/CHILD/
   STAFF는 코드 전역이 쓰는 STUDENT와 불일치 — setAllowInvalid(false)라 UI 편집이 막히고
   셀마다 빨간 깃발), status_code에 GRADUATED 추가(졸업 처리가 이미 쓰는 값).
7. ③ 전원 진급은 무수정 — grade 공백 회원은 이미 후보 필터에서 제외됨(주석으로 명문화만).
8. PATCH_NOTES.md 상단 「🚀 GAS 재배포 대기 대장(누적)」 신설: todo/90(schemaReport)+이 항목.
   각 줄에 "배포 전 웹앱 폴백 상태" 명시. docs/HANDOFF.md에서 대장 참조.

금지: 시트 컬럼 순서 변경·이름 변경. 실제 학생 이름·생년 데이터를 레포에 커밋(아동 PII —
공개 레포. CSV는 대화로만 전달).

완료 조건: verify 전 게이트(웹앱 무변경이므로 형식상) + Code.gs 문법 검증(node --check 급
간이) + PATCH_NOTES 대장 + 커밋/푸시.
