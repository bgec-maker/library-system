import { Library, Settings, SquareDashed } from 'lucide-react';
import { viewsForRole } from '../../registry';
import { openSessionSettings } from '../../services/sessionSettingsUi';
import { setLocale, t, useLocale, type Locale } from '../../i18n';
import { useRegisterFailedCount } from '../useRegisterFailedCount';
import { DOCK_WIDTH, useWindowStore } from './useWindowStore';

const DOCK_ICON_SIZE = 24;

// 언어 토글 — FRONTEND.md "전환 UI: 설정·더보기". 언어 이름 자체(한국어/English)는 로케일과
// 무관하게 항상 같은 표기라 사전 키로 옮기지 않고, ASCII 로케일 코드로만 표시한다(뷰 경계
// 린트가 검출하려는 "번역이 필요한 한글 UI 카피"와는 성격이 다르다 — 언어 선택기 자체의 라벨).
function LocaleSwitch() {
  const locale = useLocale();

  function pick(next: Locale) {
    if (next !== locale) void setLocale(next);
  }

  return (
    <div className="dock-locale" role="group" aria-label={t('common.language')}>
      <button
        type="button"
        className={`dock-locale-btn${locale === 'ko' ? ' is-active' : ''}`}
        onClick={() => pick('ko')}
      >
        KO
      </button>
      <button
        type="button"
        className={`dock-locale-btn${locale === 'en' ? ' is-active' : ''}`}
        onClick={() => pick('en')}
      >
        EN
      </button>
    </div>
  );
}

// 좌측 런처 도크 — 위: 역할 필터된 앱 아이콘(클릭=열기/포커스), 아래: 최소화된 창 목록(클릭=복원+포커스).
export function Dock() {
  const windows = useWindowStore((s) => s.windows);
  const openWindow = useWindowStore((s) => s.openWindow);
  const restoreWindow = useWindowStore((s) => s.restoreWindow);
  const focusWindow = useWindowStore((s) => s.focusWindow);
  // todo/62 — 모바일 탭 배지(53)의 데스크톱 패리티: 같은 신호(등록 실패)는 두 셸에서 같게.
  // i18n 키는 53의 것을 재사용(shell.mobile.* 네임스페이스지만 문구는 셸 무관 — 키 이동은
  // 이득 대비 게이트 리스크만 있어 보류).
  const failedCount = useRegisterFailedCount();

  const views = viewsForRole('LIBRARIAN');
  const minimized = windows.filter((w) => w.minimized);

  // todo/50(디자인 연구 — 사이드바): 업무(매일 손이 가는 처리)와 관리(가끔 여는 조회·설정)를
  // 구분선으로 나눈다. registry 순서를 바꾸지 않고 앞 4개(대출·등록·검색·점검)를 업무군으로
  // 자른다 — 새 뷰가 추가되면 registry 순서가 곧 소속이다(단일 원천 유지).
  const workViews = views.slice(0, 4);
  const manageViews = views.slice(4);

  return (
    <nav className="dock" style={{ width: DOCK_WIDTH }} aria-label={t('common.appLauncher')}>
      {/* todo/51 — 브랜드 마크: 위계의 시작점(장식, 비인터랙티브). 라벨은 기존 systemBrand 키. */}
      <div className="dock-brand" title={t('print.systemBrand')}>
        <Library size={26} aria-hidden />
      </div>
      <div className="dock-apps">
        {[workViews, manageViews].map((group, gi) => (
          <div key={gi} className={`dock-group${gi > 0 ? ' dock-group--rest' : ''}`}>
            {group.map((v) => {
              const isOpen = windows.some((w) => w.viewId === v.id && !w.minimized);
              const Icon = v.icon;
              const badge = v.id === 'register' && failedCount > 0 ? (failedCount > 9 ? '9+' : String(failedCount)) : null;
              return (
                <button
                  key={v.id}
                  type="button"
                  className={`dock-icon${isOpen ? ' is-open' : ''}`}
                  title={v.title}
                  onClick={() => {
                    // todo/131 — 도크 클릭은 "그 앱으로 가기"다: 열려 있으면 포커스, 최소화면
                    // 복원, 없을 때만 새 창. 종전엔 비단일 뷰가 클릭마다 복제돼(아이콘은
                    // is-open 표시까지 하면서) 6창 상한 토스트로 끝났다. 의도적 다중 창
                    // (도서 상세 비교 등)은 뷰 내부 shell.open 경로가 종전대로 담당한다.
                    const sameView = windows.filter((w) => w.viewId === v.id);
                    const visible = sameView.filter((w) => !w.minimized);
                    if (visible.length) {
                      const top = visible.reduce((a, b) => (b.z > a.z ? b : a));
                      focusWindow(top.id);
                    } else if (sameView.length) {
                      restoreWindow(sameView[0].id);
                    } else {
                      openWindow(v.id);
                    }
                  }}
                >
                  <Icon size={DOCK_ICON_SIZE} aria-hidden />
                  {badge && (
                    <span className="dock-badge" aria-hidden="true">
                      {badge}
                    </span>
                  )}
                  {badge && <span className="sr-only">{t('shell.mobile.registerFailedBadge', { count: String(failedCount) })}</span>}
                  {/* todo/50: 호버 라벨 플라이아웃 — title 툴팁의 지연 없이 즉시 학습.
                      포인터 없는 기기에선 CSS가 아예 렌더 억제(@media hover). */}
                  <span className="dock-flyout" aria-hidden="true">
                    {v.title}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {minimized.length > 0 && (
        <div className="dock-minimized">
          {minimized.map((w) => {
            const meta = views.find((v) => v.id === w.viewId);
            const Icon = meta?.icon ?? SquareDashed;
            return (
              <button
                key={w.id}
                type="button"
                className="dock-icon dock-icon--min"
                title={`${w.title || (meta?.title ?? w.viewId)}${t('shell.desktop.minimizedSuffix')}`}
                onClick={() => restoreWindow(w.id)}
              >
                <Icon size={DOCK_ICON_SIZE} aria-hidden />
              </button>
            );
          })}
        </div>
      )}
      <LocaleSwitch />
      <button type="button" className="dock-icon dock-settings" title={t('common.settings')} onClick={openSessionSettings}>
        <Settings size={DOCK_ICON_SIZE} aria-hidden />
      </button>
    </nav>
  );
}
