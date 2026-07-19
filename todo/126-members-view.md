# 126 · members-view — 웹앱 학생 관리 뷰 뼈대 (목록·검색·반 필터·미배포 폴백)

배경: 학생 관리가 시트 사이드바에만 있어 사서가 웹앱↔시트를 오간다. 난민학교 운영 특성상
"반 이동"이 수시 작업이므로 웹앱 상주 표면이 필요. 이 항목은 조회 절반(뼈대+목록), 쓰기
절반(등록·수정·일괄)은 127.

할 일:
1. types.ts ViewId에 'members' | registry.ts 항목(아이콘 Users, roles LIBRARIAN,
   scan 'focus' — 학생 카드 스캔 시 해당 학생으로 점프는 scanBus의 회원 분류가 지원할 때만,
   아니면 'none'으로 시작하고 사유를 코멘트) | viewResolver lazy 등록 | 모바일 더보기 경로
   (탭 0·1·2 포화), desktop.min [640,560].
2. src/services/memberData.ts: fetchMemberList(query, classCode, status) —
   UNKNOWN_ACTION → {unavailable:true} (settingsData.fetchSchemaReport 선례 그대로),
   registerMemberApi/updateMemberApi/fetchClassCodes. 목 데이터 없음 — unavailable이 곧 안내
   화면이므로 샘플 폴백 금지(101 교훈: 형 무차별 목이 스모크를 오염).
3. views/members/index.tsx + members.css:
   - 헤더: 검색 input(이름·회원번호, 300ms 디바운스) + 반 필터 칩(전체/각 반 — classes 동봉
     데이터) + 상태 select(재학중 기본/전체/졸업/탈퇴).
   - DataTable: 회원번호(mono) · 이름 · 반(라벨) · 출생연도 · 대출중(수) · 상태(pill).
     cardMetaColumns 2, 이름 nowrap. 행 클릭 → 선택(127의 편집 카드가 붙을 자리 — 이번엔
     선택 하이라이트까지만).
   - 폴백 3태: unavailable → "GAS 새 버전 배포가 필요해요" 안내(재배포 대장 문구와 동일 톤)
     / birthYearReady=false → 상단 힌트 줄("스키마 업그레이드 메뉴 실행 전 — 출생연도 저장
     불가") / 빈 목록 → 빈 상태 안내 + 127의 등록 유도 문구 자리.
   - 스켈레톤: DataTable 내장 스켈레톤 재사용(첫 로드만 — DESIGN.md 관례).
4. i18n ko/en: registry.members.title(학생 관리/Students), views.members.* 전 키.
5. e2e/mockApi.ts: memberList 핸들러 + 픽스처(★가짜 이름만 — 'Mock Ari' 등. 실제 학생
   이름·생년 금지, 공개 레포 아동 PII), classes LOVE/HOPE/FAITH.

완료 조건: verify 전 게이트 + 기존 e2e 15본 green(신규 spec은 129) + 캡처(데스크톱·모바일)
+ 커밋/푸시. 번들 예산: work 청크는 lazy 분할이라 members 청크 신설 — check-bundle-budget에
새 청크 한도 등록 필요 여부 확인.
