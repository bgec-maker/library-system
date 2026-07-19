# 128 · homeroom-class-picker — 담임 리포트 반 선택 전환 (코드북 이중 모드)

배경: reports 뷰 담임 리포트 입력이 학년·반 **숫자**(todo/121에서 inputMode=numeric까지 줌)
— 이름 반 학교에선 아예 못 쓴다. 124가 서버에 classCode 모드를 열었으니 웹앱을 잇는다.

할 일:
1. reportData.ts: fetchClassCodes()(memberData의 것 재사용) + fetchHomeroomReport를
   (params: {classCode} | {grade,classNo}, month) 이중 서명으로 확장. HomeroomReport 타입에
   classLabel? 추가.
2. reports/index.tsx 담임 섹션: 마운트 시 classCodes 조회 —
   - 코드 있음(라벨 학교): 반 select 하나만(학년·반 숫자 입력 대체).
   - 코드 없음·unavailable(숫자 학교·미배포): 종전 학년/반 숫자 입력 그대로(회귀 0).
   인쇄 제목·본문 "n학년 n반" 표기를 classLabel 우선으로(없으면 종전 형식).
3. 대시보드 「조용한 신호」의 homeroom-report 딥링크 params가 grade/classNo를 넘기는 자리
   확인 — 라벨 모드에선 반 미지정 진입(선택 유도)으로.
4. GradeReadingGap·ClassParticipation 등 학년 축 viz는 이번 범위 밖 — 학년 공백 학교에선
   빈 데이터가 정상임을 ASSUMPTIONS에 명시(후속 후보: 반 축 viz 전환).
5. mockApi: classCodes + homeroom-report의 classCode 분기(형 검증 — 101 교훈, 모르는 형은
   UNKNOWN_ACTION이 아니라 명시 실패로).

완료 조건: verify 전 게이트 + e2e green(print-recall 포함) + 캡처(라벨 모드 select) +
커밋/푸시.
