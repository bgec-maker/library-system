# 125 · member-web-api — 웹앱용 회원 API 4종 (memberList/Register/Update/classCodes)

배경: 학생 등록·관리는 지금 스프레드시트 사이드바(apiRegisterMember/apiUpdateMember —
google.script.run 바운드)에만 있고 doPost(웹앱 경로)에는 회원 액션이 0개다. 웹앱 학생 관리
뷰(126·127)가 설 자리를 서버부터 마련한다. 도메인 함수(registerMember_/updateMember_)는
무수정 재사용 — 사이드바 apiRegisterMember와 같은 executeWrite_ 래핑 관례.

할 일 (Code.gs 순수 추가 + doPost 배선 4줄):
1. apiWebMemberList_(payload): query(이름 부분일치·회원번호 부분일치, normalizeText_ 관례),
   classCode(cleanCode_), status('' = ACTIVE 기본, 'ALL' = 전체) 필터.
   행: memberId/memberNo/name/classNo(원값)/classCode(cleanCode_)/birthYear/grade/statusCode/
   memberTypeCode/note/openLoans(10_LOANS OPEN·미반납 집계). 정렬: 반 sort_order → 이름.
   상한 500행(totalCount 별도). 동봉: classes=getCodes_('CLASS'),
   memberStatuses=getCodes_('MEMBER_STATUS'), birthYearReady(birth_year 열 존재 여부 —
   웹앱이 마이그레이션 전 상태를 구분해 안내).
2. apiWebMemberRegister_/apiWebMemberUpdate_: executeWrite_('REGISTER_MEMBER'/'UPDATE_MEMBER')
   래핑(요청 멱등 requestId는 registerQueue 관례 그대로 payload에서). memberType 기본 STUDENT.
3. apiWebClassCodes_: { classes: getCodes_('CLASS') } — reports(128)가 가볍게 소비.
4. doPost: memberList/memberRegister/memberUpdate/classCodes 4줄 추가(기존 줄 무수정).
5. PATCH_NOTES 재배포 대장에 이 항목 추가(폴백: 배포 전 웹앱 memberList가 UNKNOWN_ACTION →
   members 뷰가 "서버 업데이트 필요" 화면 — 126의 완료 조건).

완료 조건: 문법 간이 검증 + 대장 갱신 + 커밋/푸시. (동작 e2e는 129의 mock 계약으로 상주.)
