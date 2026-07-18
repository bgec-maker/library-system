# 85 · cover-fallback — 표지 이미지 폴백 전수

배경: cover_url 로딩 실패 시 회색 상자·깨진 아이콘이 화면마다 다르게 나올 수 있다.

할 일: 공용 CoverThumb 컴포넌트(onError→BookOpen 플레이스홀더, width/height 고정 — perf 게이트
정합) 신설, 등록 확인·상세·학생방 치환.

완료 조건: 실패 URL 캡처 1장, 전 게이트.
