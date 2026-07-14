import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';

// FRONTEND.md '모바일 셸 — 탭 + 스택': "확인·짧은 폼은 BottomSheet(풀스크린 전환 최소화 — 스캔
// 흐름 끊지 않기)". ShellContext에는 메서드를 추가하지 않는다 — 뷰 경계 밖(shells/**)이라 뷰는 이 파일을
// import할 수 없고(린트로 강제), 이 컴포넌트는 셸이 자체 화면(예: 더보기 상세 액션)에서 쓰는
// 범용 프레젠테이션 컴포넌트로만 존재한다.
interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

const DRAG_CLOSE_THRESHOLD_PX = 80;

export default function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const [dragY, setDragY] = useState(0);
  const draggingRef = useRef(false);
  const startYRef = useRef(0);

  useEffect(() => {
    if (!open) setDragY(0);
  }, [open]);

  if (!open) return null;

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    draggingRef.current = true;
    startYRef.current = e.clientY;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    setDragY(Math.max(0, e.clientY - startYRef.current));
  }

  function handlePointerUp() {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (dragY > DRAG_CLOSE_THRESHOLD_PX) onClose();
    else setDragY(0);
  }

  return (
    <div className="m-sheet-root">
      {/* 배경 탭으로 닫힘 — .m-sheet와 형제 엘리먼트로 둬서 opacity가 시트 내용까지 물들이지 않게 한다. */}
      <div className="m-sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        className="m-sheet"
        role="dialog"
        aria-modal="true"
        style={{ transform: dragY ? `translateY(${dragY}px)` : undefined }}
      >
        <div
          className="m-sheet-handle-area"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div className="m-sheet-handle" aria-hidden="true" />
          {title && <h2 className="m-sheet-title">{title}</h2>}
        </div>
        <div className="m-sheet-content">{children}</div>
      </div>
    </div>
  );
}
