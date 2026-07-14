import { ChevronLeft, ChevronRight } from 'lucide-react';
import { t } from '../../i18n';

// FRONTEND.md 「공용 DataTable + Paginator」 — 페이지 25/50/100(기본 50), 페이지 버튼 44px
// (DESIGN.md 터치 타깃). DataTable이 정렬·필터 후 배열을 넘겨주므로 이 컴포넌트 자체는 순수
// prop 기반 표시·이동만 담당한다(자체 상태 없음) — DataTable뿐 아니라 다른 목록 화면이 생기면
// 그대로 재사용 가능.
export interface PaginatorProps {
  page: number;
  totalPages: number;
  pageSize: number;
  pageSizeOptions: number[];
  totalRows: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function Paginator({ page, totalPages, pageSize, pageSizeOptions, totalRows, onPageChange, onPageSizeChange }: PaginatorProps) {
  return (
    <div className="data-table-paginator">
      <div className="data-table-paginator-size">
        <label htmlFor="data-table-page-size">{t('components.dataTable.pageSizeLabel')}</label>
        <select id="data-table-page-size" value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))}>
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>
      <div className="data-table-paginator-nav">
        <button
          type="button"
          className="ghost data-table-page-btn"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label={t('components.dataTable.prevPage')}
        >
          <ChevronLeft size={18} aria-hidden />
        </button>
        <span className="data-table-paginator-status">
          {t('components.dataTable.pageStatus', { page, totalPages, total: totalRows })}
        </span>
        <button
          type="button"
          className="ghost data-table-page-btn"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label={t('components.dataTable.nextPage')}
        >
          <ChevronRight size={18} aria-hidden />
        </button>
      </div>
    </div>
  );
}
