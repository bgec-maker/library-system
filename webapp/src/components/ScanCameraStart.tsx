import { useEffect, useState } from 'react';
import { Camera } from 'lucide-react';
import type { ViewId } from '../types';
import { cameraSession, type CameraSessionStatus } from '../services/cameraSession';
import { getEffectiveScanRoute, subscribeScanRoute } from '../services/scanBus';
import { t } from '../i18n';

interface ScanCameraStartProps {
  viewId: ViewId;
}

/**
 * scan:'focus' 뷰(loan-return·inventory·register)가 자기 화면 안에 두는 "카메라 시작" 버튼.
 * ADR-020의 "뷰 버튼" 시작 트리거(데스크톱)와 "탭 진입 시 시작 버튼"(모바일)을 이 컴포넌트
 * 하나로 겸한다 — 같은 뷰 파일이 두 셸 모두에서 그대로 렌더되므로(FRONTEND.md "같은 뷰가 두
 * 셸에서 렌더"), 뷰 안에 한 번만 심으면 데스크톱 창·모바일 탭/스택 화면 양쪽에서 다 작동한다.
 * (셸별 오버레이를 따로 만들지 않은 이유는 docs/ASSUMPTIONS.md todo/03 참고.)
 *
 * 이 뷰가 지금 유효 스캔 라우트(getEffectiveScanRoute())이고, 카메라가 꺼져 있을 때만 보인다.
 */
export function ScanCameraStart({ viewId }: ScanCameraStartProps) {
  const [route, setRoute] = useState(getEffectiveScanRoute());
  const [session, setSession] = useState<CameraSessionStatus>(() => cameraSession.getStatus());

  useEffect(() => subscribeScanRoute(setRoute), []);
  useEffect(() => cameraSession.onStatus(setSession), []);

  if (route !== viewId || session.running) return null;

  return (
    <div className="scan-camera-start">
      <button type="button" className="warn" onClick={() => cameraSession.start('view-button')}>
        <Camera size={16} aria-hidden /> {t('camera.start')}
      </button>
    </div>
  );
}
