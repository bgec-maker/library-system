# 23 · 연간 리셋 + CSV + 아카이브
마법사(메뉴): ①미반납 전수 ②졸업 처리(미반납 차단) ③전원 진급 ④신입생 CSV(200건 배치) ⑤archiveLoans_(RETURNED/LOST/VOID→LOANS_YYYY, OPEN 이동 금지).
전부 executeWrite_ 경유·감사 기록. 무결성 점검이 아카이브 시트 FK도 보게 확장(추가만).
완료: 데모 데이터로 5단계 리허설 · 아카이브 후 무결성 0건
