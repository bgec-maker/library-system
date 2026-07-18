import { useEffect, useState } from 'react';
import { BookOpen, Lock, MessageCircle, Star } from 'lucide-react';
import { t } from '../../i18n';
import { fetchPublicBookData, type PublicBookAvailability, type PublicBookData } from '../../services/publicBookData';
import { CoverThumb } from '../../components/CoverThumb';
import { SampleDataBadge } from '../../components/SampleDataBadge';

export interface BookPageProps {
  barcode: string | null;
}

// 표지 자리 고정 크기 — FRONTEND.md 성능 예산 "표지 이미지: lazy + width/height 명시(레이아웃
// 시프트 0)". 표지가 없을 때도 같은 크기의 자리표시자를 그려 실제 표지가 늦게 도착해도 레이아웃이
// 움직이지 않는다.
const COVER_WIDTH = 120;
const COVER_HEIGHT = 180;

function statusKey(availability: PublicBookAvailability): string {
  if (availability === 'AVAILABLE') return 'student.bookPage.status.available';
  if (availability === 'ON_LOAN') return 'student.bookPage.status.onLoan';
  return 'student.bookPage.status.unavailable';
}

function statusColor(availability: PublicBookAvailability): string {
  if (availability === 'AVAILABLE') return 'var(--pass)';
  if (availability === 'ON_LOAN') return 'var(--wait)';
  return 'var(--fail)';
}

