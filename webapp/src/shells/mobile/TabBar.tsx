import { useSyncExternalStore } from 'react';
import { Ellipsis } from 'lucide-react';
import type { ViewId, ViewMeta } from '../../types';
import { onRegisterQueueChange, readFailedList } from '../../services/registerQueue';
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

/** todo/53(레퍼런스 점검 2-1, HIG Badging) — 등록 파이프라인의 백그라운드 실패는 등록 화면에 들어가야만
 *  보였다. registerQueue는 뷰가 닫혀도 도는 모듈 싱글턴이므로, 탭바가 직접 실패 건수를 구독해
 *  "그 섹션에 확인할 게 있다"를 iOS 관례(빨간 배지)로 알린다. 성공/대기는 배지 없음 — 배지는
 *  개입이 필요한 신호에만 쓴다(HIG: 남용 시 무감각해짐). */
function useRegisterFailedCount(): number {
  return useSyncExternalStore(onRegisterQueueChange, () => readFailedList().length);
}

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
