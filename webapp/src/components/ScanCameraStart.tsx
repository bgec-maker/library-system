import { useEffect, useState } from 'react';
import { Camera } from 'lucide-react';
import type { ViewId } from '../types';
import { cameraSession, type CameraSessionStatus } from '../services/cameraSession';
import { getEffectiveScanRoute, subscribeScanRoute } from '../services/scanBus';
import { t } from '../i18n';
import { MobileScanStage } from './camera/MobileScanStage';

interface ScanCameraStartProps {
  viewId: ViewId;
  /** ShellContext.platform — 반응형 판단은 셸이 이미 끝낸 값만 받는다(뷰와 같은 규율, FRONTEND.md). */
  platform: 'desktop' | 'mobile';
}

/**
 * scan:'focus' 뷰(loan-return·inventory·register·book-detail)가 자기 화면 안에 두는 카메라
 * 시작/무대 지점. ADR-020의 "뷰 버튼" 시작 트리거(데스크톱)와 "탭 진입 시 시작 버튼"(모바일)을
 * 이 컴포넌트 하나로 겸한다 — 같은 뷰 파일이 두 셸 모두에서 그대로 렌더되므로(FRONTEND.md "같은
 * 뷰가 두 셸에서 렌더"), 뷰 안에 한 번만 심으면 데스크톱 창·모바일 탭/스택 화면 양쪽에서 다 작동한다.
 * (셸별 오버레이를 따로 만들지 않은 이유는 docs/ASSUMPTIONS.md todo/03 참고.)
 *
 * 이 뷰가 지금 유효 스캔 라우트(getEffectiveScanRoute())가 아니면 어느 플랫폼에서도 아무것도
 * 렌더하지 않는다. 유효 라우트일 때는 플랫폼별로 갈린다(H1):
 *  - 데스크톱: 이 항목 이전과 완전히 동일 — 꺼져 있을 때 작은 버튼, 켜져 있을 때 null
 *    (데스크톱 카메라 UI 자체를 다루는 건 다음 큐 항목 H2 — 여기서 선점하지 않는다).
 *  - 모바일: 꺼져 있을 때 큰 "시작 카드"(ADR-020 카피 포함), 켜져 있을 때 풀스크린 스캔 무대
 *    (components/camera/MobileScanStage.tsx — 조준 프레임은 H2와 공유하는 ScanAimFrame).
 */
export function ScanCameraStart({ viewId, platform }: ScanCameraStartProps) {
  const [route, setRoute] = useState(getEffectiveScanRoute());
  const [session, setSession] = useState<CameraSessionStatus>(() => cameraSession.getStatus());

  useEffect(() => subscribeScanRoute(setRoute), []);
  useEffect(() => cameraSession.onStatus(setSession), []);

  if (route !== viewId) return null;

  if (platform === 'mobile') {
    if (session.running) return <MobileScanStage viewId={viewId} />;
    return (
      <div className="scan-off-card panel">
        <button type="button" className="scan-off-card__btn warn" onClick={() => cameraSession.start('view-button')}>
          <Camera size={22} aria-hidden /> {t('camera.start')}
        </button>
        <p className="scan-off-card__hint">{t('camera.offHint')}</p>
      </div>
    );
  }

  if (session.running) return null;

  return (
    <div className="scan-camera-start">
      <button type="button" className="warn" onClick={() => cameraSession.start('view-button')}>
        <Camera size={16} aria-hidden /> {t('camera.start')}
      </button>
    </div>
  );
}
