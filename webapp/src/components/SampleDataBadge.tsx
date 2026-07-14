import { t } from '../i18n';

// 「샘플 데이터」 배지 — todo/04 완료 조건("배지 동작"). Code.gs가 아직 해당 읽기 액션을 모르는
// 배포(UNKNOWN_ACTION)일 때 화면이 mocks/의 가짜 데이터를 보여주는 중임을 알린다. 완전 실패
// (네트워크·타임아웃 등)는 이 배지가 아니라 별도 오류 상태로 표시해야 한다 — "백엔드가 이 액션을
// 아직 모름"과 "백엔드가 죽음"을 구분하는 게 이 컴포넌트가 존재하는 이유(CLAUDE.md 검증 원칙:
// 가짜 성공 금지). 제네릭하게 유지 — todo/05(리포트)·todo/06(시각화)이 그대로 재사용한다.
export function SampleDataBadge() {
  return (
    <span className="sample-data-badge" role="status">
      {t('common.sampleDataBadge')}
    </span>
  );
}
