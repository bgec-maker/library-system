import { viewsForRole } from '../../registry';
import { openSessionSettings } from '../../services/sessionSettingsUi';
import { DOCK_WIDTH, useWindowStore } from './useWindowStore';

// 좌측 런처 도크 — 위: 역할 필터된 앱 아이콘(클릭=열기/포커스), 아래: 최소화된 창 목록(클릭=복원+포커스).
export function Dock() {
  const windows = useWindowStore((s) => s.windows);
  const openWindow = useWindowStore((s) => s.openWindow);
  const restoreWindow = useWindowStore((s) => s.restoreWindow);

  const views = viewsForRole('LIBRARIAN');
  const minimized = windows.filter((w) => w.minimized);

  return (
    <nav className="dock" style={{ width: DOCK_WIDTH }} aria-label="앱 런처">
      <div className="dock-apps">
        {views.map((v) => {
          const isOpen = windows.some((w) => w.viewId === v.id && !w.minimized);
          return (
            <button
              key={v.id}
              type="button"
              className={`dock-icon${isOpen ? ' is-open' : ''}`}
              title={v.title}
              onClick={() => openWindow(v.id)}
            >
              <span aria-hidden>{v.icon}</span>
            </button>
          );
        })}
      </div>
      {minimized.length > 0 && (
        <div className="dock-minimized">
          {minimized.map((w) => {
            const meta = views.find((v) => v.id === w.viewId);
            return (
              <button
                key={w.id}
                type="button"
                className="dock-icon dock-icon--min"
                title={`${meta?.title ?? w.viewId} (최소화됨)`}
                onClick={() => restoreWindow(w.id)}
              >
                <span aria-hidden>{meta?.icon ?? '▫️'}</span>
              </button>
            );
          })}
        </div>
      )}
      <button type="button" className="dock-icon dock-settings" title="설정" onClick={openSessionSettings}>
        <span aria-hidden>⚙</span>
      </button>
    </nav>
  );
}
