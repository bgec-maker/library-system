import { apiCall, type ApiResult } from './api';
import { subscribeDataChange } from './dataChangeBus';

// todo/29 「읽기 API 캐시·중복제거」 — GAS 호출 할당량은 이 프로젝트에서 가장 귀한 자원이다.
// 읽기 액션에 한해 세 가지를 제공한다:
//   ① in-flight 공유: 같은 (action, payload) 요청이 진행 중이면 새 fetch를 만들지 않고 합류
//      (dashboardData.refresh()가 자기 자신에게만 하던 것을 서비스 전반으로 일반화)
//   ② 짧은 TTL: 성공 응답을 초 단위로만 보관 — 뷰 재마운트·창 전환·같은 책 재열람의 중복 발사 억제
//   ③ 쓰기 신호 무효화: publishDataChange가 오면 전체 캐시를 비운다 — "트랜잭션 후 재조회"
//      (FRONTEND.md 대시보드 절) 신선도 계약을 캐시가 깨지 않는다
//
// 원칙(FRONTEND.md 「진실은 항상 시트」): 이 캐시는 지속 저장이 아니라 순간 완충이다 —
// localStorage/IndexedDB에 싣지 않고 메모리에만 둔다. 쓰기 액션은 절대 이 경로로 오면 안 된다
// (호출부가 읽기 전용 액션만 배선한다 — api.ts READ_ONLY_ACTIONS와 같은 결이지만, catalogSync는
// 자체 델타 프로토콜이 이미 캐시이고 lookupIsbn은 등록 중복 판정의 신선도가 필요해 제외).
//
// 실패(ok:false)는 캐시하지 않는다 — 오류를 TTL 동안 반복 재생하면 "재시도" 버튼이 거짓말이 된다.

interface CacheSlot {
  at: number;
  result: ApiResult<unknown>;
}

const inFlight = new Map<string, Promise<ApiResult<unknown>>>();
const slots = new Map<string, CacheSlot>();

// payload 키 안정화 — 키 순서가 달라도 같은 요청은 같은 키가 되게 정렬한다(얕은 payload 전제:
// 이 프로젝트 읽기 payload는 전부 평평한 스칼라 필드다).
function cacheKey(action: string, payload: Record<string, unknown>): string {
  const keys = Object.keys(payload).sort();
  return action + '|' + keys.map((k) => `${k}=${String(payload[k])}`).join('&');
}

export function invalidateReadCache(): void {
  slots.clear();
  // in-flight는 비우지 않는다 — 이미 나간 요청을 취소할 수는 없고, 그 응답은 곧 도착할 최신에
  // 가장 가까운 값이다. 단 완료 시 저장될 슬롯은 새 세대에 속하므로 그대로 둬도 무해하다…는
  // 가정은 틀릴 수 있다: 쓰기 직전에 나간 읽기가 쓰기 이후에 도착해 TTL 동안 낡은 값을 재생할
  // 수 있다. 그래서 세대 카운터로 "무효화 이전에 시작된 요청"의 캐시 저장을 막는다.
  generation += 1;
}

let generation = 0;

subscribeDataChange(() => invalidateReadCache());

/**
 * 읽기 전용 액션 캐시 호출. ttlMs 동안 같은 (action,payload)의 성공 응답을 재사용하고,
 * 진행 중이면 합류한다. 쓰기 트랜잭션(publishDataChange) 시 즉시 전체 무효화.
 */
export async function cachedApiCall<T = unknown>(
  action: string,
  payload: Record<string, unknown> = {},
  ttlMs = 15000
): Promise<ApiResult<T>> {
  const key = cacheKey(action, payload);

  const slot = slots.get(key);
  if (slot && Date.now() - slot.at < ttlMs) {
    return slot.result as ApiResult<T>;
  }

  const joined = inFlight.get(key);
  if (joined) return joined as Promise<ApiResult<T>>;

  const startedGeneration = generation;
  const promise = (async () => {
    try {
      const result = await apiCall<T>(action, payload);
      // 성공했고, 요청이 시작된 뒤로 쓰기 무효화가 없었을 때만 저장 — 쓰기와 교차한 응답은
      // 한 번 쓰고 버린다(호출자에겐 정상 반환, 캐시에는 남기지 않음).
      if (result.ok && startedGeneration === generation) {
        slots.set(key, { at: Date.now(), result });
      }
      return result;
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, promise);
  return promise as Promise<ApiResult<T>>;
}
