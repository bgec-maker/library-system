# 118 · manual-form-actions — 등록 폼 액션 줄 위계·취소 문구·오류 포커스 (사용자 아침 제보)

배경(사용자 실기기 캡처 06:34): ① 상태 셀렉트·저장·「취소하고 다시 스캔」이 한 줄에 흘러
저장(프라이머리)이 가장 작고 보조가 가장 큼 — 위계 역전. ② 무ISBN 폼은 스캔 없이 진입하는데
취소 문구가 스캔 경로 것을 공유. ③ 필수 미충족 시 배너가 상단에 떠서 긴 폼(모바일)에선
화면 밖 — 무반응처럼 보임.

할 일: 두 등록 폼(confirm·manualConfirm) 공통 — 액션을 전용 블록으로(저장 전폭 프라이머리
→ 취소 고스트 전폭, 상태 셀렉트는 필드 영역에 잔류). 무ISBN 취소 라벨 → 「취소」(common.cancel).
필수 미충족 시 해당 입력 포커스+scrollIntoView(center)+aria-invalid+실패색 테두리(입력 시 해제)
— ISBN 폼의 서명 필수도 동일 적용. e2e: 빈 저장→서명 입력 포커스·aria-invalid 단정.

완료 조건: 재캡처(모바일 액션 블록), 전 게이트, e2e.

---

## 이행 노트 (완료)

- 두 등록 폼 공통 .reg-formActions 블록: 저장 전폭 프라이머리 → 취소 고스트 전폭(셀렉트·버튼
  인라인 한 줄 흐름 제거). 무ISBN 취소 라벨 → 「취소」(common.cancel), 스캔 경로는 기존 문구 유지.
- 필수 미충족 시 markInvalid: 해당 입력 포커스 + scrollIntoView(center) + aria-invalid +
  --fail 테두리(입력 시 해제) — 무ISBN 서명/저자 + ISBN 폼 서명 3곳.
- e2e(register-pipeline 4번째): 빈 저장→서명 포커스·aria-invalid → 입력 시 해제 → 저자 지목,
  취소 라벨 단정. 모바일 재캡처(/tmp/vis/118-after·invalid.png). 전 게이트 · 15 e2e 통과.
