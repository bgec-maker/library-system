import { useState, useSyncExternalStore } from 'react';
import { useSession, isSessionComplete } from '../services/session';
import { closeSessionSettings, getSessionSettingsOpen, subscribeSessionSettings } from '../services/sessionSettingsUi';

// register.html의 "최초 1회 URL·토큰·이름 입력 → localStorage" 설정 화면을 셸 공통으로 계승.
// session.ts는 저장소만 제공하고 이 화면은 없었다 — 없으면 앱이 아예 동작하지 않는 공백이라 직접 채웠다.

interface Draft {
  apiUrl: string;
  token: string;
  operator: string;
}

export function SessionGate({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const manuallyOpened = useSyncExternalStore(subscribeSessionSettings, getSessionSettingsOpen);
  const complete = isSessionComplete(session);
  const [draft, setDraft] = useState<Draft>({ apiUrl: session.apiUrl, token: session.token, operator: session.operator });

  const showOverlay = !complete || manuallyOpened;

  function save() {
    if (!draft.apiUrl || !draft.token || !draft.operator) return;
    session.setConfig(draft);
    closeSessionSettings();
  }

  return (
    <>
      {complete && children}
      {showOverlay && (
        <div className="session-gate-overlay">
          <div className="session-gate-card panel">
            <h1>{complete ? '설정' : '초기 설정'}</h1>
            <p className="session-gate-sub">
              GAS Web App URL·공유 토큰·작업자 이름을 입력하세요. 이 기기에만 저장됩니다(localStorage).
            </p>
            <label htmlFor="sg-url">GAS Web App URL</label>
            <input
              id="sg-url"
              type="url"
              value={draft.apiUrl}
              placeholder="https://script.google.com/macros/s/.../exec"
              onChange={(e) => setDraft((d) => ({ ...d, apiUrl: e.target.value }))}
            />
            <label htmlFor="sg-token">공유 토큰</label>
            <input
              id="sg-token"
              type="text"
              value={draft.token}
              placeholder="ScriptProperties의 MOBILE_REG_TOKEN"
              onChange={(e) => setDraft((d) => ({ ...d, token: e.target.value }))}
            />
            <label htmlFor="sg-operator">작업자 이름</label>
            <input
              id="sg-operator"
              type="text"
              value={draft.operator}
              placeholder="예: 홍길동"
              onChange={(e) => setDraft((d) => ({ ...d, operator: e.target.value }))}
            />
            <button type="button" onClick={save} disabled={!draft.apiUrl || !draft.token || !draft.operator}>
              {complete ? '저장' : '저장하고 시작'}
            </button>
            {complete && (
              <button type="button" className="ghost" onClick={closeSessionSettings}>
                취소
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
