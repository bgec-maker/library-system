import { apiCall, type ApiResult } from './api';

// todo/37 「쓰기 BUSY_RETRY 자동 흡수」 — 서버(withWriteLock_ tryLock 10s)의 락 경합은 일시
// 오류인데, 등록 큐(registerQueue)만 흡수하고 나머지 쓰기는 사용자에게 그대로 실패로 보였다.
// 이 헬퍼는 **블로킹 UX를 유지한 채**(호출부는 여전히 await — 백그라운드화는 등록 큐만의
// 정책이다) 같은 requestId로 짧게 재시도한다. 같은 ID 재전송이 안전한 근거는 executeWrite_의
// OPERATIONS 멱등(todo/28에서 확립): COMPLETED면 idempotent 재확인 응답이 온다.
//
// 재시도 대상 코드 — registerQueue(백그라운드)와 달리 **CLIENT_TIMEOUT은 제외**한다:
// 이미 30초를 기다린 사용자를 블로킹 상태로 더 잡아두지 않는다(기존 수동 재시도 UI가 그
// 경로의 주인). BUSY_RETRY(락 경합)·NETWORK_ERROR(즉시 실패)·DUPLICATE_REQUEST(이전 시도가
// 서버에서 아직 처리 중 — 잠시 후 재문의하면 멱등 재확인으로 풀림)만 흡수한다.
const RETRYABLE_CODES = new Set(['BUSY_RETRY', 'NETWORK_ERROR', 'DUPLICATE_REQUEST']);
const RETRY_DELAYS_MS = [1500, 3000]; // 총 3회 시도, 추가 대기 최대 4.5초

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 쓰기 전용 apiCall 래퍼 — payload.requestId 필수(멱등 전제). 읽기는 readCache 관할이므로
 * 이 헬퍼를 쓰지 않는다. 구 api.ts retryApiCall(사용처 0건, todo/37에서 제거)의 "같은
 * requestId로만 재시도" 관례를 실제 코드로 만든 것.
 */
export async function apiCallWithRetry<T = unknown>(
  action: string,
  payload: Record<string, unknown> & { requestId: string }
): Promise<ApiResult<T>> {
  let result = await apiCall<T>(action, payload);
  for (const delay of RETRY_DELAYS_MS) {
    if (result.ok || !RETRYABLE_CODES.has(result.error.code)) return result;
    await sleep(delay);
    result = await apiCall<T>(action, payload);
  }
  return result;
}
