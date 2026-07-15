// 「샘플 데이터」 폴백(todo/21, todo/04 관례 재사용) — Code.gs가 아직 manualEntryPendingCount
// 액션을 모르는 배포(UNKNOWN_ACTION)일 때 services/manualEntryData.ts가 이 수 대신 내려주고,
// 화면은 components/SampleDataBadge.tsx로 "이건 진짜 데이터가 아니다"를 알린다. 0으로 두면
// 배지가 붙어 있어도 "정말 미처리가 없는지 샘플이라 안 보이는지" 구분이 안 되므로, 배지가 실제로
// 눈에 들어오는 작은 양수(2)를 택했다 — mocks/dashboard.ts가 대출·연체 등에서 이미 쓰는 관례.
export const mockManualEntryPendingCount = 2;
