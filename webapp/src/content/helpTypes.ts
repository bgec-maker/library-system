// 도움말 가이드 콘텐츠 타입 — todo/137·138.
//
// 왜 i18n JSON이 아니라 콘텐츠 모듈인가: 가이드는 수백 문장짜리 "문서"라 키-값 사전에 넣으면
// 사전이 문서가 돼 버린다(검토·집필 불가능). 대신 ko/en 병행 모듈이 같은 섹션 id 집합을
// export하도록 타입으로 강제해(HelpContent) 한쪽만 갱신되는 누락을 컴파일 단계에서 잡는다.
// src/content/**는 views/** 밖이라 한글 리터럴 게이트 대상이 아니다 — 그 게이트의 목적은
// "번역 안 된 UI 카피" 차단이고, 이건 번역 병행이 구조로 보장되는 콘텐츠다.
// help 뷰 lazy 청크에만 실리므로 초기 번들 예산과 무관하다.

export interface HelpBlock {
  /** 소제목(선택) */
  h?: string;
  /** 본문 문단(선택) */
  p?: string;
  /** 순서 있는 단계(선택) */
  steps?: string[];
  /** 강조 메모 — "서버 업데이트 후 활성" 같은 조건부 안내(선택) */
  note?: string;
}

export interface HelpSection {
  id: string;
  title: string;
  blocks: HelpBlock[];
}

/** ko/en 모듈이 공유하는 계약 — 섹션 id 목록이 다르면 tsc가 잡도록 as const 튜플로 고정 */
export const HELP_SECTION_IDS = [
  'getting-started',
  'loan-return',
  'register',
  'search-catalog',
  'members',
  'inventory',
  'reports-print',
  'reservations',
  'troubleshooting',
  'admin-notices'
] as const;

export type HelpSectionId = (typeof HELP_SECTION_IDS)[number];

export type HelpContent = Record<HelpSectionId, HelpSection>;
