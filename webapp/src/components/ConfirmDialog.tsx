import { useId, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { t } from '../i18n';
import './ConfirmDialog.css';

// 공용 확인 다이얼로그 — todo/13. book-detail의 「연장」「분실 처리」「변상」, loan-return의
// 반납-대신-연장/분실 리디렉션이 전부 이 컴포넌트 하나를 소비한다("확인 UI 중복 금지",
// DataTable과 같은 결). "전부 실행취소 불가 명시(확인 다이얼로그 — 즉시실행 예외)" 완료 조건이
// 요구하는 건 book-detail/loan-return이 window.confirm을 직접 부를 수 없다는 점(views/**는
// window.*를 못 쓴다 — check-view-boundary.mjs)인데, 이 파일은 src/components/**라 그 제약 밖이다
// — 하지만 여기서도 window.confirm을 쓰지 않는다: 그냥 뷰의 렌더 트리 안에 그리는 평범한 React
// 오버레이 컴포넌트로 구현했다(components/SessionGate.tsx의 .session-gate-overlay와 같은
// position:fixed 오버레이 관례 재사용) — ShellContext에 confirm()을 추가하는 대신 이 방식을
// 택한 이유는 docs/ASSUMPTIONS.md `## todo/13`에 적었다: confirm은 셸이 대신 처리해줘야 하는
// 플랫폼 관심사(print()처럼 창/탭 자체를 조작해야 하는 일)가 아니라 순수 시각적 관심사라
// ShellContext 표면을 넓힐 이유가 없었다.
export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 기본 true — 되돌릴 수 없는 작업(연장·분실 처리·변상)을 강조하는 위험 스타일(danger 버튼). */
  danger?: boolean;
  /** 확인 버튼을 누른 뒤 응답을 기다리는 동안(중복 클릭 방지 + 라벨을 "처리 중…"으로 교체). */
  busy?: boolean;
  /** 폼 검증 미충족(예: 분실 대체비 미입력) — busy와 별개로 확인 버튼을 막는다. */
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger = true,
  busy = false,
  confirmDisabled = false,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  const titleId = useId();
  if (!open) return null;
  return (
    <div className="confirm-dialog-overlay" role="presentation" onClick={busy ? undefined : onCancel}>
      <div
        className="confirm-dialog-card panel"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirm-dialog-head">
          <AlertTriangle size={18} aria-hidden />
          <h2 id={titleId}>{title}</h2>
        </div>
        <div className="confirm-dialog-body">{message}</div>
        <div className="confirm-dialog-actions">
          <button type="button" className="ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel ?? t('common.cancel')}
          </button>
          <button type="button" className={danger ? 'danger' : ''} onClick={onConfirm} disabled={busy || confirmDisabled}>
            {busy ? t('common.loading') : (confirmLabel ?? t('common.confirm'))}
          </button>
        </div>
      </div>
    </div>
  );
}
