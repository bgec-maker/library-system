import { useSyncExternalStore } from 'react';

// ADR-023 「웹앱 다국어 — 학생 표면 포함, 기반은 1차 런에」 + FRONTEND.md 「다국어」:
// i18n 라이브러리 무도입(번들 예산 — student ≤70KB gz) · 자체 t() 유틸 · 활성 로케일만 dynamic
// import(두 언어 JSON을 메인 청크에 함께 굽지 않는다) · 감지 순서 localStorage → navigator.language
// → 'ko' · 미번역 키는 ko 문자열로 폴백(원문 키 그대로 노출하지 않는다).
//
// 사전에 넣지 않는 것(ADR-023): 서명·저자·학생 이름(데이터), 날짜·숫자(Intl.*(locale) 사용).

export type Locale = 'ko' | 'en';

const SUPPORTED_LOCALES: readonly Locale[] = ['ko', 'en'];
const STORAGE_KEY = 'lib.locale';

type Dict = Record<string, string>;
type NestedDict = { [key: string]: string | NestedDict };

function isSupportedLocale(value: string | null | undefined): value is Locale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

function flatten(obj: NestedDict, prefix = ''): Dict {
  const out: Dict = {};
  for (const [key, value] of Object.entries(obj)) {
    const flatKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      out[flatKey] = value;
    } else {
      Object.assign(out, flatten(value, flatKey));
    }
  }
  return out;
}

const dictCache = new Map<Locale, Dict>();

async function loadDict(locale: Locale): Promise<Dict> {
  const cached = dictCache.get(locale);
  if (cached) return cached;
  // 활성 로케일만 dynamic import — Vite가 각 JSON을 별도 청크로 분리해준다(ADR-023).
  const mod = locale === 'en' ? await import('./en.json') : await import('./ko.json');
  const raw = (mod as unknown as { default: NestedDict }).default;
  const dict = flatten(raw);
  dictCache.set(locale, dict);
  return dict;
}

function detectLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isSupportedLocale(stored)) return stored;
  } catch {
    /* localStorage 접근 불가(사생활 모드 등) — navigator.language로 폴백 */
  }
  const nav = (navigator.language || '').slice(0, 2);
  if (isSupportedLocale(nav)) return nav;
  return 'ko';
}

let activeLocale: Locale = 'ko';
let activeDict: Dict = {};
// 항상 ko 사전 — 활성 로케일에 없는 키의 폴백 대상(FRONTEND.md: "미번역 키는 ko로 폴백").
let fallbackDict: Dict = {};

const listeners = new Set<() => void>();
function notify(): void {
  listeners.forEach((fn) => fn());
}

/** 로케일이 바뀔 때마다 재렌더해야 하는 컴포넌트/스토어(registry.ts 등)를 위한 구독. */
export function subscribeLocale(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getLocale(): Locale {
  return activeLocale;
}

export async function setLocale(locale: Locale, persist = true): Promise<void> {
  const [dict, fb] = await Promise.all([loadDict(locale), locale === 'ko' ? Promise.resolve(null) : loadDict('ko')]);
  activeDict = dict;
  fallbackDict = fb ?? dict;
  activeLocale = locale;
  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      /* 저장 실패 — 이번 세션 동안만 유지(치명적이지 않음) */
    }
  }
  notify();
}

let readyPromise: Promise<void> | null = null;
let ready = false;

/**
 * Suspense 리소스 패턴 — 아직 로케일 사전이 준비되지 않았으면 로딩 promise를 throw해
 * 가장 가까운 <Suspense>가 기다리게 한다(boot.tsx의 I18nGate). 준비되면 조용히 반환.
 */
export function ensureLocaleReady(): void {
  if (ready) return;
  if (!readyPromise) {
    readyPromise = setLocale(detectLocale(), false).then(() => {
      ready = true;
    });
  }
  throw readyPromise;
}

function interpolate(raw: string, params?: Record<string, string | number>): string {
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (match, key: string) => (key in params ? String(params[key]) : match));
}

/** 사전 키 → 표시 문자열. 활성 로케일에 없으면 ko 문자열로, 그것도 없으면 키 자체를 반환. */
export function t(key: string, params?: Record<string, string | number>): string {
  const raw = activeDict[key] ?? fallbackDict[key] ?? key;
  return interpolate(raw, params);
}

/** 날짜·숫자는 사전에 넣지 않고 Intl.*(locale)로 로케일만 반영한다(ADR-023). */
export function intlLocaleTag(locale: Locale = activeLocale): string {
  return locale === 'en' ? 'en-US' : 'ko-KR';
}

/** 로케일이 바뀔 때마다 재렌더하고 싶은 컴포넌트가 쓰는 훅. */
export function useLocale(): Locale {
  return useSyncExternalStore(subscribeLocale, getLocale, getLocale);
}
