# 85 · cover-fallback — 표지 이미지 폴백 전수

배경: cover_url 로딩 실패 시 회색 상자·깨진 아이콘이 화면마다 다르게 나올 수 있다.

할 일: 공용 CoverThumb 컴포넌트(onError→BookOpen 플레이스홀더, width/height 고정 — perf 게이트
정합) 신설, 등록 확인·상세·학생방 치환.

완료 조건: 실패 URL 캡처 1장, 전 게이트.

---

## 이행 노트 (완료)

- `components/CoverThumb.tsx` + `.css` 신설: safeCoverUrl 가드 내장, onError→broken 상태,
  URL 변경 시 리셋. 없음/실패 모두 동일 플레이스홀더(BookOpen + emptyLabel 옵션).
  img에 width/height/loading="lazy" 상시 부착(perf 게이트 정합).
- 적용 3처: 도서 상세(120×168, 표지 없음 라벨) · 등록 확인(56×80 — 기존엔 URL 없으면 칸
  자체가 사라져 레이아웃이 널뛰었는데 이제 상시 표시) · 학생 책 페이지(flexShrink 고정).
- safeCoverUrl 개별 임포트 3곳 제거(가드는 CoverThumb 내부 단일 경로).
- 증빙: 등록 lookupIsbn 라우트로 죽은 표지 URL 주입 + route.abort → `.cover-thumb--empty`
  가시 확인, /tmp/cover-fallback.png 캡처. 전 게이트 · 빌드 · e2e 11개 통과.
