import { useCallback, useEffect, useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import type { ViewProps } from '../../types';
import { getViewMeta } from '../../registry';
import { ScanCameraStart } from '../../components/ScanCameraStart';
import { PrintDocument } from '../../components/PrintDocument';
import { SampleDataBadge } from '../../components/SampleDataBadge';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { cameraSession } from '../../services/cameraSession';
import { openScannerWindow } from '../../services/scannerWindowStore';
import { ensureCatalogSync, useCatalogSync, type CatalogCopyRow } from '../../services/catalog';
import { useDashboardData } from '../../services/dashboardData';
import { getEffectiveScanRoute, subscribeScan } from '../../services/scanBus';
import { inventoryScan } from '../../services/inventoryData';
import { intlLocaleTag, t } from '../../i18n';
import './inventory.css';

// 장서 점검(inventory) 뷰 — todo/14 「장서점검 + ZXing Worker(부채 상환 세트)」의 두 번째 절반.
// 정본 대조 기준은 services/catalog.ts의 IndexedDB 미러(todo/08)다 — 서버에 새 "점검 목록" 조회
// 액션을 만들지 않고, 이미 동기화된 카탈로그 미러 스냅샷과 이 세션 안에서 스캔한 바코드 집합을
// 클라이언트에서 그대로 비교한다(ADR-024와 같은 원칙: 대조·집계는 로컬).
//
// 점검 대상("보관중") 상태 코드 — docs/ASSUMPTIONS.md `## todo/14` 참고. AVAILABLE(서가에 있어야
// 함)·HOLD_READY(예약 수령 선반에 있어야 함) 둘만 포함한다. ON_LOAN을 일부러 뺀 이유: 대출 중인
// 책은 회원에게 가 있어 서가를 돌아도 원래 스캔되지 않는 게 정상이다 — 포함시키면 세션마다
// "대출 중인 책 전부"가 분실 후보로 잘못 뜬다(장서점검의 목적 자체를 무력화). LOST·WITHDRAWN·
// REPAIR는 이미 소재/상태가 확인·처리된 것들이라 다시 점검할 이유가 없어 뺐다.
const ELIGIBLE_STATUS_CODES: ReadonlySet<string> = new Set(['AVAILABLE', 'HOLD_READY']);

interface LostGroup {
  shelfCode: string;
  rows: CatalogCopyRow[];
}

function groupByShelf(rows: CatalogCopyRow[]): LostGroup[] {
  const map = new Map<string, CatalogCopyRow[]>();
  for (const row of rows) {
    const key = row.shelfCode || '';
    const bucket = map.get(key);
    if (bucket) bucket.push(row);
    else map.set(key, [row]);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([shelfCode, groupRows]) => ({ shelfCode, rows: groupRows }));
}

const lostCandidateColumns: DataTableColumn<CatalogCopyRow>[] = [
  { key: 'barcode', header: t('views.catalog.col.barcode'), sortable: true, mono: true, mobilePrimary: true },
  { key: 'title', header: t('views.catalog.col.title'), sortable: true, mobileSecondary: true },
  { key: 'shelfCode', header: t('views.catalog.col.shelf'), sortable: true }
];

export default function InventoryView({ shell }: ViewProps) {
  const catalogState = useCatalogSync();
  // 인쇄 머리(학교명)용 — 이 뷰가 새로 서버를 호출하지 않고, 이미 셸 기저층(DashboardBaseLayer/
  // MobileShell)이 항상 띄워 두는 대시보드 데이터를 그대로 재사용한다(DashboardBaseLayer.tsx와
  // 동일한 폴백: 아직 안 불러왔으면 dashboard.title로 대체).
  const dashboardState = useDashboardData();
  const libraryName = dashboardState.data?.libraryName || t('dashboard.title');

  const [sessionActive, setSessionActive] = useState(false);
  const [baseline, setBaseline] = useState<CatalogCopyRow[]>([]);
  const [scannedBarcodes, setScannedBarcodes] = useState<ReadonlySet<string>>(() => new Set());
  const [ended, setEnded] = useState(false);
  const [lostCandidates, setLostCandidates] = useState<CatalogCopyRow[]>([]);
  const [endedAt, setEndedAt] = useState<Date | null>(null);

  useEffect(() => {
    shell.setTitle(getViewMeta('inventory')?.title ?? t('registry.inventory.title'));
  }, [shell]);

  useEffect(() => {
    ensureCatalogSync();
  }, []);

  const baselineByBarcode = useMemo(() => {
    const map = new Map<string, CatalogCopyRow>();
    baseline.forEach((row) => map.set(row.barcode, row));
    return map;
  }, [baseline]);

  const handleBookScan = useCallback(
    (barcode: string) => {
      if (scannedBarcodes.has(barcode)) return; // 이미 이 세션에서 스캔됨 — 중복 집계·중복 호출 금지
      const row = baselineByBarcode.get(barcode);
      if (!row) return; // 점검 대상(baseline) 밖 — 조용히 무시(위 ELIGIBLE_STATUS_CODES 주석 참고)

      setScannedBarcodes((prev) => {
        const next = new Set(prev);
        next.add(barcode);
        return next;
      });

      // fire-and-forget — 다음 스캔을 막지 않는다(연속 스캔 세션의 핵심). todo/38: 실패 시
      // 이 바코드를 세트에서 되돌린다 — 이전에는 선등록+중복 가드 때문에 실패한 책을 다시
      // 찍어도 no-op이라 그 소장본의 서버 점검 기록이 세션 내 복구 불가였다. 진행 카운트도
      // 함께 되돌아간다: 시트에 없는 걸 "봤다"고 세지 않는다(검증 원칙 「가짜 성공 금지」 —
      // 구 주석의 "로컬 확정 우선" 트레이드오프를 뒤집는 결정, todo/done/38 참고).
      void inventoryScan(barcode).then((res) => {
        if (!res.ok) {
          setScannedBarcodes((prev) => {
            const next = new Set(prev);
            next.delete(barcode);
            return next;
          });
          shell.toast(t('views.inventory.scanWriteFailed', { message: res.message }), 'error');
        }
      });
    },
    [scannedBarcodes, baselineByBarcode, shell]
  );

  // scanBus 구독 — 이 뷰가 유효 스캔 라우트일 때만, 그리고 세션이 활성일 때만 반응한다(다른
  // scan:'focus' 뷰들과 같은 규약, loan-return/index.tsx 참고).
  useEffect(
    () =>
      subscribeScan((evt) => {
        if (!sessionActive) return;
        if (getEffectiveScanRoute() !== 'inventory') return;
        const target = evt.target;
        const barcode = target.kind === 'book' ? target.barcode : target.kind === 'book-url' ? target.barcode : null;
        if (barcode) handleBookScan(barcode);
      }),
    [sessionActive, handleBookScan]
  );

  function handleStartSession() {
    const eligible = catalogState.rows.filter((row) => ELIGIBLE_STATUS_CODES.has(row.statusCode));
    setBaseline(eligible);
    setScannedBarcodes(new Set());
    setLostCandidates([]);
    setEnded(false);
    setSessionActive(true);
    // ADR-020 온디맨드 정책 — 세션은 카메라가 실제로 돌고 있어야 의미가 있다. openScannerWindow()는
    // ScanCameraStart의 데스크톱 시작 버튼과 같은 단일 진입점(services/scannerWindowStore.ts) —
    // 이미 켜져 있으면 그냥 펼치기만 하는 멱등 호출이라 플랫폼/기존 상태를 따로 분기할 필요가 없다
    // (데스크톱: 창을 열어 미리보기를 보여줌. 모바일: cameraSession.start()만 내부에서 호출되고,
    // 이미 이 뷰에 박혀 있는 <ScanCameraStart>가 session.running을 구독해 자동으로 전체화면
    // 스캔 무대를 그린다).
    openScannerWindow();
    cameraSession.setContinuous(true);
  }

  function handleEndSession() {
    const lost = baseline.filter((row) => !scannedBarcodes.has(row.barcode));
    setLostCandidates(lost);
    setEndedAt(new Date());
    setSessionActive(false);
    setEnded(true);
    // 연속 모드 핀만 해제한다 — 카메라 자체는 평소처럼 유휴 타이머 정책을 따르게 둔다(세션
    // 종료가 곧 카메라 강제 종료를 뜻하지는 않는다, 사서가 이어서 다른 화면에서 스캔할 수 있음).
    cameraSession.setContinuous(false);
  }

  const scannedCount = scannedBarcodes.size;
  const baselineTotal = baseline.length;
  const remaining = Math.max(0, baselineTotal - scannedCount);
  const progressPct = baselineTotal > 0 ? Math.min(100, Math.round((scannedCount / baselineTotal) * 100)) : 0;
  const lostGroups = useMemo(() => groupByShelf(lostCandidates), [lostCandidates]);
  // ADR-023 — 날짜는 사전에 문자열로 박아 넣지 않고 Intl.*(locale)로 그때그때 포맷한다
  // (reports 5종의 서버 generatedAt과 달리 이건 서버 호출이 없어 클라이언트 시각을 쓴다).
  const generatedAtText = endedAt ? new Intl.DateTimeFormat(intlLocaleTag(), { dateStyle: 'medium', timeStyle: 'short' }).format(endedAt) : '';

  return (
    <div className="inv-view">
      <ScanCameraStart viewId="inventory" platform={shell.platform} />

      {!sessionActive && !ended && (
        <div className="panel" style={{ padding: 20 }}>
          <div className="inv-toolbar">
            <div className="inv-sync-note">
              {(catalogState.sample || catalogState.syncing) && (
                <>
                  {catalogState.sample && <SampleDataBadge />}
                  {catalogState.syncing && (
                    <span>{t('views.catalog.syncing', { count: catalogState.syncedCount, total: catalogState.totalHint ?? '?' })}</span>
                  )}
                </>
              )}
            </div>
            <button type="button" className="warn" onClick={handleStartSession} disabled={catalogState.rows.length === 0}>
              {t('views.inventory.startSession')}
            </button>
          </div>
          {catalogState.rows.length === 0 ? (
            <p className="inv-note">{t('views.inventory.notSyncedHint')}</p>
          ) : (
            <p className="inv-note">{t('views.inventory.eligibleNote')}</p>
          )}
        </div>
      )}

      {sessionActive && (
        <div className="panel" style={{ padding: 20 }}>
          <p>{t('views.inventory.sessionHint')}</p>
          <div className="inv-progress">
            <div className="inv-progress-stat">
              <span className="inv-progress-value">{scannedCount}</span>
              <span className="inv-progress-label">{t('views.inventory.progress', { scanned: scannedCount, total: baselineTotal })}</span>
            </div>
            <div className="inv-progress-bar">
              <div className="inv-progress-bar-fill" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="inv-progress-stat">
              <span className="inv-progress-value">{remaining}</span>
              <span className="inv-progress-label">{t('views.inventory.remaining', { count: remaining })}</span>
            </div>
          </div>
          <p className="inv-note">{t('views.inventory.baselineCount', { count: baselineTotal })}</p>
          <div className="inv-actions">
            <button type="button" onClick={handleEndSession}>
              {t('views.inventory.endSession')}
            </button>
          </div>
        </div>
      )}

      {ended && (
        <div className="panel no-print" style={{ padding: 20 }}>
          <h2>{t('views.inventory.resultHeading')}</h2>
          <p className="inv-result-summary">
            {t('views.inventory.resultSummary', { total: baselineTotal, scanned: scannedCount, lost: lostCandidates.length })}
          </p>
          <div className="inv-actions">
            <button type="button" className="ghost" onClick={() => shell.print()}>
              <Printer size={16} aria-hidden /> {t('views.reports.printButton')}
            </button>
            <button type="button" className="ghost" onClick={() => setEnded(false)}>
              {t('views.inventory.backToStart')}
            </button>
          </div>

          <h3>{t('views.inventory.lostHeading')}</h3>
          <DataTable<CatalogCopyRow>
            columns={lostCandidateColumns}
            rows={lostCandidates}
            rowKey={(row) => row.copyId}
            platform={shell.platform}
            emptyHint={t('views.inventory.lostEmpty')}
            csvFileName="inventory-lost-candidates.csv"
            defaultPageSize={25}
          />
        </div>
      )}

      {ended && (
        <div className="print-preview-frame">
          <PrintDocument libraryName={libraryName} generatedAtText={generatedAtText}>
            <h2>{t('views.inventory.resultHeading')}</h2>
            <p className="inv-result-summary">
              {t('views.inventory.resultSummary', { total: baselineTotal, scanned: scannedCount, lost: lostCandidates.length })}
            </p>
            <h2>{t('views.inventory.lostHeading')}</h2>
            {lostCandidates.length === 0 ? (
              <p className="print-empty">{t('views.inventory.lostEmpty')}</p>
            ) : (
              lostGroups.map((group) => (
                <div className="print-class-group" key={group.shelfCode || '__none__'}>
                  <div className="print-class-title">
                    {group.shelfCode
                      ? t('views.inventory.shelfGroupHeading', { shelf: group.shelfCode, count: group.rows.length })
                      : t('views.inventory.noShelfGroupHeading', { count: group.rows.length })}
                  </div>
                  <table className="print-table">
                    <thead>
                      <tr>
                        <th className="mono">{t('views.catalog.col.barcode')}</th>
                        <th>{t('views.catalog.col.title')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((row) => (
                        <tr key={row.copyId}>
                          <td className="mono">{row.barcode}</td>
                          <td>{row.title}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))
            )}
          </PrintDocument>
        </div>
      )}
    </div>
  );
}
