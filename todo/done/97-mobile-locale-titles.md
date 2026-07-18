# 97 · mobile-locale-titles — 모바일 헤더 로케일 전환 미반영 (시각 감사 3R 실결함)

배경(증빙 /tmp/vis/r3-m1-en-more.png): EN 전환 후에도 모바일 헤더가 「더보기」(한국어)로
남는다 — 탭 라벨·메뉴 목록은 즉시 영어가 되는데 헤더만 낡은 언어. 원인: m-shell 헤더의
tabTitle과 StackNav 엔트리 title이 "설정 시점 문자열"로 동결(setTitle 1회 호출 계약).
데스크톱 창은 todo/10에서 같은 문제를 "커스텀 제목이 아니면 로케일 알림 때 재파생"으로
풀었다 — 모바일만 미적용 잔여.

할 일: 데스크톱과 같은 패턴 — MobileShell: 기본 제목 종류(meta/tab)를 추적해 subscribeLocale
때 비커스텀만 재파생. StackNav: 엔트리에 custom 플래그, 알림 때 비커스텀 title을 레지스트리
에서 재매핑(도서 상세의 책 제목 같은 커스텀은 보존). e2e: EN 전환 → 헤더 'More' 단정 신설.

완료 조건: e2e 단정, 전 게이트.

---

## 이행 노트 (완료)

- MobileShell: tabTitle의 기본값 종류(meta/tab/custom)를 ref로 추적 — setTitle에서 분류,
  selectTab에서 'tab' 복귀, subscribeLocale 때 비커스텀만 재파생(더보기는 t('common.more')).
- StackNav: 엔트리에 customTitle 플래그(push=false, setTitle에서 레지스트리 기본과 비교),
  로케일 알림 때 비커스텀만 레지스트리(새 언어로 이미 mutate — ADR-023)에서 재매핑.
  도서 상세의 책 제목 같은 커스텀은 보존 — 데스크톱 Window(todo/10)와 완전 동형.
- e2e(mobile-smoke 확장): EN 전환→헤더 'More', push 제목 'Reservations', 열린 채 KO 복귀→
  「더보기」 — 사전 결함이던 지점을 상주 단정으로. 전 게이트 · 12 e2e 통과.
