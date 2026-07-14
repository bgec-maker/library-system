export interface RankingProps {
  barcode: string | null;
}

// 학생용 랭킹 — 로그인 방식 미결정으로 라우트만 준비됨(CLAUDE.md 🟡).
export default function Ranking({ barcode }: RankingProps) {
  return (
    <main style={{ padding: 24, fontFamily: 'var(--sans)', color: 'var(--ink)' }}>
      <h1 style={{ fontSize: 20 }}>랭킹</h1>
      <p style={{ marginTop: 8, color: 'var(--ink-2)' }}>로그인 방식 미결정으로 라우트만 준비됨.</p>
      <p style={{ marginTop: 12, fontFamily: 'var(--mono)', color: 'var(--ink-3)' }}>barcode: {barcode ?? '(없음)'}</p>
    </main>
  );
}
