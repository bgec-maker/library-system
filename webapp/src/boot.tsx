import { Suspense, lazy, useMemo } from 'react';
import './tokens/work.css';
import './styles/base.css';
import { SessionGate } from './components/SessionGate';

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

export default function Boot() {
  const studentRoute = useMemo(() => isStudentRoute(window.location.hash), []);
  const platform = useMemo(() => detectPlatform(), []);

  return (
    <Suspense fallback={<BootFallback />}>
      {studentRoute ? (
        <StudentRoot />
      ) : (
        <SessionGate>{platform === 'desktop' ? <DesktopShell /> : <MobileShell />}</SessionGate>
      )}
    </Suspense>
  );
}
