# 도서관 관리 시스템

QR 기반 학교 도서관 관리 시스템 — 대출·반납·검색·장서점검을 Google Sheets(GAS) 백엔드 위에서, 두 셸(데스크톱 창 관리자·모바일 탭)을 공유하는 웹앱으로 운영합니다.

**▶ 앱: [/app/](https://bgec-maker.github.io/library-system/app/)** (사서·스테이션용)

## 구조

```
webapp/          통합 웹앱 (Vite + React + TS) — 실제 개발은 여기서
  src/views/       업무 화면 (대출·반납·검색·장서점검·등록…)
  src/shells/      데스크톱 창 관리자 / 모바일 탭+스택
  src/student/     학생 공개 표면 (번들 분리)
school-patch-v1/ GAS 백엔드 현행판 (Code.gs·Sidebar.html·워크북) — 사이드바 콘솔 겸용
docs/            설계 문서 — DECISIONS.md(ADR)부터 읽으세요
todo/            에이전트 실행 큐 (CLAUDE.md 루프 프로토콜)
spike/           Phase 0 카메라·PWA 검증 스파이크 — 도우미 폰 설치형 PWA가 이 URL을 가리키므로 삭제 금지
```

레거시(원본 `mvp-package/` 등)는 트리에서 제거되었고 git 히스토리에서 확인할 수 있습니다.

## E2E 테스트

Playwright 스위트(`webapp/e2e/`) — 데스크톱 스모크(세션게이트→대출·반납→등록→catalog 정렬→언어 토글→인쇄 CSS 스냅샷), 등록 파이프라인 회귀(BUSY_RETRY 자동 회복·새로고침 재개), 쓰기 재시도, **모바일 셸 스모크**(탭바·대출·등록 파이프라인·더보기 push)를 목 백엔드(`page.route()`, 실제 GAS 미호출)로 검증합니다.

```
cd webapp
npx playwright install --with-deps chromium   # 최초 1회
npm run e2e
```

`main` 브랜치 push 시 `.github/workflows/e2e.yml`이 CI에서 자동 실행합니다(headless Chromium).

## 문서 읽는 순서

`CLAUDE.md` → `docs/DECISIONS.md`(ADR) → `docs/FRONTEND.md`(웹앱 아키텍처) → `docs/PATCH_SPEC.md`(백엔드 패치 상태) → `docs/ROADMAP.md`(전체 지도)
