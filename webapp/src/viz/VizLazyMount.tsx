import { useEffect, useRef, useState, type ReactNode } from 'react';

interface VizLazyMountProps {
  children: ReactNode;
  /** 마운트 전 자리 차지용 최소 높이(레이아웃 점프 방지). */
  minHeight?: number;
  className?: string;
}

/**
 * VIZ.md 완료 조건 "지연 로딩" — viz/index.ts의 React.lazy()가 이미 차트 4종의 JS 청크를
 * 메인 번들에서 분리해 주지만(코드 스플리팅), 이 래퍼는 한 걸음 더 나가 "실제로 보일 가능성이
 * 있을 때만 fetch/렌더"까지 만족시킨다: IntersectionObserver로 뷰포트(+200px 여유)에 들어오기
 * 전에는 children 자체를 마운트하지 않는다 — 그 전까지는 useVizData의 fetch도 실행되지 않는다.
 *
 * 대시보드 기저층은 셸 부팅 시 항상 마운트되지만 그 안의 차트들은 스크롤해서 봐야 보이는
 * 위치일 수 있고, 리포트 허브는 애초에 온디맨드 진입이라 이 래퍼가 이중으로 안전하다.
 * IntersectionObserver 미지원 구형 브라우저에서는 즉시 마운트로 안전하게 폴백한다.
 */
export function VizLazyMount({ children, minHeight = 200, className }: VizLazyMountProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState<boolean>(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <div ref={ref} className={className} style={visible ? undefined : { minHeight }}>
      {visible ? children : null}
    </div>
  );
}