// 학생용 공개 도서 페이지(todo/20) — 폰 기본 카메라로 책 QR(ADR-004: 책 QR = URL)을 찍으면
// 로그인 없이 열리는 화면이다. 표지·서지·대출 가능 여부만 보여준다 — 실제 조회는
// services/publicBookData.ts가 school-patch-v1/Code.gs의 신규 doGet(e)(무인증 읽기 전용,
// doPost·MOBILE_REG_TOKEN과 완전히 분리된 별도 진입점)을 GET으로 부른다. 배포 전이거나 네트워크
// 실패면 자동으로 샘플 데이터 + SampleDataBadge로 대체된다(가짜 성공이 아니라 "아직 실 데이터를
// 못 받는 정상 상태" 표시, CLAUDE.md 검증 원칙).
//
// 「이 책 빌리기」는 실제 대출 액션을 부르지 않는다 — 로그인 방식이 CLAUDE.md 🟡 미결이라
// 이 라운드는 로그인 게이트 배너를 보여주는 순수 로컬 상태 토글이다(서버 호출 없음).
export default function BookPage({ barcode }: BookPageProps) {
  const [data, setData] = useState<PublicBookData | null>(null);
  const [sample, setSample] = useState(false);
  const [loading, setLoading] = useState(true);
  const [gateOpen, setGateOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setGateOpen(false);
    void fetchPublicBookData(barcode).then((result) => {
      if (cancelled) return;
      setData(result.data);
      setSample(result.sample);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [barcode]);

  if (loading || !data) {
    return (
      <main style={{ padding: 24, fontFamily: 'var(--sans)', color: 'var(--ink)' }}>
        <p>{t('common.loading')}</p>
      </main>
    );
  }

  const pageCountText = data.pageCount === '' ? t('student.bookPage.pageCountUnknown') : String(data.pageCount);

  return (
    <main style={{ padding: 24, fontFamily: 'var(--sans)', color: 'var(--ink)', maxWidth: 480, margin: '0 auto' }}>
      <h1
        style={{
          fontSize: 'var(--fs-sm)',
          fontWeight: 700,
          color: 'var(--ink-3)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          margin: 0
        }}
      >
        <BookOpen size={16} aria-hidden /> {t('student.bookPage.title')}
      </h1>

      <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
        {/* todo/85 — 없음/로드 실패 모두 CoverThumb(공용 폴백). todo/48의 "표지 없는 정상 상태"
            카피는 emptyLabel로 승계. */}
        <CoverThumb
          url={data.coverUrl}
          alt={t('student.bookPage.coverAlt', { title: data.title })}
          width={COVER_WIDTH}
          height={COVER_HEIGHT}
          emptyLabel={t('student.bookPage.coverMissing')}
          style={{ flexShrink: 0 }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <h2 style={{ fontSize: 'var(--fs-xl)', margin: 0 }}>{data.title}</h2>
          {data.subtitle && <p style={{ margin: 0, color: 'var(--ink-2)', fontSize: 'var(--fs-sm)' }}>{data.subtitle}</p>}
          {data.authors && <p style={{ margin: 0, color: 'var(--ink-2)', fontSize: 'var(--fs-sm)' }}>{data.authors}</p>}
          {data.publisher && <p style={{ margin: 0, color: 'var(--ink-3)', fontSize: 'var(--fs-xs)' }}>{data.publisher}</p>}
          <span
            style={{
              marginTop: 8,
              alignSelf: 'flex-start',
              display: 'inline-flex',
              alignItems: 'center',
              padding: '4px 12px',
              borderRadius: 999,
              background: statusColor(data.availability),
              color: '#fff',
              fontSize: 'var(--fs-xs)',
              fontWeight: 700
            }}
          >
            {t(statusKey(data.availability))}
          </span>
        </div>
      </div>

      {sample && (
        <div style={{ marginTop: 12 }}>
          <SampleDataBadge />
        </div>
      )}

      <dl
        style={{
          marginTop: 16,
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          columnGap: 12,
          rowGap: 4,
          fontSize: 'var(--fs-sm)'
        }}
      >
        {data.classification && (
          <>
            <dt style={{ color: 'var(--ink-3)' }}>{t('student.bookPage.classificationLabel')}</dt>
            <dd style={{ margin: 0 }}>{data.classification}</dd>
          </>
        )}
        <dt style={{ color: 'var(--ink-3)' }}>{t('student.bookPage.pageCountLabel')}</dt>
        <dd style={{ margin: 0 }}>{pageCountText}</dd>
        <dt style={{ color: 'var(--ink-3)' }}>{t('student.bookPage.barcodeLabel')}</dt>
        <dd style={{ margin: 0, fontFamily: 'var(--mono)' }}>{data.barcode}</dd>
      </dl>

      <button
        type="button"
        onClick={() => setGateOpen(true)}
        style={{
          marginTop: 24,
          width: '100%',
          minHeight: 44,
          border: 'none',
          borderRadius: 'var(--radius)',
          background: 'var(--deep)',
          color: '#fff',
          fontSize: 'var(--fs-md)',
          fontWeight: 700,
          cursor: 'pointer'
        }}
      >
        {t('student.bookPage.borrowButton')}
      </button>

      {/* todo/48(P2-4): 로그인 전에는 CTA의 결과를 누르기 전에 예고 — 눌렀다 실망하는 흐름을
          줄인다. 로그인 도입 시 이 안내는 자연 제거 대상. */}
      {!gateOpen && (
        <p style={{ margin: '8px 0 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 'var(--fs-xs)' }}>
          {t('student.bookPage.borrowPreHint')}
        </p>
      )}

      {gateOpen && (
        <div
          role="status"
          style={{
            marginTop: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            borderRadius: 'var(--radius)',
            background: 'var(--panel)',
            border: '1px solid var(--rule)',
            color: 'var(--ink-2)',
            fontSize: 'var(--fs-sm)'
          }}
        >
          <Lock size={16} aria-hidden /> {t('student.bookPage.loginGateMessage')}
        </div>
      )}

      <section style={{ marginTop: 24, display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <h3
            style={{
              fontSize: 'var(--fs-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              margin: 0,
              color: 'var(--ink-2)'
            }}
          >
            <Star size={16} aria-hidden /> {t('student.bookPage.ratingHeading')}
          </h3>
          <p style={{ margin: '4px 0 0', color: 'var(--ink-3)', fontSize: 'var(--fs-xs)' }}>
            {t('student.bookPage.ratingPlaceholder')}
          </p>
        </div>
        <div style={{ flex: 1 }}>
          <h3
            style={{
              fontSize: 'var(--fs-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              margin: 0,
              color: 'var(--ink-2)'
            }}
          >
            <MessageCircle size={16} aria-hidden /> {t('student.bookPage.reviewHeading')}
          </h3>
          <p style={{ margin: '4px 0 0', color: 'var(--ink-3)', fontSize: 'var(--fs-xs)' }}>
            {t('student.bookPage.reviewPlaceholder')}
          </p>
        </div>
      </section>

      <footer
        style={{
          marginTop: 32,
          paddingTop: 12,
          borderTop: '1px solid var(--rule)',
          color: 'var(--ink-3)',
          fontSize: 'var(--fs-xs)'
        }}
      >
        {t('student.bookPage.footerAttribution')}
      </footer>
    </main>
  );
}
