import { useSyncExternalStore } from 'react';
import { onRegisterQueueChange, readFailedList } from '../services/registerQueue';

/** todo/62 — 등록 파이프라인 실패 건수 구독. todo/53(모바일 탭 배지)의 훅을 셸 공용으로
 *  승격 — 같은 신호는 두 셸에서 같은 원천을 읽어야 한다(로직 중복 금지, todo/14 관례).
 *  getSnapshot이 원시값(길이)을 돌려주므로 참조 동일성 문제 없음. */
export function useRegisterFailedCount(): number {
  return useSyncExternalStore(onRegisterQueueChange, () => readFailedList().length);
}
