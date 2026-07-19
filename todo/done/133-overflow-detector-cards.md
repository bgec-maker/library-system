# 133 · overflow-detector-cards — 이탈 검출기 + 카드 메타 그리드 이탈 실결함 (박스 점검 1/3)

배경(사용자 실기기 제보 — iPhone 최근 처리 화면): 카드가 화면 좌우로 새 나가 카드 왼쪽
모서리·라벨이 화면 밖, MOBILE_REG…·STF-…684AD9가 오른쪽에서 잘리고 뷰 전체가 옆으로
스크롤된다. 원인 확정(코드 대조):
- DataTable 카드 메타 그리드가 `auto 1fr auto 1fr` — 1fr의 **자동 최소값(min-content)** 이
  nowrap/긴 토큰의 전체 폭까지 올라간다. todo/93이 이 성질을 "그리드가 스스로 트랙을
  넓힌다"고 의도적으로 썼는데, 짧은 날짜엔 맞고 20자 mono 토큰(TTL-8291…, STF-BEF6…)
  **두 쌍이 한 줄**에 오면 그리드가 카드·뷰포트를 뚫는다.
- recent-ops의 entityId 열이 nowrap — 불투명 ID는 접혀도 무손실인데 nowrap이라 낱값 자체가
  안 접힌다.
- 모바일 스크롤 컨테이너(.m-shell-main/.m-stack-body)가 overflow-y만 지정 — x가 auto로
  계산돼 콘텐츠 결함이 **앱 전체 가로 스크롤**로 승격된다(제보 화면의 옆밀림).

할 일:
1. e2e 이탈 검출기(helper): document.scrollWidth > clientWidth 및 각 요소 rect의
   뷰포트 좌우 초과(visibility·display·opacity 0·fixed 의도 요소 필터)를 전수 수집해
   위반 목록을 돌려준다 — 이후 134 전 뷰 스윕과 135 상주 회귀의 공용 부품.
2. DataTable.css: 카드 메타 트랙 `auto minmax(0,1fr)`(2열형·:has 강등형·--single 전부),
   dd에 min-width:0 + overflow-wrap:anywhere(keep-all 유지 — 한글은 어절, 긴 토큰만 응급
   꺾음), dd.is-nowrap에 overflow:hidden + text-overflow:ellipsis(짧은 값 종전 그대로,
   극단값만 말줄임 — 계약: nowrap은 "꺾지 마라"지 "뚫어라"가 아니다).
3. recent-ops entityId의 nowrap 제거(ID는 접힘이 말줄임보다 낫다 — 대조 정보 무손실).
4. mobile.css: .m-shell-main/.m-stack-body에 overflow-x hidden(방어층 — 개별 결함이 앱
   전체를 밀지 못하게. 개별 수정과 병행하는 심층 방어임을 주석).
5. 프로브: 390px에서 제보와 같은 길이 토큰으로 recentOps 목 응답 구성 → 수정 전 위반
   재현 캡처 → 수정 후 검출기 0건 + 재캡처.

완료 조건: verify 전 게이트 + e2e 18본 green + 캡처 확인 + 커밋/푸시.
