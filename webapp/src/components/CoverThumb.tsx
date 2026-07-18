import { useEffect, useState, type CSSProperties } from 'react';
import { BookOpen } from 'lucide-react';
import { safeCoverUrl } from '../services/urlGuard';
import './CoverThumb.css';

// todo/85 — 표지 썸네일 공용화. 기존 세 화면(등록 확인·도서 상세·학생 책 페이지)은 "URL 없음"만
// 처리하고 "로드 실패(죽은 URL·차단망)"는 각자 방치 — 깨진 이미지 아이콘이 화면마다 다르게
// 노출될 수 있었다. 여기서 onError까지 한 곳에서: 없음/실패 모두 같은 플레이스홀더.
// perf-budget 정합: img는 width/height/loading 필수 — 이 컴포넌트가 항상 붙인다.
interface CoverThumbProps {
  /** 원본 URL(가드 전) — 내부에서 safeCoverUrl을 거친다(http 차단 등 기존 규칙 그대로). */
  url?: string;
  alt: string;
  width: number;
  height: number;
  /** 플레이스홀더에 붙일 문구(예: "표지 없음"). 없으면 장식 취급(aria-hidden). */
  emptyLabel?: string;
  className?: string;
  style?: CSSProperties;
}

export function CoverThumb({ url, alt, width, height, emptyLabel, className, style }: CoverThumbProps) {
  const safe = safeCoverUrl(url ?? '');
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setBroken(false); // URL이 바뀌면(다른 책) 실패 상태를 리셋
  }, [safe]);

  if (!safe || broken) {
    return (
      <div
        className={`cover-thumb cover-thumb--empty${className ? ` ${className}` : ''}`}
        style={{ width, height, ...style }}
        role={emptyLabel ? 'img' : undefined}
        aria-label={emptyLabel}
        aria-hidden={emptyLabel ? undefined : true}
      >
        <BookOpen size={Math.min(32, Math.floor(width / 2.5))} aria-hidden />
        {emptyLabel && <span>{emptyLabel}</span>}
      </div>
    );
  }

  return (
    <img
      className={`cover-thumb${className ? ` ${className}` : ''}`}
      src={safe}
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      style={style}
      onError={() => setBroken(true)}
    />
  );
}
