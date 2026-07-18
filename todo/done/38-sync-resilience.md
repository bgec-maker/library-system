# 38 · sync-resilience — 동기화·저장 실패 내성 3건

## 왜 (전수 검토 발견 #3·4·6 — 전부 코드로 확정)
1. catalog.ts backgroundSync: putRows/setCursor(IndexedDB)에 catch가 없어 쿼터 초과·쓰기 실패
   시 syncing:true로 영구 고착 + 오류 배너도 없음(catalog·search·inventory 화면 멈춘 것처럼 보임)
2. session.ts setConfig: localStorage.setItem 무가드 — 코드베이스 관례(i18n·useWindowStore·
   scannerWindowStore 전부 try/catch)와 어긋나고, 사생활 모드에서 최초 설정 저장이 예외로 죽음
3. inventory: 스캔을 세트에 선등록 + 중복 가드라, inventoryScan 서버 쓰기가 실패하면 같은 책을
   다시 찍어도 no-op — 그 소장본의 점검 기록이 세션 내 복구 불가(진실은 시트인데 시트에 없음)

## 무엇
1. backgroundSync 루프에 try/catch: 오류를 state.error로 노출 + syncing 해제(다음 진입 시 재시도)
2. setConfig setItem try/catch(관례 정렬 — 실패해도 메모리 상태는 갱신)
3. inventoryScan 실패 시 scannedBarcodes에서 제거 + "다시 스캔하면 재시도" 토스트 — 진행
   카운트도 되돌린다(서버에 없는 걸 봤다고 세지 않는다 — 기존 주석의 트레이드오프를 뒤집는
   결정이므로 주석도 교체, 근거는 「가짜 성공 금지」)
## 완료 조건: verify·e2e 통과, 3번은 e2e 또는 하네스로 실측

## 실행 기록 (2026-07-17)
- 3건 모두 적용. 검증 범위의 정직한 한정: catalog 고착·inventory 재스캔은 실제 IndexedDB
  실패·카메라 스캔을 재현하기 어려워 **코드 경로 리뷰 + 정적 게이트 + 전체 e2e(회귀 없음)**로
  확인했다 — 상태 전이 자체는 단순(catch→error/finally→syncing:false, 실패→Set.delete)해서
  타입·경로 검증으로 충분하다고 판단. lint 이슈(37 스펙 미사용 import)도 이 커밋에서 수정.
