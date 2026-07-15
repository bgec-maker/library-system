import { CROP } from '../../services/camera';

// ScanAimFrame.tsx의 순수 기하 계산을 별도 모듈로 뺀 것 — react-refresh/only-export-components
// 린트(컴포넌트 파일은 컴포넌트만 export)를 지키면서, H2(데스크톱)나 향후 다른 소비자가 렌더링
// 없이 이 계산만 재사용하고 싶을 때도 그대로 import할 수 있게 한다.
export interface AimRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * object-fit: cover로 표시된 <video> 위에서, services/camera.ts의 CROP 비율이 실제로 차지하는
 * 화면 픽셀 사각형을 계산한다. cover는 컨테이너 비율에 맞춰 비디오를 확대하고 넘치는 부분을
 * 중앙 기준으로 잘라내므로(대칭 오프셋), 그 확대 배율(displayScale)과 오프셋을 먼저 구한 뒤
 * CROP 비율에 곱해야 화면 위 사각형이 디코드 크롭 영역과 픽셀 단위로 일치한다.
 */
export function computeAimRect(videoWidth: number, videoHeight: number, containerWidth: number, containerHeight: number): AimRect | null {
  if (!videoWidth || !videoHeight || !containerWidth || !containerHeight) return null;

  const displayScale = Math.max(containerWidth / videoWidth, containerHeight / videoHeight);
  const displayedVideoW = videoWidth * displayScale;
  const displayedVideoH = videoHeight * displayScale;
  const offsetX = (containerWidth - displayedVideoW) / 2;
  const offsetY = (containerHeight - displayedVideoH) / 2;

  const cropX = videoWidth * CROP.xRatio;
  const cropY = videoHeight * CROP.yRatio;
  const cropW = videoWidth * CROP.wRatio;
  const cropH = videoHeight * CROP.hRatio;

  return {
    left: offsetX + cropX * displayScale,
    top: offsetY + cropY * displayScale,
    width: cropW * displayScale,
    height: cropH * displayScale
  };
}
