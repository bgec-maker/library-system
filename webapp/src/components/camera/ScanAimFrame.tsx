import { computeAimRect } from './aimRect';
import './ScanAimFrame.css';

// H1(모바일)·H2(데스크톱)가 공유하는 "조준 프레임" 규격 컴포넌트 — 순수 표현 전용, 카메라/세션
// 로직은 전혀 모른다(어디서 렌더되든 video 네이티브 해상도 + 실제 화면에 표시되는 컨테이너 픽셀
// 크기만 주면 된다). 완료 조건 "조준 프레임 = 실제 디코드 크롭 영역과 픽셀 일치"를 만족시키려고
// 기하 계산(aimRect.ts)이 services/camera.ts가 export하는 실제 CROP 비율을 그대로 가져다 쓴다 —
// 여기서 값을 다시 하드코딩하면 그 파일 비율이 바뀔 때 조용히 어긋난다.
export interface ScanAimFrameProps {
  /** 카메라의 네이티브 비디오 해상도(video.videoWidth/videoHeight) — 프레임이 아직 준비 안 됐으면 0. */
  videoWidth: number;
  videoHeight: number;
  /** <video>가 실제로 차지하는 컨테이너의 화면 픽셀 크기 (object-fit: cover 기준). */
  containerWidth: number;
  containerHeight: number;
  /** 인식 순간 프레임을 잠깐 초록으로 — scanFeedback 'hit' 신호에 얹어 소비자가 켠다. */
  flash?: boolean;
}

export function ScanAimFrame({ videoWidth, videoHeight, containerWidth, containerHeight, flash = false }: ScanAimFrameProps) {
  const rect = computeAimRect(videoWidth, videoHeight, containerWidth, containerHeight);
  if (!rect) return null;

  return (
    <div
      className={`scan-aim-frame${flash ? ' is-flash' : ''}`}
      style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
      aria-hidden
    >
      <span className="scan-aim-frame__corner scan-aim-frame__corner--tl" />
      <span className="scan-aim-frame__corner scan-aim-frame__corner--tr" />
      <span className="scan-aim-frame__corner scan-aim-frame__corner--bl" />
      <span className="scan-aim-frame__corner scan-aim-frame__corner--br" />
    </div>
  );
}
