# 137 · help-view — 도움말 뷰 뼈대: 공지 섹션 + 새 공지 부팅 토스트 (도움말 2/3)

할 일:
1. ViewId 'help' — registry(아이콘 CircleHelp, roles LIBRARIAN, scan none, desktop min
   [520,560], 모바일 더보기), viewResolver, i18n(registry.help.title 도움말/Help).
2. services/noticeData.ts: fetchNotices() — UNKNOWN_ACTION → unavailable(공지 섹션에
   "서버 업데이트 후 표시" 한 줄, 가이드는 정상 표시 — 미배포에도 탭 가치 유지). 캐시 60s.
3. views/help/index.tsx: 상단 공지 섹션(레벨 pill INFO/WARN, 고정 우선, 날짜) + 아래 138의
   가이드 슬롯. 빈 공지 = "새 공지가 없어요".
4. 새 공지 알림: localStorage 'notices:lastSeen'(최신 createdAt) 비교 — 셸 부팅 시 새 공지
   있으면 토스트 1회 "새 공지: {title} — 도움말에서 확인"(양 셸 공통 서비스에서, 타이머 없이
   부팅 1회만). 도움말 열람 시 lastSeen 갱신. 배지 인프라 신설은 보류(최소 표면).
5. mock: notices 2건(INFO 고정 1 + WARN 1) — e2e·캡처용.

완료 조건: verify·build·e2e green + 캡처 + 커밋/푸시.
