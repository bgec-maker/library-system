import { intlLocaleTag } from './index';

// todo/73 — 금액 표기 단일 원천. 동일한 formatCurrency 구현이 뷰 4곳(loan-return·book-detail·
// reports·연간 보고서 패널)에 복제돼 있었다(로직 중복 금지, todo/14 관례 위반 상태였음).
// 규칙: KRW·소수 0자리·로케일 숫자 구분(ko: ₩1,000 / en: ₩1,000). 새 금액 표기는 반드시
// 이 함수로 — 화면마다 다른 정밀도·기호가 다시 생기지 않게.
export function formatKRW(amount: number): string {
  return new Intl.NumberFormat(intlLocaleTag(), {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0
  }).format(amount);
}
