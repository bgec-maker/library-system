# 105 · srtable-scroll-inflation — sr 표가 스크롤 영역을 8배로 부풀림 (시각 감사 7R 실결함)

배경(스크롤 캡처 공백 → 프로브 실측): 대시보드 기저층 콘텐츠는 ~1.4천px인데 scrollHeight가
11,013px — 범인은 `TABLE.viz-table.viz-sr-only`(대출 잔디의 365행 sr 표, bottom=11013).
표시형 table엔 overflow/height 클리핑이 안 먹혀(display:table은 overflow·height 무시)
absolute 박스가 원高 그대로 남고, absolute 자손도 조상(.dashboard-base)의 스크롤 영역을
늘린다 → 푸터 아래로 ~9,600px의 빈 스크롤 꼬리(사용자가 "무(無)"로 스크롤 가능).
리포트 허브 「장서 시각화」 패널도 동일 노출.

할 일: .viz-sr-only에 display:block 추가 — 블록 박스가 되면 height:1px+overflow:hidden이
실효해 1×1로 접힌다(표준 sr-only 레시피의 누락분). 프로브로 scrollHeight 정상화 확인.

완료 조건: scrollHeight 실측 정상(±콘텐츠), 전 게이트, e2e.

---

## 이행 노트 (완료)

- viz.css .viz-sr-only에 display:block — 실측 scrollHeight 11,013 → **1,487px**(정상).
  빈 스크롤 꼬리 소멸(대시보드·리포트 허브 「장서 시각화」 공통).
- 전 게이트 · 12 e2e(하드 게이트) 통과.
