import { useEffect, useState } from 'react';
import { subscribeToast, type ToastMessage } from '../services/toastBus';

const AUTO_DISMISS_MS = 4000;

/** 셸(desktop/mobile) 루트에서 한 번만 마운트. ShellContext.toast()가 여기로 흘러든다. */
export function ToastHost() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(
    () =>
      subscribeToast((toast) => {
        setToasts((prev) => [...prev, toast]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== toast.id)), AUTO_DISMISS_MS);
      }),
    []
  );

  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
