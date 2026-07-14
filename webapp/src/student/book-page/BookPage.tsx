import { BookOpen } from 'lucide-react';
import { t } from '../../i18n';

export interface BookPageProps {
  barcode: string | null;
}

// 학생용 도서 페이지 — 로그인 방식 미결정으로 라우트만 준비됨(CLAUDE.md 🟡).
export default function BookPage({ barcode }: BookPageProps) {
  return (
    <main style={{ padding: 24, fontFamily: 'var(--sans)', color: 'var(--ink)' }}>
      <h1 style={{ fontSize: 'var(--fs-xl)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <BookOpen size={20} aria-hidden /> {t('student.bookPage.title')}
      </h1>
      <p style={{ marginTop: 8, color: 'var(--ink-2)' }}>{t('student.common.notReady')}</p>
      <p style={{ marginTop: 12, fontFamily: 'var(--mono)', color: 'var(--ink-3)' }}>barcode: {barcode ?? t('common.none')}</p>
    </main>
  );
}
