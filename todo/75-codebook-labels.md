# 75 · codebook-labels — 코드값 라벨 병기 (16_CODEBOOK 미러)

배경: 정책 화면의 member_type_code(GENERAL 등)·무결성 결과의 코드가 원값 노출 — 내부어 금지
원칙의 잔여 구멍. 서버 응답에 라벨이 없으므로 프론트 상수 미러로 해결(시드 코드북은 안정적).

할 일: codebookLabels.ts(code_group→code→ko/en) 신설 — 시트 시드와 대조 주석, 미지 코드는
원값 그대로. 정책·무결성·상세 화면 적용.

완료 조건: 캡처 1장, i18n 게이트 포함 전 게이트.
