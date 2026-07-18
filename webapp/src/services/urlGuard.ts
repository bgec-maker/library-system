// todo/32 「보안 점검」 — 외부에서 온 URL(서지 조회 coverUrl 등)을 src로 렌더하기 전의 스킴
// 검증. img src의 javascript:는 최신 브라우저에서 실행되진 않지만, data:·blob:·상대경로 등
// 예상 밖 스킴이 UI에 흘러드는 것 자체를 한 곳에서 막는다 — 표지는 항상 원격 http(s) 이미지라는
// 전제를 코드로 못박는 것. 검증 실패는 오류가 아니라 "표지 없음"과 동일하게 취급된다(빈 문자열
// 반환 → 렌더 안 함).
export function safeCoverUrl(url: string | undefined | null): string {
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? url : '';
}
