import { Component, Fragment } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { t } from '../i18n';
import './ViewErrorBoundary.css';

// todo/25 위생 항목 2 — 뷰 하나가 렌더/커밋 중 던진 예외가 앱 전체(데스크톱 도크·다른 창들,
// 모바일 탭바·스택의 다른 화면)를 함께 죽이면 안 된다는 요구. React 에러 바운더리는 클래스
// 컴포넌트로만 만들 수 있다(훅 등가물이 없음 — getDerivedStateFromError/componentDidCatch는
// 클래스 라이프사이클 전용). 이 파일 하나가 뷰 컴포넌트가 실제로 마운트되는 세 곳(데스크톱
// Window.tsx, 모바일 StackNav.tsx의 push 화면, 모바일 MobileShell.tsx의 활성 탭 화면) 전부에서
// 렌더를 감싸는 유일한 자리다 — 셸마다 따로 만들지 않는다("같은 개념은 한 곳", DESIGN.md 원칙과
// 같은 결).
//
// "다시 열기" 버튼은 두 가지를 한다: (1) 이 바운더리 자신의 에러 상태를 지우고 resetKey를
// 올려 자식 서브트리를 강제로 새로 마운트한다(React가 key를 보고 이전 인스턴스를 버리고
// 새로 만든다 — 뷰 내부 state가 크래시를 유발했다면 이 리마운트만으로 복구되는 경우가 많다).
// (2) 호출자가 onReopen을 넘겼으면(데스크톱 Window.tsx가 넘긴다) 그것도 함께 실행한다 — 이미
// useWindowStore에 있는 closeWindow/openWindow를 그대로 재사용해 창 자체를 닫고 같은 뷰로 새
// 창을 연다(병렬 닫기/열기 메커니즘을 새로 만들지 않는다). 모바일 StackNav.tsx·MobileShell.tsx는
// "창" 개념이 없어 onReopen 없이 리마운트만으로 충분하다 — 각각 스택 항목 고유 key(top.key)·
// 활성 탭 id(activeTabId)를 바운더리에 그대로 넘겨주므로, 화면을 벗어나면 이전 크래시 상태가
// 다음 화면으로 새지 않고 자동으로 사라진다(React가 key 변경 시 이 컴포넌트 자체를 새로 만든다).
export interface ViewErrorBoundaryProps {
  children: ReactNode;
  /** 리셋 시 바운더리 자체 상태 초기화 외에 셸이 추가로 수행할 동작(데스크톱: 창 닫기+재오픈). */
  onReopen?: () => void;
}

interface ViewErrorBoundaryState {
  error: Error | null;
  resetKey: number;
}

export class ViewErrorBoundary extends Component<ViewErrorBoundaryProps, ViewErrorBoundaryState> {
  state: ViewErrorBoundaryState = { error: null, resetKey: 0 };

  static getDerivedStateFromError(error: Error): Pick<ViewErrorBoundaryState, 'error'> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // 사서 진단용 콘솔 로그 — api.ts의 onApiLog와 같은 결로 "무슨 일이 있었는지"는 항상 콘솔에
    // 남긴다(사용자에게는 아래 fallback UI만 보인다). 새 진단 채널을 만들지 않고 console.error만
    // 쓴다 — 이 항목의 범위는 "죽지 않기"이지 새 로깅 인프라가 아니다.
    console.error('[ViewErrorBoundary] 뷰 렌더 중 오류:', error, info.componentStack);
  }

  handleReopen = (): void => {
    this.props.onReopen?.();
    this.setState((prev) => ({ error: null, resetKey: prev.resetKey + 1 }));
  };

  render(): ReactNode {
    const { error } = this.state;
    if (error) {
      return (
        <div className="view-error-boundary panel" role="alert">
          <AlertTriangle size={28} className="view-error-boundary-icon" aria-hidden />
          <p className="view-error-boundary-message">{t('components.viewErrorBoundary.message')}</p>
          <button type="button" onClick={this.handleReopen}>
            <RotateCcw size={16} aria-hidden /> {t('components.viewErrorBoundary.reopen')}
          </button>
          <details className="view-error-boundary-detail">
            <summary>{t('components.viewErrorBoundary.detailSummary')}</summary>
            <pre>{error.message || String(error)}</pre>
          </details>
        </div>
      );
    }
    return <Fragment key={this.state.resetKey}>{this.props.children}</Fragment>;
  }
}
