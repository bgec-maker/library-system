import { Suspense, forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import type { ShellContext, ViewId } from '../../types';
import { getViewMeta } from '../../registry';
import { VIEW_COMPONENTS } from '../../viewResolver';
import { ViewErrorBoundary } from '../../components/ViewErrorBoundary';
import { t } from '../../i18n';

// FRONTEND.md '모바일 셸 — 탭 + 스택': book-detail 같은 push 전용 뷰(registry의 mobile.tab이 없는 뷰)를
// 위한 스택 내비게이터. 브라우저/제스처 뒤로가기(popstate) 또는 자체 뒤로가기 버튼으로 pop하고,
// 루트(스택 빈 상태)에서 뒤로가기는 탭을 유지한 채 앱을 벗어나지 않는다(설치형 PWA에서 "종료"로
// 보이는 걸 막는다 — history에 depth-0 sentinel을 항상 유지·재적재하는 표준 트랩 패턴).

interface StackEntry {
  key: string;
  viewId: ViewId;
  params: Record<string, unknown>;
  title: string;
}

export interface StackNavHandle {
  push(viewId: ViewId, params?: Record<string, unknown>): void;
  pop(): void;
  /** 스택을 즉시 루트로 비운다 — 탭 전환 시 이전 탭에 남아있던 push 화면을 정리하는 데 쓴다. */
  reset(): void;
}

interface HistoryState {
  __mstackDepth?: number;
}

interface StackNavProps {
  /** 스택 화면 안에서 shell.open()이 호출됐을 때 상위(MobileShell)가 tab 전환/재-push를 판단하도록 위임. */
  onOpen: (viewId: ViewId, params?: Record<string, unknown>) => void;
  toast: ShellContext['toast'];
  /** 스택 깊이·최상단 뷰가 바뀔 때마다 알림(스캔 라우팅·카메라 on/off 판단용, MobileShell 참고). */
  onDepthChange?: (depth: number, topViewId: ViewId | null) => void;
}

function readDepth(state: unknown): number {
  const s = state as HistoryState | null;
  return typeof s?.__mstackDepth === 'number' ? s.__mstackDepth : 0;
}

const StackNav = forwardRef<StackNavHandle, StackNavProps>(function StackNav({ onOpen, toast, onDepthChange }, ref) {
  const [stack, setStack] = useState<StackEntry[]>([]);
  const stackRef = useRef<StackEntry[]>(stack);
  stackRef.current = stack;
  const depthCbRef = useRef(onDepthChange);
  depthCbRef.current = onDepthChange;

  // 루트 sentinel: 마운트 시 depth-0 히스토리 엔트리를 하나 더 쌓아, "이 세션에서 처음 누르는
  // 뒤로가기"가 앱 바깥(진짜 이전 페이지/PWA 종료)으로 새지 않고 우리 popstate 핸들러로 먼저 들어오게 한다.
  useEffect(() => {
    window.history.pushState({ __mstackDepth: 0 } satisfies HistoryState, '');
  }, []);

  useEffect(() => {
    function handlePopState(e: PopStateEvent) {
      const targetDepth = readDepth(e.state);
      setStack((prev) => (prev.length > targetDepth ? prev.slice(0, targetDepth) : prev));
      if (targetDepth === 0) {
        // 루트까지 왔다 — 여기서 한 번 더 뒤로가면 앱을 벗어난다. sentinel을 즉시 재적재해
        // "탭 유지 · 앱 종료 아님"을 만족시킨다(값을 소비만 하고 화면은 그대로).
        window.history.pushState({ __mstackDepth: 0 } satisfies HistoryState, '');
      }
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    depthCbRef.current?.(stack.length, stack.length ? stack[stack.length - 1].viewId : null);
  }, [stack]);

  useImperativeHandle(
    ref,
    () => ({
      push(viewId, params = {}) {
        // todo/66(e2e가 적발) — pushState를 setState 업데이터 **밖**에서 호출한다. 업데이터는
        // React가 재실행할 수 있는 순수 함수여야 하는데(StrictMode dev는 실제로 2회 호출),
        // 안에 두면 같은 화면이 히스토리에 두 번 적재돼 뒤로가기가 한 번 씹힌다. 깊이는
        // 리렌더 타이밍과 무관하게 정확해야 하므로 stackRef(렌더마다 동기화) 기준으로 계산.
        const meta = getViewMeta(viewId);
        const entry: StackEntry = {
          key: `${viewId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          viewId,
          params,
          title: meta?.title ?? viewId
        };
        window.history.pushState({ __mstackDepth: stackRef.current.length + 1 } satisfies HistoryState, '');
        setStack((prev) => [...prev, entry]);
      },
      pop() {
        if (stackRef.current.length === 0) return;
        window.history.back();
      },
      reset() {
        if (stackRef.current.length === 0) return;
        window.history.go(-stackRef.current.length);
      }
    }),
    []
  );

  if (stack.length === 0) return null;

  const top = stack[stack.length - 1];
  const Comp = VIEW_COMPONENTS[top.viewId];

  const shell: ShellContext = {
    setTitle(title) {
      setStack((prev) => prev.map((entry) => (entry.key === top.key ? { ...entry, title } : entry)));
    },
    requestClose() {
      if (stackRef.current.length === 0) return;
      window.history.back();
    },
    open(viewId, params) {
      onOpen(viewId, params);
    },
    toast,
    platform: 'mobile',
    // StackNav는 스택 최상단 화면 1개만 렌더한다(위 `if (stack.length === 0) return null` +
    // `top = stack[stack.length - 1]`) — 데스크톱과 달리 "여러 화면 중 어느 걸 인쇄?" 구분이
    // 필요 없어 표식 클래스 없이 그냥 연다(styles/print.css가 .m-stack-overlay 등을 항상 해제).
    print() {
      window.print();
    }
  };

  return (
    <div className="m-stack-overlay" role="dialog" aria-modal="true">
      <header className="m-stack-header">
        <button type="button" className="m-stack-back" onClick={() => window.history.back()} aria-label={t('common.back')}>
          <ChevronLeft size={24} aria-hidden />
        </button>
        <h1 className="m-stack-title">{top.title}</h1>
        <span className="m-stack-spacer" aria-hidden="true" />
      </header>
      <div className="m-stack-body">
        {/* todo/25 — 뷰 크래시가 탭바·스택 전체가 아니라 이 화면 하나만 죽이게 격리한다.
            key={top.key}는 스택 항목마다 이미 고유(위 push()에서 발급)하므로, 뒤로 갔다 다른
            화면으로 넘어가면 이전 화면의 크래시 상태가 새 화면으로 새지 않고 바운더리째
            새로 만들어진다. "창" 개념이 없는 모바일이라 onReopen 없이 내부 리마운트만으로
            충분하다(Window.tsx의 onReopen과 대응). */}
        <ViewErrorBoundary key={top.key}>
          <Suspense fallback={<div className="m-shell-loading">{t('common.loading')}</div>}>
            <Comp shell={shell} params={top.params} />
          </Suspense>
        </ViewErrorBoundary>
      </div>
    </div>
  );
});

export default StackNav;
