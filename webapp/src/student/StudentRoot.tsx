import { useEffect, useState, type CSSProperties } from 'react';
import { Globe } from 'lucide-react';
import '../tokens/student.css';
import { setLocale, t, useLocale, type Locale } from '../i18n';
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

// 언어 토글 — FRONTEND.md "전환 UI: 설정·더보기 + student 표면 상단 지구본". 학생 표면은 셸이
// 없어(StudentRoot 자신이 최상위 라우터, ShellContext 통로가 아예 없음) 데스크톱
// Dock.tsx(LocaleSwitch)·모바일 MobileShell.tsx(LocaleRow)처럼 셸 컴포넌트에 심을 수 없다 —
// setLocale/getLocale/useLocale은 이미 셸과 무관한 범용 함수/훅이라 여기서 직접 호출한다
// (docs/ASSUMPTIONS.md todo/02가 "09번 항목이 학생 표면에 토글 버튼만 얹으면 되도록 만들어
// 뒀다"고 예고한 대로). 색·버튼 모양은 모바일 더보기의 .m-more-locale-btn과 같은 토큰 조합을
// 그대로 재사용하고(비활성=paper/rule, 활성=deep/#fff), 이 표면 고유 표식으로 지구본 아이콘만
// 얹는다(FRONTEND.md 문구 그대로, 사이즈는 인라인 버튼 관례인 16 — DESIGN.md 아이콘 규칙).
function StudentLocaleToggle() {
  const locale = useLocale();

  function pick(next: Locale) {
    if (next !== locale) void setLocale(next);
  }

  function btnStyle(active: boolean): CSSProperties {
    return {
      minWidth: 40,
      minHeight: 28,
      border: `1px solid ${active ? 'var(--deep)' : 'var(--rule)'}`,
      borderRadius: 'var(--radius)',
      background: active ? 'var(--deep)' : 'var(--paper)',
      color: active ? '#fff' : 'var(--ink-2)',
      font: '700 var(--fs-xs) var(--sans)',
      cursor: 'pointer'
    };
  }

  return (
    <div
      role="group"
      aria-label={t('common.language')}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 16px',
        background: 'var(--panel)',
        borderBottom: '1px solid var(--rule)'
      }}
    >
      <Globe size={16} aria-hidden style={{ color: 'var(--ink-3)' }} />
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" style={btnStyle(locale === 'ko')} onClick={() => pick('ko')}>
          KO
        </button>
        <button type="button" style={btnStyle(locale === 'en')} onClick={() => pick('en')}>
          EN
        </button>
      </div>
    </div>
  );
}

export default function StudentRoot() {
  // 언어 토글이 눌리면 이 컴포넌트가 재렌더되고, 그 아래 활성 서브뷰(BookPage/MyShelf/Ranking)도
  // 함께 재렌더돼 t()를 다시 평가한다 — DesktopShell.tsx/MobileShell.tsx의 동일 패턴(각 셸
  // 루트가 useLocale()을 구독해 자식 전체의 재렌더를 유발). StudentLocaleToggle 혼자 구독하면
  // 토글 버튼 자신의 활성/비활성 표시만 갱신되고 형제인 서브뷰는 재렌더 이유가 없어 그대로
  // 남는다 — 실제로 두 컴포넌트가 형제 관계라 이 줄 없이는 화면 본문이 언어 전환에 반응하지
  // 않는 버그가 있었다(로케일 토글 버튼 자체 상태는 바뀌는데 본문 텍스트는 그대로인 채로).
  useLocale();
  const [route, setRoute] = useState<ParsedRoute>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return (
    <>
      <StudentLocaleToggle />
      {route.sub === 'my-shelf' && <MyShelf barcode={route.barcode} />}
      {route.sub === 'ranking' && <Ranking barcode={route.barcode} />}
      {route.sub === 'book-page' && <BookPage barcode={route.barcode} />}
    </>
  );
}
