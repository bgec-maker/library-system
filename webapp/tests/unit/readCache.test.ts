// todo/42 — todo/29 검증 하네스의 정식판(당시 1회용으로 만들고 버린 것을 CI 상주로).
import { cachedApiCall } from '../../src/services/readCache';
import { publishDataChange } from '../../src/services/dataChangeBus';
import { calls, setDelay } from './stubs/api';

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  console.log('ok —', msg);
}

(async () => {
  setDelay(30);

  const [a, b] = await Promise.all([cachedApiCall('recentOps', { limit: 100 }), cachedApiCall('recentOps', { limit: 100 })]);
  assert(calls.length === 1, `동시 2건 → fetch 1회 (실측 ${calls.length})`);
  assert(a === b, '두 소비자가 같은 결과를 공유');

  await cachedApiCall('recentOps', { limit: 100 }, 15000);
  assert(calls.length === 1, 'TTL 내 재호출 → fetch 없음');

  await cachedApiCall('report', { type: 'x', b: 1 }, 15000);
  await cachedApiCall('report', { b: 1, type: 'x' }, 15000);
  assert(calls.length === 2, 'payload 키 순서 무관 동일 캐시 키');

  publishDataChange();
  await cachedApiCall('recentOps', { limit: 100 }, 15000);
  assert(calls.length === 3, '쓰기 신호 후 즉시 재조회(무효화)');

  const p = cachedApiCall('viz', { type: 'wave' }, 60000);
  publishDataChange(); // 요청이 나간 뒤, 도착 전 — 세대 가드
  await p;
  await cachedApiCall('viz', { type: 'wave' }, 60000);
  assert(calls.length === 5, '쓰기와 교차한 응답은 캐시 미저장 → 재조회');

  const { setPlan } = await import('./stubs/api');
  setPlan(['X_FAIL']);
  await cachedApiCall('unpaidFines', {}, 15000);
  await cachedApiCall('unpaidFines', {}, 15000);
  assert(calls.length === 7, '실패 응답은 캐시하지 않음 → 재시도 시 재조회');

  console.log('readCache ALL PASS');
})();
