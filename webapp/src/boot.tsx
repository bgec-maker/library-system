import { Suspense, lazy, useMemo, type ReactNode } from 'react';
import './tokens/work.css';
import './styles/base.css';
import './styles/print.css';
import { SessionGate } from './components/SessionGate';
import { UpdateBanner } from './components/UpdateBanner';
import { ensureLocaleReady } from './i18n';

// 셸 선택 + 스킨 로드 — FRONTEND.md: "셸은 부팅 시 하나만 선택, 리사이즈로 셸 전환 안 함".
// 학생 표면(#/b/:barcode)은 완전히 별도 번들로 lazy-load해 사서 셸 코드가 같이 딸려가지 않게 한다
// (수용 기준: "학생 번들: /b/ 진입 시 사서 셸 코드 미로딩").
const DesktopShell = lazy(() => import('./shells/desktop/DesktopShell'));
const MobileShell = lazy(() => import('./shells/mobile/MobileShell'));
const StudentRoot = lazy(() => import('./student/StudentRoot'));

export type Platform = 'desktop' | 'mobile';

function detectPlatform(): Platform {
  // boot.tsx는 셸 그 자체이지 src/views/** 뷰가 아니다 — matchMedia/innerWidth 사용이 허용되는 유일한 층.
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const narrow = window.innerWidth < 900;
  return coarsePointer || narrow ? 'mobile' : 'desktop';
}

function isStudentRoute(hash: string): boolean {
  return /^#\/b\//.test(hash);
}

function BootFallback() {
  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif', color: '#4a5058' }}>불러오는 중…</div>
  );
}

// i18n/index.ts의 Suspense 리소스 패턴 — 로케일 사전이 로드되기 전에는 자식(셸·학생 표면)이
// 아예 렌더되지 않는다. registry.ts 등 t()를 모듈 평가 시점에 호출하는 코드가 항상 올바른
// 로케일을 보고 시작하도록 보장한다(ADR-023 "활성 로케일만 dynamic import").
function I18nGate({ children }: { children: ReactNode }) {
  ensureLocaleReady();
  return <>{children}</>;
}

export default function Boot() {
  const studentRoute = useMemo(() => isStudentRoute(window.location.hash), []);
  const platform = useMemo(() => detectPlatform(), []);

  return (
    <Suspense fallback={<BootFallback />}>
      <I18nGate>
        {studentRoute ? (
          <StudentRoot />
        ) : (
          <>
            {/* todo/86 — 사서 표면 전용(학생 QR 페이지는 일회성 열람이라 새 버전 안내 불필요) */}
            <UpdateBanner />
            <SessionGate>{platform === 'desktop' ? <DesktopShell /> : <MobileShell />}</SessionGate>
          </>
        )}
      </I18nGate>
    </Suspense>
  );
}
