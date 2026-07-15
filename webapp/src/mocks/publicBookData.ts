import type { PublicBookData } from '../services/publicBookData';

// 공개 책 페이지(todo/20) 목데이터 — mocks/titleDetail.ts와 같은 "아몬드" 표본(여러 목데이터
// 파일을 넘나들어도 낯설지 않도록 의도적으로 재사용, mocks/titleDetail.ts 주석 참고). 이 페이지가
// 노출하는 필드만 담는다 — school-patch-v1/Code.gs doGet(e)이 실제로 돌려주는 모양 그대로.
export function mockPublicBookData(barcode?: string): PublicBookData {
  return {
    barcode: barcode || '0004511',
    title: '아몬드',
    subtitle: '',
    authors: '손원평',
    publisher: '창비',
    coverUrl: '',
    classification: '문학',
    pageCount: 264,
    availability: 'AVAILABLE'
  };
}
