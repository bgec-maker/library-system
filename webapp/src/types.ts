// FRONTEND.md — ViewRegistry 단일 원천에서 쓰는 공용 타입.
// 이 파일은 셸·뷰·서비스 모두가 참조하는 계약이므로 함부로 넓히지 않는다.
import type { LucideIcon } from 'lucide-react';

export type Role = 'LIBRARIAN' | 'STATION';

export type ViewId =
  | 'loan-return'
  | 'register'
  | 'search'
  | 'book-detail'
  | 'inventory'
  | 'recent-ops';

export type ScanInterest = 'focus' | 'none';

export interface ViewMeta {
  id: ViewId;
  title: string;
  /** lucide-react 아이콘 컴포넌트 — 셸이 size/stroke를 지정해 렌더한다(색은 currentColor). */
  icon: LucideIcon;
  roles: Role[];
  scan: ScanInterest;
  desktop: { min: [number, number]; single?: boolean };
  mobile: { tab?: number };
}

export type ToastKind = 'success' | 'error' | 'info';

// 뷰가 셸에게 원하는 것의 전부 — 이 인터페이스 밖으로 뷰가 셸에 닿을 방법은 없다(린트로 강제).
export interface ShellContext {
  setTitle(title: string): void;
  requestClose(): void;
  open(viewId: ViewId, params?: Record<string, unknown>): void;
  toast(message: string, kind?: ToastKind): void;
  /** 셸 종류 — 반응형 판단(matchMedia/innerWidth)을 뷰가 직접 하지 못하게, 셸이 이미 판정한 값만 내려준다. */
  platform: 'desktop' | 'mobile';
}

// 모든 뷰 컴포넌트의 표준 시그니처 — 데스크톱 창이든 모바일 탭/스택이든 이 props만 받는다.
// "뷰가 받는 것: props + ShellContext + 서비스 훅. 그 외 채널 없음"(FRONTEND.md).
export interface ViewProps<Params = Record<string, unknown>> {
  shell: ShellContext;
  params: Params;
}

// scanBus가 파싱해 뷰에 전달하는 스캔 이벤트 페이로드.
export type ScanTarget =
  | { kind: 'book'; barcode: string }
  | { kind: 'student'; studentCode: string }
  | { kind: 'book-url'; barcode: string; rawUrl: string }
  | { kind: 'isbn'; isbn: string }
  | { kind: 'unknown'; raw: string };

export interface ScanEvent {
  target: ScanTarget;
  raw: string;
  at: number;
}
