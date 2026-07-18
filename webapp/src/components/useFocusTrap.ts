import { useEffect, useRef, type RefObject } from 'react';

// todo/80 — 모달 포커스 트랩 공용 훅. ConfirmDialog(+SessionGate)가 소비한다.
// 계약: active 동안 ① 첫 포커서블로 진입 ② Tab/Shift+Tab이 컨테이너 안에서 순환
// ③ Escape는 onEscape(있을 때만 — 세션게이트처럼 닫으면 안 되는 모달은 생략)
// ④ 비활성화 시 열기 직전 포커스로 복귀(키보드 사용자의 문맥 보존).
const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useFocusTrap(
  active: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onEscape?: () => void
): void {
  // onEscape는 렌더마다 새 함수여도 재구독하지 않게 최신값만 ref로 추적.
  const escapeRef = useRef(onEscape);
  escapeRef.current = onEscape;

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;
    const prev = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        // display:none 제외(offsetParent null) — 단 position:fixed 컨테이너 자손은 offsetParent가
        // null일 수 있어 크기로도 판정한다.
        (el) => el.offsetParent !== null || el.getClientRects().length > 0
      );
    focusables()[0]?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        escapeRef.current?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const els = focusables();
      if (els.length === 0) return;
      const idx = els.indexOf(document.activeElement as HTMLElement);
      const next = e.shiftKey ? (idx <= 0 ? els.length - 1 : idx - 1) : idx >= els.length - 1 ? 0 : idx + 1;
      e.preventDefault();
      els[next]?.focus();
    }

    container.addEventListener('keydown', onKeyDown);
    return () => {
      container.removeEventListener('keydown', onKeyDown);
      prev?.focus();
    };
  }, [active, containerRef]);
}
