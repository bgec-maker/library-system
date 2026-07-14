import { Ellipsis } from 'lucide-react';
import type { ViewId, ViewMeta } from '../../types';

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
  return meta.id === 'loan-return' ? '스캔' : meta.title;
}

/** 하단 탭바 — 터치 타깃 44px 이상(.m-tab min-height 52px, mobile.css). */
export default function TabBar({ tabs, activeId, onSelect }: TabBarProps) {
  return (
    <nav className="m-tabbar" aria-label="주요 화면">
      {tabs.map((meta) => {
        const Icon = meta.icon;
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
            </span>
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
        <span className="m-tab-label">더보기</span>
      </button>
    </nav>
  );
}
