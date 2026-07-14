import type { ReactNode } from 'react';
import { t } from '../i18n';

interface PrintDocumentProps {
  libraryName: string;
  generatedAtText: string;
  children: ReactNode;
}

/**
 * 인쇄 문서 공통 머리·꼬리 — DESIGN.md "인쇄" 절: "모든 인쇄물 머리: 학교명 · 생성일 ·
 * 'OO학교 도서관 시스템' — 꼬리: 페이지 번호". 학교명(libraryName)은 이미 첫 칸에 나오므로
 * 3번째 칸에서 학교명을 다시 반복하지 않고 고정 브랜드 문구(t('print.systemBrand'))만
 * 적는다 — LIBRARY_NAME 설정값이 이미 "OO초등학교 도서관"처럼 "도서관"을 포함할 수도 있어
 * 그대로 이어붙이면 중복될 수 있다(docs/ASSUMPTIONS.md todo/05 참고).
 *
 * 페이지 번호는 styles/print.css가 처리한다(브라우저 간 실제 쪽수 계산 지원이 들쭉날쭉이라
 * position:fixed 꼬리 + Chrome 계열 전용 점진적 향상 — 상세 사유도 ASSUMPTIONS.md).
 *
 * todo/05(R1 리포트 2종)뿐 아니라 todo/09(회수 쪽지·기증 감사장 등 R1 나머지 3종)도 인쇄
 * 문서라면 전부 이 컴포넌트로 감싸 머리·꼬리 규약을 중복 구현하지 않는다.
 */
export function PrintDocument({ libraryName, generatedAtText, children }: PrintDocumentProps) {
  return (
    <div className="print-root">
      <header className="print-header">
        <span>{libraryName}</span>
        <span>{t('print.generatedAt', { time: generatedAtText })}</span>
        <span>{t('print.systemBrand')}</span>
      </header>
      <div className="print-body">{children}</div>
      <footer className="print-footer">
        <span>{libraryName}</span>
        <span>{t('print.systemBrand')}</span>
      </footer>
    </div>
  );
}
