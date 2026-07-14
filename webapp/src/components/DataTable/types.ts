import type { ReactNode } from 'react';

// FRONTEND.md 「공용 DataTable + Paginator」 열 정의 API. 이 컴포넌트는 catalog·recent-ops·
// reports 어디서도 재사용되므로(중복 제거 증명, todo/08) 도메인 지식을 전혀 갖지 않는다 —
// header는 이미 t()로 번역된 문자열을 호출측이 넘긴다(이 폴더는 views/**가 아니라 i18n 리터럴
// 린트 대상도 아니지만, 실제 도메인 문자열은 여기서 만들지 않는다는 원칙은 그대로 지킨다).
export interface DataTableColumn<T> {
  /** row 객체 키 힌트 — sortAccessor/filterValue/csvValue/render를 안 주면 이 key로 row[key]를
   *  읽는 기본 동작의 기준이 된다. React key로도 쓰인다. */
  key: string;
  header: string;
  sortable?: boolean;
  /** 정렬 비교값 추출 — 생략 시 row[key]를 그대로 쓴다(문자열이면 localeCompare, 숫자면 빼기). */
  sortAccessor?: (row: T) => string | number;
  /** 검색어 필터 대상 문자열 추출 — false면 이 열은 필터 검색 범위에서 제외한다.
   *  생략 시 row[key]를 문자열화해서 쓴다. */
  filterValue?: ((row: T) => string) | false;
  /** 셀 렌더러 — 생략 시 row[key]를 문자열로 표시한다. */
  render?: (row: T) => ReactNode;
  /** CSV 내보내기 값 — 생략 시 sortAccessor → row[key] 순으로 폴백한다(렌더러의 ReactNode는
   *  CSV 텍스트로 직렬화할 수 없으므로 별도 추출기가 필요). */
  csvValue?: (row: T) => string | number;
  numeric?: boolean;
  /** 등록번호·바코드 등 --mono 서체 대상(DESIGN.md "테이블" 절). */
  mono?: boolean;
  /** 모바일 카드 변환 시 제목 자리(열 중 최대 1개). */
  mobilePrimary?: boolean;
  /** 모바일 카드 변환 시 부제 자리(열 중 최대 1개). */
  mobileSecondary?: boolean;
}

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  key: string;
  direction: SortDirection;
}
