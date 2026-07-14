import { useEffect, useState } from 'react';
import '../tokens/student.css';
import BookPage from './book-page/BookPage';
import MyShelf from './my-shelf/MyShelf';
import Ranking from './ranking/Ranking';

// 학생 공개 표면 라우터 — src/student/**는 src/views/**가 아니므로 뷰 경계 린트가 적용되지 않는다.
// (뷰 경계 규칙은 "뷰는 셸을 모른다"를 지키기 위한 것이고, 학생 표면은 셸 자체와 무관한
// 완전히 별도 번들이다 — 사서 셸 코드가 여기 딸려오지 않는 게 핵심 수용 기준.)
// 여기서만 window.location.hash를 직접 파싱한다. services/session.ts·shells/**는 import하지
// 않는다 — 로그인 방식은 CLAUDE.md 🟡 미결이라 이번 라운드는 라우트 뼈대만 세운다.
//
// 지원 해시 형태(잠정 — 확정 아님, 이후 라운드에서 재검토):
//   #/b/<barcode>              → book-page (기본)
//   #/b/<barcode>/my-shelf     → my-shelf
//   #/b/<barcode>/ranking      → ranking
type SubRoute = 'book-page' | 'my-shelf' | 'ranking';

interface ParsedRoute {
  barcode: string | null;
  sub: SubRoute;
}

function parseHash(hash: string): ParsedRoute {
  const match = hash.match(/^#\/b\/([^/]+)(?:\/(my-shelf|ranking))?/);
  if (!match) return { barcode: null, sub: 'book-page' };
  return { barcode: decodeURIComponent(match[1]), sub: (match[2] as SubRoute | undefined) ?? 'book-page' };
}

export default function StudentRoot() {
  const [route, setRoute] = useState<ParsedRoute>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  if (route.sub === 'my-shelf') return <MyShelf barcode={route.barcode} />;
  if (route.sub === 'ranking') return <Ranking barcode={route.barcode} />;
  return <BookPage barcode={route.barcode} />;
}
