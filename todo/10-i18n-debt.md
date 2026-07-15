# 10 · i18n 부채 상환 (ASSUMPTIONS 자백분)
- 린트 확장: JSX 밖 한글 문자열(toast·throw·alert 인자 등) 검출 — console.* 제외 허용목록
- Window.tsx가 로케일 변경 구독 → 열린 창 제목 즉시 갱신
완료: 하드코딩 toast('한글') 심으면 CI 실패 · 토글 시 열린 창 제목 변경
