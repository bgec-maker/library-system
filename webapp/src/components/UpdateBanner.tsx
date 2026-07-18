import { useEffect, useState } from 'react';
import { t } from '../i18n';
import './UpdateBanner.css';

// todo/86 — 새 버전 감지 배너. PWA는 사서가 새로고침하지 않으면 옛 번들로 오래 돈다 —
// 버그 수정을 배포해도 실기기에 늦게 닿는 문제의 해소 장치.
//
// 방식: 탭 복귀(visibilitychange→visible) 시 index.html을 no-store로 재조회해
// <meta name="build-id">(vite.config.ts가 빌드마다 주입)를 번들 상수 __BUILD_ID__와 비교.
// 다르면 상단 배너를 올린다. 주기 타이머 금지(perf 게이트의 setInterval 마커 규칙과 동일
// 철학 — 폴링 대신 "사서가 돌아온 순간"만 확인). 오프라인·비정상 응답은 조용히 무시.
const MIN_INTERVAL_MS = 60_000; // 빠른 탭 전환 연타로 서버를 두드리지 않게(타이머 아님 — 시각 비교)
const META_RE = /<meta\s+name="build-id"\s+content="([^"]+)"/;

let lastCheckAt = 0;
let inFlight = false;

async function fetchRemoteBuildId(): Promise<string | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}index.html`, { cache: 'no-store' });
    if (!res.ok) return null;
    const m = META_RE.exec(await res.text());
    return m ? m[1] : null;
  } catch {
    return null; // 오프라인 등 — 다음 복귀 때 다시
  }
}

export function UpdateBanner() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (available) return; // 이미 떴으면 더 확인할 것 없음
    let alive = true;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (inFlight || now - lastCheckAt < MIN_INTERVAL_MS) return;
      inFlight = true;
      lastCheckAt = now;
      void fetchRemoteBuildId().then((remote) => {
        inFlight = false;
        if (alive && remote && remote !== __BUILD_ID__) setAvailable(true);
      });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [available]);

  if (!available) return null;
  return (
    <div className="update-banner" role="status">
      <span>{t('shell.update.newVersion')}</span>
      <button type="button" onClick={() => window.location.reload()}>
        {t('shell.update.reload')}
      </button>
    </div>
  );
}
