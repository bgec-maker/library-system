import { t } from '../i18n';

// todo/13 — renew/markLost/payFine도 loan-return의 checkout/return과 같은 "operator note 관통"
// 관례를 따라야 한다(school-patch-v1/Code.gs의 appendNote_가 payload.note를 그대로 이어붙인다).
// loan-return/index.tsx의 기존 로컬 operatorNote() 콜백과 정확히 같은 문구를 만드는 공유 헬퍼 —
// i18n 키는 새로 만들지 않고 loan-return이 이미 쓰는 views.loanReturn.operatorNote(WithName)을
// 그대로 재사용한다(DESIGN.md "같은 행동 같은 이름 관통" — "웹앱발 쓰기"라는 개념 자체가 화면과
// 무관하게 하나다). loan-return 자신은 이 헬퍼로 갈아타지 않고 기존 로컬 콜백을 그대로 둔다 —
// 이미 검증된 즉시실행+실행취소 경로를 이번 항목에서 굳이 리팩터링해 위험을 만들지 않기 위해서다
// (docs/ASSUMPTIONS.md `## todo/13` 참고).
export function operatorNoteFor(operator: string): string {
  return operator ? t('views.loanReturn.operatorNoteWithName', { operator }) : t('views.loanReturn.operatorNote');
}
