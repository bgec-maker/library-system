import { useRef, useState, useSyncExternalStore } from 'react';
import { useSession, isSessionComplete } from '../services/session';
import { closeSessionSettings, getSessionSettingsOpen, subscribeSessionSettings } from '../services/sessionSettingsUi';
import { useFocusTrap } from './useFocusTrap';

// register.html의 "최초 1회 URL·토큰·이름 입력 → localStorage" 설정 화면을 셸 공통으로 계승.
// session.ts는 저장소만 제공하고 이 화면은 없었다 — 없으면 앱이 아예 동작하지 않는 공백이라 직접 채웠다.

interface Draft {
  apiUrl: string;
  token: string;
  operator: string;
}

// todo/112 — 최초 설정 URL의 형식 검증: https + URL 파싱. "빈 값만 막던" 종전엔 오형식이
// 그대로 저장돼 이후 모든 호출이 네트워크 오류로만 보였다(원인 추적이 사서 몫이 되는 침묵).
function isLikelyWebAppUrl(raw: string): boolean {
  if (!raw) return false;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function SessionGate({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const manuallyOpened = useSyncExternalStore(subscribeSessionSettings, getSessionSettingsOpen);
  const complete = isSessionComplete(session);
  const [draft, setDraft] = useState<Draft>({ apiUrl: session.apiUrl, token: session.token, operator: session.operator });

  const showOverlay = !complete || manuallyOpened;

  // todo/80 — 포커스 트랩: 부팅 게이트(!complete)는 ESC로 닫을 수 없다(필수 관문 — 닫으면
  // 빈 앱만 남는다). 설정으로 다시 연 경우(complete)만 ESC=닫기.
  const cardRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(showOverlay, cardRef, complete ? closeSessionSettings : undefined);

  const urlInvalid = draft.apiUrl.length > 0 && !isLikelyWebAppUrl(draft.apiUrl);

  function save() {
    if (!isLikelyWebAppUrl(draft.apiUrl) || !draft.token || !draft.operator) return;
    session.setConfig(draft);
    closeSessionSettings();
  }

  return (
    <>
      {complete && children}
      {showOverlay && (
        <div className="session-gate-overlay">
          <div className="session-gate-card panel" ref={cardRef} role="dialog" aria-modal="true">
            {/* todo/117 — 재열람 제목을 기어 라벨(연결 설정)과 동기화: 레지스트리 「설정」
                뷰(정책·무결성)와 이름이 충돌하던 것 해소. */}
            <h1>{complete ? '연결 설정' : '초기 설정'}</h1>
            <p className="session-gate-sub">
              GAS Web App URL·공유 토큰·작업자 이름을 입력하세요. 이 기기에만 저장됩니다(localStorage).
            </p>
            <label htmlFor="sg-url">GAS Web App URL</label>
            <input
              id="sg-url"
              type="url"
              value={draft.apiUrl}
              placeholder="https://script.google.com/macros/s/.../exec"
              aria-invalid={urlInvalid || undefined}
              aria-describedby={urlInvalid ? 'sg-url-hint' : undefined}
              onChange={(e) => setDraft((d) => ({ ...d, apiUrl: e.target.value }))}
            />
            {urlInvalid && (
              <p id="sg-url-hint" className="session-gate-hint">
                https://로 시작하는 웹앱 URL이어야 해요 — 예: https://script.google.com/macros/s/…/exec
              </p>
            )}
            <label htmlFor="sg-token">공유 토큰</label>
            <input
              id="sg-token"
              type="text"
              value={draft.token}
              placeholder="사서 선생님께 받은 공유 토큰"
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
            <button type="button" onClick={save} disabled={!isLikelyWebAppUrl(draft.apiUrl) || !draft.token || !draft.operator}>
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
