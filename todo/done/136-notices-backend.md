# 136 · notices-backend — 공지 저장소: 23_NOTICES 시트 + notices 액션 (도움말 1/3)

배경(사용자 요청): 관리자(진수)가 사서에게 공지를 남길 곳 + 기능 사용법을 보여줄 탭.
설계 판단 — 보는 곳은 전부 웹앱(도움말 뷰), 공지 "글" 저장소만 시트의 새 탭:
공지의 생명은 배포 없는 즉시 게시다. 레포 내장이면 한 줄마다 빌드·배포가 필요하지만
시트 행이면 폰 Sheets 앱에서 10초에 올리고 웹앱에 바로 뜬다(시트=이 시스템의 DB 관례).
사용법 가이드는 반대로 기능과 함께 버전돼야 하므로 앱 번들 내장(138).

할 일:
1. HEADERS '23_NOTICES': ['notice_id','title','body','level','pinned','starts_at','ends_at',
   'status_code','created_at','created_by'] — level: INFO/WARN, pinned: TRUE/공백,
   기간 공백 = 상시. 22까지 사용 중이라 23.
2. upgradeSchemaClassBirth_에 23_NOTICES 생성(없으면 ensureSchema_식 생성+서식) 통합 —
   배포 후 조치가 메뉴 1회로 유지되게. 메뉴 라벨을 「스키마 업그레이드」로 일반화하고
   (반·생년 명칭은 더 이상 전부를 담지 못함) 이를 참조하는 오류 메시지 2곳(registerMember_/
   updateMember_)·웹앱 힌트 문구(views.members.birthYearNotReady ko/en)·PATCH_NOTES 대장
   문구를 함께 갱신(이름 불일치 안내는 사서를 헤매게 한다).
3. apiWebNotices_(읽기 전용): status ACTIVE + (starts_at 공백 또는 ≤now) + (ends_at 공백
   또는 ≥now) 필터, pinned 우선 → created_at desc, 상한 50. 응답: {notices:[{noticeId,
   title, body, level, pinned, createdAt(포맷)}]}.
4. doPost 'notices' 1줄. PATCH_NOTES 대장 #4 + todo/136 절(공지 작성법: 시트에 행 추가 —
   title·body만 필수, 나머지 공백이면 즉시·상시·INFO).

완료 조건: gs 문법 검증 + 대장 갱신 + 커밋/푸시.
