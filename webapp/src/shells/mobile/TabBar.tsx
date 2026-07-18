import { Ellipsis } from 'lucide-react';
import type { ViewId, ViewMeta } from '../../types';
import { useRegisterFailedCount } from '../useRegisterFailedCount';
import { t } from '../../i18n';

const TAB_ICON_SIZE = 20;

// FRONTEND.md '모바일 셸 — 탭 + 스택': 하단 탭 = registry가 내려주는 탭(loan-return/register/search)
// + 셸이 덧붙이는 "더보기"(moreMenuViews를 리스트로 보여주는 자체 화면, registry엔 없는 셸 전용 슬롯).
// "더보기"는 ViewId가 아니므로 활성 탭 타입을 ViewId보다 한 칸 넓힌다.
export type TabSelection = ViewId | 'more';

interface TabBarProps {
  tabs: ViewMeta[];
  activeId: TabSelection;
  onSelect: (id: TabSelection) => void;
}

function labelFor(meta: ViewMeta): string {
  // tab 0(loan-return)은 registry 타이틀("대출·반납") 대신 "스캔"으로 표시(작업 지시 그대로) —
  // 스캔이 이 셸의 기본 진입 화면이라는 걸 탭 라벨에서부터 드러낸다.
  return meta.id === 'loan-return' ? t('shell.mobile.scanTabLabel') : meta.title;
}

// todo/53(HIG Badging) — 실패 건수 구독은 todo/62에서 셸 공용 훅(../useRegisterFailedCount)으로
// 승격: 같은 신호를 데스크톱 도크도 표시한다. 배지는 개입 필요 신호에만(인터랙션 표준).

/** 하단 탭바 — 터치 타깃 44px 이상(.m-tab min-height 52px, mobile.css). */
export default function TabBar({ tabs, activeId, onSelect }: TabBarProps) {
  const failedCount = useRegisterFailedCount();
  return (
    <nav className="m-tabbar" aria-label={t('shell.mobile.tabBarLabel')}>
      {tabs.map((meta) => {
        const Icon = meta.icon;
        const badge = meta.id === 'register' && failedCount > 0 ? (failedCount > 9 ? '9+' : String(failedCount)) : null;
        return (
          <button
            key={meta.id}
            type="button"
            className={`m-tab${activeId === meta.id ? ' active' : ''}`}
            aria-current={activeId === meta.id ? 'page' : undefined}
            onClick={() => onSelect(meta.id)}
          >
            <span className="m-tab-icon" aria-hidden="true">
              <Icon size={TAB_ICON_SIZE} />
              {badge && <span className="m-tab-badge">{badge}</span>}
            </span>
            {badge && <span className="sr-only">{t('shell.mobile.registerFailedBadge', { count: String(failedCount) })}</span>}
            <span className="m-tab-label">{labelFor(meta)}</span>
          </button>
        );
      })}
      <button
        type="button"
        className={`m-tab${activeId === 'more' ? ' active' : ''}`}
        aria-current={activeId === 'more' ? 'page' : undefined}
        onClick={() => onSelect('more')}
      >
        <span className="m-tab-icon" aria-hidden="true">
          <Ellipsis size={TAB_ICON_SIZE} />
        </span>
        <span className="m-tab-label">{t('common.more')}</span>
      </button>
    </nav>
  );
}
