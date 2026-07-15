/**
 * 도서관 관리 MVP v1.0.0
 * Google Sheets에 바인딩해서 사용하는 Apps Script입니다.
 * 내부 함수는 헤더명 기반으로 동작하므로 DB 시트의 열 순서를 바꿔도 되지만,
 * 헤더명 자체는 변경하지 마세요.
 */

var LIBRARY_MVP = Object.freeze({
  VERSION: '1.0.0',
  TIMEZONE: 'Asia/Seoul',
  CONSOLE_SHEET: '01_운영센터',
  // todo/22(구 PATCH_SPEC P7) — 영어 사용자를 위한 운영센터 쌍둥이 시트. 전역 언어 토글 대신
  // "시트 콘솔은 2장, 각자 자기 탭"(ADR-017) 원칙에 따라 별도 시트 이름으로 존재한다.
  // 01_운영센터와 마찬가지로 서식이 미리 그려진 리포트 시트라 LIBRARY_MVP.HEADERS에는 넣지
  // 않는다(HEADERS는 ensureSchema_/protectDatabaseSheets_이 순회하는 스키마 검증 대상 DB
  // 시트 전용 — 01_운영센터 자신도 HEADERS에 없다, 아래 refreshDashboard_/writeDashboardToSheet_
  // 참고). 이 환경은 바이너리 xlsx의 서식·라벨 셀을 만들 수 없으므로(todo/21과 동일한 제약),
  // 이 시트가 실제 스프레드시트에 아직 없으면 refreshDashboard_는 조용히 건너뛴다.
  CONSOLE_EN_SHEET: '01_Console_EN',
  GUIDE_SHEET: '02_사용법',
  SHEETS: Object.freeze({
    TITLES: '03_TITLES',
    AUTHORS: '04_AUTHORS',
    TITLE_AUTHORS: '05_TITLE_AUTHORS',
    CATEGORIES: '06_CATEGORIES',
    TITLE_CATEGORIES: '07_TITLE_CATEGORIES',
    COPIES: '08_COPIES',
    MEMBERS: '09_MEMBERS',
    LOANS: '10_LOANS',
    RESERVATIONS: '11_RESERVATIONS',
    FINES: '12_FINES',
    POLICIES: '13_POLICIES',
    STAFF: '14_STAFF_USERS',
    AUDIT: '15_AUDIT_LOG',
    CODEBOOK: '16_CODEBOOK',
    CONFIG: '17_CONFIG',
    OPERATIONS: '18_SYS_OPERATIONS',
    NOTIFICATIONS: '19_NOTIFICATION_QUEUE',
    VIZ_CACHE: '20_VIZ_CACHE',
    BOOK_CACHE: '21_BOOK_CACHE',
    // todo/21(구 PATCH_SPEC P3) — 명세 원문은 "20_MANUAL_ENTRY"라고 적었지만, 그 사이 20/21은
    // VIZ_CACHE/BOOK_CACHE가 이미 차지했다(각각 todo/06·todo/17). 번호가 겹치면 시트 탭 이름은
    // 여전히 고유하니 기술적으로는 동작하지만 혼란스러워서, 다음 순번인 22를 대신 썼다
    // (docs/ASSUMPTIONS.md todo/21 참고). 의도적으로 LIBRARY_MVP.HEADERS에는 넣지 않는다 —
    // 이 시트 하나만 protectDatabaseSheets_의 자동 보호 대상에서 빠져야 하기 때문이다. 아래
    // ensureManualEntrySheet_()/MANUAL_ENTRY_HEADERS_ 주석 참고.
    MANUAL_ENTRY: '22_MANUAL_ENTRY'
  }),
  HEADERS: Object.freeze({
    '03_TITLES': ['title_id', 'isbn13', 'title', 'subtitle', 'edition', 'publisher', 'published_year', 'language_code', 'material_type_code', 'classification_no', 'keywords', 'description', 'cover_url', 'status_code', 'created_at', 'created_by', 'updated_at', 'updated_by', 'row_version'],
    '04_AUTHORS': ['author_id', 'display_name', 'sort_name', 'external_id', 'bio', 'status_code', 'created_at', 'created_by', 'updated_at', 'updated_by', 'row_version'],
    '05_TITLE_AUTHORS': ['title_author_id', 'title_id', 'author_id', 'role_code', 'sort_order', 'created_at', 'created_by'],
    '06_CATEGORIES': ['category_id', 'parent_category_id', 'category_code', 'name_ko', 'name_en', 'sort_order', 'status_code', 'created_at', 'created_by', 'updated_at', 'updated_by', 'row_version'],
    '07_TITLE_CATEGORIES': ['title_category_id', 'title_id', 'category_id', 'is_primary', 'created_at', 'created_by'],
    '08_COPIES': ['copy_id', 'barcode', 'title_id', 'location_code', 'shelf_code', 'acquired_at', 'acquisition_source', 'price', 'condition_code', 'status_code', 'last_inventory_at', 'note', 'created_at', 'created_by', 'updated_at', 'updated_by', 'row_version'],
    '09_MEMBERS': ['member_id', 'member_no', 'name', 'school_no', 'grade', 'class_no', 'student_no', 'member_type_code', 'phone', 'email', 'joined_at', 'graduated_at', 'expires_at', 'status_code', 'loan_limit_override', 'suspended_until', 'suspend_reason', 'privacy_consent_at', 'note', 'created_at', 'created_by', 'updated_at', 'updated_by', 'row_version'],
    '10_LOANS': ['loan_id', 'copy_id', 'member_id', 'checked_out_at', 'due_at', 'returned_at', 'status_code', 'renew_count', 'policy_id', 'checkout_staff_id', 'return_staff_id', 'request_id', 'note', 'created_at', 'created_by', 'updated_at', 'updated_by', 'row_version'],
    '11_RESERVATIONS': ['reservation_id', 'title_id', 'member_id', 'requested_at', 'queue_seq', 'status_code', 'assigned_copy_id', 'ready_at', 'pickup_expires_at', 'fulfilled_loan_id', 'fulfilled_at', 'cancelled_at', 'request_id', 'note', 'created_at', 'created_by', 'updated_at', 'updated_by', 'row_version'],
    '12_FINES': ['fine_id', 'member_id', 'loan_id', 'fine_type_code', 'amount', 'assessed_at', 'status_code', 'paid_amount', 'paid_at', 'waived_reason', 'note', 'created_at', 'created_by', 'updated_at', 'updated_by', 'row_version'],
    '13_POLICIES': ['policy_id', 'member_type_code', 'material_type_code', 'loan_days', 'max_open_loans', 'max_renewals', 'renewal_days', 'max_reservations', 'hold_days', 'overdue_fee_per_day', 'active_from', 'active_to', 'status_code', 'created_at', 'created_by', 'updated_at', 'updated_by', 'row_version'],
    '14_STAFF_USERS': ['staff_id', 'email', 'display_name', 'role_code', 'status_code', 'last_login_at', 'created_at', 'created_by', 'updated_at', 'updated_by', 'row_version'],
    '15_AUDIT_LOG': ['log_id', 'occurred_at', 'actor_id', 'request_id', 'action_code', 'entity_type', 'entity_id', 'before_json', 'after_json', 'summary'],
    '16_CODEBOOK': ['code_group', 'code', 'label_ko', 'label_en', 'sort_order', 'status_code', 'description'],
    '17_CONFIG': ['setting_key', 'setting_value', 'value_type', 'description', 'updated_at', 'updated_by'],
    '18_SYS_OPERATIONS': ['request_id', 'operation_type', 'status_code', 'target_type', 'target_id', 'payload_hash', 'started_at', 'completed_at', 'actor_id', 'error_code', 'error_message'],
    '19_NOTIFICATION_QUEUE': ['notification_id', 'member_id', 'event_code', 'channel_code', 'recipient', 'template_code', 'payload_json', 'scheduled_at', 'sent_at', 'status_code', 'retry_count', 'last_error', 'created_at', 'created_by', 'updated_at', 'updated_by', 'row_version'],
    '20_VIZ_CACHE': ['viz_type', 'computed_at', 'payload_json'],
    '21_BOOK_CACHE': ['isbn13', 'title', 'subtitle', 'authors', 'publisher', 'published_year', 'page_count', 'cover_url', 'source', 'cached_at']
  })
});

function onOpen() {
  buildLibraryMenu_();
}

function buildLibraryMenu_() {
  var ui = SpreadsheetApp.getUi();
  var quickMenu = ui.createMenu('빠른 업무')
    .addItem('대출', 'openCheckoutForm')
    .addItem('반납', 'openReturnForm')
    .addItem('연장', 'openRenewForm')
    .addItem('예약', 'openReservationForm')
    .addSeparator()
    .addItem('회원 등록', 'openMemberForm')
    .addItem('도서·소장본 등록', 'openBookForm')
    .addItem('통합 검색', 'openSearchForm');
  var adminMenu = ui.createMenu('관리')
    .addItem('최초 설정/스키마 확인', 'setupLibraryMvp')
    .addItem('DB 시트 보호(ADMIN 전용)', 'protectDatabaseSheets')
    .addItem('무결성 점검', 'runIntegrityCheck')
    .addItem('소장본 상태 복구', 'reconcileCopyStatuses')
    .addItem('일일 관리 트리거 설치', 'installLibraryTriggers')
    .addItem('서지 일괄 보강', 'runBibliographicEnrichment')
    .addItem('수기입력 흡수', 'runAbsorbManualEntries');

  ui.createMenu('📚 도서관 관리')
    .addItem('사이드바 열기', 'showLibrarySidebar')
    .addItem('운영센터로 이동', 'goToLibraryConsole')
    .addItem('현황 새로고침', 'refreshDashboard')
    .addSubMenu(quickMenu)
    .addSubMenu(adminMenu)
    .addToUi();
}

function showLibrarySidebar() { showSidebar_('dashboard'); }
function openCheckoutForm() { showSidebar_('checkout'); }
function openReturnForm() { showSidebar_('return'); }
function openRenewForm() { showSidebar_('return'); }
function openReservationForm() { showSidebar_('reservation'); }
function openMemberForm() { showSidebar_('member'); }
function openBookForm() { showSidebar_('catalog'); }
function openSearchForm() { showSidebar_('search'); }

function showSidebar_(initialTab) {
  var template = HtmlService.createTemplateFromFile('Sidebar');
  template.initialTab = initialTab || 'dashboard';
  var html = template.evaluate().setTitle('도서관 관리').setWidth(420);
  SpreadsheetApp.getUi().showSidebar(html);
}

function goToLibraryConsole() {
  var sheet = getSpreadsheet_().getSheetByName(LIBRARY_MVP.CONSOLE_SHEET);
  if (!sheet) fail_('SCHEMA_MISMATCH', '01_운영센터 시트가 없습니다.');
  sheet.activate();
}

function setupLibraryMvp() {
  try {
    var ss = getSpreadsheet_();
    ss.setSpreadsheetTimeZone(LIBRARY_MVP.TIMEZONE);
    try { ss.setSpreadsheetLocale('ko_KR'); } catch (ignore) {}
    ensureSchema_();
    var setupActor = ensureCurrentStaff_();
    requireRole_({ role: setupActor.role_code }, ['ADMIN']);
    applyDataValidations_();
    formatIdTextColumns_();
    protectDatabaseSheets_(true);
    PropertiesService.getDocumentProperties().setProperties({
      LIBRARY_MVP_VERSION: LIBRARY_MVP.VERSION,
      LIBRARY_SCHEMA_VERSION: getConfig_('SCHEMA_VERSION', '1.0.0')
    });
    buildLibraryMenu_();
    refreshDashboard_();
    SpreadsheetApp.getUi().alert('설정 완료', '스키마·검증·보호·운영센터를 확인했습니다. 스프레드시트를 새로고침해 메뉴를 사용하세요.', SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (error) {
    SpreadsheetApp.getUi().alert('설정 실패', error.message || String(error), SpreadsheetApp.getUi().ButtonSet.OK);
    throw error;
  }
}

function ensureSchema_() {
  var ss = getSpreadsheet_();
  Object.keys(LIBRARY_MVP.HEADERS).forEach(function(sheetName) {
    var expected = LIBRARY_MVP.HEADERS[sheetName];
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.getRange(1, 1, 1, expected.length).setValues([expected]);
      formatNewDbSheet_(sheet, expected.length);
      return;
    }
    var lastColumn = Math.max(sheet.getLastColumn(), expected.length);
    var actual = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
    var nonEmpty = actual.filter(function(value) { return value !== ''; });
    if (nonEmpty.length === 0) {
      sheet.getRange(1, 1, 1, expected.length).setValues([expected]);
      formatNewDbSheet_(sheet, expected.length);
      return;
    }
    var missing = expected.filter(function(header) { return actual.indexOf(header) === -1; });
    if (missing.length) {
      fail_('SCHEMA_MISMATCH', sheetName + '에 필요한 헤더가 없습니다: ' + missing.join(', '));
    }
  });
}

function formatNewDbSheet_(sheet, columnCount) {
  sheet.setFrozenRows(1);
  sheet.setHiddenGridlines(true);
  sheet.getRange(1, 1, 1, columnCount)
    .setBackground('#17324D')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setWrap(true);
}

function getDataValidationRules_() {
  return [
    [LIBRARY_MVP.SHEETS.TITLES, 'material_type_code', 10000, ['BOOK']],
    [LIBRARY_MVP.SHEETS.TITLES, 'status_code', 10000, ['ACTIVE', 'INACTIVE', 'WITHDRAWN']],
    [LIBRARY_MVP.SHEETS.AUTHORS, 'status_code', 10000, ['ACTIVE', 'INACTIVE']],
    [LIBRARY_MVP.SHEETS.TITLE_AUTHORS, 'role_code', 10000, ['AUTHOR', 'TRANSLATOR', 'EDITOR']],
    [LIBRARY_MVP.SHEETS.COPIES, 'condition_code', 10000, ['GOOD', 'FAIR', 'DAMAGED']],
    [LIBRARY_MVP.SHEETS.COPIES, 'status_code', 10000, ['AVAILABLE', 'ON_LOAN', 'HOLD_READY', 'REPAIR', 'LOST', 'WITHDRAWN']],
    [LIBRARY_MVP.SHEETS.MEMBERS, 'member_type_code', 10000, ['GENERAL', 'CHILD', 'STAFF']],
    [LIBRARY_MVP.SHEETS.MEMBERS, 'status_code', 10000, ['ACTIVE', 'SUSPENDED', 'WITHDRAWN']],
    [LIBRARY_MVP.SHEETS.LOANS, 'status_code', 10000, ['OPEN', 'RETURNED', 'LOST', 'VOID']],
    [LIBRARY_MVP.SHEETS.RESERVATIONS, 'status_code', 10000, ['WAITING', 'READY', 'FULFILLED', 'CANCELLED', 'EXPIRED']],
    [LIBRARY_MVP.SHEETS.FINES, 'fine_type_code', 10000, ['OVERDUE', 'REPLACEMENT']],
    [LIBRARY_MVP.SHEETS.FINES, 'status_code', 10000, ['UNPAID', 'PARTIAL', 'PAID', 'WAIVED']],
    [LIBRARY_MVP.SHEETS.STAFF, 'role_code', 1000, ['ADMIN', 'LIBRARIAN', 'VIEWER']],
    [LIBRARY_MVP.SHEETS.STAFF, 'status_code', 1000, ['ACTIVE', 'INACTIVE']]
  ];
}

function buildListValidation_(values) {
  return SpreadsheetApp.newDataValidation()
    .requireValueInList(values, true)
    .setAllowInvalid(false)
    .setHelpText('정의된 상태 코드만 선택하세요.')
    .build();
}

function applyDataValidations_() {
  var rules = getDataValidationRules_();
  rules.forEach(function(item) {
    var table = readTable_(item[0]);
    var sheet = table.sheet;
    var targetRows = Math.max(item[2], sheet.getMaxRows());
    ensureSheetRows_(sheet, targetRows);
    var column = table.index[item[1]];
    if (column === undefined) fail_('SCHEMA_MISMATCH', item[0] + '에 검증 대상 헤더가 없습니다: ' + item[1]);
    sheet.getRange(2, column + 1, targetRows - 1, 1).setDataValidation(buildListValidation_(item[3]));
  });
}

function applyDataValidationsForRow_(table, rowNumber) {
  getDataValidationRules_().forEach(function(item) {
    if (item[0] !== table.sheet.getName()) return;
    var column = table.index[item[1]];
    if (column === undefined) fail_('SCHEMA_MISMATCH', item[0] + '에 검증 대상 헤더가 없습니다: ' + item[1]);
    table.sheet.getRange(rowNumber, column + 1).setDataValidation(buildListValidation_(item[3]));
  });
}

function protectDatabaseSheets() {
  requireRole_(getActor_(), ['ADMIN']);
  protectDatabaseSheets_(false);
}

function protectDatabaseSheets_(silent, transaction) {
  var ownsTransaction = !transaction;
  var protectionTransaction = transaction || createCompensationContext_();
  try {
    var adminEmails = getActiveAdminEmails_();
    var ownerEmail = getSpreadsheetOwnerEmail_();
    if (ownerEmail && adminEmails.indexOf(ownerEmail) === -1) {
      fail_('OWNER_ADMIN_REQUIRED', '스프레드시트 소유자는 보호에서 제외할 수 없으므로 항상 활성 ADMIN으로 유지해야 합니다: ' + ownerEmail);
    }
    var currentEmail = currentEmail_();
    if (currentEmail === 'LOCAL_USER') fail_('USER_IDENTITY_UNAVAILABLE', 'DB 시트 보호를 설정할 Google 계정을 확인할 수 없습니다.');
    if (adminEmails.indexOf(currentEmail) === -1) fail_('PERMISSION_DENIED', '현재 계정이 활성 ADMIN 보호 허용 목록에 없습니다.');
    Object.keys(LIBRARY_MVP.HEADERS).forEach(function(sheetName) {
      var sheet = getRequiredSheet_(sheetName);
      var protection = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET).find(function(item) {
        return item.getDescription() === 'LIBRARY_MVP_DB_PROTECTION' || item.getDescription() === 'LIBRARY_MVP_DB_WARNING';
      });
      var existed = Boolean(protection);
      if (!protection) protection = sheet.protect();
      var snapshot = existed ? snapshotSheetProtection_(protection) : { existed: false };
      protectionTransaction.record(function() {
        restoreSheetProtection_(protection, snapshot);
      });
      protection.setWarningOnly(false);
      protection.setDescription('LIBRARY_MVP_DB_PROTECTION');
      syncProtectionEditors_(protection, adminEmails, ownerEmail);
      if (protection.canDomainEdit()) protection.setDomainEdit(false);
      if (protection.isWarningOnly()) fail_('PROTECTION_NOT_ENFORCED', sheetName + ' 보호가 경고 전용 상태로 남아 있습니다.');
      if (protection.canDomainEdit()) fail_('PROTECTION_DOMAIN_EDIT_ENABLED', sheetName + ' 보호의 도메인 전체 편집 권한을 끄지 못했습니다.');
    });
    SpreadsheetApp.flush();
    if (ownsTransaction) protectionTransaction.commit();
    if (!silent) getSpreadsheet_().toast('활성 ADMIN ' + adminEmails.length + '명만 DB를 편집하도록 ' + Object.keys(LIBRARY_MVP.HEADERS).length + '개 시트 보호를 동기화했습니다.', '도서관 관리', 7);
    return { adminEmails: adminEmails, protectedSheetCount: Object.keys(LIBRARY_MVP.HEADERS).length };
  } catch (error) {
    if (ownsTransaction) {
      var rollbackError = protectionTransaction.rollback();
      if (rollbackError) {
        var protectionError = new Error((error.message || String(error)) + ' | 보호 설정 원복 실패: ' + rollbackError);
        protectionError.code = 'PROTECTION_ROLLBACK_FAILED';
        protectionError.details = { originalCode: error.code || 'UNEXPECTED_ERROR', rollbackError: rollbackError };
        throw protectionError;
      }
    }
    throw error;
  }
}

function snapshotSheetProtection_(protection) {
  return {
    existed: true,
    description: protection.getDescription(),
    warningOnly: protection.isWarningOnly(),
    domainEdit: protection.canDomainEdit(),
    editors: protection.getEditors().map(function(user) { return normalizeEmail_(user.getEmail()); }).filter(Boolean)
  };
}

function syncProtectionEditors_(protection, desiredEmails, implicitOwnerEmail) {
  var desired = {};
  desiredEmails.forEach(function(email) { desired[normalizeEmail_(email)] = true; });
  var currentEmails = protection.getEditors().map(function(user) { return normalizeEmail_(user.getEmail()); }).filter(Boolean);
  var current = {};
  currentEmails.forEach(function(email) { current[email] = true; });
  var removable = currentEmails.filter(function(email) { return !desired[email]; });
  var addable = Object.keys(desired).filter(function(email) { return !current[email]; });
  if (removable.length) protection.removeEditors(removable);
  if (addable.length) protection.addEditors(addable);
  var actual = {};
  protection.getEditors().forEach(function(user) {
    var email = normalizeEmail_(user.getEmail());
    if (email) actual[email] = true;
  });
  var unexpected = Object.keys(actual).filter(function(email) { return !desired[email]; });
  var missing = Object.keys(desired).filter(function(email) { return !actual[email] && email !== implicitOwnerEmail; });
  if (unexpected.length || missing.length) {
    fail_('PROTECTION_EDITOR_MISMATCH', 'DB 보호 편집자 동기화를 확인할 수 없습니다.', { unexpected: unexpected, missing: missing });
  }
}

function restoreSheetProtection_(protection, snapshot) {
  if (!snapshot.existed) {
    protection.remove();
    return;
  }
  protection.setWarningOnly(false);
  syncProtectionEditors_(protection, snapshot.editors, '');
  if (protection.canDomainEdit() !== snapshot.domainEdit) protection.setDomainEdit(snapshot.domainEdit);
  protection.setDescription(snapshot.description);
  if (snapshot.warningOnly) protection.setWarningOnly(true);
}

function formatIdTextColumns_() {
  [[LIBRARY_MVP.SHEETS.MEMBERS, ['member_no', 'school_no']], [LIBRARY_MVP.SHEETS.COPIES, ['barcode']]].forEach(function(spec) {
    var table = readTable_(spec[0]);
    spec[1].forEach(function(field) {
      if (table.index[field] === undefined) return;
      table.sheet.getRange(2, table.index[field] + 1, Math.max(1, table.sheet.getMaxRows() - 1), 1).setNumberFormat('@');
    });
  });
}

function refreshDashboard() {
  try {
    requireRole_(getActor_(), ['ADMIN', 'LIBRARIAN']);
    var result = refreshDashboard_();
    getSpreadsheet_().toast('현황을 새로고침했습니다.', '도서관 관리', 4);
    return result;
  } catch (error) {
    getSpreadsheet_().toast(error.message || String(error), '새로고침 실패', 8);
    throw error;
  }
}

function refreshDashboard_() {
  var data = getDashboardData_();
  writeDashboardToSheet_(getRequiredSheet_(LIBRARY_MVP.CONSOLE_SHEET), data);
  // todo/22(구 PATCH_SPEC P7) — 영어 콘솔 쌍둥이. 이 환경은 xlsx 서식(라벨 셀)을 새로
  // 그릴 수 없으므로 시트 존재 여부를 매번 확인만 하고, 없으면 오류 없이 건너뛴다
  // (getRequiredSheet_ 대신 getSheetByName으로 존재만 확인 — 01_운영센터 없는 사용자를
  // 절대 깨뜨리지 않기 위해). 시트가 생기면(사용자가 xlsx에 탭을 추가하면) 다음 새로고침부터
  // 자동으로 같이 기록된다 — 코드 변경 불필요.
  var enSheet = getSpreadsheet_().getSheetByName(LIBRARY_MVP.CONSOLE_EN_SHEET);
  if (enSheet) writeDashboardToSheet_(enSheet, data);
  return data;
}

// todo/22 — refreshDashboard_ 안에 있던 "계산된 값을 시트 셀에 쓴다" 로직을 그대로(좌표·서식
// 100% 동일) 함수로 뽑아낸 것. 순수 기계적 추출이며 01_운영센터 대상 동작은 한 글자도
// 바뀌지 않는다 — 유일한 차이는 어떤 sheet 객체를 넘기느냐뿐이다.
function writeDashboardToSheet_(sheet, data) {
  sheet.getRange('B3').setValue(data.libraryName);
  sheet.getRange('E3').setValue(data.actorLabel);
  sheet.getRange('J3').setValue(formatDateTime_(new Date()));
  sheet.getRange('A6').setValue(data.stats.activeTitles);
  sheet.getRange('C6').setValue(data.stats.availableCopies);
  sheet.getRange('E6').setValue(data.stats.openLoans);
  sheet.getRange('G6').setValue(data.stats.dueToday);
  sheet.getRange('I6').setValue(data.stats.overdue);
  sheet.getRange('K6').setValue(data.stats.activeReservations);

  var dueRange = sheet.getRange('A21:G27');
  var readyRange = sheet.getRange('I21:L27');
  try { dueRange.breakApart(); } catch (ignore1) {}
  try { readyRange.breakApart(); } catch (ignore2) {}
  dueRange.clearContent().setBackground('#F8FAFC').setFontColor('#334155').setFontSize(9).setVerticalAlignment('middle');
  readyRange.clearContent().setBackground('#F8FAFC').setFontColor('#334155').setFontSize(9).setVerticalAlignment('middle');

  var dueRows = data.dueItems.map(function(item) {
    return [item.type, item.memberNo, item.memberName, item.title, item.barcode, item.dueAtText, item.overdueDays || 0];
  });
  while (dueRows.length < 7) dueRows.push(['', '', '', '', '', '', '']);
  dueRange.setValues(dueRows.slice(0, 7));
  data.dueItems.slice(0, 7).forEach(function(item, index) {
    if (item.type === '연체') sheet.getRange(21 + index, 1, 1, 7).setBackground('#FEE2E2').setFontColor('#991B1B');
    else sheet.getRange(21 + index, 1, 1, 7).setBackground('#FEF3C7').setFontColor('#92400E');
  });

  var readyRows = data.readyItems.map(function(item) {
    return [item.memberNo, item.memberName, item.title, item.pickupExpiresText];
  });
  while (readyRows.length < 7) readyRows.push(['', '', '', '']);
  readyRange.setValues(readyRows.slice(0, 7));
  if (data.readyItems.length) sheet.getRange(21, 9, Math.min(7, data.readyItems.length), 4).setBackground('#EDE9FE').setFontColor('#5B21B6');
}

function getDashboardData_() {
  var now = new Date();
  var today = formatDate_(now);
  var titles = readTable_(LIBRARY_MVP.SHEETS.TITLES).rows;
  var copies = readTable_(LIBRARY_MVP.SHEETS.COPIES).rows;
  var members = readTable_(LIBRARY_MVP.SHEETS.MEMBERS).rows;
  var loans = readTable_(LIBRARY_MVP.SHEETS.LOANS).rows;
  var reservations = readTable_(LIBRARY_MVP.SHEETS.RESERVATIONS).rows;
  var titleById = indexBy_(titles, 'title_id');
  var copyById = indexBy_(copies, 'copy_id');
  var memberById = indexBy_(members, 'member_id');
  var openLoans = loans.filter(function(row) { return row.status_code === 'OPEN' && !row.returned_at; });
  var activeReservations = reservations.filter(function(row) { return row.status_code === 'WAITING' || row.status_code === 'READY'; });

  var dueItems = openLoans.map(function(loan) {
    var copy = copyById[loan.copy_id] || {};
    var title = titleById[copy.title_id] || {};
    var member = memberById[loan.member_id] || {};
    var due = asDate_(loan.due_at);
    var overdueDays = due && due.getTime() < now.getTime() ? Math.max(1, Math.ceil((now.getTime() - due.getTime()) / 86400000)) : 0;
    return {
      type: overdueDays ? '연체' : '예정',
      memberNo: member.member_no || loan.member_id,
      memberName: member.name || '',
      title: title.title || copy.title_id || '',
      barcode: copy.barcode || loan.copy_id,
      dueAt: due ? due.getTime() : Number.MAX_SAFE_INTEGER,
      dueAtText: due ? formatDateTime_(due) : '',
      overdueDays: overdueDays
    };
  }).filter(function(item) {
    return item.overdueDays > 0 || item.dueAtText.indexOf(today) === 0;
  }).sort(function(a, b) { return b.overdueDays - a.overdueDays || a.dueAt - b.dueAt; }).slice(0, 7);

  var readyItems = reservations.filter(function(row) { return row.status_code === 'READY'; }).map(function(row) {
    var title = titleById[row.title_id] || {};
    var member = memberById[row.member_id] || {};
    var expires = asDate_(row.pickup_expires_at);
    return {
      memberNo: member.member_no || row.member_id,
      memberName: member.name || '',
      title: title.title || row.title_id,
      pickupExpires: expires ? expires.getTime() : Number.MAX_SAFE_INTEGER,
      pickupExpiresText: expires ? formatDateTime_(expires) : ''
    };
  }).sort(function(a, b) { return a.pickupExpires - b.pickupExpires; }).slice(0, 7);

  return {
    libraryName: getConfig_('LIBRARY_NAME', 'MVP 도서관'),
    actorLabel: getActor_().displayName,
    stats: {
      activeTitles: titles.filter(function(row) { return row.status_code === 'ACTIVE'; }).length,
      availableCopies: copies.filter(function(row) { return row.status_code === 'AVAILABLE'; }).length,
      openLoans: openLoans.length,
      dueToday: openLoans.filter(function(row) { var d = asDate_(row.due_at); return d && formatDate_(d) === today; }).length,
      overdue: openLoans.filter(function(row) { var d = asDate_(row.due_at); return d && d.getTime() < now.getTime(); }).length,
      activeReservations: activeReservations.length,
      activeMembers: members.filter(function(row) { return row.status_code === 'ACTIVE'; }).length
    },
    dueItems: dueItems,
    readyItems: readyItems,
    refreshedAt: formatDateTime_(now)
  };
}

// --------------------------- Sidebar API ---------------------------

function apiBootstrap(payload) {
  return runApi_(function() {
    var actor = getActor_();
    var dashboard = actor.role === 'VIEWER' ? getDashboardData_() : refreshDashboard_();
    return {
      initialTab: payload && payload.initialTab ? payload.initialTab : 'dashboard',
      version: LIBRARY_MVP.VERSION,
      actor: actor,
      dashboard: dashboard,
      options: {
        memberTypes: getCodes_('MEMBER_TYPE'),
        memberStatuses: getCodes_('MEMBER_STATUS'),
        copyConditions: getCodes_('CONDITION'),
        copyStatuses: getCodes_('COPY_STATUS'),
        categories: readTable_(LIBRARY_MVP.SHEETS.CATEGORIES).rows.filter(function(row) { return row.status_code === 'ACTIVE'; }).map(function(row) {
          return { code: row.category_code, label: row.category_code + ' · ' + row.name_ko };
        })
      }
    };
  });
}

function apiRefreshDashboard() {
  return runApi_(function() {
    requireRole_(getActor_(), ['ADMIN', 'LIBRARIAN']);
    return refreshDashboard_();
  });
}

function apiSearch(payload) {
  return runApi_(function() {
    getActor_();
    return search_(payload || {});
  });
}

// --------------------------- todo/22(구 PATCH_SPEC P7) 한/영 다국어 ---------------------------
//
// 새 함수만 추가 — apiBootstrap·getCodes_ 등 기존 함수는 건드리지 않는다.
//
// 1) 사용자별 언어 저장: PropertiesService.getUserProperties()는 (스크립트, 로그인 계정) 쌍마다
//    격리되는 GAS 내장 저장소다 — 이 코드베이스에서 UserProperties를 쓰는 첫 사례지만(기존
//    코드는 전부 DocumentProperties=시트 전체 공유 또는 ScriptProperties=배포 전역만 썼다),
//    바로 그 "계정별 격리"가 이번 요구사항("두 브라우저에서 동시에 서로 다른 언어")의 근거다.
//    이메일로 직접 키를 만들 필요조차 없다 — GAS가 이미 호출자별로 분리해 주기 때문이다.
//    getActor_()를 거치지 않는다: STAFF 시트에 등록되지 않은 계정(또는 아직 등록 전 최초
//    설정자)도 "등록되지 않았습니다" 오류 메시지 자체를 영어로 읽고 싶을 수 있으므로, 언어
//    설정만은 직원 등록 여부와 무관하게 항상 동작해야 한다.
function getUserLocale_() {
  var stored = PropertiesService.getUserProperties().getProperty('UI_LOCALE');
  return stored === 'en' ? 'en' : 'ko';
}

function setUserLocale_(locale) {
  var normalized = locale === 'en' ? 'en' : 'ko';
  PropertiesService.getUserProperties().setProperty('UI_LOCALE', normalized);
  return normalized;
}

function apiGetUserLocale() {
  return runApi_(function() {
    return { locale: getUserLocale_() };
  });
}

function apiSetUserLocale(payload) {
  return runApi_(function() {
    return { locale: setUserLocale_(payload && payload.locale) };
  });
}

// 2) CODEBOOK label_en 활용 — PATCH_SPEC.md는 "이미 존재, 추가 작업 없음"이라 적었지만 실제로는
//    그렇지 않다: getCodes_(2650행 부근)는 `label: row.label_ko || row.code`만 돌려주고
//    label_en은 애초에 읽지도 않으며, apiBootstrap의 categories 매핑도 `row.name_ko`만 쓴다.
//    즉 label_en 컬럼은 CODEBOOK 시트 안에 존재할 뿐 지금까지 어떤 서버 함수도 클라이언트에
//    전달한 적이 없다 — "이미 존재"는 시트 컬럼 얘기였지, 배선(配線)까지 이미 있다는 뜻이
//    아니었다. getCodes_·apiBootstrap을 고치는 대신(그 두 함수는 그대로 두라는 과제 지침)
//    새 함수를 하나 추가해 label_en/name_en만 별도로 내려준다. 사이드바는 이 맵을 이용해
//    영어 모드일 때만 이미 그려둔 select/datalist의 표시 텍스트를 코드 기준으로 다시 씌운다
//    (값=code는 그대로라 폼 제출 로직은 전혀 안 바뀐다).
function apiGetCodeLabels() {
  return runApi_(function() {
    getActor_();
    var byGroup = {};
    readTable_(LIBRARY_MVP.SHEETS.CODEBOOK).rows.forEach(function(row) {
      if (row.status_code !== 'ACTIVE') return;
      if (!byGroup[row.code_group]) byGroup[row.code_group] = {};
      byGroup[row.code_group][row.code] = row.label_en || row.label_ko || row.code;
    });
    var categories = {};
    readTable_(LIBRARY_MVP.SHEETS.CATEGORIES).rows.forEach(function(row) {
      if (row.status_code !== 'ACTIVE') return;
      categories[row.category_code] = row.name_en || row.name_ko || row.category_code;
    });
    return { codeGroups: byGroup, categories: categories };
  });
}

function apiRegisterMember(payload) {
  return runApi_(function() {
    return executeWrite_('REGISTER_MEMBER', payload || {}, function(actor, requestId, transaction) {
      return registerMember_(payload || {}, actor, requestId, transaction);
    });
  });
}

function apiUpdateMember(payload) {
  return runApi_(function() {
    return executeWrite_('UPDATE_MEMBER', payload || {}, function(actor, requestId, transaction) {
      return updateMember_(payload || {}, actor, requestId, transaction);
    });
  });
}

function apiRegisterTitle(payload) {
  return runApi_(function() {
    return executeWrite_('REGISTER_TITLE', payload || {}, function(actor, requestId, transaction) {
      return registerTitle_(payload || {}, actor, requestId, transaction);
    });
  });
}

function apiRegisterCopy(payload) {
  return runApi_(function() {
    return executeWrite_('REGISTER_COPY', payload || {}, function(actor, requestId, transaction) {
      return registerCopy_(payload || {}, actor, requestId, transaction);
    });
  });
}

function apiCheckout(payload) {
  return runApi_(function() {
    return executeWrite_('CHECKOUT', payload || {}, function(actor, requestId, transaction) {
      return checkout_(payload || {}, actor, requestId, transaction);
    });
  });
}

function apiReturn(payload) {
  return runApi_(function() {
    return executeWrite_('RETURN', payload || {}, function(actor, requestId, transaction) {
      return return_(payload || {}, actor, requestId, transaction);
    });
  });
}

function apiMarkLoanLost(payload) {
  return runApi_(function() {
    return executeWrite_('MARK_LOAN_LOST', payload || {}, function(actor, requestId, transaction) {
      return markLoanLost_(payload || {}, actor, requestId, transaction);
    });
  });
}

function apiRenew(payload) {
  return runApi_(function() {
    return executeWrite_('RENEW', payload || {}, function(actor, requestId, transaction) {
      return renew_(payload || {}, actor, requestId, transaction);
    });
  });
}

function apiReserve(payload) {
  return runApi_(function() {
    return executeWrite_('RESERVE', payload || {}, function(actor, requestId, transaction) {
      return reserve_(payload || {}, actor, requestId, transaction);
    });
  });
}

function apiCancelReservation(payload) {
  return runApi_(function() {
    return executeWrite_('CANCEL_RESERVATION', payload || {}, function(actor, requestId, transaction) {
      return cancelReservation_(payload || {}, actor, requestId, transaction);
    });
  });
}

function apiPayFine(payload) {
  return runApi_(function() {
    return executeWrite_('PAY_FINE', payload || {}, function(actor, requestId, transaction) {
      return payFine_(payload || {}, actor, requestId, transaction);
    });
  });
}

function apiUpdateCopyStatus(payload) {
  return runApi_(function() {
    return executeWrite_('UPDATE_COPY_STATUS', payload || {}, function(actor, requestId, transaction) {
      return updateCopyStatus_(payload || {}, actor, requestId, transaction);
    });
  });
}

function apiRunIntegrityCheck() {
  return runApi_(function() {
    getActor_();
    return integrityCheck_();
  });
}

function apiReconcileCopyStatuses(payload) {
  return runApi_(function() {
    return executeWrite_('RECONCILE_COPY_STATUS', payload || {}, function(actor, requestId, transaction) {
      requireRole_(actor, ['ADMIN']);
      return reconcileCopyStatuses_(actor, requestId, transaction);
    });
  });
}

function apiUpsertStaff(payload) {
  return runApi_(function() {
    return executeWrite_('UPSERT_STAFF', payload || {}, function(actor, requestId, transaction) {
      requireRole_(actor, ['ADMIN']);
      return upsertStaff_(payload || {}, actor, requestId, transaction);
    });
  });
}

function apiUpdatePolicy(payload) {
  return runApi_(function() {
    return executeWrite_('UPDATE_POLICY', payload || {}, function(actor, requestId, transaction) {
      requireRole_(actor, ['ADMIN']);
      return updatePolicy_(payload || {}, actor, requestId, transaction);
    });
  });
}

function runApi_(callback) {
  try {
    return { ok: true, data: toClient_(callback()), error: null };
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    return {
      ok: false,
      data: null,
      error: {
        code: error.code || 'UNEXPECTED_ERROR',
        message: error.message || String(error),
        details: error.details || null
      }
    };
  }
}

// --------------------------- Domain services ---------------------------

function registerMember_(payload, actor, requestId, transaction) {
  var name = safeText_(requiredText_(payload.name, '이름'));
  var memberType = cleanCode_(payload.memberType || 'STUDENT');
  assertCode_('MEMBER_TYPE', memberType);
  var grade = positiveIntegerOrBlank_(payload.grade, '학년');
  var classNo = positiveIntegerOrBlank_(payload.classNo, '반');
  var studentNo = positiveIntegerOrBlank_(payload.studentNo, '번호');
  if (memberType === 'STUDENT' && (grade === '' || classNo === '')) fail_('VALIDATION_ERROR', '학생은 학년과 반이 필요합니다.');
  var schoolNo = cleanText_(payload.schoolNo || '');
  var emailNormalized = normalizeEmail_(payload.email);
  if (emailNormalized) validateEmail_(emailNormalized);

  var members = readTable_(LIBRARY_MVP.SHEETS.MEMBERS).rows;
  if (schoolNo) {
    var dupSchool = members.find(function(row) { return row.status_code !== 'WITHDRAWN' && cleanText_(row.school_no) === schoolNo; });
    if (dupSchool) fail_('DUPLICATE_MEMBER', '같은 학번의 회원이 있습니다: ' + dupSchool.member_no + ' (' + dupSchool.name + ')');
  }
  if (grade !== '' && classNo !== '' && studentNo !== '') {
    var dupSeat = members.find(function(row) {
      return row.status_code === 'ACTIVE' && String(row.grade) === String(grade) && String(row.class_no) === String(classNo) && String(row.student_no) === String(studentNo);
    });
    if (dupSeat) fail_('DUPLICATE_MEMBER', grade + '학년 ' + classNo + '반 ' + studentNo + '번에 이미 활성 회원이 있습니다: ' + dupSeat.name + ' (' + dupSeat.member_no + '). 전출·졸업 처리 후 등록하세요.');
  }

  var now = new Date();
  var joinedAt = parseOptionalDate_(payload.joinedAt) || now;
  var memberNo = payload.memberNo ? cleanCode_(payload.memberNo) : nextNumericCode_('SEQ_MEMBER', LIBRARY_MVP.SHEETS.MEMBERS, 'member_no');
  validateCodeInput_(memberNo, '회원번호');
  if (members.some(function(row) { return cleanCode_(row.member_no) === memberNo; })) fail_('DUPLICATE_MEMBER_NO', '이미 사용 중인 회원번호입니다.');

  var record = transactionAppendRecord_(transaction, LIBRARY_MVP.SHEETS.MEMBERS, {
    member_id: newId_('MEM'),
    member_no: memberNo,
    name: name,
    school_no: schoolNo,
    grade: grade,
    class_no: classNo,
    student_no: studentNo,
    member_type_code: memberType,
    phone: safeText_(payload.phone || ''),
    email: safeText_(emailNormalized),
    joined_at: joinedAt,
    graduated_at: '',
    expires_at: parseExpiryDate_(payload.expiresAt) || '',
    status_code: 'ACTIVE',
    loan_limit_override: positiveIntegerOrBlank_(payload.loanLimitOverride, '개별 대출 한도'),
    suspended_until: '',
    suspend_reason: '',
    privacy_consent_at: payload.privacyConsent ? now : '',
    note: safeText_(payload.note || ''),
    created_at: now,
    created_by: actor.id,
    updated_at: now,
    updated_by: actor.id,
    row_version: 1
  });
  writeAudit_(actor, requestId, 'CREATE', 'MEMBER', record.member_id, {}, { member_id: record.member_id, member_no: record.member_no, status_code: record.status_code, grade: grade, class_no: classNo }, '회원 등록', transaction);
  return { targetType: 'MEMBER', targetId: record.member_id, memberId: record.member_id, memberNo: record.member_no, name: record.name, grade: grade, classNo: classNo };
}

function updateMember_(payload, actor, requestId, transaction) {
  var member = findMemberByKey_(requiredText_(payload.memberKey, '회원번호'));
  var members = readTable_(LIBRARY_MVP.SHEETS.MEMBERS).rows;
  var patch = {};
  if (cleanText_(payload.name)) patch.name = safeText_(payload.name);
  if (payload.phone !== undefined && payload.phone !== '') {
    var phoneNormalized = normalizePhone_(payload.phone);
    if (!phoneNormalized) fail_('VALIDATION_ERROR', '전화번호에는 숫자가 하나 이상 있어야 합니다.');
    patch.phone = safeText_(payload.phone);
  }
  if (payload.email !== undefined && payload.email !== '') {
    var emailNormalized = normalizeEmail_(payload.email);
    validateEmail_(emailNormalized);
    patch.email = safeText_(emailNormalized);
  }
  var nextPhone = patch.phone !== undefined ? normalizePhone_(patch.phone) : normalizePhone_(member.phone);
  var nextEmail = patch.email !== undefined ? normalizeEmail_(patch.email) : normalizeEmail_(member.email);
  var duplicate = members.find(function(row) {
    return row.member_id !== member.member_id && row.status_code !== 'WITHDRAWN' &&
      ((nextPhone && normalizePhone_(row.phone) === nextPhone) || (nextEmail && normalizeEmail_(row.email) === nextEmail));
  });
  if (duplicate) fail_('DUPLICATE_MEMBER', '같은 전화번호 또는 이메일을 가진 회원이 있습니다: ' + duplicate.member_no);
  if (payload.schoolNo !== undefined && cleanText_(payload.schoolNo) !== '') patch.school_no = cleanText_(payload.schoolNo);
  if (payload.grade !== undefined && payload.grade !== '') patch.grade = positiveIntegerOrBlank_(payload.grade, '학년');
  if (payload.classNo !== undefined && payload.classNo !== '') patch.class_no = positiveIntegerOrBlank_(payload.classNo, '반');
  if (payload.studentNo !== undefined && payload.studentNo !== '') patch.student_no = positiveIntegerOrBlank_(payload.studentNo, '번호');
  if (payload.clearSuspension) { patch.suspended_until = ''; patch.suspend_reason = ''; }
  if (cleanText_(payload.memberType)) {
    var memberType = cleanCode_(payload.memberType);
    assertCode_('MEMBER_TYPE', memberType);
    patch.member_type_code = memberType;
  }
  if (cleanText_(payload.status)) {
    var status = cleanCode_(payload.status);
    assertCode_('MEMBER_STATUS', status);
    if (status !== 'ACTIVE' && status !== member.status_code) assertMemberCanDeactivate_(member);
    if (status === 'GRADUATED' && member.status_code !== 'GRADUATED') patch.graduated_at = new Date();
    patch.status_code = status;
  }
  if (cleanText_(payload.expiresAt)) patch.expires_at = parseExpiryDate_(payload.expiresAt);
  if (payload.loanLimitOverride !== undefined && payload.loanLimitOverride !== '') patch.loan_limit_override = positiveIntegerOrBlank_(payload.loanLimitOverride, '개별 대출 한도');
  if (payload.clearLoanLimit) patch.loan_limit_override = '';
  if (payload.note) patch.note = appendNote_(member.note, payload.note);
  if (!Object.keys(patch).length) fail_('VALIDATION_ERROR', '변경할 값을 하나 이상 입력하세요.');
  var updated = transactionUpdateRecord_(transaction, LIBRARY_MVP.SHEETS.MEMBERS, 'member_id', member.member_id, patch, actor.id);
  writeAudit_(actor, requestId, 'UPDATE', 'MEMBER', member.member_id,
    { status_code: member.status_code, member_type_code: member.member_type_code, expires_at: member.expires_at, row_version: member.row_version },
    { status_code: updated.status_code, member_type_code: updated.member_type_code, expires_at: updated.expires_at, row_version: updated.row_version },
    '회원 정보/상태 변경', transaction);
  return { targetType: 'MEMBER', targetId: member.member_id, memberId: member.member_id, memberNo: updated.member_no, name: updated.name, status: updated.status_code, expiresAt: updated.expires_at };
}

function assertMemberCanDeactivate_(member) {
  var openLoan = readTable_(LIBRARY_MVP.SHEETS.LOANS).rows.some(function(row) {
    return row.member_id === member.member_id && row.status_code === 'OPEN' && !row.returned_at;
  });
  if (openLoan) fail_('MEMBER_HAS_OPEN_LOAN', '진행 중 대출이 있는 회원은 졸업·전출·정지·탈퇴 상태로 변경할 수 없습니다. 먼저 반납 또는 분실 처리하세요.');
  var readyReservation = readTable_(LIBRARY_MVP.SHEETS.RESERVATIONS).rows.some(function(row) {
    return row.member_id === member.member_id && row.status_code === 'READY';
  });
  if (readyReservation) fail_('MEMBER_HAS_READY_RESERVATION', '수령 준비 예약이 있는 회원은 졸업·전출·정지·탈퇴 상태로 변경할 수 없습니다. 먼저 예약을 취소 또는 만료 처리하세요.');
  var unpaidFine = readTable_(LIBRARY_MVP.SHEETS.FINES).rows.some(function(row) {
    var remaining = Number(row.amount || 0) - Number(row.paid_amount || 0);
    return row.member_id === member.member_id && (row.status_code === 'UNPAID' || row.status_code === 'PARTIAL') && remaining > 0;
  });
  if (unpaidFine) fail_('MEMBER_HAS_UNPAID_FINE', '미납 금액이 있는 회원은 졸업·전출·정지·탈퇴 상태로 변경할 수 없습니다. 먼저 납부 또는 감면 처리하세요.');
}

function upsertStaff_(payload, actor, requestId, transaction) {
  var email = normalizeEmail_(requiredText_(payload.email, '직원 이메일'));
  validateEmail_(email);
  var table = readTable_(LIBRARY_MVP.SHEETS.STAFF);
  var existing = table.rows.find(function(row) { return normalizeEmail_(row.email) === email; });
  var role = cleanCode_(payload.role || (existing ? existing.role_code : 'LIBRARIAN'));
  if (['ADMIN', 'LIBRARIAN', 'VIEWER'].indexOf(role) === -1) fail_('INVALID_ROLE', '지원하지 않는 직원 역할입니다.');
  var status = cleanCode_(payload.status || (existing ? existing.status_code : 'ACTIVE'));
  if (['ACTIVE', 'INACTIVE'].indexOf(status) === -1) fail_('INVALID_STATUS', '지원하지 않는 직원 상태입니다.');
  var now = new Date();
  if (existing) {
    if (existing.role_code === 'ADMIN' && existing.status_code === 'ACTIVE' && (role !== 'ADMIN' || status !== 'ACTIVE')) {
      var otherActiveAdmin = table.rows.some(function(row) { return row.staff_id !== existing.staff_id && row.role_code === 'ADMIN' && row.status_code === 'ACTIVE'; });
      if (!otherActiveAdmin) fail_('LAST_ADMIN', '마지막 ACTIVE ADMIN은 강등하거나 비활성화할 수 없습니다. 먼저 다른 ADMIN을 등록하세요.');
    }
    var ownerEmail = getSpreadsheetOwnerEmail_();
    if (ownerEmail && email === ownerEmail && (role !== 'ADMIN' || status !== 'ACTIVE')) {
      fail_('OWNER_ADMIN_REQUIRED', '스프레드시트 소유자는 보호에서 제외할 수 없으므로 강등하거나 비활성화할 수 없습니다.');
    }
    if (existing.staff_id === actor.id && (role !== 'ADMIN' || status !== 'ACTIVE')) {
      fail_('SELF_LOCKOUT', '현재 로그인한 ADMIN 자신을 강등하거나 비활성화할 수 없습니다. 다른 ADMIN이 변경해야 합니다.');
    }
    var updated = transactionUpdateRecord_(transaction, LIBRARY_MVP.SHEETS.STAFF, 'staff_id', existing.staff_id, {
      display_name: safeText_(payload.displayName || existing.display_name || email), role_code: role, status_code: status
    }, actor.id);
    protectDatabaseSheets_(true, transaction);
    writeAudit_(actor, requestId, 'UPDATE', 'STAFF', existing.staff_id,
      { role_code: existing.role_code, status_code: existing.status_code },
      { role_code: updated.role_code, status_code: updated.status_code }, '직원 계정 변경', transaction);
    return { targetType: 'STAFF', targetId: existing.staff_id, staffId: existing.staff_id, email: email, role: updated.role_code, status: updated.status_code };
  }
  var created = transactionAppendRecord_(transaction, LIBRARY_MVP.SHEETS.STAFF, {
    staff_id: newId_('STF'), email: email, display_name: safeText_(payload.displayName || email), role_code: role, status_code: status,
    last_login_at: '', created_at: now, created_by: actor.id, updated_at: now, updated_by: actor.id, row_version: 1
  });
  protectDatabaseSheets_(true, transaction);
  writeAudit_(actor, requestId, 'CREATE', 'STAFF', created.staff_id, {}, { email: '[MASKED]', role_code: role, status_code: status }, '직원 계정 등록', transaction);
  return { targetType: 'STAFF', targetId: created.staff_id, staffId: created.staff_id, email: email, role: role, status: status };
}

function updatePolicy_(payload, actor, requestId, transaction) {
  var policyId = cleanCode_(payload.policyId || getConfig_('DEFAULT_POLICY_ID', 'POL-DEFAULT'));
  validateCodeInput_(policyId, '정책 ID');
  var policy = findByIdRequired_(LIBRARY_MVP.SHEETS.POLICIES, 'policy_id', policyId, '대출 정책');
  var patch = {};
  var fields = ['loanDays', 'maxOpenLoans', 'maxRenewals', 'renewalDays', 'maxReservations', 'holdDays', 'overdueFeePerDay'];
  var dbFields = ['loan_days', 'max_open_loans', 'max_renewals', 'renewal_days', 'max_reservations', 'hold_days', 'overdue_fee_per_day'];
  var labels = ['대출 일수', '최대 대출 권수', '최대 연장 횟수', '연장 일수', '최대 예약 건수', '예약 보관 일수', '일 연체료'];
  fields.forEach(function(field, index) {
    if (payload[field] === '' || payload[field] === undefined || payload[field] === null) return;
    patch[dbFields[index]] = nonNegativeInteger_(payload[field], labels[index]);
  });
  if (!Object.keys(patch).length) fail_('VALIDATION_ERROR', '변경할 정책값을 하나 이상 입력하세요.');
  var updated = transactionUpdateRecord_(transaction, LIBRARY_MVP.SHEETS.POLICIES, 'policy_id', policyId, patch, actor.id);
  writeAudit_(actor, requestId, 'UPDATE', 'POLICY', policyId,
    { row_version: policy.row_version }, { row_version: updated.row_version, changed_fields: Object.keys(patch) }, '대출 정책 변경', transaction);
  return { targetType: 'POLICY', targetId: policyId, policyId: policyId, values: patch, rowVersion: updated.row_version };
}

function registerTitle_(payload, actor, requestId, transaction) {
  var title = safeText_(requiredText_(payload.title, '도서명'));
  var isbn = normalizeIsbn_(payload.isbn);
  var titles = readTable_(LIBRARY_MVP.SHEETS.TITLES).rows;
  if (isbn && titles.some(function(row) { return normalizeIsbnLoose_(row.isbn13) === isbn; })) fail_('DUPLICATE_ISBN', '같은 ISBN의 서지가 이미 있습니다. 기존 도서에 소장본을 추가하세요.');

  var materialType = cleanCode_(payload.materialType || 'BOOK');
  assertCode_('MATERIAL_TYPE', materialType);
  var categoryCodes = splitList_(payload.categoryCodes).map(cleanCode_);
  var categories = readTable_(LIBRARY_MVP.SHEETS.CATEGORIES).rows;
  var selectedCategories = categoryCodes.map(function(categoryCode) {
    var category = categories.find(function(row) { return cleanCode_(row.category_code) === categoryCode && row.status_code === 'ACTIVE'; });
    if (!category) fail_('INVALID_CATEGORY', '분류 코드를 찾을 수 없습니다: ' + categoryCode);
    return category;
  });
  var wantsCopy = truthy_(payload.createCopy);
  var preparedCopy = wantsCopy ? prepareCopyPayload_(payload) : null;

  var now = new Date();
  var record = transactionAppendRecord_(transaction, LIBRARY_MVP.SHEETS.TITLES, {
    title_id: newId_('TTL'),
    isbn13: isbn,
    title: title,
    subtitle: safeText_(payload.subtitle || ''),
    edition: safeText_(payload.edition || ''),
    publisher: safeText_(payload.publisher || ''),
    published_year: integerOrBlank_(payload.publishedYear),
    language_code: cleanCode_(payload.languageCode || 'KOR'),
    material_type_code: materialType,
    classification_no: safeText_(payload.classificationNo || ''),
    keywords: safeText_(payload.keywords || ''),
    description: safeText_(payload.description || ''),
    cover_url: safeText_(payload.coverUrl || ''),
    status_code: 'ACTIVE',
    created_at: now,
    created_by: actor.id,
    updated_at: now,
    updated_by: actor.id,
    row_version: 1
  });

  var authorNames = splitList_(payload.authors);
  var authorRows = readTable_(LIBRARY_MVP.SHEETS.AUTHORS).rows;
  authorNames.forEach(function(authorName, index) {
    var normalized = normalizeText_(authorName);
    var author = authorRows.find(function(row) { return normalizeText_(row.display_name) === normalized; });
    if (!author) {
      author = transactionAppendRecord_(transaction, LIBRARY_MVP.SHEETS.AUTHORS, {
        author_id: newId_('AUT'), display_name: safeText_(authorName), sort_name: safeText_(authorName), external_id: '', bio: '', status_code: 'ACTIVE',
        created_at: now, created_by: actor.id, updated_at: now, updated_by: actor.id, row_version: 1
      });
      authorRows.push(author);
    }
    transactionAppendRecord_(transaction, LIBRARY_MVP.SHEETS.TITLE_AUTHORS, {
      title_author_id: newId_('TLA'), title_id: record.title_id, author_id: author.author_id, role_code: 'AUTHOR', sort_order: index + 1,
      created_at: now, created_by: actor.id
    });
  });

  selectedCategories.forEach(function(category, index) {
    transactionAppendRecord_(transaction, LIBRARY_MVP.SHEETS.TITLE_CATEGORIES, {
      title_category_id: newId_('TLC'), title_id: record.title_id, category_id: category.category_id, is_primary: index === 0,
      created_at: now, created_by: actor.id
    });
  });

  var copy = null;
  if (preparedCopy) {
    copy = createCopyRecord_(record, preparedCopy, actor, now, true, transaction);
  }
  writeAudit_(actor, requestId, 'CREATE', 'TITLE', record.title_id, {}, { title_id: record.title_id, isbn13: record.isbn13, status_code: record.status_code }, '도서 서지 등록', transaction);
  return {
    targetType: 'TITLE', targetId: record.title_id, titleId: record.title_id, title: record.title, isbn: record.isbn13,
    copyId: copy ? copy.copy_id : '', barcode: copy ? copy.barcode : ''
  };
}

function registerCopy_(payload, actor, requestId, transaction) {
  var title = findTitleByKey_(requiredText_(payload.titleKey, '도서 ID/ISBN'));
  if (title.status_code !== 'ACTIVE') fail_('TITLE_INACTIVE', '비활성/제적 도서에는 소장본을 추가할 수 없습니다.');
  var now = new Date();
  var record = createCopyRecord_(title, prepareCopyPayload_(payload), actor, now, true, transaction);
  var assignment = assignNextReservation_(title.title_id, record.copy_id, actor, requestId, now, '', transaction);
  var finalStatus = assignment ? 'HOLD_READY' : 'AVAILABLE';
  writeAudit_(actor, requestId, 'CREATE', 'COPY', record.copy_id, {}, { copy_id: record.copy_id, barcode: record.barcode, title_id: record.title_id, status_code: finalStatus }, '소장본 등록', transaction);
  return { targetType: 'COPY', targetId: record.copy_id, copyId: record.copy_id, barcode: record.barcode, titleId: title.title_id, title: title.title, holdReady: Boolean(assignment) };
}

function prepareCopyPayload_(payload) {
  var copies = readTable_(LIBRARY_MVP.SHEETS.COPIES).rows;
  var barcode = cleanCode_(payload.barcode || nextNumericCode_('SEQ_COPY', LIBRARY_MVP.SHEETS.COPIES, 'barcode'));
  validateCodeInput_(barcode, '바코드');
  if (copies.some(function(row) { return cleanCode_(row.barcode) === barcode; })) fail_('DUPLICATE_BARCODE', '이미 사용 중인 소장본 바코드입니다.');
  var condition = cleanCode_(payload.condition || 'GOOD');
  assertCode_('CONDITION', condition);
  var prepared = {};
  Object.keys(payload || {}).forEach(function(key) { prepared[key] = payload[key]; });
  prepared.barcode = barcode;
  prepared.condition = condition;
  return prepared;
}

function createCopyRecord_(title, payload, actor, now, prevalidated, transaction) {
  if (!prevalidated) payload = prepareCopyPayload_(payload);
  var barcode = payload.barcode;
  var condition = payload.condition;
  var record = {
    copy_id: newId_('CPY'), barcode: barcode, title_id: title.title_id,
    location_code: safeText_(payload.locationCode || 'MAIN'), shelf_code: safeText_(payload.shelfCode || ''),
    acquired_at: parseOptionalDate_(payload.acquiredAt) || now, acquisition_source: safeText_(payload.acquisitionSource || ''),
    price: numberOrBlank_(payload.price), condition_code: condition, status_code: 'AVAILABLE', last_inventory_at: '',
    note: safeText_(payload.copyNote || payload.note || ''), created_at: now, created_by: actor.id, updated_at: now, updated_by: actor.id, row_version: 1
  };
  return transaction ? transactionAppendRecord_(transaction, LIBRARY_MVP.SHEETS.COPIES, record) : appendRecord_(LIBRARY_MVP.SHEETS.COPIES, record);
}

function checkout_(payload, actor, requestId, transaction) {
  var member = findMemberByKey_(requiredText_(payload.memberKey, '회원번호'));
  validateMemberForCirculation_(member);
  var unpaidReplacement = readTable_(LIBRARY_MVP.SHEETS.FINES).rows.some(function(row) {
    var remaining = Number(row.amount || 0) - Number(row.paid_amount || 0);
    return row.member_id === member.member_id && row.fine_type_code === 'REPLACEMENT' && remaining > 0 && (row.status_code === 'UNPAID' || row.status_code === 'PARTIAL');
  });
  if (unpaidReplacement) fail_('MEMBER_UNPAID_REPLACEMENT', '분실 변상이 완료되지 않아 신규 대출이 제한됩니다. 변상 처리 후 이용하세요.');
  var copy = findCopyByKey_(requiredText_(payload.copyKey, '소장본 바코드'));
  var title = findByIdRequired_(LIBRARY_MVP.SHEETS.TITLES, 'title_id', copy.title_id, '연결된 도서');
  if (title.status_code !== 'ACTIVE') fail_('TITLE_INACTIVE', '비활성/제적 도서는 대출할 수 없습니다.');
  if (copy.status_code !== 'AVAILABLE' && copy.status_code !== 'HOLD_READY') fail_('COPY_UNAVAILABLE', '현재 대출할 수 없는 소장본입니다: ' + copy.status_code);

  var loans = readTable_(LIBRARY_MVP.SHEETS.LOANS).rows;
  if (loans.some(function(row) { return row.copy_id === copy.copy_id && row.status_code === 'OPEN' && !row.returned_at; })) fail_('COPY_ALREADY_ON_LOAN', '해당 소장본에 진행 중 대출이 있습니다.');
  var memberOpenLoans = loans.filter(function(row) { return row.member_id === member.member_id && row.status_code === 'OPEN' && !row.returned_at; });
  var policy = findPolicy_(member.member_type_code, title.material_type_code);
  var memberLimit = positiveIntegerOrBlank_(member.loan_limit_override, '개별 대출 한도');
  var maxLoans = memberLimit === '' ? policyInteger_(policy.max_open_loans, 5, '최대 대출 권수') : memberLimit;
  if (memberOpenLoans.length >= maxLoans) fail_('LOAN_LIMIT', '대출 한도(' + maxLoans + '권)를 초과합니다.');
  if (truthy_(getConfig_('BLOCK_CHECKOUT_WHEN_OVERDUE', 'TRUE')) && memberOpenLoans.some(function(row) { var d = asDate_(row.due_at); return d && d.getTime() < Date.now(); })) {
    fail_('MEMBER_OVERDUE', '연체 중인 대출이 있어 신규 대출이 제한됩니다.');
  }

  var reservations = readTable_(LIBRARY_MVP.SHEETS.RESERVATIONS).rows.filter(function(row) {
    return row.title_id === title.title_id && (row.status_code === 'WAITING' || row.status_code === 'READY');
  }).sort(reservationSort_);
  var readyForOther = reservations.find(function(row) { return row.status_code === 'READY' && row.assigned_copy_id === copy.copy_id && row.member_id !== member.member_id; });
  if (readyForOther) fail_('RESERVED_FOR_OTHER_MEMBER', '다른 회원에게 배정된 예약 소장본입니다.');
  var ownReady = reservations.find(function(row) { return row.status_code === 'READY' && row.member_id === member.member_id; });
  if (ownReady && ownReady.assigned_copy_id && ownReady.assigned_copy_id !== copy.copy_id) fail_('USE_ASSIGNED_COPY', '이 예약에는 다른 소장본이 배정되어 있습니다: ' + ownReady.assigned_copy_id);
  var firstWaiting = reservations.find(function(row) { return row.status_code === 'WAITING'; });
  if (copy.status_code === 'AVAILABLE' && firstWaiting && firstWaiting.member_id !== member.member_id) fail_('RESERVATION_PRIORITY', '예약 대기자의 우선권이 있는 도서입니다.');

  var now = new Date();
  var dueAt = endOfDay_(addDays_(now, policyInteger_(policy.loan_days, 14, '대출 일수')));
  var loan = transactionAppendRecord_(transaction, LIBRARY_MVP.SHEETS.LOANS, {
    loan_id: newId_('LON'), copy_id: copy.copy_id, member_id: member.member_id, checked_out_at: now, due_at: dueAt,
    returned_at: '', status_code: 'OPEN', renew_count: 0, policy_id: policy.policy_id,
    checkout_staff_id: actor.id, return_staff_id: '', request_id: requestId, note: safeText_(payload.note || ''),
    created_at: now, created_by: actor.id, updated_at: now, updated_by: actor.id, row_version: 1
  });
  transactionUpdateRecord_(transaction, LIBRARY_MVP.SHEETS.COPIES, 'copy_id', copy.copy_id, { status_code: 'ON_LOAN' }, actor.id);
  var ownReservation = reservations.find(function(row) { return row.member_id === member.member_id; });
  if (ownReservation) {
    transactionUpdateRecord_(transaction, LIBRARY_MVP.SHEETS.RESERVATIONS, 'reservation_id', ownReservation.reservation_id, {
      status_code: 'FULFILLED', fulfilled_loan_id: loan.loan_id, fulfilled_at: now
    }, actor.id);
  }
  writeAudit_(actor, requestId, 'CHECKOUT', 'LOAN', loan.loan_id, {}, { loan_id: loan.loan_id, copy_id: copy.copy_id, member_id: member.member_id, due_at: dueAt, status_code: 'OPEN' }, '대출 처리', transaction);
  return {
    targetType: 'LOAN', targetId: loan.loan_id, loanId: loan.loan_id, memberNo: member.member_no,
    memberName: member.name, barcode: copy.barcode, title: title.title, dueAt: dueAt
  };
}

function return_(payload, actor, requestId, transaction) {
  var copy = findCopyByKey_(requiredText_(payload.copyKey, '소장본 바코드'));
  var loans = readTable_(LIBRARY_MVP.SHEETS.LOANS).rows;
  var loan = loans.find(function(row) { return row.copy_id === copy.copy_id && row.status_code === 'OPEN' && !row.returned_at; });
  if (!loan) fail_('NO_OPEN_LOAN', '해당 소장본의 진행 중 대출을 찾을 수 없습니다.');
  var member = findByIdRequired_(LIBRARY_MVP.SHEETS.MEMBERS, 'member_id', loan.member_id, '회원');
  var title = findByIdRequired_(LIBRARY_MVP.SHEETS.TITLES, 'title_id', copy.title_id, '도서');
  var policy = findPolicy_(member.member_type_code, title.material_type_code);
  var now = new Date();
  var dueAt = asDate_(loan.due_at);
  var overdueDays = dueAt && now.getTime() > dueAt.getTime() ? Math.max(1, Math.ceil((now.getTime() - dueAt.getTime()) / 86400000)) : 0;
  var feeAmount = overdueDays * policyInteger_(policy.overdue_fee_per_day, 0, '일 연체료');
  var existingFine = readTable_(LIBRARY_MVP.SHEETS.FINES).rows.find(function(row) {
    return row.loan_id === loan.loan_id && row.fine_type_code === 'OVERDUE';
  });
  var assignmentPlan = planNextReservation_(title.title_id, copy.copy_id, now, '', null);

  transactionUpdateRecord_(transaction, LIBRARY_MVP.SHEETS.LOANS, 'loan_id', loan.loan_id, {
    returned_at: now, status_code: 'RETURNED', return_staff_id: actor.id, note: appendNote_(loan.note, payload.note)
  }, actor.id);

  var suspendMultiplier = Number(getConfig_('OVERDUE_SUSPEND_MULTIPLIER', '1')) || 0;
  var suspendedUntil = '';
  if (overdueDays > 0 && suspendMultiplier > 0) {
    var previousSuspension = asDate_(member.suspended_until);
    var candidate = endOfDay_(addDays_(now, overdueDays * suspendMultiplier));
    suspendedUntil = previousSuspension && previousSuspension.getTime() > candidate.getTime() ? previousSuspension : candidate;
    transactionUpdateRecord_(transaction, LIBRARY_MVP.SHEETS.MEMBERS, 'member_id', member.member_id, {
      suspended_until: suspendedUntil,
      suspend_reason: '연체 ' + overdueDays + '일 반납 (' + formatDate_(now) + ')'
    }, actor.id);
  }

  var fineId = '';
  if (feeAmount > 0) {
    if (!existingFine) {
      var fine = transactionAppendRecord_(transaction, LIBRARY_MVP.SHEETS.FINES, {
        fine_id: newId_('FIN'), member_id: member.member_id, loan_id: loan.loan_id, fine_type_code: 'OVERDUE', amount: feeAmount,
        assessed_at: now, status_code: 'UNPAID', paid_amount: 0, paid_at: '', waived_reason: '', note: overdueDays + '일 연체',
        created_at: now, created_by: actor.id, updated_at: now, updated_by: actor.id, row_version: 1
      });
      fineId = fine.fine_id;
    } else fineId = existingFine.fine_id;
  }

  var assignment = applyReservationPlan_(assignmentPlan, actor, requestId, transaction);
  if (!assignment) transactionUpdateRecord_(transaction, LIBRARY_MVP.SHEETS.COPIES, 'copy_id', copy.copy_id, { status_code: 'AVAILABLE' }, actor.id);
  writeAudit_(actor, requestId, 'RETURN', 'LOAN', loan.loan_id, { status_code: 'OPEN' }, { status_code: 'RETURNED', returned_at: now, overdue_days: overdueDays, fine_id: fineId, suspended_until: suspendedUntil }, '반납 처리', transaction);
  return {
    targetType: 'LOAN', targetId: loan.loan_id, loanId: loan.loan_id, barcode: copy.barcode, title: title.title,
    memberNo: member.member_no, returnedAt: now, overdueDays: overdueDays, fineAmount: feeAmount, suspendedUntil: suspendedUntil,
    fineId: fineId,
    holdReady: assignment ? { reservationId: assignment.reservation_id, memberId: assignment.member_id, pickupExpiresAt: assignment.pickup_expires_at } : null
  };
}

function markLoanLost_(payload, actor, requestId, transaction) {
  var key = requiredText_(payload.loanOrCopyKey, '대출 ID/소장본 바코드');
  var fineAmount = nonNegativeInteger_(requiredText_(payload.fineAmount, '분실 대체비'), '분실 대체비');
  var loans = readTable_(LIBRARY_MVP.SHEETS.LOANS).rows;
  var loan = loans.find(function(row) {
    return cleanCode_(row.loan_id) === cleanCode_(key) && row.status_code === 'OPEN' && !row.returned_at;
  });
  var copy;
  if (!loan) {
    copy = findCopyByKey_(key);
    loan = loans.find(function(row) { return row.copy_id === copy.copy_id && row.status_code === 'OPEN' && !row.returned_at; });
  }
  if (!loan) fail_('NO_OPEN_LOAN', '분실 처리할 진행 중 대출을 찾을 수 없습니다.');
  copy = copy || findByIdRequired_(LIBRARY_MVP.SHEETS.COPIES, 'copy_id', loan.copy_id, '소장본');
  var member = findByIdRequired_(LIBRARY_MVP.SHEETS.MEMBERS, 'member_id', loan.member_id, '회원');
  var title = findByIdRequired_(LIBRARY_MVP.SHEETS.TITLES, 'title_id', copy.title_id, '도서');
  var existingFine = readTable_(LIBRARY_MVP.SHEETS.FINES).rows.find(function(row) {
    return row.loan_id === loan.loan_id && row.fine_type_code === 'REPLACEMENT';
  });
  if (existingFine && Number(existingFine.amount) !== fineAmount) {
    fail_('REPLACEMENT_FINE_CONFLICT', '기존 분실 대체비(' + existingFine.amount + '원)와 입력 금액이 다릅니다: ' + existingFine.fine_id);
  }

  var now = new Date();
  var note = appendNote_(loan.note, payload.note || '분실 처리');
  transactionUpdateRecord_(transaction, LIBRARY_MVP.SHEETS.LOANS, 'loan_id', loan.loan_id, {
    status_code: 'LOST', return_staff_id: actor.id, note: note
  }, actor.id);
  transactionUpdateRecord_(transaction, LIBRARY_MVP.SHEETS.COPIES, 'copy_id', copy.copy_id, {
    status_code: 'LOST', note: appendNote_(copy.note, payload.note || '대출 중 분실 처리')
  }, actor.id);
  var fine = existingFine || null;
  if (fineAmount > 0 && !fine) {
    fine = transactionAppendRecord_(transaction, LIBRARY_MVP.SHEETS.FINES, {
      fine_id: newId_('FIN'), member_id: member.member_id, loan_id: loan.loan_id, fine_type_code: 'REPLACEMENT', amount: fineAmount,
      assessed_at: now, status_code: 'UNPAID', paid_amount: 0, paid_at: '', waived_reason: '', note: safeText_(payload.note || '분실 자료 대체비'),
      created_at: now, created_by: actor.id, updated_at: now, updated_by: actor.id, row_version: 1
    });
  }
  writeAudit_(actor, requestId, 'MARK_LOST', 'LOAN', loan.loan_id,
    { loan_status: loan.status_code, copy_status: copy.status_code },
    { loan_status: 'LOST', copy_status: 'LOST', replacement_fine_id: fine ? fine.fine_id : '', replacement_fine_amount: fineAmount },
    '대출 자료 분실 처리', transaction);
  return {
    targetType: 'LOAN', targetId: loan.loan_id, loanId: loan.loan_id, copyId: copy.copy_id, barcode: copy.barcode,
    title: title.title, memberNo: member.member_no, memberName: member.name, status: 'LOST',
    replacementFineId: fine ? fine.fine_id : '', replacementFineAmount: fineAmount
  };
}

function renew_(payload, actor, requestId, transaction) {
  var key = requiredText_(payload.loanOrCopyKey, '대출 ID/소장본 바코드');
  var loans = readTable_(LIBRARY_MVP.SHEETS.LOANS).rows;
  var loan = loans.find(function(row) { return cleanCode_(row.loan_id) === cleanCode_(key) && row.status_code === 'OPEN'; });
  var copy;
  if (!loan) {
    copy = findCopyByKey_(key);
    loan = loans.find(function(row) { return row.copy_id === copy.copy_id && row.status_code === 'OPEN' && !row.returned_at; });
  }
  if (!loan) fail_('NO_OPEN_LOAN', '진행 중 대출을 찾을 수 없습니다.');
  copy = copy || findByIdRequired_(LIBRARY_MVP.SHEETS.COPIES, 'copy_id', loan.copy_id, '소장본');
  var member = findByIdRequired_(LIBRARY_MVP.SHEETS.MEMBERS, 'member_id', loan.member_id, '회원');
  validateMemberForCirculation_(member);
  var title = findByIdRequired_(LIBRARY_MVP.SHEETS.TITLES, 'title_id', copy.title_id, '도서');
  var policy = findPolicy_(member.member_type_code, title.material_type_code);
  if (Number(loan.renew_count || 0) >= policyInteger_(policy.max_renewals, 0, '최대 연장 횟수')) fail_('RENEWAL_LIMIT', '연장 가능 횟수를 모두 사용했습니다.');
  var nextReservation = readTable_(LIBRARY_MVP.SHEETS.RESERVATIONS).rows.find(function(row) {
    return row.title_id === title.title_id && row.member_id !== member.member_id && (row.status_code === 'WAITING' || row.status_code === 'READY');
  });
  if (nextReservation) fail_('RESERVATION_EXISTS', '다음 예약자가 있어 연장할 수 없습니다.');
  var now = new Date();
  var currentDue = asDate_(loan.due_at) || now;
  var base = currentDue.getTime() > now.getTime() ? currentDue : now;
  var renewalDays = isBlankValue_(policy.renewal_days) ? policyInteger_(policy.loan_days, 14, '대출 일수') : policyInteger_(policy.renewal_days, 0, '연장 일수');
  var newDue = endOfDay_(addDays_(base, renewalDays));
  var updated = transactionUpdateRecord_(transaction, LIBRARY_MVP.SHEETS.LOANS, 'loan_id', loan.loan_id, {
    due_at: newDue, renew_count: Number(loan.renew_count || 0) + 1, note: appendNote_(loan.note, payload.note)
  }, actor.id);
  writeAudit_(actor, requestId, 'RENEW', 'LOAN', loan.loan_id, { due_at: loan.due_at, renew_count: loan.renew_count }, { due_at: newDue, renew_count: updated.renew_count }, '대출 연장', transaction);
  return { targetType: 'LOAN', targetId: loan.loan_id, loanId: loan.loan_id, barcode: copy.barcode, title: title.title, newDueAt: newDue, renewCount: updated.renew_count };
}

function reserve_(payload, actor, requestId, transaction) {
  var member = findMemberByKey_(requiredText_(payload.memberKey, '회원번호'));
  validateMemberForCirculation_(member);
  var title = findTitleByKey_(requiredText_(payload.titleKey, '도서 ID/ISBN'));
  if (title.status_code !== 'ACTIVE') fail_('TITLE_INACTIVE', '비활성/제적 도서는 예약할 수 없습니다.');
  var reservations = readTable_(LIBRARY_MVP.SHEETS.RESERVATIONS).rows;
  if (reservations.some(function(row) { return row.title_id === title.title_id && row.member_id === member.member_id && (row.status_code === 'WAITING' || row.status_code === 'READY'); })) {
    fail_('DUPLICATE_RESERVATION', '같은 도서에 활성 예약이 이미 있습니다.');
  }
  var policy = findPolicy_(member.member_type_code, title.material_type_code);
  var memberActive = reservations.filter(function(row) { return row.member_id === member.member_id && (row.status_code === 'WAITING' || row.status_code === 'READY'); });
  var maxReservations = policyInteger_(policy.max_reservations, 5, '최대 예약 건수');
  if (memberActive.length >= maxReservations) fail_('RESERVATION_LIMIT', '예약 한도(' + maxReservations + '건)를 초과합니다.');
  var sameTitleActive = reservations.filter(function(row) { return row.title_id === title.title_id && (row.status_code === 'WAITING' || row.status_code === 'READY'); });
  var queueSeq = sameTitleActive.reduce(function(max, row) { return Math.max(max, Number(row.queue_seq || 0)); }, 0) + 1;
  var now = new Date();
  var availableCopy = readTable_(LIBRARY_MVP.SHEETS.COPIES).rows.find(function(row) { return row.title_id === title.title_id && row.status_code === 'AVAILABLE'; });
  var reservationRecord = {
    reservation_id: newId_('RSV'), title_id: title.title_id, member_id: member.member_id, requested_at: now, queue_seq: queueSeq,
    status_code: 'WAITING', assigned_copy_id: '', ready_at: '', pickup_expires_at: '', fulfilled_loan_id: '', fulfilled_at: '', cancelled_at: '', request_id: requestId,
    note: safeText_(payload.note || ''), created_at: now, created_by: actor.id, updated_at: now, updated_by: actor.id, row_version: 1
  };
  var assignmentPlan = availableCopy ? planNextReservation_(title.title_id, availableCopy.copy_id, now, '', reservationRecord) : null;
  var reservation = transactionAppendRecord_(transaction, LIBRARY_MVP.SHEETS.RESERVATIONS, reservationRecord);
  var assignment = assignmentPlan ? applyReservationPlan_(assignmentPlan, actor, requestId, transaction) : null;
  var newReservationReady = Boolean(assignment && assignment.reservation_id === reservation.reservation_id);
  var finalReservation = newReservationReady ? assignment : reservation;
  writeAudit_(actor, requestId, 'RESERVE', 'RESERVATION', reservation.reservation_id, {}, {
    reservation_id: reservation.reservation_id, title_id: title.title_id, member_id: member.member_id,
    status_code: finalReservation.status_code, assigned_copy_id: finalReservation.assigned_copy_id || ''
  }, '도서 예약', transaction);
  return {
    targetType: 'RESERVATION', targetId: reservation.reservation_id, reservationId: reservation.reservation_id,
    memberNo: member.member_no, title: title.title, queueSeq: queueSeq, status: finalReservation.status_code,
    assignedBarcode: newReservationReady && availableCopy ? availableCopy.barcode : '', pickupExpiresAt: finalReservation.pickup_expires_at || ''
  };
}

function cancelReservation_(payload, actor, requestId, transaction) {
  var reservationId = cleanCode_(requiredText_(payload.reservationId, '예약 ID'));
  var reservation = findByIdRequired_(LIBRARY_MVP.SHEETS.RESERVATIONS, 'reservation_id', reservationId, '예약');
  if (reservation.status_code !== 'WAITING' && reservation.status_code !== 'READY') fail_('RESERVATION_NOT_ACTIVE', '대기/수령준비 상태의 예약만 취소할 수 있습니다.');
  var now = new Date();
  var assignmentPlan = reservation.assigned_copy_id ? planNextReservation_(reservation.title_id, reservation.assigned_copy_id, now, reservationId, null) : null;
  transactionUpdateRecord_(transaction, LIBRARY_MVP.SHEETS.RESERVATIONS, 'reservation_id', reservationId, {
    status_code: 'CANCELLED', cancelled_at: now, note: appendNote_(reservation.note, payload.note)
  }, actor.id);
  if (reservation.assigned_copy_id) {
    var next = applyReservationPlan_(assignmentPlan, actor, requestId, transaction);
    if (!next) transactionUpdateRecord_(transaction, LIBRARY_MVP.SHEETS.COPIES, 'copy_id', reservation.assigned_copy_id, { status_code: 'AVAILABLE' }, actor.id);
  }
  writeAudit_(actor, requestId, 'CANCEL', 'RESERVATION', reservationId, { status_code: reservation.status_code }, { status_code: 'CANCELLED' }, '예약 취소', transaction);
  return { targetType: 'RESERVATION', targetId: reservationId, reservationId: reservationId, status: 'CANCELLED' };
}

// 장서 점검 스캔(todo/14) — cancelReservation_와 정확히 같은 구조의 "가장 단순한 쓰기" 패턴:
// findCopyByKey_로 찾고, transactionUpdateRecord_로 필드 하나(last_inventory_at)만 갱신하고,
// writeAudit_ 남기고, 결과를 돌려준다. 상태 코드 자체는 건드리지 않는다 — 장서점검은 "이 소장본을
// 실제로 봤다"는 사실만 기록하는 단순 갱신이지(todo 원문: "쓰기지만 단순 갱신"), 대출/반납/분실
// 처리 같은 상태 전이가 아니다. 세션 중 같은 소장본을 여러 번 스캔해도(예: 사서가 실수로 재스캔)
// 이 함수 자체는 멱등하게 last_inventory_at을 그때그때 최신 시각으로 다시 쓸 뿐이라 문제없다 —
// 중복 호출 자체를 막는 건 프론트(views/inventory/index.tsx의 세션-로컬 Set)의 몫이다.
function inventoryScan_(payload, actor, requestId, transaction) {
  var copy = findCopyByKey_(requiredText_(payload.copyKey, '소장본 바코드'));
  var now = new Date();
  var updated = transactionUpdateRecord_(transaction, LIBRARY_MVP.SHEETS.COPIES, 'copy_id', copy.copy_id, { last_inventory_at: now }, actor.id);
  writeAudit_(actor, requestId, 'INVENTORY_SCAN', 'COPY', copy.copy_id, { last_inventory_at: copy.last_inventory_at }, { last_inventory_at: updated.last_inventory_at }, '장서 점검 스캔', transaction);
  return { targetType: 'COPY', targetId: copy.copy_id, copyId: copy.copy_id, barcode: copy.barcode, lastInventoryAt: updated.last_inventory_at };
}

function payFine_(payload, actor, requestId, transaction) {
  var fineId = cleanCode_(requiredText_(payload.fineId, '연체료 ID'));
  var fine = findByIdRequired_(LIBRARY_MVP.SHEETS.FINES, 'fine_id', fineId, '연체료');
  if (fine.status_code === 'PAID' || fine.status_code === 'WAIVED') fail_('FINE_CLOSED', '이미 납부 또는 감면 완료된 항목입니다.');
  var payment = Number(payload.amount);
  if (!isFinite(payment) || payment <= 0) fail_('VALIDATION_ERROR', '납부 금액은 0보다 커야 합니다.');
  var totalPaid = Number(fine.paid_amount || 0) + payment;
  var amount = Number(fine.amount || 0);
  if (totalPaid > amount) fail_('OVERPAYMENT', '부과 금액보다 많이 납부할 수 없습니다.');
  var status = totalPaid >= amount ? 'PAID' : 'PARTIAL';
  var now = new Date();
  transactionUpdateRecord_(transaction, LIBRARY_MVP.SHEETS.FINES, 'fine_id', fineId, { paid_amount: totalPaid, paid_at: status === 'PAID' ? now : '', status_code: status }, actor.id);
  writeAudit_(actor, requestId, 'PAY', 'FINE', fineId, { paid_amount: fine.paid_amount, status_code: fine.status_code }, { paid_amount: totalPaid, status_code: status }, '연체료 납부', transaction);
  return { targetType: 'FINE', targetId: fineId, fineId: fineId, paidAmount: totalPaid, remainingAmount: amount - totalPaid, status: status };
}

function updateCopyStatus_(payload, actor, requestId, transaction) {
  var copy = findCopyByKey_(requiredText_(payload.copyKey, '소장본 바코드'));
  var status = cleanCode_(requiredText_(payload.status, '새 상태'));
  assertCode_('COPY_STATUS', status);
  if (status === 'ON_LOAN' || status === 'HOLD_READY') fail_('DERIVED_STATUS', 'ON_LOAN/HOLD_READY는 대출·예약에서 자동 계산되는 상태입니다.');
  var openLoan = readTable_(LIBRARY_MVP.SHEETS.LOANS).rows.find(function(row) { return row.copy_id === copy.copy_id && row.status_code === 'OPEN' && !row.returned_at; });
  if (openLoan) fail_('OPEN_LOAN_EXISTS', '진행 중 대출은 반납 또는 분실 처리 전용 흐름으로 먼저 종료해야 합니다.');
  var readyReservation = readTable_(LIBRARY_MVP.SHEETS.RESERVATIONS).rows.find(function(row) { return row.assigned_copy_id === copy.copy_id && row.status_code === 'READY'; });
  if (readyReservation) fail_('READY_RESERVATION_EXISTS', '수령 준비 예약을 먼저 취소하거나 만료 처리하세요.');
  var now = new Date();
  var assignmentPlan = status === 'AVAILABLE' ? planNextReservation_(copy.title_id, copy.copy_id, now, '', null) : null;
  var updated = transactionUpdateRecord_(transaction, LIBRARY_MVP.SHEETS.COPIES, 'copy_id', copy.copy_id, { status_code: status, note: appendNote_(copy.note, payload.note) }, actor.id);
  var assignment = assignmentPlan ? applyReservationPlan_(assignmentPlan, actor, requestId, transaction) : null;
  var finalStatus = assignment ? 'HOLD_READY' : updated.status_code;
  writeAudit_(actor, requestId, 'UPDATE_STATUS', 'COPY', copy.copy_id, { status_code: copy.status_code }, {
    requested_status: status, final_status: finalStatus, assigned_reservation_id: assignment ? assignment.reservation_id : ''
  }, '소장본 상태 변경', transaction);
  return { targetType: 'COPY', targetId: copy.copy_id, copyId: copy.copy_id, barcode: copy.barcode, status: finalStatus, assignedReservationId: assignment ? assignment.reservation_id : '' };
}

function planNextReservation_(titleId, copyId, now, excludeReservationId, virtualReservation) {
  var waiting = readTable_(LIBRARY_MVP.SHEETS.RESERVATIONS).rows.filter(function(row) {
    return row.title_id === titleId && row.status_code === 'WAITING' && row.reservation_id !== excludeReservationId;
  });
  if (virtualReservation && virtualReservation.title_id === titleId && virtualReservation.status_code === 'WAITING' && virtualReservation.reservation_id !== excludeReservationId) {
    waiting.push(virtualReservation);
  }
  waiting.sort(reservationSort_);
  var memberRows = readTable_(LIBRARY_MVP.SHEETS.MEMBERS).rows;
  var expiredReservationIds = [];
  var next = null;
  var member = null;
  var effectiveNow = now || new Date();
  for (var i = 0; i < waiting.length; i++) {
    var candidateMember = memberRows.find(function(row) { return row.member_id === waiting[i].member_id; });
    var memberExpiresAt = candidateMember ? asDate_(candidateMember.expires_at) : null;
    if (!candidateMember || candidateMember.status_code !== 'ACTIVE' || (memberExpiresAt && memberExpiresAt.getTime() < effectiveNow.getTime())) {
      if (waiting[i] !== virtualReservation) expiredReservationIds.push(waiting[i].reservation_id);
      continue;
    }
    next = waiting[i];
    member = candidateMember;
    break;
  }
  var title = null;
  var pickupExpiresAt = '';
  if (next) {
    title = findByIdRequired_(LIBRARY_MVP.SHEETS.TITLES, 'title_id', titleId, '예약 도서');
    var policy = findPolicy_(member.member_type_code, title.material_type_code);
    pickupExpiresAt = endOfDay_(addDays_(effectiveNow, policyInteger_(policy.hold_days, 3, '예약 보관 일수')));
  }
  return {
    titleId: titleId, copyId: copyId, now: effectiveNow, selected: next, member: member, title: title,
    pickupExpiresAt: pickupExpiresAt, expiredReservationIds: expiredReservationIds
  };
}

function applyReservationPlan_(plan, actor, requestId, transaction) {
  if (!plan) return null;
  plan.expiredReservationIds.forEach(function(reservationId) {
    transactionUpdateRecord_(transaction, LIBRARY_MVP.SHEETS.RESERVATIONS, 'reservation_id', reservationId, { status_code: 'EXPIRED' }, actor.id);
  });
  if (!plan.selected) return null;
  var updated = transactionUpdateRecord_(transaction, LIBRARY_MVP.SHEETS.RESERVATIONS, 'reservation_id', plan.selected.reservation_id, {
    status_code: 'READY', assigned_copy_id: plan.copyId, ready_at: plan.now, pickup_expires_at: plan.pickupExpiresAt
  }, actor.id);
  transactionUpdateRecord_(transaction, LIBRARY_MVP.SHEETS.COPIES, 'copy_id', plan.copyId, { status_code: 'HOLD_READY' }, actor.id);
  enqueueNotification_(plan.member, 'RESERVATION_READY', {
    reservationId: plan.selected.reservation_id, title: plan.title.title, pickupExpiresAt: plan.pickupExpiresAt
  }, actor, transaction);
  return updated;
}

function assignNextReservation_(titleId, copyId, actor, requestId, now, excludeReservationId, transaction) {
  return applyReservationPlan_(planNextReservation_(titleId, copyId, now, excludeReservationId, null), actor, requestId, transaction);
}

// --------------------------- Search ---------------------------

function search_(payload) {
  var query = requiredText_(payload.query, '검색어');
  var normalized = normalizeText_(query);
  var exactCode = cleanCode_(query);
  var queryIsbn = normalizeIsbnLoose_(query);
  var validQueryIsbn = queryIsbn.length === 10 || queryIsbn.length === 13;
  var scope = cleanCode_(payload.scope || 'ALL');
  var limit = Math.min(100, Math.max(1, Number(getConfig_('MAX_SEARCH_RESULTS', '50')) || 50));
  var titles = readTable_(LIBRARY_MVP.SHEETS.TITLES).rows;
  var authors = readTable_(LIBRARY_MVP.SHEETS.AUTHORS).rows;
  var titleAuthors = readTable_(LIBRARY_MVP.SHEETS.TITLE_AUTHORS).rows;
  var copies = readTable_(LIBRARY_MVP.SHEETS.COPIES).rows;
  var members = readTable_(LIBRARY_MVP.SHEETS.MEMBERS).rows;
  var loans = readTable_(LIBRARY_MVP.SHEETS.LOANS).rows;
  var reservations = readTable_(LIBRARY_MVP.SHEETS.RESERVATIONS).rows;
  var fines = readTable_(LIBRARY_MVP.SHEETS.FINES).rows;
  var authorById = indexBy_(authors, 'author_id');
  var titleById = indexBy_(titles, 'title_id');
  var copyById = indexBy_(copies, 'copy_id');
  var memberById = indexBy_(members, 'member_id');
  var authorTextByTitle = {};
  titleAuthors.forEach(function(link) {
    var author = authorById[link.author_id];
    if (!author) return;
    if (!authorTextByTitle[link.title_id]) authorTextByTitle[link.title_id] = [];
    authorTextByTitle[link.title_id].push(author.display_name);
  });
  var results = [];

  if (scope === 'ALL' || scope === 'BOOKS') {
    titles.forEach(function(title) {
      var authorsText = (authorTextByTitle[title.title_id] || []).join(', ');
      var haystack = normalizeText_([title.title_id, title.isbn13, title.title, title.subtitle, title.publisher, title.classification_no, title.keywords, authorsText].join(' '));
      var isbnExact = validQueryIsbn && normalizeIsbnLoose_(title.isbn13) === queryIsbn;
      if (haystack.indexOf(normalized) === -1 && cleanCode_(title.title_id) !== exactCode && !isbnExact) return;
      var titleCopies = copies.filter(function(copy) { return copy.title_id === title.title_id; });
      results.push({
        rank: cleanCode_(title.title_id) === exactCode || isbnExact ? 0 : 3,
        type: 'BOOK', id: title.title_id, primary: title.title,
        secondary: [authorsText, title.publisher, title.isbn13].filter(Boolean).join(' · '),
        status: title.status_code,
        details: '소장 ' + titleCopies.length + '권 / 대출가능 ' + titleCopies.filter(function(copy) { return copy.status_code === 'AVAILABLE'; }).length + '권'
      });
    });
  }

  if (scope === 'ALL' || scope === 'COPIES') {
    copies.forEach(function(copy) {
      var title = titleById[copy.title_id] || {};
      var haystack = normalizeText_([copy.copy_id, copy.barcode, copy.location_code, copy.shelf_code, title.title, title.isbn13].join(' '));
      if (haystack.indexOf(normalized) === -1 && cleanCode_(copy.barcode) !== exactCode && cleanCode_(copy.copy_id) !== exactCode) return;
      results.push({
        rank: cleanCode_(copy.barcode) === exactCode || cleanCode_(copy.copy_id) === exactCode ? 0 : 2,
        type: 'COPY', id: copy.copy_id, primary: title.title || copy.title_id,
        secondary: copy.barcode + ' · ' + [copy.location_code, copy.shelf_code].filter(Boolean).join('/'),
        status: copy.status_code, details: '소장본 ID ' + copy.copy_id
      });
    });
  }

  if (scope === 'ALL' || scope === 'MEMBERS') {
    members.forEach(function(member) {
      var haystack = normalizeText_([member.member_id, member.member_no, member.name, member.school_no, member.phone, member.email, (member.grade !== '' && member.grade !== undefined ? member.grade + '-' + member.class_no : '')].join(' '));
      if (haystack.indexOf(normalized) === -1 && cleanCode_(member.member_no) !== exactCode && cleanCode_(member.member_id) !== exactCode) return;
      var open = loans.filter(function(loan) { return loan.member_id === member.member_id && loan.status_code === 'OPEN' && !loan.returned_at; });
      results.push({
        rank: cleanCode_(member.member_no) === exactCode || cleanCode_(member.member_id) === exactCode ? 0 : 2,
        type: 'MEMBER', id: member.member_id, primary: member.name,
        secondary: member.member_no + ' · ' + (member.grade !== '' && member.grade !== undefined && member.grade !== null ? member.grade + '학년 ' + member.class_no + '반' + (member.student_no !== '' && member.student_no !== undefined ? ' ' + member.student_no + '번' : '') : maskPhone_(member.phone) + ' · ' + maskEmail_(member.email)),
        status: member.status_code, details: '현재 대출 ' + open.length + '권 / 활성 예약 ' + reservations.filter(function(row) { return row.member_id === member.member_id && (row.status_code === 'WAITING' || row.status_code === 'READY'); }).length + '건'
      });
    });
  }

  if (scope === 'ALL' || scope === 'LOANS') {
    loans.forEach(function(loan) {
      var copy = copyById[loan.copy_id] || {};
      var title = titleById[copy.title_id] || {};
      var member = memberById[loan.member_id] || {};
      var haystack = normalizeText_([loan.loan_id, copy.barcode, title.title, member.member_no, member.name].join(' '));
      if (haystack.indexOf(normalized) === -1 && cleanCode_(loan.loan_id) !== exactCode) return;
      results.push({
        rank: cleanCode_(loan.loan_id) === exactCode ? 0 : 4,
        type: 'LOAN', id: loan.loan_id, primary: title.title || loan.copy_id,
        secondary: (member.member_no || loan.member_id) + ' · ' + (copy.barcode || loan.copy_id),
        status: loan.status_code, details: '대출 ' + formatDateTime_(loan.checked_out_at) + ' / 반납예정 ' + formatDateTime_(loan.due_at)
      });
    });
  }

  if (scope === 'ALL' || scope === 'RESERVATIONS') {
    reservations.forEach(function(reservation) {
      var title = titleById[reservation.title_id] || {};
      var member = memberById[reservation.member_id] || {};
      var assignedCopy = copyById[reservation.assigned_copy_id] || {};
      var haystack = normalizeText_([reservation.reservation_id, title.title, title.isbn13, member.member_no, member.name, assignedCopy.barcode].join(' '));
      if (haystack.indexOf(normalized) === -1 && cleanCode_(reservation.reservation_id) !== exactCode) return;
      results.push({
        rank: cleanCode_(reservation.reservation_id) === exactCode ? 0 : 3,
        type: 'RESERVATION', id: reservation.reservation_id, primary: title.title || reservation.title_id,
        secondary: (member.member_no || reservation.member_id) + ' · 순번 ' + (reservation.queue_seq || '-'),
        status: reservation.status_code,
        details: '요청 ' + formatDateTime_(reservation.requested_at) + (assignedCopy.barcode ? ' / 배정 ' + assignedCopy.barcode : '') + (reservation.pickup_expires_at ? ' / 수령기한 ' + formatDateTime_(reservation.pickup_expires_at) : '')
      });
    });
  }

  if (scope === 'ALL' || scope === 'FINES') {
    fines.forEach(function(fine) {
      var member = memberById[fine.member_id] || {};
      var loan = loans.find(function(row) { return row.loan_id === fine.loan_id; }) || {};
      var copy = copyById[loan.copy_id] || {};
      var title = titleById[copy.title_id] || {};
      var haystack = normalizeText_([fine.fine_id, fine.loan_id, member.member_no, member.name, copy.barcode, title.title].join(' '));
      if (haystack.indexOf(normalized) === -1 && cleanCode_(fine.fine_id) !== exactCode) return;
      results.push({
        rank: cleanCode_(fine.fine_id) === exactCode ? 0 : 4,
        type: 'FINE', id: fine.fine_id, primary: title.title || fine.fine_type_code || '연체료',
        secondary: (member.member_no || fine.member_id) + ' · 대출 ' + fine.loan_id,
        status: fine.status_code,
        details: '부과 ' + Number(fine.amount || 0).toLocaleString('ko-KR') + '원 / 납부 ' + Number(fine.paid_amount || 0).toLocaleString('ko-KR') + '원'
      });
    });
  }

  results.sort(function(a, b) { return a.rank - b.rank || String(a.primary).localeCompare(String(b.primary), 'ko'); });
  return { query: query, scope: scope, total: results.length, results: results.slice(0, limit) };
}

// --------------------------- Integrity and maintenance ---------------------------

function runIntegrityCheck() {
  getActor_();
  var result = integrityCheck_();
  var message = result.issueCount ? result.issueCount + '개 문제를 찾았습니다. 사이드바 관리 탭에서 상세 목록을 확인하세요.' : '문제를 찾지 못했습니다.';
  SpreadsheetApp.getUi().alert('무결성 점검', message, SpreadsheetApp.getUi().ButtonSet.OK);
  return result;
}

function integrityCheck_() {
  var issues = [];
  var tables = {};
  Object.keys(LIBRARY_MVP.HEADERS).forEach(function(name) { tables[name] = readTable_(name).rows; });
  var primaryKeys = {};
  primaryKeys[LIBRARY_MVP.SHEETS.TITLES] = 'title_id';
  primaryKeys[LIBRARY_MVP.SHEETS.AUTHORS] = 'author_id';
  primaryKeys[LIBRARY_MVP.SHEETS.TITLE_AUTHORS] = 'title_author_id';
  primaryKeys[LIBRARY_MVP.SHEETS.CATEGORIES] = 'category_id';
  primaryKeys[LIBRARY_MVP.SHEETS.TITLE_CATEGORIES] = 'title_category_id';
  primaryKeys[LIBRARY_MVP.SHEETS.COPIES] = 'copy_id';
  primaryKeys[LIBRARY_MVP.SHEETS.MEMBERS] = 'member_id';
  primaryKeys[LIBRARY_MVP.SHEETS.LOANS] = 'loan_id';
  primaryKeys[LIBRARY_MVP.SHEETS.RESERVATIONS] = 'reservation_id';
  primaryKeys[LIBRARY_MVP.SHEETS.FINES] = 'fine_id';
  primaryKeys[LIBRARY_MVP.SHEETS.POLICIES] = 'policy_id';
  primaryKeys[LIBRARY_MVP.SHEETS.STAFF] = 'staff_id';
  primaryKeys[LIBRARY_MVP.SHEETS.AUDIT] = 'log_id';
  primaryKeys[LIBRARY_MVP.SHEETS.OPERATIONS] = 'request_id';
  primaryKeys[LIBRARY_MVP.SHEETS.NOTIFICATIONS] = 'notification_id';

  Object.keys(primaryKeys).forEach(function(sheetName) {
    checkUnique_(tables[sheetName], primaryKeys[sheetName], sheetName, issues, true);
  });
  checkUnique_(tables[LIBRARY_MVP.SHEETS.COPIES], 'barcode', LIBRARY_MVP.SHEETS.COPIES, issues, true);
  checkUnique_(tables[LIBRARY_MVP.SHEETS.MEMBERS], 'member_no', LIBRARY_MVP.SHEETS.MEMBERS, issues, true);

  var titleIds = toSet_(tables[LIBRARY_MVP.SHEETS.TITLES], 'title_id');
  var authorIds = toSet_(tables[LIBRARY_MVP.SHEETS.AUTHORS], 'author_id');
  var categoryIds = toSet_(tables[LIBRARY_MVP.SHEETS.CATEGORIES], 'category_id');
  var copyIds = toSet_(tables[LIBRARY_MVP.SHEETS.COPIES], 'copy_id');
  var memberIds = toSet_(tables[LIBRARY_MVP.SHEETS.MEMBERS], 'member_id');
  var loanIds = toSet_(tables[LIBRARY_MVP.SHEETS.LOANS], 'loan_id');
  var policyIds = toSet_(tables[LIBRARY_MVP.SHEETS.POLICIES], 'policy_id');
  var staffIds = toSet_(tables[LIBRARY_MVP.SHEETS.STAFF], 'staff_id');
  var requestIds = toSet_(tables[LIBRARY_MVP.SHEETS.OPERATIONS], 'request_id');
  tables[LIBRARY_MVP.SHEETS.CATEGORIES].forEach(function(row) {
    if (row.parent_category_id) requireForeignKey_(row, 'parent_category_id', categoryIds, LIBRARY_MVP.SHEETS.CATEGORIES, issues);
  });
  tables[LIBRARY_MVP.SHEETS.TITLE_AUTHORS].forEach(function(row) {
    requireForeignKey_(row, 'title_id', titleIds, LIBRARY_MVP.SHEETS.TITLE_AUTHORS, issues);
    requireForeignKey_(row, 'author_id', authorIds, LIBRARY_MVP.SHEETS.TITLE_AUTHORS, issues);
  });
  tables[LIBRARY_MVP.SHEETS.TITLE_CATEGORIES].forEach(function(row) {
    requireForeignKey_(row, 'title_id', titleIds, LIBRARY_MVP.SHEETS.TITLE_CATEGORIES, issues);
    requireForeignKey_(row, 'category_id', categoryIds, LIBRARY_MVP.SHEETS.TITLE_CATEGORIES, issues);
  });
  tables[LIBRARY_MVP.SHEETS.COPIES].forEach(function(row) { requireForeignKey_(row, 'title_id', titleIds, LIBRARY_MVP.SHEETS.COPIES, issues); });
  tables[LIBRARY_MVP.SHEETS.LOANS].forEach(function(row) {
    requireForeignKey_(row, 'copy_id', copyIds, LIBRARY_MVP.SHEETS.LOANS, issues);
    requireForeignKey_(row, 'member_id', memberIds, LIBRARY_MVP.SHEETS.LOANS, issues);
    if (row.policy_id) requireForeignKey_(row, 'policy_id', policyIds, LIBRARY_MVP.SHEETS.LOANS, issues);
    if (row.checkout_staff_id) requireForeignKey_(row, 'checkout_staff_id', staffIds, LIBRARY_MVP.SHEETS.LOANS, issues);
    if (row.return_staff_id) requireForeignKey_(row, 'return_staff_id', staffIds, LIBRARY_MVP.SHEETS.LOANS, issues);
    if (row.request_id) requireForeignKey_(row, 'request_id', requestIds, LIBRARY_MVP.SHEETS.LOANS, issues);
    var checkedOut = asDate_(row.checked_out_at); var due = asDate_(row.due_at); var returned = asDate_(row.returned_at);
    if (checkedOut && due && due.getTime() < checkedOut.getTime()) issues.push(issue_('INVALID_DATE_ORDER', LIBRARY_MVP.SHEETS.LOANS, row._row, 'due_at이 checked_out_at보다 빠릅니다.'));
    if (checkedOut && returned && returned.getTime() < checkedOut.getTime()) issues.push(issue_('INVALID_DATE_ORDER', LIBRARY_MVP.SHEETS.LOANS, row._row, 'returned_at이 checked_out_at보다 빠릅니다.'));
  });
  tables[LIBRARY_MVP.SHEETS.RESERVATIONS].forEach(function(row) {
    requireForeignKey_(row, 'title_id', titleIds, LIBRARY_MVP.SHEETS.RESERVATIONS, issues);
    requireForeignKey_(row, 'member_id', memberIds, LIBRARY_MVP.SHEETS.RESERVATIONS, issues);
    if (row.assigned_copy_id) {
      requireForeignKey_(row, 'assigned_copy_id', copyIds, LIBRARY_MVP.SHEETS.RESERVATIONS, issues);
      var assigned = tables[LIBRARY_MVP.SHEETS.COPIES].find(function(copy) { return copy.copy_id === row.assigned_copy_id; });
      if (assigned && assigned.title_id !== row.title_id) issues.push(issue_('RESERVATION_COPY_MISMATCH', LIBRARY_MVP.SHEETS.RESERVATIONS, row._row, '배정 소장본이 다른 도서에 속합니다.'));
    }
    if (row.fulfilled_loan_id) requireForeignKey_(row, 'fulfilled_loan_id', loanIds, LIBRARY_MVP.SHEETS.RESERVATIONS, issues);
    if (row.request_id) requireForeignKey_(row, 'request_id', requestIds, LIBRARY_MVP.SHEETS.RESERVATIONS, issues);
  });
  tables[LIBRARY_MVP.SHEETS.FINES].forEach(function(row) {
    requireForeignKey_(row, 'member_id', memberIds, LIBRARY_MVP.SHEETS.FINES, issues);
    requireForeignKey_(row, 'loan_id', loanIds, LIBRARY_MVP.SHEETS.FINES, issues);
  });
  tables[LIBRARY_MVP.SHEETS.NOTIFICATIONS].forEach(function(row) {
    requireForeignKey_(row, 'member_id', memberIds, LIBRARY_MVP.SHEETS.NOTIFICATIONS, issues);
  });

  var activeReservationByMemberTitle = {};
  var readyByCopy = {};
  tables[LIBRARY_MVP.SHEETS.RESERVATIONS].filter(function(row) { return row.status_code === 'WAITING' || row.status_code === 'READY'; }).forEach(function(row) {
    var memberTitleKey = row.member_id + '|' + row.title_id;
    if (activeReservationByMemberTitle[memberTitleKey]) issues.push(issue_('DUPLICATE_ACTIVE_RESERVATION', LIBRARY_MVP.SHEETS.RESERVATIONS, row._row, '동일 회원·도서에 활성 예약이 여러 건입니다.'));
    activeReservationByMemberTitle[memberTitleKey] = row;
    if (row.status_code === 'READY' && row.assigned_copy_id) {
      if (readyByCopy[row.assigned_copy_id]) issues.push(issue_('MULTIPLE_READY_RESERVATIONS', LIBRARY_MVP.SHEETS.RESERVATIONS, row._row, '하나의 소장본에 READY 예약이 여러 건입니다.'));
      readyByCopy[row.assigned_copy_id] = row;
    }
  });

  var openByCopy = {};
  tables[LIBRARY_MVP.SHEETS.LOANS].filter(function(row) { return row.status_code === 'OPEN' && !row.returned_at; }).forEach(function(row) {
    if (!openByCopy[row.copy_id]) openByCopy[row.copy_id] = [];
    openByCopy[row.copy_id].push(row);
  });
  Object.keys(openByCopy).forEach(function(copyId) {
    if (openByCopy[copyId].length > 1) issues.push(issue_('MULTIPLE_OPEN_LOANS', LIBRARY_MVP.SHEETS.LOANS, openByCopy[copyId][0]._row, copyId + '에 활성 대출이 ' + openByCopy[copyId].length + '건 있습니다.'));
  });
  tables[LIBRARY_MVP.SHEETS.COPIES].forEach(function(copy) {
    var hasOpen = Boolean(openByCopy[copy.copy_id] && openByCopy[copy.copy_id].length);
    var hasReady = Boolean(readyByCopy[copy.copy_id]);
    if (hasOpen && copy.status_code !== 'ON_LOAN') issues.push(issue_('COPY_STATUS_MISMATCH', LIBRARY_MVP.SHEETS.COPIES, copy._row, '활성 대출이 있지만 상태가 ON_LOAN이 아닙니다.'));
    if (!hasOpen && copy.status_code === 'ON_LOAN') issues.push(issue_('COPY_STATUS_MISMATCH', LIBRARY_MVP.SHEETS.COPIES, copy._row, '활성 대출 없이 상태가 ON_LOAN입니다.'));
    if (hasReady && copy.status_code !== 'HOLD_READY') issues.push(issue_('READY_STATUS_MISMATCH', LIBRARY_MVP.SHEETS.COPIES, copy._row, 'READY 예약이 있지만 상태가 HOLD_READY가 아닙니다.'));
    if (!hasReady && copy.status_code === 'HOLD_READY') issues.push(issue_('READY_STATUS_MISMATCH', LIBRARY_MVP.SHEETS.COPIES, copy._row, 'READY 예약 없이 상태가 HOLD_READY입니다.'));
  });

  return { checkedAt: formatDateTime_(new Date()), issueCount: issues.length, issues: issues.slice(0, 200), truncated: issues.length > 200 };
}

function reconcileCopyStatuses() {
  var result = executeWrite_('RECONCILE_COPY_STATUS', {}, function(actor, requestId, transaction) {
    requireRole_(actor, ['ADMIN']);
    return reconcileCopyStatuses_(actor, requestId, transaction);
  });
  getSpreadsheet_().toast(result.changedCount + '개 소장본 상태를 복구했습니다.', '도서관 관리', 5);
  return result;
}

function reconcileCopyStatuses_(actor, requestId, transaction) {
  var copyTable = readTable_(LIBRARY_MVP.SHEETS.COPIES);
  var copies = copyTable.rows;
  var loans = readTable_(LIBRARY_MVP.SHEETS.LOANS).rows;
  var reservations = readTable_(LIBRARY_MVP.SHEETS.RESERVATIONS).rows;
  var openSet = {};
  loans.forEach(function(row) { if (row.status_code === 'OPEN' && !row.returned_at) openSet[row.copy_id] = true; });
  var readySet = {};
  reservations.forEach(function(row) { if (row.status_code === 'READY' && row.assigned_copy_id) readySet[row.assigned_copy_id] = true; });
  var changed = [];
  copies.forEach(function(copy) {
    if (copy.status_code === 'REPAIR' || copy.status_code === 'LOST' || copy.status_code === 'WITHDRAWN') return;
    var derived = openSet[copy.copy_id] ? 'ON_LOAN' : (readySet[copy.copy_id] ? 'HOLD_READY' : 'AVAILABLE');
    if (derived !== copy.status_code) {
      transactionUpdateRecord_(transaction, LIBRARY_MVP.SHEETS.COPIES, 'copy_id', copy.copy_id, { status_code: derived }, actor.id);
      changed.push({ copy_id: copy.copy_id, before: copy.status_code, after: derived });
    }
  });
  writeAudit_(actor, requestId, 'RECONCILE', 'COPY', 'BATCH', {}, { changed_count: changed.length }, '소장본 파생 상태 복구', transaction);
  return { targetType: 'COPY', targetId: 'BATCH', changedCount: changed.length, changes: changed.slice(0, 100) };
}

function installLibraryTriggers() {
  requireRole_(getActor_(), ['ADMIN']);
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'dailyLibraryMaintenance') ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger('dailyLibraryMaintenance').timeBased().everyDays(1).atHour(4).create();
  ScriptApp.newTrigger('dailyVizBatch').timeBased().everyDays(1).atHour(5).create();
  SpreadsheetApp.getUi().alert('트리거 설치 완료', '매일 오전 4시 전후에 예약 만료·상태 복구·대시보드 갱신을 실행합니다.', SpreadsheetApp.getUi().ButtonSet.OK);
}

function dailyLibraryMaintenance() {
  executeWrite_('DAILY_MAINTENANCE', { requestId: 'DAILY-' + formatDate_(new Date()) }, function(actor, requestId, transaction) {
    var now = new Date();
    var expiredCount = 0;
    var ready = readTable_(LIBRARY_MVP.SHEETS.RESERVATIONS).rows.filter(function(row) {
      var expires = asDate_(row.pickup_expires_at);
      return row.status_code === 'READY' && expires && expires.getTime() < now.getTime();
    });
    ready.forEach(function(row) {
      transactionUpdateRecord_(transaction, LIBRARY_MVP.SHEETS.RESERVATIONS, 'reservation_id', row.reservation_id, { status_code: 'EXPIRED' }, actor.id);
      if (row.assigned_copy_id) {
        var next = assignNextReservation_(row.title_id, row.assigned_copy_id, actor, requestId, now, row.reservation_id, transaction);
        if (!next) transactionUpdateRecord_(transaction, LIBRARY_MVP.SHEETS.COPIES, 'copy_id', row.assigned_copy_id, { status_code: 'AVAILABLE' }, actor.id);
      }
      expiredCount++;
    });
    var reconciled = reconcileCopyStatuses_(actor, requestId, transaction);
    return { targetType: 'MAINTENANCE', targetId: formatDate_(now), expiredReservations: expiredCount, reconciledCopies: reconciled.changedCount };
  });
  refreshDashboard_();
}

// --------------------------- VIZ_CACHE 일배치(시각화 집계 캐시) ---------------------------
//
// VIZ.md 원칙 ① "집계는 서버 일배치 · doPost `viz`는 읽기만" — 이 트리거가 LOANS/COPIES/
// TITLES/CATEGORIES/RESERVATIONS를 훑어 4개 차트 데이터를 미리 계산해 20_VIZ_CACHE 시트에
// 적재하고, apiWebViz_()는 그 캐시 행을 읽기만 한다(클라이언트가 원장을 스캔하지 않는다).
//
// 20_VIZ_CACHE는 LOANS·MEMBERS·15_AUDIT_LOG 같은 업무 원장이 아니라 "당일 재계산 가능한
// 파생 캐시"다 — 그래서 runVizDailyBatch_()가 매일 기존 4행을 지우고 새로 쓴다(append-only가
// 아니라 rewrite). CLAUDE.md 절대 규칙 6번("행 삭제 금지 — 상태 코드로")·ADR-012는 감사·법적
// 근거가 있는 업무 기록(대출·회원·감사 로그 등)에 적용되는 규칙이고, 언제든 원장에서 다시
// 계산해낼 수 있는 읽기 전용 요약 캐시에는 해당하지 않는다 — 원장 자체의 행은 하나도 지우지
// 않으며, 이 배치는 executeWrite_/checkout_/return_ 같은 보호된 업무 트랜잭션 경로를 거치지도
// 않는다(순수 파생 캐시 유지보수이지 업무 트랜잭션이 아니다).
function dailyVizBatch() {
  runVizDailyBatch_();
}

function runVizDailyBatch_() {
  var now = new Date();
  var rows = [
    ['loan-heatmap', now, JSON.stringify(computeLoanHeatmapViz_(now))],
    ['category-treemap', now, JSON.stringify(computeCategoryTreemapViz_())],
    ['turnover-quadrant', now, JSON.stringify(computeTurnoverQuadrantViz_(now))],
    ['reservation-pressure', now, JSON.stringify(computeReservationPressureViz_(now))],
    // todo/18 — 승인된 방식(추가만): 아래 4행은 새로 추가한 항목이고, 위 4행의 로직·순서는
    // 그대로다(dailyVizBatch/runVizDailyBatch_ 본문 자체는 손대지 않았다).
    ['loan-time-of-day', now, JSON.stringify(computeLoanTimeOfDayViz_(now))],
    ['overdue-flow', now, JSON.stringify(computeOverdueFlowViz_(now))],
    ['class-participation', now, JSON.stringify(computeClassParticipationViz_(now))],
    ['monthly-loan-curve', now, JSON.stringify(computeMonthlyLoanCurveViz_(now))],
    // todo/19 — 같은 방식으로 한 번 더(승인된 "추가만" 패턴): 아래 4행이 이번에 새로 추가한
    // 항목이고, 위 8행의 로직·순서는 그대로다. V1 12종 전체가 이 배열에 다 모였다.
    ['shelf-heatmap', now, JSON.stringify(computeShelfHeatmapViz_(now))],
    ['collection-age', now, JSON.stringify(computeCollectionAgeViz_(now))],
    ['grade-reading-gap', now, JSON.stringify(computeGradeReadingGapViz_(now))],
    ['budget-picture', now, JSON.stringify(computeBudgetViz_(now))]
  ];
  var sheet = getRequiredSheet_(LIBRARY_MVP.SHEETS.VIZ_CACHE);
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
  ensureSheetRows_(sheet, rows.length + 1);
  sheet.getRange(2, 1, rows.length, 3).setValues(rows);
  invalidateTableCache_(LIBRARY_MVP.SHEETS.VIZ_CACHE);
  return { computedAt: formatDateTime_(now), count: rows.length };
}

// #1 대출 잔디 — LOANS 일별 건수(최근 365일). 연도 아카이브 시트가 아직 없으므로(LIBRARY_MVP.SHEETS에
// 아카이브 패턴 없음 — docs/ASSUMPTIONS.md todo/06 참고) 현재 살아 있는 10_LOANS 한 시트만 훑는다.
var VIZ_LOAN_HEATMAP_DAYS_ = 365;

function computeLoanHeatmapViz_(now) {
  var startDate = addDays_(now, -(VIZ_LOAN_HEATMAP_DAYS_ - 1));
  startDate.setHours(0, 0, 0, 0);
  var countByDate = {};
  readTable_(LIBRARY_MVP.SHEETS.LOANS).rows.forEach(function(row) {
    var checkedOut = asDate_(row.checked_out_at);
    if (!checkedOut || checkedOut.getTime() < startDate.getTime()) return;
    var key = formatDate_(checkedOut);
    countByDate[key] = (countByDate[key] || 0) + 1;
  });
  var days = [];
  for (var i = 0; i < VIZ_LOAN_HEATMAP_DAYS_; i++) {
    var key = formatDate_(addDays_(startDate, i));
    days.push({ date: key, count: countByDate[key] || 0 });
  }
  return { days: days };
}

// #3 장서 vs 대출 트리맵 — 06_CATEGORIES(활성) × 08_COPIES/10_LOANS. 서명 하나가 여러 카테고리에
// 걸칠 수 있어(07_TITLE_CATEGORIES) 트리맵 면적이 어긋나지 않도록 서명당 "대표 카테고리" 하나만
// 고른다(is_primary 우선, 없으면 처음 매핑된 카테고리 — docs/ASSUMPTIONS.md todo/06).
function computeCategoryTreemapViz_() {
  var categories = readTable_(LIBRARY_MVP.SHEETS.CATEGORIES).rows.filter(function(row) {
    return row.status_code === 'ACTIVE';
  });
  var categoryById = indexBy_(categories, 'category_id');
  var primaryCategoryByTitle = {};
  readTable_(LIBRARY_MVP.SHEETS.TITLE_CATEGORIES).rows.forEach(function(row) {
    if (!categoryById[row.category_id]) return; // 비활성 카테고리는 트리맵에서 제외
    if (primaryCategoryByTitle[row.title_id] === undefined || truthy_(row.is_primary)) {
      primaryCategoryByTitle[row.title_id] = row.category_id;
    }
  });

  var copies = readTable_(LIBRARY_MVP.SHEETS.COPIES).rows.filter(function(row) { return row.status_code !== 'WITHDRAWN'; });
  var copyById = indexBy_(copies, 'copy_id');

  var copyCountByCategory = {};
  copies.forEach(function(copy) {
    var categoryId = primaryCategoryByTitle[copy.title_id];
    if (categoryId) copyCountByCategory[categoryId] = (copyCountByCategory[categoryId] || 0) + 1;
  });

  var loanCountByCategory = {};
  readTable_(LIBRARY_MVP.SHEETS.LOANS).rows.forEach(function(loan) {
    var copy = copyById[loan.copy_id];
    var categoryId = copy && primaryCategoryByTitle[copy.title_id];
    if (categoryId) loanCountByCategory[categoryId] = (loanCountByCategory[categoryId] || 0) + 1;
  });

  return {
    categories: categories.map(function(cat) {
      return {
        categoryCode: cat.category_code || cat.category_id,
        categoryLabel: cat.name_ko || cat.category_code || cat.category_id,
        copyCount: copyCountByCategory[cat.category_id] || 0,
        loanCount: loanCountByCategory[cat.category_id] || 0
      };
    }).sort(function(a, b) { return b.copyCount - a.copyCount; })
  };
}

// #6 회전율 사분면 — 소장본별 대출횟수 × 입수경과. 5,000권 규모면 소장본 하나당 점 하나를
// 셀에 그대로 담는 게 GAS 셀 용량(~50KB)을 위협할 수 있어(docs/ASSUMPTIONS.md todo/06),
// (대출횟수 버킷 6단) × (경과일 버킷 5단) = 최대 30칸의 히스토그램 그리드로 집계한다 —
// 소장본 수와 무관하게 항상 작다. 프론트는 각 칸을 버킷 중심 좌표의 점(크기=count)으로 그린다.
var VIZ_TURNOVER_LOAN_BUCKETS_ = [
  { label: '0회', max: 0 },
  { label: '1회', max: 1 },
  { label: '2회', max: 2 },
  { label: '3~5회', max: 5 },
  { label: '6~10회', max: 10 },
  { label: '11회+', max: Infinity }
];
var VIZ_TURNOVER_AGE_BUCKETS_DAYS_ = [
  { label: '90일 미만', max: 90 },
  { label: '90일~1년', max: 365 },
  { label: '1~2년', max: 730 },
  { label: '2~4년', max: 1460 },
  { label: '4년 이상', max: Infinity }
];

function vizBucketIndex_(value, buckets) {
  for (var i = 0; i < buckets.length; i++) {
    if (value <= buckets[i].max) return i;
  }
  return buckets.length - 1;
}

function computeTurnoverQuadrantViz_(now) {
  var copies = readTable_(LIBRARY_MVP.SHEETS.COPIES).rows.filter(function(row) {
    return row.status_code === 'AVAILABLE' || row.status_code === 'ON_LOAN' || row.status_code === 'HOLD_READY' || row.status_code === 'REPAIR';
  });
  var loanCountByCopy = {};
  readTable_(LIBRARY_MVP.SHEETS.LOANS).rows.forEach(function(loan) {
    loanCountByCopy[loan.copy_id] = (loanCountByCopy[loan.copy_id] || 0) + 1;
  });

  var grid = {};
  var skippedNoAcquiredDate = 0;
  copies.forEach(function(copy) {
    var acquired = asDate_(copy.acquired_at);
    if (!acquired) { skippedNoAcquiredDate++; return; }
    var ageDays = Math.max(0, Math.floor((now.getTime() - acquired.getTime()) / 86400000));
    var loanCount = loanCountByCopy[copy.copy_id] || 0;
    var key = vizBucketIndex_(loanCount, VIZ_TURNOVER_LOAN_BUCKETS_) + '-' + vizBucketIndex_(ageDays, VIZ_TURNOVER_AGE_BUCKETS_DAYS_);
    grid[key] = (grid[key] || 0) + 1;
  });

  var cells = Object.keys(grid).map(function(key) {
    var parts = key.split('-');
    return { loanBucketIndex: Number(parts[0]), ageBucketIndex: Number(parts[1]), count: grid[key] };
  });

  return {
    loanBuckets: VIZ_TURNOVER_LOAN_BUCKETS_.map(function(b) { return b.label; }),
    ageBuckets: VIZ_TURNOVER_AGE_BUCKETS_DAYS_.map(function(b) { return b.label; }),
    cells: cells,
    totalCopies: copies.length,
    skippedNoAcquiredDate: skippedNoAcquiredDate
  };
}

// #7 예약 압력 — 현재 대기열(WAITING·READY)이 있는 서명만 추린 뒤, 최근 6주를 7일 단위
// 창으로 나눠 그 서명에 새로 걸린 예약 건수 추이(스파크라인 원재료)를 함께 담는다.
var VIZ_RESERVATION_TREND_WINDOWS_ = 6;
var VIZ_RESERVATION_TREND_WINDOW_DAYS_ = 7;
var VIZ_RESERVATION_MAX_TITLES_ = 50;

function computeReservationPressureViz_(now) {
  var reservations = readTable_(LIBRARY_MVP.SHEETS.RESERVATIONS).rows;
  var queueLengthByTitle = {};
  reservations.forEach(function(row) {
    if (row.status_code !== 'WAITING' && row.status_code !== 'READY') return;
    queueLengthByTitle[row.title_id] = (queueLengthByTitle[row.title_id] || 0) + 1;
  });

  var windowMs = VIZ_RESERVATION_TREND_WINDOW_DAYS_ * 86400000;
  var horizonStart = now.getTime() - VIZ_RESERVATION_TREND_WINDOWS_ * windowMs;
  var trendByTitle = {};
  reservations.forEach(function(row) {
    if (!queueLengthByTitle[row.title_id]) return;
    var requested = asDate_(row.requested_at);
    if (!requested || requested.getTime() < horizonStart) return;
    var windowIndex = Math.min(VIZ_RESERVATION_TREND_WINDOWS_ - 1, Math.floor((requested.getTime() - horizonStart) / windowMs));
    if (!trendByTitle[row.title_id]) trendByTitle[row.title_id] = new Array(VIZ_RESERVATION_TREND_WINDOWS_).fill(0);
    trendByTitle[row.title_id][windowIndex]++;
  });

  var titleById = indexBy_(readTable_(LIBRARY_MVP.SHEETS.TITLES).rows, 'title_id');
  var titles = Object.keys(queueLengthByTitle).map(function(titleId) {
    return {
      titleId: titleId,
      title: (titleById[titleId] || {}).title || titleId,
      queueLength: queueLengthByTitle[titleId],
      trend: trendByTitle[titleId] || new Array(VIZ_RESERVATION_TREND_WINDOWS_).fill(0)
    };
  }).sort(function(a, b) { return b.queueLength - a.queueLength; }).slice(0, VIZ_RESERVATION_MAX_TITLES_);

  return { titles: titles };
}

// #2 하루의 파도 — LOANS.checked_out_at의 시각(0~23시)별 분포. computeLoanHeatmapViz_의 365일
// 창(연간 계절성 관찰용)과 달리, 이 차트가 답하는 질문("점심 피크 — 스테이션·도우미 배치 근거")은
// "지금 이 학기 운영에 필요한 인력 배치"라 방학처럼 패턴이 전혀 다른 옛 데이터가 섞이면 피크가
// 흐려진다 — reportNoLoanFinder_(todo/05)가 이미 쓰는 "최근 90일" 창을 그대로 재사용해(새 기간
// 정의를 또 만들지 않음) "요즘 어떻게 붐비나"를 반영한다(docs/ASSUMPTIONS.md todo/18). 시각(hour)은
// 스크립트 런타임 시간대가 아니라 항상 LIBRARY_MVP.TIMEZONE 기준으로 뽑는다(formatDate_/
// formatDateTime_과 같은 관례 — Utilities.formatDate에 시간대를 명시).
var VIZ_TIME_OF_DAY_WINDOW_DAYS_ = 90;

function computeLoanTimeOfDayViz_(now) {
  var since = addDays_(now, -VIZ_TIME_OF_DAY_WINDOW_DAYS_);
  var countByHour = new Array(24).fill(0);
  readTable_(LIBRARY_MVP.SHEETS.LOANS).rows.forEach(function(loan) {
    var checkedOut = asDate_(loan.checked_out_at);
    if (!checkedOut || checkedOut.getTime() < since.getTime()) return;
    var hour = Number(Utilities.formatDate(checkedOut, LIBRARY_MVP.TIMEZONE, 'H'));
    countByHour[hour]++;
  });
  return { hours: countByHour.map(function(count, hour) { return { hour: hour, count: count }; }) };
}

// #8 연체 흐름 — LOANS의 연체 "발생"·"해소"를 각각 due_at·returned_at 기준 주간 버킷으로 센다.
//
// 발생(occurred) = due_at이 그 주에 속하고, 이미 지난 날짜(due_at < now, 과거에 실제로 연체로
// 넘어갈 수 있었던 대출만)이며, 아직 안 돌아왔거나(returned_at 없음 = 지금도 연체 중) 늦게
// 돌아왔다(returned_at > due_at) — due_at 기준이라 계산 시점과 무관하게 고정되는 사건이다.
// 해소(resolved) = returned_at이 그 주에 속하고 returned_at > due_at인 경우만(제때 반납은 애초에
// 연체였던 적이 없으므로 "해소"로 세지 않는다) — returned_at 기준으로 고정되는 사건.
// 같은 대출 하나가 발생 주 하나 + (반납되면) 해소 주 하나를 낼 수 있고 두 주가 다를 수 있다 —
// 그 간격이 벌어지는지 좁혀지는지가 "정책(정지 배수)이 듣고 있나"에 대한 답이다.
//
// 창은 12주(≈1분기)로 잡았다 — computeReservationPressureViz_의 6주(스파크라인 원재료, 그냥
// "최근 추이 몇 점"이면 충분)보다 길게 잡은 이유는 이 차트는 "추세가 꺾였는가"를 판단해야 해서다
// (VIZ.md는 정확한 주 수를 명시하지 않아 임의 지정, docs/ASSUMPTIONS.md todo/18).
var VIZ_OVERDUE_FLOW_WEEKS_ = 12;
var VIZ_OVERDUE_FLOW_WEEK_DAYS_ = 7;

function computeOverdueFlowViz_(now) {
  var windowMs = VIZ_OVERDUE_FLOW_WEEK_DAYS_ * 86400000;
  var horizonStart = now.getTime() - VIZ_OVERDUE_FLOW_WEEKS_ * windowMs;
  var nowMs = now.getTime();
  var occurred = new Array(VIZ_OVERDUE_FLOW_WEEKS_).fill(0);
  var resolved = new Array(VIZ_OVERDUE_FLOW_WEEKS_).fill(0);

  function weekIndexOf(timeMs) {
    if (timeMs < horizonStart || timeMs > nowMs) return -1;
    return Math.min(VIZ_OVERDUE_FLOW_WEEKS_ - 1, Math.floor((timeMs - horizonStart) / windowMs));
  }

  readTable_(LIBRARY_MVP.SHEETS.LOANS).rows.forEach(function(loan) {
    var due = asDate_(loan.due_at);
    var returned = asDate_(loan.returned_at);
    if (due && due.getTime() < nowMs) {
      var wentOverdue = !returned || returned.getTime() > due.getTime();
      if (wentOverdue) {
        var occurredIdx = weekIndexOf(due.getTime());
        if (occurredIdx >= 0) occurred[occurredIdx]++;
      }
    }
    if (due && returned && returned.getTime() > due.getTime()) {
      var resolvedIdx = weekIndexOf(returned.getTime());
      if (resolvedIdx >= 0) resolved[resolvedIdx]++;
    }
  });

  var weeks = [];
  for (var i = 0; i < VIZ_OVERDUE_FLOW_WEEKS_; i++) {
    weeks.push({
      weekStart: formatDate_(new Date(horizonStart + i * windowMs)),
      occurredCount: occurred[i],
      resolvedCount: resolved[i]
    });
  }
  return { weeks: weeks };
}

// #10 반 참여 링 — 09_MEMBERS(STUDENT·ACTIVE)를 반(grade+class_no)별로 묶어 "최근 N일 무대출
// 비율"을 낸다. 창은 reportNoLoanFinder_(todo/05)가 이미 쓰는 "최근 90일" 기본값을 그대로
// 재사용했다 — 정확히 같은 질문("누가 최근에 안 빌렸나")을 반 단위로 다시 묻는 것뿐이라 별도
// 기간 정의를 또 만들 이유가 없다(docs/ASSUMPTIONS.md todo/18).
//
// noLoanRatio = 무대출 학생 수 / 반 학생 수(0~1) — VIZ.md 원문 "반별 미대출 비율" 그 축 이름과
// 방향을 그대로 유지한다: 값이 높을수록 그 반의 "참여가 낮다"는 뜻이다. 프론트
// (ClassParticipation.tsx)는 링을 채울 때 participationRatio = 1 - noLoanRatio로 뒤집어 쓴다 —
// 링이 꽉 찰수록 "잘 빌리는 반"으로 직관적으로 읽히게 하려는 화면 쪽 선택일 뿐, 서버가 내려주는
// 원 지표 자체는 VIZ.md가 명시한 이름·방향 그대로 유지해 둘의 관계가 나중에 헷갈리지 않게 했다.
var VIZ_CLASS_PARTICIPATION_WINDOW_DAYS_ = 90;

function computeClassParticipationViz_(now) {
  var since = addDays_(now, -VIZ_CLASS_PARTICIPATION_WINDOW_DAYS_);
  var members = readTable_(LIBRARY_MVP.SHEETS.MEMBERS).rows.filter(function(row) {
    return row.member_type_code === 'STUDENT' && row.status_code === 'ACTIVE';
  });
  var loanedMemberIds = {};
  readTable_(LIBRARY_MVP.SHEETS.LOANS).rows.forEach(function(loan) {
    var checkedOut = asDate_(loan.checked_out_at);
    if (checkedOut && checkedOut.getTime() >= since.getTime()) loanedMemberIds[loan.member_id] = true;
  });

  var classesByKey = {};
  members.forEach(function(m) {
    var grade = Number(m.grade) || 0;
    var classNo = Number(m.class_no) || 0;
    var key = grade + '-' + classNo;
    if (!classesByKey[key]) classesByKey[key] = { grade: grade, classNo: classNo, studentCount: 0, noLoanCount: 0 };
    classesByKey[key].studentCount++;
    if (!loanedMemberIds[m.member_id]) classesByKey[key].noLoanCount++;
  });

  var classes = Object.keys(classesByKey).map(function(key) {
    var cls = classesByKey[key];
    return {
      grade: cls.grade,
      classNo: cls.classNo,
      studentCount: cls.studentCount,
      noLoanCount: cls.noLoanCount,
      noLoanRatio: cls.studentCount > 0 ? cls.noLoanCount / cls.studentCount : 0
    };
  }).sort(function(a, b) { return a.grade - b.grade || a.classNo - b.classNo; });

  return { sinceDate: formatDate_(since), classes: classes };
}

// #12 열두 달 곡선 — LOANS.checked_out_at를 (연도, 월)로 묶어 프론트가 Jan~Dec 공통 축에 여러
// 해를 겹쳐 그리게 한다. computeLoanHeatmapViz_와 같은 이유로(연도 아카이브 시트가 아직 없음 —
// docs/ASSUMPTIONS.md todo/06) 살아있는 10_LOANS 한 시트만 훑되, 연도 자체는 "현재 연도 포함
// 최근 4개년"으로 상한을 둔다 — 겹쳐 그리는 라인이 그보다 많아지면 "방학 골짜기·개학 산"의 대비가
// 오히려 흐려진다(VIZ.md는 "다년 겹침"이라고만 하고 몇 년인지 명시하지 않아 임의 지정,
// docs/ASSUMPTIONS.md todo/18). 대출 기록이 전혀 없는 연도는 결과 배열에서 빼(빈 0라인을 그리지
// 않는다). 연·월 추출은 스크립트 런타임 시간대가 아니라 formatDate_(TIMEZONE 고정)의 문자열을
// 그대로 슬라이스한다 — reportHomeroomClass_가 이미 쓰는 것과 같은 관례.
var VIZ_MONTHLY_CURVE_MAX_YEARS_ = 4;

function computeMonthlyLoanCurveViz_(now) {
  var currentYear = Number(formatDate_(now).slice(0, 4));
  var minYear = currentYear - (VIZ_MONTHLY_CURVE_MAX_YEARS_ - 1);
  var countByYearMonth = {};
  readTable_(LIBRARY_MVP.SHEETS.LOANS).rows.forEach(function(loan) {
    var checkedOut = asDate_(loan.checked_out_at);
    if (!checkedOut) return;
    var dateKey = formatDate_(checkedOut); // yyyy-MM-dd, TZ-safe
    var year = Number(dateKey.slice(0, 4));
    if (year < minYear || year > currentYear) return;
    var month = Number(dateKey.slice(5, 7)) - 1; // 0-11
    var key = year + '-' + month;
    countByYearMonth[key] = (countByYearMonth[key] || 0) + 1;
  });

  var years = [];
  for (var y = minYear; y <= currentYear; y++) {
    var months = [];
    var hasAny = false;
    for (var m = 0; m < 12; m++) {
      var count = countByYearMonth[y + '-' + m] || 0;
      if (count > 0) hasAny = true;
      months.push(count);
    }
    if (hasAny) years.push({ year: y, months: months });
  }
  return { years: years };
}

// todo/19 — VIZ.md V1 3차(마지막): #4 서가 온도·#5 장서 나이·#9 학년 독서 격차·#11 예산 그림.
// 아래 4개 함수는 todo/06·todo/18과 같은 관례(readTable_/indexBy_/asDate_/formatDate_ 재사용,
// 한 번의 순회로 인덱싱해 O(n²) 회피, 이미 있는 시간창·버킷 헬퍼 재사용)를 그대로 따른다.

// #4 서가 온도 — COPIES.shelf_code별 대출횟수 집계 → "재배가 근거 — 죽은 구역". 소장본이 그
// 서가를 지금 점유하고 있다고 셀 기준은 회전율 사분면(computeTurnoverQuadrantViz_)이 이미 쓰는
// 것과 똑같은 상태 집합(AVAILABLE/ON_LOAN/HOLD_READY/REPAIR — 이미 폐기·분실된 소장본은 더는
// 어느 서가도 점유하지 않으므로 제외)을 그대로 재사용한다 — 같은 질문("이 소장본이 지금 서가
// 배치의 일부인가")을 다른 축으로 다시 묻는 것뿐이라 새 필터를 만들지 않았다.
//
// shelf_code는 acquisition_source처럼 CODEBOOK 코드군이 없는 자유 텍스트다(HEADERS 확인 —
// registerCopy_가 safeText_로만 저장). 물리적 서가 배치 순서(층·구역 접두사 같은 관례)가
// 문서·코드 어디에도 없어(docs/ASSUMPTIONS.md todo/19) 자연수 인식 정렬 대신 plain
// localeCompare(다른 자유 텍스트 정렬에 이미 쓰이는 관례 — reportWeedingRecommend_의
// acquiredAtText.localeCompare, purchaseCandidates의 title.localeCompare와 같은 방식)로
// 사전순 정렬한다. shelf_code가 빈 소장본은 집계에서 빼고 개수만 skippedNoShelf로 내려
// 각주 표시한다(회전율 사분면의 skippedNoAcquiredDate와 같은 관례). "죽은 구역"(회전율이
// 유독 낮은 서가) 판정 자체는 프론트가 avgLoansPerCopy를 상대 비교해 정한다(원 자료는 서버가
// 다 계산해 두고, 어느 정도가 "낮다"인지의 임계값 판단만 화면 쪽 책임 — TurnoverQuadrant.tsx의
// quadrantFor·ClassParticipation.tsx의 levelForRatio와 같은 분업).
function computeShelfHeatmapViz_(now) {
  var copies = readTable_(LIBRARY_MVP.SHEETS.COPIES).rows.filter(function(row) {
    return row.status_code === 'AVAILABLE' || row.status_code === 'ON_LOAN' || row.status_code === 'HOLD_READY' || row.status_code === 'REPAIR';
  });
  var loanCountByCopy = {};
  readTable_(LIBRARY_MVP.SHEETS.LOANS).rows.forEach(function(loan) {
    loanCountByCopy[loan.copy_id] = (loanCountByCopy[loan.copy_id] || 0) + 1;
  });

  var byShelf = {};
  var skippedNoShelf = 0;
  copies.forEach(function(copy) {
    var shelf = cleanText_(copy.shelf_code);
    if (!shelf) { skippedNoShelf++; return; }
    if (!byShelf[shelf]) byShelf[shelf] = { shelfCode: shelf, copyCount: 0, totalLoanCount: 0 };
    byShelf[shelf].copyCount++;
    byShelf[shelf].totalLoanCount += loanCountByCopy[copy.copy_id] || 0;
  });

  var shelves = Object.keys(byShelf).map(function(key) {
    var s = byShelf[key];
    return {
      shelfCode: s.shelfCode,
      copyCount: s.copyCount,
      totalLoanCount: s.totalLoanCount,
      avgLoansPerCopy: s.copyCount > 0 ? s.totalLoanCount / s.copyCount : 0
    };
  }).sort(function(a, b) { return a.shelfCode.localeCompare(b.shelfCode); });

  return { shelves: shelves, skippedNoShelf: skippedNoShelf };
}

// #5 장서 나이 — COPIES.acquired_at을 입수연도로 묶고 status_code로 적층해 "노후 + 아직
// 유통 중"과 "노후 + 이미 폐기·분실 처리됨"을 한눈에 가른다. 상태 6종의 고정 순서는 새로
// 정하지 않고 08_COPIES status_code 데이터 검증 배열(LIBRARY_MVP.VALIDATIONS, 이 파일 위쪽)이
// 이미 쓰는 순서를 그대로 재사용한다 — DESIGN.md 범주(≤6) 고정 팔레트 한도에 정확히 맞는다
// (상태값 자체가 정확히 6종이라 "기타" 버킷이 필요 없다).
//
// "미점검"(VIZ.md 차트 이름 "장서 나이"가 답하는 질문 "노후·미점검 장서 규모"에 명시)은 별도
// 색 계열로 쪼개지 않았다 — 6종 상태 팔레트에 일곱 번째 계열을 얹으면 DESIGN.md 범주 고정
// 한도(≤6)를 넘는다. 대신 최상위 요약 숫자 하나로 함께 내려준다: 현재 유통 중인(AVAILABLE/
// ON_LOAN/HOLD_READY/REPAIR — 이미 폐기·분실로 결론 난 소장본은 "점검"의 의미가 없어 제외)
// 소장본 중 last_inventory_at이 비어 있거나 VIZ_COLLECTION_AGE_STALE_INSPECTION_DAYS_일보다
// 오래된 것의 개수(staleUncheckedCount). 이 임계값(1년)은 VIZ.md·기존 코드 어디에도 정의가
// 없어(todo/14 장서점검은 "언제 점검했는지" 필드만 추가했을 뿐 "얼마나 오래되면 재점검이
// 필요한가" 기준은 정하지 않았다) 이 항목에서 새로 임의 지정한 값이다(docs/ASSUMPTIONS.md
// todo/19).
//
// acquired_at이 비어 있는 소장본은 연도별 적층 집계에서 빼고 개수만 skippedNoAcquiredDate로
// 내려 각주 표시한다(회전율 사분면과 같은 관례) — staleUncheckedCount 집계는 이와 별개로
// acquired_at 유무와 무관하게 포함한다("언제 샀나"가 아니라 "언제 마지막으로 봤나"를 묻는
// 별개의 질문이라서다).
var VIZ_COLLECTION_AGE_STATUS_ORDER_ = ['AVAILABLE', 'ON_LOAN', 'HOLD_READY', 'REPAIR', 'LOST', 'WITHDRAWN'];
var VIZ_COLLECTION_AGE_STALE_INSPECTION_DAYS_ = 365;

function computeCollectionAgeViz_(now) {
  var copies = readTable_(LIBRARY_MVP.SHEETS.COPIES).rows;
  var byYear = {};
  var skippedNoAcquiredDate = 0;

  copies.forEach(function(copy) {
    var acquired = asDate_(copy.acquired_at);
    if (!acquired) { skippedNoAcquiredDate++; return; }
    if (VIZ_COLLECTION_AGE_STATUS_ORDER_.indexOf(copy.status_code) === -1) return; // 방어적 스킵(assertCode_가 이미 막아 실제로는 발생하지 않음)
    var year = Number(formatDate_(acquired).slice(0, 4));
    if (!byYear[year]) {
      byYear[year] = { year: year, statusCounts: {} };
      VIZ_COLLECTION_AGE_STATUS_ORDER_.forEach(function(code) { byYear[year].statusCounts[code] = 0; });
    }
    byYear[year].statusCounts[copy.status_code]++;
  });

  var years = Object.keys(byYear).map(function(key) { return byYear[key]; })
    .sort(function(a, b) { return a.year - b.year; });

  var staleCutoff = addDays_(now, -VIZ_COLLECTION_AGE_STALE_INSPECTION_DAYS_);
  var staleUncheckedCount = 0;
  copies.forEach(function(copy) {
    var circulating = copy.status_code === 'AVAILABLE' || copy.status_code === 'ON_LOAN' || copy.status_code === 'HOLD_READY' || copy.status_code === 'REPAIR';
    if (!circulating) return;
    var lastInventory = asDate_(copy.last_inventory_at);
    if (!lastInventory || lastInventory.getTime() < staleCutoff.getTime()) staleUncheckedCount++;
  });

  return {
    statusOrder: VIZ_COLLECTION_AGE_STATUS_ORDER_,
    years: years,
    skippedNoAcquiredDate: skippedNoAcquiredDate,
    staleInspectionDays: VIZ_COLLECTION_AGE_STALE_INSPECTION_DAYS_,
    staleUncheckedCount: staleUncheckedCount
  };
}

// #9 학년 독서 격차 — LOANS × MEMBERS.grade(STUDENT·ACTIVE)를 학년별 분포 스트립으로 낸다.
// "몇 회 빌렸나"를 4단 버킷(0회·1~3회·4~10회·11회+)으로 나눠 학년마다 학생이 어느 버킷에
// 몰려 있는지 보여준다 — vizBucketIndex_(회전율 사분면이 이미 정의해 둔 버킷 인덱싱 헬퍼, 이
// 파일 위쪽)를 그대로 재사용한다(새 버킷 인덱싱 로직을 또 만들지 않는다).
//
// 창 폭은 reportNoLoanFinder_/computeClassParticipationViz_가 이미 쓰는 "최근 90일"을 그대로
// 재사용하지 않고 180일(약 한 학기)로 새로 잡았다 — "정확히 같은 질문"의 재사용이 아니라고
// 판단했기 때문이다: 반 참여 링은 "요즘 누가 안 빌렸나"라는 순간 스냅샷이지만, "어느 학년이
// 비어 있나"는 학년 전체의 독서 습관 격차라는 더 느린 신호라 90일(한 분기)로는 시험 기간 같은
// 일시적 요철에 너무 민감하게 흔들릴 수 있다고 봤다. VIZ.md는 정확한 기간을 명시하지 않아
// 임의 지정이다(docs/ASSUMPTIONS.md todo/19).
var VIZ_GRADE_READING_GAP_WINDOW_DAYS_ = 180;
var VIZ_GRADE_READING_GAP_BUCKETS_ = [
  { label: '0회', max: 0 },
  { label: '1~3회', max: 3 },
  { label: '4~10회', max: 10 },
  { label: '11회+', max: Infinity }
];

function computeGradeReadingGapViz_(now) {
  var since = addDays_(now, -VIZ_GRADE_READING_GAP_WINDOW_DAYS_);
  var members = readTable_(LIBRARY_MVP.SHEETS.MEMBERS).rows.filter(function(row) {
    return row.member_type_code === 'STUDENT' && row.status_code === 'ACTIVE';
  });

  var loanCountByMember = {};
  readTable_(LIBRARY_MVP.SHEETS.LOANS).rows.forEach(function(loan) {
    var checkedOut = asDate_(loan.checked_out_at);
    if (!checkedOut || checkedOut.getTime() < since.getTime()) return;
    loanCountByMember[loan.member_id] = (loanCountByMember[loan.member_id] || 0) + 1;
  });

  var byGrade = {};
  members.forEach(function(m) {
    var grade = Number(m.grade) || 0;
    if (!byGrade[grade]) byGrade[grade] = { grade: grade, studentCount: 0, bucketCounts: new Array(VIZ_GRADE_READING_GAP_BUCKETS_.length).fill(0) };
    byGrade[grade].studentCount++;
    var loanCount = loanCountByMember[m.member_id] || 0;
    byGrade[grade].bucketCounts[vizBucketIndex_(loanCount, VIZ_GRADE_READING_GAP_BUCKETS_)]++;
  });

  var grades = Object.keys(byGrade).map(function(key) { return byGrade[key]; })
    .sort(function(a, b) { return a.grade - b.grade; });

  return {
    sinceDate: formatDate_(since),
    windowDays: VIZ_GRADE_READING_GAP_WINDOW_DAYS_,
    buckets: VIZ_GRADE_READING_GAP_BUCKETS_.map(function(b) { return b.label; }),
    grades: grades
  };
}

// #11 예산 그림 — COPIES.price를 acquisition_source별로 누적하고 acquired_at 연도로 나눠
// "적층 영역"(연도 × 출처)으로 낸다. 예산 증빙 성격이라 상태 필터를 두지 않는다(이미
// 폐기·분실된 소장본도 "그때 그 돈을 썼다"는 사실은 그대로다) — reportDonorThanks_(todo/09)와
// 정확히 같은 이유로 같은 전제를 따른다.
//
// 출처 버킷 = reportDonorThanks_가 이미 확립한 자유 텍스트 그룹 키(acquisition_source 원문
// 문자열, CODEBOOK 코드군 없음)를 그대로 재사용한다 — 새 분류 체계를 만들지 않는다. 다만
// reportDonorThanks_는 그룹을 몇 개든 표로 그대로 나열하지만(리포트는 줄 수 제한이 없다), 이
// 차트는 DESIGN.md 범주(≤6) 고정 팔레트 안에 있어야 해서(적층 영역의 색 계열 수 = 팔레트
// 크기) 누적 금액 상위 VIZ_BUDGET_MAX_SOURCES_개만 개별 계열로 두고 나머지는
// VIZ_BUDGET_OTHER_LABEL_("그 외 출처") 한 계열로 합친다. "기타"라는 문구를 쓰지 않은 이유 —
// acquisition_source가 자유 텍스트라 사서가 실제로 그 칸에 문자 그대로 "기타"를 입력해 뒀을
// 수 있고, 그 값과 이 합산 버킷이 같은 라벨로 뒤섞이면 헷갈린다(docs/ASSUMPTIONS.md todo/19).
//
// 인쇄 파이프라인(todo/24 R3 연간 운영 보고서가 "예산 차트(19) 삽입"을 예고함)에 그대로 꽂을
// 수 있게 페이로드를 "연도별 × 출처별 순수 숫자" 표로 단순하게 유지한다 — 중첩 계산·프론트
// 전용 파생값을 서버가 미리 다 끝내 둔다(정적 인쇄본에서 다시 계산할 게 없다).
var VIZ_BUDGET_MAX_SOURCES_ = 5;
var VIZ_BUDGET_OTHER_LABEL_ = '그 외 출처';

function computeBudgetViz_(now) {
  var copies = readTable_(LIBRARY_MVP.SHEETS.COPIES).rows;

  var totalBySource = {};
  var skippedNoSource = 0;
  copies.forEach(function(copy) {
    var source = cleanText_(copy.acquisition_source);
    if (!source) { skippedNoSource++; return; }
    totalBySource[source] = (totalBySource[source] || 0) + (Number(copy.price) || 0);
  });

  var topSources = Object.keys(totalBySource)
    .sort(function(a, b) { return totalBySource[b] - totalBySource[a] || a.localeCompare(b); })
    .slice(0, VIZ_BUDGET_MAX_SOURCES_);
  var topSourceSet = {};
  topSources.forEach(function(s) { topSourceSet[s] = true; });
  var hasOther = Object.keys(totalBySource).some(function(s) { return !topSourceSet[s]; });
  var sourceOrder = hasOther ? topSources.concat([VIZ_BUDGET_OTHER_LABEL_]) : topSources;

  var byYear = {};
  var skippedNoAcquiredDate = 0;
  copies.forEach(function(copy) {
    var acquired = asDate_(copy.acquired_at);
    if (!acquired) { skippedNoAcquiredDate++; return; }
    var source = cleanText_(copy.acquisition_source);
    if (!source) return; // skippedNoSource에서 이미 셈 — 연도×출처 적층에서도 동일하게 제외
    var bucketLabel = topSourceSet[source] ? source : VIZ_BUDGET_OTHER_LABEL_;
    var year = Number(formatDate_(acquired).slice(0, 4));
    if (!byYear[year]) {
      byYear[year] = { year: year, amountBySource: {}, total: 0 };
      sourceOrder.forEach(function(s) { byYear[year].amountBySource[s] = 0; });
    }
    var price = Number(copy.price) || 0;
    byYear[year].amountBySource[bucketLabel] += price;
    byYear[year].total += price;
  });

  var years = Object.keys(byYear).map(function(key) {
    var y = byYear[key];
    return {
      year: y.year,
      total: y.total,
      sources: sourceOrder.map(function(s) { return { sourceLabel: s, amount: y.amountBySource[s] }; })
    };
  }).sort(function(a, b) { return a.year - b.year; });

  return {
    sourceOrder: sourceOrder,
    years: years,
    skippedNoSource: skippedNoSource,
    skippedNoAcquiredDate: skippedNoAcquiredDate
  };
}

// --------------------------- Repository and common helpers ---------------------------

function getSpreadsheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) fail_('NO_ACTIVE_SPREADSHEET', '활성 스프레드시트를 찾을 수 없습니다. 바인딩된 스크립트로 실행하세요.');
  return ss;
}

function getRequiredSheet_(name) {
  var sheet = getSpreadsheet_().getSheetByName(name);
  if (!sheet) fail_('SCHEMA_MISMATCH', '필수 시트가 없습니다: ' + name);
  return sheet;
}

function ensureSheetRows_(sheet, requiredRows) {
  var currentRows = sheet.getMaxRows();
  if (currentRows < requiredRows) sheet.insertRowsAfter(currentRows, requiredRows - currentRows);
}

var TABLE_CACHE_ = {};
function invalidateTableCache_(sheetName) {
  if (sheetName) delete TABLE_CACHE_[sheetName];
  else TABLE_CACHE_ = {};
}

function readTable_(sheetName) {
  if (TABLE_CACHE_[sheetName]) return TABLE_CACHE_[sheetName];
  var sheet = getRequiredSheet_(sheetName);
  var lastColumn = sheet.getLastColumn();
  if (lastColumn < 1) fail_('SCHEMA_MISMATCH', sheetName + '에 헤더가 없습니다.');
  var headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].map(function(value) { return cleanText_(value); });
  var requiredHeaders = LIBRARY_MVP.HEADERS[sheetName] || [];
  var missing = requiredHeaders.filter(function(header) { return headers.indexOf(header) === -1; });
  if (missing.length) fail_('SCHEMA_MISMATCH', sheetName + ' 헤더 누락: ' + missing.join(', '));
  var index = {};
  headers.forEach(function(header, i) { if (header) index[header] = i; });
  var lastRow = sheet.getLastRow();
  var rows = [];
  if (lastRow > 1) {
    var values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
    rows = values.map(function(row, offset) {
      var object = { _row: offset + 2 };
      headers.forEach(function(header, i) { if (header) object[header] = row[i]; });
      return object;
    }).filter(function(object) {
      return headers.some(function(header) { return header && object[header] !== '' && object[header] !== null; });
    });
  }
  var table = { sheet: sheet, headers: headers, index: index, rows: rows };
  TABLE_CACHE_[sheetName] = table;
  return table;
}

function appendRecord_(sheetName, record) {
  var table = readTable_(sheetName);
  var now = new Date();
  if (table.index.created_at !== undefined && record.created_at === undefined) record.created_at = now;
  if (table.index.updated_at !== undefined && record.updated_at === undefined) record.updated_at = now;
  if (table.index.row_version !== undefined && record.row_version === undefined) record.row_version = 1;
  var values = table.headers.map(function(header) { return escapeCellValue_(record[header] === undefined ? '' : record[header]); });
  var row = Math.max(2, table.sheet.getLastRow() + 1);
  ensureSheetRows_(table.sheet, row);
  applyDataValidationsForRow_(table, row);
  table.sheet.getRange(row, 1, 1, table.headers.length).setValues([values]);
  invalidateTableCache_(sheetName);
  var inserted = { _row: row };
  table.headers.forEach(function(header, index) { if (header) inserted[header] = values[index]; });
  return inserted;
}

function transactionAppendRecord_(transaction, sheetName, record) {
  var inserted = appendRecord_(sheetName, record);
  if (transaction) {
    var sheet = getRequiredSheet_(sheetName);
    var columnCount = readTable_(sheetName).headers.length;
    transaction.record(function() {
      sheet.getRange(inserted._row, 1, 1, columnCount).clearContent();
      invalidateTableCache_(sheetName);
    });
  }
  return inserted;
}

function updateRecord_(sheetName, idField, idValue, patch, actorId) {
  var table = readTable_(sheetName);
  var row = table.rows.find(function(item) { return String(item[idField]) === String(idValue); });
  if (!row) fail_('NOT_FOUND', sheetName + '에서 ' + idValue + '을(를) 찾을 수 없습니다.');
  return updateKnownRow_(table, row, patch, actorId);
}

function transactionUpdateRecord_(transaction, sheetName, idField, idValue, patch, actorId) {
  if (!transaction) return updateRecord_(sheetName, idField, idValue, patch, actorId);
  var table = readTable_(sheetName);
  var row = table.rows.find(function(item) { return String(item[idField]) === String(idValue); });
  if (!row) fail_('NOT_FOUND', sheetName + '에서 ' + idValue + '을(를) 찾을 수 없습니다.');
  var range = table.sheet.getRange(row._row, 1, 1, table.headers.length);
  var values = range.getValues()[0];
  var formulas = range.getFormulas()[0];
  transaction.record(function() {
    var restored = values.map(function(value, index) { return formulas[index] || value; });
    table.sheet.getRange(row._row, 1, 1, table.headers.length).setValues([restored]);
    invalidateTableCache_(sheetName);
  });
  return updateKnownRow_(table, row, patch, actorId);
}

function updateKnownRow_(table, row, patch, actorId) {
  var next = {};
  table.headers.forEach(function(header) { if (header) next[header] = row[header]; });
  Object.keys(patch || {}).forEach(function(key) {
    if (table.index[key] === undefined) fail_('SCHEMA_MISMATCH', table.sheet.getName() + '에 열이 없습니다: ' + key);
    next[key] = patch[key];
  });
  if (table.index.updated_at !== undefined) next.updated_at = new Date();
  if (table.index.updated_by !== undefined) next.updated_by = actorId || getActor_().id;
  if (table.index.row_version !== undefined) next.row_version = Number(row.row_version || 0) + 1;
  var changedFields = {};
  Object.keys(patch || {}).forEach(function(key) { changedFields[key] = next[key]; });
  if (table.index.updated_at !== undefined) changedFields.updated_at = next.updated_at;
  if (table.index.updated_by !== undefined) changedFields.updated_by = next.updated_by;
  if (table.index.row_version !== undefined) changedFields.row_version = next.row_version;
  Object.keys(changedFields).forEach(function(key) {
    table.sheet.getRange(row._row, table.index[key] + 1).setValue(escapeCellValue_(changedFields[key]));
  });
  invalidateTableCache_(table.sheet.getName());
  next._row = row._row;
  return next;
}

function findByIdRequired_(sheetName, idField, idValue, label) {
  var row = readTable_(sheetName).rows.find(function(item) { return String(item[idField]) === String(idValue); });
  if (!row) fail_('NOT_FOUND', (label || sheetName) + '을(를) 찾을 수 없습니다: ' + idValue);
  return row;
}

function findMemberByKey_(key) {
  var normalized = cleanCode_(key);
  var member = readTable_(LIBRARY_MVP.SHEETS.MEMBERS).rows.find(function(row) {
    return cleanCode_(row.member_no) === normalized || cleanCode_(row.member_id) === normalized;
  });
  if (!member) fail_('MEMBER_NOT_FOUND', '회원을 찾을 수 없습니다: ' + key);
  return member;
}

function findCopyByKey_(key) {
  var normalized = cleanCode_(key);
  var copy = readTable_(LIBRARY_MVP.SHEETS.COPIES).rows.find(function(row) {
    return cleanCode_(row.barcode) === normalized || cleanCode_(row.copy_id) === normalized;
  });
  if (!copy) fail_('COPY_NOT_FOUND', '소장본을 찾을 수 없습니다: ' + key);
  return copy;
}

function findTitleByKey_(key) {
  var normalized = cleanCode_(key);
  var isbn = normalizeIsbnLoose_(key);
  var normalizedText = normalizeText_(key);
  var matches = readTable_(LIBRARY_MVP.SHEETS.TITLES).rows.filter(function(row) {
    return cleanCode_(row.title_id) === normalized || (isbn && normalizeIsbnLoose_(row.isbn13) === isbn) || normalizeText_(row.title) === normalizedText;
  });
  if (!matches.length) fail_('TITLE_NOT_FOUND', '도서를 찾을 수 없습니다: ' + key);
  if (matches.length > 1) fail_('AMBIGUOUS_TITLE', '같은 제목이 여러 건입니다. title_id 또는 ISBN을 사용하세요.');
  return matches[0];
}

function findPolicy_(memberType, materialType) {
  var now = new Date();
  var policies = readTable_(LIBRARY_MVP.SHEETS.POLICIES).rows.filter(function(row) {
    if (row.status_code !== 'ACTIVE') return false;
    var from = asDate_(row.active_from); var to = asDate_(row.active_to);
    return (!from || from.getTime() <= now.getTime()) && (!to || to.getTime() >= now.getTime());
  });
  var exact = policies.find(function(row) { return row.member_type_code === memberType && row.material_type_code === materialType; });
  if (exact) return exact;
  var defaultId = getConfig_('DEFAULT_POLICY_ID', 'POL-DEFAULT');
  var fallback = policies.find(function(row) { return row.policy_id === defaultId; });
  if (!fallback) fail_('POLICY_NOT_FOUND', '적용할 대출 정책을 찾을 수 없습니다.');
  return fallback;
}

function validateMemberForCirculation_(member) {
  if (member.status_code !== 'ACTIVE') fail_('MEMBER_INACTIVE', '활성 회원만 이용할 수 있습니다: ' + member.status_code);
  var expires = asDate_(member.expires_at);
  if (expires && expires.getTime() < Date.now()) fail_('MEMBER_EXPIRED', '회원 유효기간이 만료되었습니다.');
  var suspended = asDate_(member.suspended_until);
  if (suspended && suspended.getTime() >= Date.now()) {
    fail_('MEMBER_SUSPENDED', formatDate_(suspended) + '까지 대출 정지 중입니다' + (cleanText_(member.suspend_reason) ? ' (' + member.suspend_reason + ')' : '') + '.');
  }
}

function executeWrite_(operationType, payload, callback) {
  payload = payload || {};
  var requestId = cleanCode_(payload.requestId || newId_('REQ'));
  validateCodeInput_(requestId, '요청 ID');
  return withWriteLock_(function() {
    var actor = getActor_();
    requireRole_(actor, ['ADMIN', 'LIBRARIAN']);
    var operations = readTable_(LIBRARY_MVP.SHEETS.OPERATIONS).rows;
    var existing = operations.find(function(row) { return cleanCode_(row.request_id) === requestId; });
    var payloadHash = hashPayload_(payload);
    if (existing && (existing.operation_type !== operationType || existing.payload_hash !== payloadHash)) {
      fail_('REQUEST_ID_CONFLICT', '같은 요청 ID가 다른 작업 또는 입력값에 이미 사용되었습니다.');
    }
    if (existing && existing.status_code === 'COMPLETED') {
      return { targetType: existing.target_type, targetId: existing.target_id, requestId: requestId, idempotent: true, message: '이미 완료된 요청입니다.' };
    }
    if (existing && existing.status_code === 'STARTED') {
      var startedAt = asDate_(existing.started_at);
      if (!startedAt || Date.now() - startedAt.getTime() < 10 * 60 * 1000) fail_('DUPLICATE_REQUEST', '같은 요청이 처리 중입니다. 잠시 후 다시 확인하세요.');
      updateRecord_(LIBRARY_MVP.SHEETS.OPERATIONS, 'request_id', requestId, { status_code: 'FAILED', completed_at: new Date(), error_code: 'STALE_OPERATION', error_message: '10분 이상 완료되지 않아 중단 상태로 전환됨' }, actor.id);
      fail_('STALE_OPERATION', '이전 요청이 중간 실패했을 수 있습니다. 무결성 점검 후 새 요청으로 다시 실행하세요.');
    }
    if (existing && existing.status_code === 'FAILED') fail_('FAILED_REQUEST_REQUIRES_REVIEW', '이 요청은 이전에 실패했습니다. 무결성 점검 후 새 요청 ID로 실행하세요.');
    if (!existing) {
      appendRecord_(LIBRARY_MVP.SHEETS.OPERATIONS, {
        request_id: requestId, operation_type: operationType, status_code: 'STARTED', target_type: '', target_id: '',
        payload_hash: payloadHash, started_at: new Date(), completed_at: '', actor_id: actor.id, error_code: '', error_message: ''
      });
    } else {
      updateRecord_(LIBRARY_MVP.SHEETS.OPERATIONS, 'request_id', requestId, { status_code: 'STARTED', started_at: new Date(), completed_at: '', error_code: '', error_message: '' }, actor.id);
    }
    var transaction = createCompensationContext_();
    try {
      var result = callback(actor, requestId, transaction) || {};
      updateRecord_(LIBRARY_MVP.SHEETS.OPERATIONS, 'request_id', requestId, {
        status_code: 'COMPLETED', target_type: result.targetType || '', target_id: result.targetId || '', completed_at: new Date()
      }, actor.id);
      SpreadsheetApp.flush();
      transaction.commit();
      result.requestId = requestId;
      return result;
    } catch (error) {
      var rollbackError = transaction.rollback();
      var originalErrorCode = error.code || 'UNEXPECTED_ERROR';
      try {
        updateRecord_(LIBRARY_MVP.SHEETS.OPERATIONS, 'request_id', requestId, {
          status_code: 'FAILED', completed_at: new Date(), error_code: rollbackError ? 'ROLLBACK_FAILED' : originalErrorCode,
          error_message: (String(error.message || error) + (rollbackError ? ' | 원복 실패: ' + rollbackError : '')).slice(0, 500)
        }, actor.id);
        appendRecord_(LIBRARY_MVP.SHEETS.AUDIT, {
          log_id: newId_('LOG'), occurred_at: new Date(), actor_id: actor.id, request_id: requestId,
          action_code: 'FAILED', entity_type: 'OPERATION', entity_id: requestId, before_json: '{}',
          after_json: safeJson_({ operation_type: operationType, error_code: originalErrorCode, rolled_back: !rollbackError }),
          summary: safeText_('작업 실패' + (rollbackError ? ' · 자동 원복 확인 필요' : ' · 자동 원복 완료'))
        });
        SpreadsheetApp.flush();
      } catch (logError) {
        console.error(logError);
      }
      if (rollbackError) {
        var rollbackFailure = new Error((error.message || String(error)) + ' | 자동 원복 실패: ' + rollbackError);
        rollbackFailure.code = 'ROLLBACK_FAILED';
        rollbackFailure.details = { originalCode: originalErrorCode, rollbackError: rollbackError };
        throw rollbackFailure;
      }
      throw error;
    }
  });
}

function createCompensationContext_() {
  var undoStack = [];
  var active = true;
  return {
    record: function(undo) {
      if (active && typeof undo === 'function') undoStack.push(undo);
    },
    commit: function() {
      active = false;
      undoStack = [];
    },
    rollback: function() {
      if (!active) return '';
      var failures = [];
      for (var i = undoStack.length - 1; i >= 0; i--) {
        try { undoStack[i](); } catch (rollbackError) { failures.push(String(rollbackError.message || rollbackError)); }
      }
      active = false;
      undoStack = [];
      try { SpreadsheetApp.flush(); } catch (flushError) { failures.push(String(flushError.message || flushError)); }
      return failures.join('; ');
    }
  };
}

function withWriteLock_(callback) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) fail_('BUSY_RETRY', '다른 작업이 처리 중입니다. 잠시 후 다시 시도하세요.');
  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
}

function writeAudit_(actor, requestId, action, entityType, entityId, beforeValue, afterValue, summary, transaction) {
  var record = {
    log_id: newId_('LOG'), occurred_at: new Date(), actor_id: actor.id, request_id: requestId,
    action_code: action, entity_type: entityType, entity_id: entityId,
    before_json: safeJson_(beforeValue), after_json: safeJson_(afterValue), summary: safeText_(summary || '')
  };
  return transaction ? transactionAppendRecord_(transaction, LIBRARY_MVP.SHEETS.AUDIT, record) : appendRecord_(LIBRARY_MVP.SHEETS.AUDIT, record);
}

function enqueueNotification_(member, eventCode, payload, actor, transaction) {
  var recipient = normalizeEmail_(member.email) || normalizePhone_(member.phone);
  if (!recipient) return null;
  var channel = normalizeEmail_(member.email) ? 'EMAIL' : 'SMS';
  var record = {
    notification_id: newId_('NTF'), member_id: member.member_id, event_code: eventCode, channel_code: channel,
    recipient: recipient, template_code: eventCode, payload_json: safeJson_(payload), scheduled_at: new Date(), sent_at: '',
    status_code: 'PENDING', retry_count: 0, last_error: '', created_at: new Date(), created_by: actor.id,
    updated_at: new Date(), updated_by: actor.id, row_version: 1
  };
  return transaction ? transactionAppendRecord_(transaction, LIBRARY_MVP.SHEETS.NOTIFICATIONS, record) : appendRecord_(LIBRARY_MVP.SHEETS.NOTIFICATIONS, record);
}

function ensureCurrentStaff_() {
  return withWriteLock_(function() {
    var email = currentEmail_();
    if (email === 'LOCAL_USER') fail_('USER_IDENTITY_UNAVAILABLE', 'Google 계정 이메일을 확인할 수 없습니다. appsscript.json의 userinfo.email 권한을 적용하고 다시 승인하세요.');
    var rows = readTable_(LIBRARY_MVP.SHEETS.STAFF).rows;
    var existing = rows.find(function(row) { return normalizeEmail_(row.email) === normalizeEmail_(email); });
    var ownerEmail = getSpreadsheetOwnerEmail_();
    var now = new Date();
    if (existing) {
      if (existing.status_code !== 'ACTIVE') fail_('STAFF_INACTIVE', '비활성 직원 계정입니다. 다른 관리자에게 문의하세요.');
      return updateRecord_(LIBRARY_MVP.SHEETS.STAFF, 'staff_id', existing.staff_id, { last_login_at: now }, existing.staff_id);
    }
    if (rows.length && (!ownerEmail || email !== ownerEmail)) {
      fail_('STAFF_NOT_REGISTERED', '등록되지 않은 직원 계정입니다. 기존 ADMIN이 먼저 직원 계정을 등록해야 합니다: ' + email);
    }
    if (!rows.length && ownerEmail && email !== ownerEmail) {
      fail_('FIRST_ADMIN_MUST_BE_OWNER', '개인 소유 스프레드시트의 최초 설정은 파일 소유자가 실행해야 합니다: ' + ownerEmail);
    }
    return appendRecord_(LIBRARY_MVP.SHEETS.STAFF, {
      staff_id: newId_('STF'), email: email, display_name: email === 'LOCAL_USER' ? '로컬 사용자' : email,
      role_code: 'ADMIN', status_code: 'ACTIVE', last_login_at: now,
      created_at: now, created_by: 'SYSTEM', updated_at: now, updated_by: 'SYSTEM', row_version: 1
    });
  });
}

function getActor_() {
  var email = currentEmail_();
  if (email === 'LOCAL_USER') fail_('USER_IDENTITY_UNAVAILABLE', 'Google 계정 이메일을 확인할 수 없습니다. 권한을 다시 승인하세요.');
  var staff = readTable_(LIBRARY_MVP.SHEETS.STAFF).rows.find(function(row) { return normalizeEmail_(row.email) === normalizeEmail_(email); });
  if (!staff) fail_('STAFF_NOT_REGISTERED', '등록되지 않은 직원 계정입니다. ADMIN에게 등록을 요청하세요: ' + email);
  if (staff.status_code !== 'ACTIVE') fail_('STAFF_INACTIVE', '비활성 직원 계정입니다.');
  return { id: staff.staff_id, email: staff.email, displayName: staff.display_name || staff.email, role: staff.role_code };
}

function requireRole_(actor, allowedRoles) {
  if (!actor || allowedRoles.indexOf(actor.role) === -1) fail_('PERMISSION_DENIED', '이 작업에 필요한 권한이 없습니다. 허용 역할: ' + allowedRoles.join(', '));
}

function getActiveAdminEmails_() {
  var emails = [];
  var seen = {};
  readTable_(LIBRARY_MVP.SHEETS.STAFF).rows.forEach(function(row) {
    if (row.role_code !== 'ADMIN' || row.status_code !== 'ACTIVE') return;
    var email = normalizeEmail_(row.email);
    if (!email) fail_('INVALID_ADMIN_EMAIL', '활성 ADMIN의 이메일이 비어 있습니다: ' + row.staff_id);
    validateEmail_(email);
    if (!seen[email]) {
      seen[email] = true;
      emails.push(email);
    }
  });
  if (!emails.length) fail_('NO_ACTIVE_ADMIN', 'DB 시트를 보호할 활성 ADMIN이 없습니다.');
  return emails;
}

function getSpreadsheetOwnerEmail_() {
  var owner = null;
  try {
    owner = getSpreadsheet_().getOwner();
  } catch (error) {
    fail_('OWNER_LOOKUP_FAILED', '스프레드시트 소유자를 확인하지 못해 보호 편집자 동기화를 중단했습니다.', { message: error.message || String(error) });
  }
  if (!owner) return '';
  if (typeof owner.getEmail !== 'function') fail_('OWNER_LOOKUP_FAILED', '스프레드시트 소유자 이메일을 확인할 수 없습니다.');
  var ownerEmail = normalizeEmail_(owner.getEmail());
  if (!ownerEmail) fail_('OWNER_LOOKUP_FAILED', '스프레드시트 소유자 객체는 확인했지만 이메일이 비어 있어 보호 동기화를 중단했습니다.');
  return ownerEmail;
}

function currentEmail_() {
  var email = '';
  try { email = Session.getActiveUser().getEmail(); } catch (ignore1) {}
  if (!email) try { email = Session.getEffectiveUser().getEmail(); } catch (ignore2) {}
  return normalizeEmail_(email) || 'LOCAL_USER';
}

function getConfig_(key, fallback) {
  var row = readTable_(LIBRARY_MVP.SHEETS.CONFIG).rows.find(function(item) { return item.setting_key === key; });
  return row && row.setting_value !== '' ? row.setting_value : fallback;
}

function getCodes_(group) {
  return readTable_(LIBRARY_MVP.SHEETS.CODEBOOK).rows.filter(function(row) {
    return row.code_group === group && row.status_code === 'ACTIVE';
  }).sort(function(a, b) { return Number(a.sort_order || 0) - Number(b.sort_order || 0); }).map(function(row) {
    return { code: row.code, label: row.label_ko || row.code };
  });
}

function assertCode_(group, code) {
  if (!getCodes_(group).some(function(item) { return item.code === code; })) fail_('INVALID_CODE', group + '에 정의되지 않은 코드입니다: ' + code);
}

function nextHumanCode_(propertyKey, prefix, sheetName, fieldName) {
  var properties = PropertiesService.getDocumentProperties();
  var current = Number(properties.getProperty(propertyKey) || 0);
  if (!current) {
    var pattern = new RegExp('^' + escapeRegExp_(prefix) + '-?(\\d+)$', 'i');
    current = readTable_(sheetName).rows.reduce(function(max, row) {
      var match = cleanText_(row[fieldName]).match(pattern);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
  }
  current++;
  properties.setProperty(propertyKey, String(current));
  return cleanCode_(prefix) + '-' + String(current).padStart(6, '0');
}

function luhnCheckDigit_(digits) {
  var sum = 0;
  for (var i = 0; i < digits.length; i++) {
    var d = Number(digits.charAt(digits.length - 1 - i));
    if (i % 2 === 0) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return String((10 - (sum % 10)) % 10);
}

function nextNumericCode_(propertyKey, sheetName, fieldName) {
  var properties = PropertiesService.getDocumentProperties();
  var current = Number(properties.getProperty(propertyKey) || 0);
  if (!current) {
    current = readTable_(sheetName).rows.reduce(function(max, row) {
      var match = cleanText_(row[fieldName]).match(/^(\d{6})\d$/);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
  }
  current++;
  properties.setProperty(propertyKey, String(current));
  var base = String(current).padStart(6, '0');
  return base + luhnCheckDigit_(base);
}

function newId_(prefix) {
  return prefix + '-' + Utilities.getUuid().replace(/-/g, '').slice(0, 16).toUpperCase();
}

function hashPayload_(payload) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(payload || {}), Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(digest).slice(0, 32);
}

function normalizeText_(value) {
  return cleanText_(value).toLowerCase().replace(/\s+/g, ' ');
}

function cleanText_(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function requiredText_(value, label) {
  var text = cleanText_(value);
  if (!text) fail_('VALIDATION_ERROR', label + '은(는) 필수입니다.');
  return text;
}

function safeText_(value) {
  var text = cleanText_(value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function cleanCode_(value) {
  return cleanText_(value).toUpperCase().replace(/\s+/g, '');
}

function normalizePhone_(value) {
  return cleanText_(value).replace(/[^0-9]/g, '');
}

function normalizeEmail_(value) {
  return cleanText_(value).toLowerCase();
}

function validateEmail_(email) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail_('INVALID_EMAIL', '이메일 형식이 올바르지 않습니다.');
}

function validateCodeInput_(value, label) {
  var code = cleanText_(value);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:\/-]{0,99}$/.test(code)) fail_('INVALID_CODE_FORMAT', label + '은(는) 영문, 숫자, 점, 밑줄, 콜론, 슬래시, 하이픈만 사용할 수 있습니다.');
  return code;
}

function escapeCellValue_(value) {
  return typeof value === 'string' && /^[=+\-@]/.test(value) ? "'" + value : value;
}

function normalizeIsbn_(value) {
  var isbn = normalizeIsbnLoose_(value);
  if (isbn && isbn.length !== 10 && isbn.length !== 13) fail_('INVALID_ISBN', 'ISBN은 숫자/X 기준 10자리 또는 13자리여야 합니다.');
  return isbn;
}

function normalizeIsbnLoose_(value) {
  return cleanText_(value).toUpperCase().replace(/[^0-9X]/g, '');
}

function splitList_(value) {
  return cleanText_(value).split(/[,;\n]/).map(function(item) { return item.trim(); }).filter(Boolean);
}

function truthy_(value) {
  if (typeof value === 'boolean') return value;
  return ['TRUE', '1', 'YES', 'Y', 'ON'].indexOf(cleanCode_(value)) !== -1;
}

function numberOrBlank_(value) {
  if (value === '' || value === null || value === undefined) return '';
  var number = Number(value);
  if (!isFinite(number)) fail_('VALIDATION_ERROR', '숫자 형식이 올바르지 않습니다: ' + value);
  return number;
}

function isBlankValue_(value) {
  return value === '' || value === null || value === undefined;
}

function nonNegativeInteger_(value, label) {
  if (isBlankValue_(value) || (typeof value === 'string' && !cleanText_(value))) {
    fail_('VALIDATION_ERROR', (label || '값') + '은(는) 0 이상의 정수여야 합니다.');
  }
  var number = Number(value);
  if (!isFinite(number) || Math.floor(number) !== number || number < 0 || number > 9007199254740991) {
    fail_('VALIDATION_ERROR', (label || '값') + '은(는) 0 이상의 정수여야 합니다.');
  }
  return number;
}

function positiveIntegerOrBlank_(value, label) {
  if (isBlankValue_(value)) return '';
  var number = Number(value);
  if (!isFinite(number) || Math.floor(number) !== number || number <= 0 || number > 9007199254740991) {
    fail_('VALIDATION_ERROR', (label || '값') + '은(는) 비워 두거나 1 이상의 정수여야 합니다.');
  }
  return number;
}

function policyInteger_(value, fallback, label) {
  return nonNegativeInteger_(isBlankValue_(value) ? fallback : value, label || '정책값');
}

function integerOrBlank_(value) {
  var number = numberOrBlank_(value);
  return number === '' ? '' : Math.trunc(number);
}

function parseOptionalDate_(value) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === '[object Date]') return isNaN(value.getTime()) ? null : value;
  var date = new Date(value);
  if (isNaN(date.getTime())) fail_('VALIDATION_ERROR', '날짜 형식이 올바르지 않습니다: ' + value);
  return date;
}

function parseExpiryDate_(value) {
  var date = parseOptionalDate_(value);
  return date ? endOfDay_(date) : null;
}

function asDate_(value) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === '[object Date]') return isNaN(value.getTime()) ? null : value;
  var date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

function addDays_(date, days) {
  var result = new Date(date.getTime());
  result.setDate(result.getDate() + Number(isBlankValue_(days) ? 0 : days));
  return result;
}

function endOfDay_(date) {
  var result = new Date(date.getTime());
  result.setHours(23, 59, 59, 999);
  return result;
}

function formatDate_(value) {
  var date = asDate_(value);
  return date ? Utilities.formatDate(date, LIBRARY_MVP.TIMEZONE, 'yyyy-MM-dd') : '';
}

function formatDateTime_(value) {
  var date = asDate_(value);
  return date ? Utilities.formatDate(date, LIBRARY_MVP.TIMEZONE, 'yyyy-MM-dd HH:mm') : '';
}

function indexBy_(rows, key) {
  return rows.reduce(function(index, row) { if (row[key] !== '' && row[key] !== null) index[row[key]] = row; return index; }, {});
}

function toSet_(rows, key) {
  return rows.reduce(function(set, row) { if (row[key]) set[row[key]] = true; return set; }, {});
}

function reservationSort_(a, b) {
  return Number(a.queue_seq || 0) - Number(b.queue_seq || 0) || (asDate_(a.requested_at) || new Date(0)).getTime() - (asDate_(b.requested_at) || new Date(0)).getTime();
}

function appendNote_(oldNote, newNote) {
  var next = safeText_(newNote || '');
  if (!next) return oldNote || '';
  return [cleanText_(oldNote), '[' + formatDateTime_(new Date()) + '] ' + next].filter(Boolean).join('\n');
}

function safeJson_(value) {
  var text = JSON.stringify(value || {}, function(key, item) {
    if (/phone|email|address|birth/i.test(key) && item) return '[MASKED]';
    return item;
  });
  if (text.length <= 45000) return text;
  return JSON.stringify({ truncated: true, preview: text.slice(0, 44000) });
}

function toClient_(value) {
  return JSON.parse(JSON.stringify(value));
}

function maskPhone_(value) {
  var phone = normalizePhone_(value);
  if (phone.length < 7) return phone;
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}

function maskEmail_(value) {
  var email = normalizeEmail_(value);
  if (!email || email.indexOf('@') === -1) return email;
  var parts = email.split('@');
  return parts[0].slice(0, 2) + '***@' + parts[1];
}

function escapeRegExp_(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function checkUnique_(rows, field, sheetName, issues, required) {
  var seen = {};
  rows.forEach(function(row) {
    var value = cleanText_(row[field]);
    if (!value) {
      if (required) issues.push(issue_('MISSING_KEY', sheetName, row._row, field + ' 값이 비어 있습니다.'));
      return;
    }
    if (seen[value]) issues.push(issue_('DUPLICATE_KEY', sheetName, row._row, field + ' 중복: ' + value));
    else seen[value] = row._row;
  });
}

function requireForeignKey_(row, field, set, sheetName, issues) {
  var value = row[field];
  if (!value || !set[value]) issues.push(issue_('ORPHAN_FOREIGN_KEY', sheetName, row._row, field + ' 참조를 찾을 수 없습니다: ' + value));
}

function issue_(code, sheetName, row, message) {
  return { code: code, sheet: sheetName, row: row, message: message };
}

function fail_(code, message, details) {
  var error = new Error(message);
  error.code = code;
  error.details = details || null;
  throw error;
}

// --------------------------- 폰 ISBN 등록 Web App (TASK_MOBILE_REG) ---------------------------
//
// 배포: "실행 사용자: 나(소유자)" + "액세스: 모든 사용자". Session에 caller 신원이 없으므로
// (getActor_()는 항상 배포자=소유자로 귀결됨) 인증은 ScriptProperties 공유 토큰 1개로 하고,
// "누가 등록했는지"는 payload.operator를 감사 로그·소장본 note에 직접 남겨 추적한다.
// executeWrite_·registerTitle_·registerCopy_ 등 보호 대상 로직은 그대로 재사용하며 수정하지 않는다.

var MOBILE_REG_CACHE_TTL_SECONDS_ = 21600; // CacheService.put() 최대 TTL(6시간)과 동일하게 맞춤

function assertMobileToken_(token) {
  var expected = PropertiesService.getScriptProperties().getProperty('MOBILE_REG_TOKEN');
  if (!expected) fail_('MOBILE_REG_NOT_CONFIGURED', 'ScriptProperties에 MOBILE_REG_TOKEN이 설정되어 있지 않습니다.');
  if (!token || token !== expected) fail_('UNAUTHORIZED', '토큰이 올바르지 않습니다.');
}

function doPost(e) {
  var response;
  try {
    if (!e || !e.postData || !e.postData.contents) fail_('BAD_REQUEST', '요청 본문이 없습니다.');
    var payload = JSON.parse(e.postData.contents);
    response = runApi_(function() {
      assertMobileToken_(payload.token);
      var action = cleanText_(payload.action);
      if (action === 'lookupIsbn') return apiLookupIsbn_(payload);
      if (action === 'registerByIsbn') return apiRegisterByIsbn_(payload);
      if (action === 'copyStatus') return apiCopyStatus_(payload);
      if (action === 'checkout') return apiWebCheckout_(payload);
      if (action === 'return') return apiWebReturn_(payload);
      if (action === 'reserve') return apiWebReserve_(payload);
      if (action === 'cancelReservation') return apiWebCancelReservation_(payload);
      if (action === 'reservations') return apiWebReservations_(payload);
      if (action === 'dashboard') return apiWebDashboard_(payload);
      if (action === 'manualEntryPendingCount') return apiWebManualEntryPendingCount_(payload);
      if (action === 'report') return apiWebReport_(payload);
      if (action === 'viz') return apiWebViz_(payload);
      if (action === 'catalogSync') return apiWebCatalogSync_(payload);
      if (action === 'recentOps') return apiWebRecentOps_(payload);
      if (action === 'titleDetail') return apiWebTitleDetail_(payload);
      if (action === 'renew') return apiWebRenew_(payload);
      if (action === 'markLost') return apiWebMarkLost_(payload);
      if (action === 'payFine') return apiWebPayFine_(payload);
      if (action === 'unpaidFines') return apiWebUnpaidFines_(payload);
      if (action === 'inventoryScan') return apiWebInventoryScan_(payload);
      if (action === 'registerTitle') return apiWebRegisterTitle_(payload);
      if (action === 'registerCopy') return apiWebRegisterCopy_(payload);
      if (action === 'enrichBibliographic') return apiWebEnrichBibliographic_(payload);
      fail_('UNKNOWN_ACTION', '지원하지 않는 action입니다: ' + action);
    });
  } catch (error) {
    response = {
      ok: false, data: null,
      error: { code: error.code || 'BAD_REQUEST', message: error.message || String(error), details: error.details || null }
    };
  }
  return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
}

// --------------------------- 공개 책 페이지 Web App (todo/20, TASK_PUBLIC_BOOK_PAGE) ---------------------------
//
// ADR-004 "책 QR = URL, 학생 QR = 불투명 ID"의 실제 배선: 책에 붙은 QR을 폰 기본 카메라로 찍으면
// 로그인 없이 표지·서지·대출 가능 여부만 보는 공개 페이지가 열려야 한다(webapp/src/student/**).
// doPost의 모든 action은 assertMobileToken_(MOBILE_REG_TOKEN, 사서 기기 전용 공유 비밀)을 거친다
// — 그 토큰을 이 공개 표면에 재사용하면(프론트 번들에 심든, 로그인 없이 통과시키든) 토큰이 사서
// 기기만 아는 값이어야 한다는 존재 이유 자체가 무너진다(번들 네트워크 탭에서 누구나 추출해 대출·
// 반납 같은 쓰기 액션까지 흉내 낼 수 있다). 그래서 doPost와 완전히 독립된 진입점 doGet(e)을
// 새로 추가한다 — GAS Web App은 doPost·doGet을 동시에 정의할 수 있고, 이 함수는 doPost·
// assertMobileToken_·executeWrite_ 등 기존 함수를 단 한 줄도 바꾸지 않는다(순수 추가).
//
// 이 경로는 읽기 전용이라 executeWrite_(락·감사로그·되돌리기)를 거칠 필요가 없다 — 바꿀 수 있는
// 상태가 애초에 없다. findCopyByKey_/findByIdRequired_/readTable_/runApi_ 등 기존 조회 헬퍼만
// 그대로 재사용한다.
//
// 노출 필드는 의도적으로 이 8개로 고정한다(barcode 에코 포함, 사유는 docs/ASSUMPTIONS.md
// todo/20 참고): barcode · title · subtitle · authors · publisher · coverUrl · classification ·
// pageCount · availability. 노출하지 않는 것 — 회원/대출자 이름, 예약 대기열, title_id/copy_id
// 등 내부 ID, isbn13, description, 08_COPIES.status_code 원문(publicAvailability_로 3단 이상
// 뭉갬). 누구나 아무 barcode로나 호출할 수 있다는 전제 자체가 이 설계다(실제 도서관 OPAC과 같은
// 위협 모델) — 그 바코드가 존재하는지·표지가 뭔지 정도는 공개돼도 안전하다고 판단했다.
//
// H3(2026-07-15, 긴급 인터럽트) 추가 — iOS 설치형 PWA에서 doPost 응답 수신 실패(서버 실행기록은
// doPost 4~5초 내 정상 완료인데 폰 fetch가 ~500ms에 TypeError "Load failed") 대응: WKWebView가
// POST + 내부 리다이렉트(Apps Script Web App 응답은 실제로 googleusercontent.com 콘텐츠 URL로
// 302 리다이렉트되는 구조) 조합을 못 받는 사례가 있어, 읽기 전용 action에 한해 GET 쿼리 경로도
// 연다(쓰기는 여전히 POST 전용). 아래 GET_ALLOWED_ACTIONS_는 doPost가 이미 호출하는 바로 그
// apiWeb*_/apiLookupIsbn_/apiCopyStatus_/apiWebUnpaidFines_ 함수를 참조 동일하게 재호출할 뿐이라
// (새 로직 없음) GET·POST 두 경로가 항상 같은 동작을 보장한다. assertMobileToken_도 doPost와
// 동일하게 거친다(barcode 전용 공개 경로와는 완전히 별개 분기 — 그쪽의 무인증 범위를 절대
// 넓히지 않는다). doPost·assertMobileToken_·apiPublicBookPage_·각 read 핸들러는 단 한 줄도
// 바꾸지 않았다 — 이 함수(doGet) 자체의 순수 추가일 뿐이다.
var GET_ALLOWED_ACTIONS_ = [
  'lookupIsbn', 'copyStatus', 'reservations', 'dashboard', 'manualEntryPendingCount',
  'report', 'viz', 'catalogSync', 'recentOps', 'titleDetail', 'unpaidFines'
];

function doGet(e) {
  var response;
  try {
    var params = (e && e.parameter) || {};
    var action = cleanText_(params.action || '');
    if (action) {
      // 인증된 읽기 액션 경로(H3) — payload 대신 e.parameter(문자열 맵)를 그대로 넘긴다. GET 값은
      // 전부 문자열이지만 각 핸들러가 이미 cleanText_/cleanCode_/Number(...)/nonNegativeInteger_로
      // 방어적으로 coercion하므로(POST의 JSON 바디도 결국 그 헬퍼들을 거친다) 문제 없다.
      response = runApi_(function() {
        assertMobileToken_(params.token);
        if (GET_ALLOWED_ACTIONS_.indexOf(action) === -1) {
          // 방어적 이중 거부 — 이 배열에 없는 이상 애초에 아래 분기에도 안 걸리지만, 쓰기 action
          // 이름이 GET으로 들어왔을 때 "왜 안 되는지"가 UNKNOWN_ACTION보다 명확하도록 별도 코드로 거른다.
          fail_('METHOD_NOT_ALLOWED', 'GET으로 호출할 수 없는 action입니다(쓰기 액션은 POST 전용): ' + action);
        }
        if (action === 'lookupIsbn') return apiLookupIsbn_(params);
        if (action === 'copyStatus') return apiCopyStatus_(params);
        if (action === 'reservations') return apiWebReservations_(params);
        if (action === 'dashboard') return apiWebDashboard_(params);
        if (action === 'manualEntryPendingCount') return apiWebManualEntryPendingCount_(params);
        if (action === 'report') return apiWebReport_(params);
        if (action === 'viz') return apiWebViz_(params);
        if (action === 'catalogSync') return apiWebCatalogSync_(params);
        if (action === 'recentOps') return apiWebRecentOps_(params);
        if (action === 'titleDetail') return apiWebTitleDetail_(params);
        if (action === 'unpaidFines') return apiWebUnpaidFines_(params);
        fail_('UNKNOWN_ACTION', '지원하지 않는 action입니다: ' + action);
      });
    } else {
      var barcode = cleanText_(params.barcode || '');
      if (barcode) {
        // 기존 동작(todo/20) — 완전히 그대로. 무인증 공개 책 페이지.
        response = runApi_(function() {
          return apiPublicBookPage_(barcode);
        });
      } else {
        // action도 barcode도 없는 맨 URL 호출 — 헬스체크(H3). iOS PWA 진단 패널이 "서버에 아예
        // 안 닿는지"와 "닿긴 하는데 POST만 실패하는지"를 구분하는 데 쓴다.
        response = runApi_(function() {
          return { version: LIBRARY_MVP.VERSION };
        });
      }
    }
  } catch (error) {
    response = {
      ok: false, data: null,
      error: { code: error.code || 'BAD_REQUEST', message: error.message || String(error), details: error.details || null }
    };
  }
  return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
}

// apiWebTitleDetail_(사서 전용, 대출이력·예약대기·회원명까지 포함)과 조회 로직(저자·분류 조인,
// 21_BOOK_CACHE 페이지수 최선노력)은 같은 패턴을 재사용하되, 반환 필드는 공개해도 안전한
// 서지 정보 + 대출 가능 여부로만 엄격히 제한한다.
function apiPublicBookPage_(barcodeInput) {
  var copy = findCopyByKey_(barcodeInput);
  var title = findByIdRequired_(LIBRARY_MVP.SHEETS.TITLES, 'title_id', copy.title_id, '연결된 도서');

  var authorById = indexBy_(readTable_(LIBRARY_MVP.SHEETS.AUTHORS).rows, 'author_id');
  var authorNames = readTable_(LIBRARY_MVP.SHEETS.TITLE_AUTHORS).rows
    .filter(function(ta) { return ta.title_id === copy.title_id; })
    .sort(function(a, b) { return Number(a.sort_order || 0) - Number(b.sort_order || 0); })
    .map(function(ta) { return (authorById[ta.author_id] || {}).display_name || ''; })
    .filter(function(name) { return Boolean(name); });

  var categoryById = indexBy_(readTable_(LIBRARY_MVP.SHEETS.CATEGORIES).rows, 'category_id');
  var titleCategoryRows = readTable_(LIBRARY_MVP.SHEETS.TITLE_CATEGORIES).rows.filter(function(tc) { return tc.title_id === copy.title_id; });
  var primaryCategoryRow = titleCategoryRows.filter(function(tc) { return truthy_(tc.is_primary); })[0] || titleCategoryRows[0];
  var primaryCategory = primaryCategoryRow ? categoryById[primaryCategoryRow.category_id] : null;

  // apiWebTitleDetail_과 같은 이유로 같은 방식의 최선노력 값이다 — 03_TITLES엔 페이지수 컬럼이
  // 없고, 21_BOOK_CACHE(ISBN 조회 부가 캐시)에 이 서지의 isbn13으로 찾히는 행이 있을 때만 곁들인다.
  var pageCount = '';
  if (title.isbn13) {
    var cacheRow = findBookCacheRow_(normalizeIsbnLoose_(title.isbn13));
    if (cacheRow && cacheRow.page_count !== '' && cacheRow.page_count !== null && cacheRow.page_count !== undefined) {
      pageCount = cacheRow.page_count;
    }
  }

  return {
    barcode: copy.barcode,
    title: title.title || '',
    subtitle: title.subtitle || '',
    authors: authorNames.join(' · '),
    publisher: title.publisher || '',
    coverUrl: title.cover_url || '',
    classification: primaryCategory ? (primaryCategory.name_ko || primaryCategory.category_code || '') : '',
    pageCount: pageCount,
    availability: publicAvailability_(copy.status_code)
  };
}

// 08_COPIES.status_code 6종(AVAILABLE/ON_LOAN/HOLD_READY/REPAIR/LOST/WITHDRAWN, 데이터 검증
// 배열 LIBRARY_MVP.VALIDATIONS 참고) 원문을 공개 표면에 그대로 보여주지 않는다 — HOLD_READY(다른
// 회원에게 배정된 예약)·REPAIR/LOST/WITHDRAWN(내부 서가 사정)은 방문자 입장에서 전부 "지금은 못
// 빌린다"일 뿐이라 3단으로만 뭉갠다(todo/20 명시 규약). HOLD_READY를 ON_LOAN이 아니라
// UNAVAILABLE로 묶는 이유: 이 소장본은 대출 중이 아니라 서가에 있지만 특정 회원을 위해 배정된
// 상태라 "누가 찜해 놓음" 같은 예약 정보를 조금이라도 흘리지 않으려면 대출 중과 구분 없이 그냥
// "못 빌린다"로만 보여주는 편이 안전하다.
function publicAvailability_(statusCode) {
  if (statusCode === 'AVAILABLE') return 'AVAILABLE';
  if (statusCode === 'ON_LOAN') return 'ON_LOAN';
  return 'UNAVAILABLE';
}

// 소장본 상태 조회(읽기 전용) — 웹앱 loan-return이 "스캔 → 대출중이면 즉시 반납 / 가능하면
// 대출 대기"를 판단하는 데 쓴다. 대출 중이면 누가 빌렸는지(반납 확인 표시용)도 함께 돌려준다.
function apiCopyStatus_(payload) {
  var copy = findCopyByKey_(requiredText_(payload.copyKey, '소장본 바코드'));
  var title = findByIdRequired_(LIBRARY_MVP.SHEETS.TITLES, 'title_id', copy.title_id, '연결된 도서');
  var openLoan = readTable_(LIBRARY_MVP.SHEETS.LOANS).rows.find(function(row) {
    return row.copy_id === copy.copy_id && row.status_code === 'OPEN' && !row.returned_at;
  });
  var member = openLoan
    ? readTable_(LIBRARY_MVP.SHEETS.MEMBERS).rows.find(function(row) { return row.member_id === openLoan.member_id; })
    : null;
  return {
    copyId: copy.copy_id,
    barcode: copy.barcode,
    statusCode: copy.status_code,
    title: title.title,
    titleStatusCode: title.status_code,
    onLoan: Boolean(openLoan),
    loanId: openLoan ? openLoan.loan_id : '',
    dueAt: openLoan ? openLoan.due_at : '',
    memberNo: member ? member.member_no : '',
    memberName: member ? member.name : ''
  };
}

// 웹앱용 대출/반납 — 사이드바 apiCheckout/apiReturn과 같은 패턴으로 executeWrite_·checkout_·return_을
// 그대로 재사용한다(runApi_ 래핑은 doPost가 담당하므로 여기서 이중 래핑하지 않는다).
// 작업자 식별은 registerByIsbn과 동일: Web App은 소유자 권한으로 실행되므로 payload.operator를
// note에 남기는 건 프론트 몫(웹앱이 note에 '웹앱 · <operator>'를 담아 보낸다).
function apiWebCheckout_(payload) {
  return executeWrite_('CHECKOUT', payload || {}, function(actor, requestId, transaction) {
    return checkout_(payload || {}, actor, requestId, transaction);
  });
}

function apiWebReturn_(payload) {
  return executeWrite_('RETURN', payload || {}, function(actor, requestId, transaction) {
    return return_(payload || {}, actor, requestId, transaction);
  });
}

// 웹앱용 예약 걸기/취소(todo/12) — 위 apiWebCheckout_/apiWebReturn_과 정확히 같은 패턴(사이드바
// apiReserve/apiCancelReservation과 동일하게 executeWrite_·reserve_/cancelReservation_을 그대로
// 재사용, doPost가 이미 바깥 runApi_ 1겹을 제공하므로 이중 래핑하지 않음). reserve_/
// cancelReservation_ 본문은 이 항목에서 전혀 수정하지 않는다(절대 규칙) — payload 키(memberKey·
// titleKey / reservationId)도 그 함수들이 이미 기대하는 이름을 그대로 쓴다.
function apiWebReserve_(payload) {
  return executeWrite_('RESERVE', payload || {}, function(actor, requestId, transaction) {
    return reserve_(payload || {}, actor, requestId, transaction);
  });
}

function apiWebCancelReservation_(payload) {
  return executeWrite_('CANCEL_RESERVATION', payload || {}, function(actor, requestId, transaction) {
    return cancelReservation_(payload || {}, actor, requestId, transaction);
  });
}

// 웹앱용 연장/분실 처리/변상(todo/13) — 위 apiWebCheckout_/apiWebReserve_와 정확히 같은 패턴(사이드바
// apiRenew/apiMarkLoanLost/apiPayFine과 동일하게 executeWrite_·renew_/markLoanLost_/payFine_을
// 그대로 재사용, doPost가 이미 바깥 runApi_ 1겹을 제공하므로 이중 래핑하지 않음). renew_/
// markLoanLost_/payFine_ 본문은 이 항목에서 전혀 수정하지 않는다(절대 규칙) — payload 키
// (loanOrCopyKey·fineAmount·note / fineId·amount)도 그 함수들이 이미 기대하는 이름을 그대로 쓴다.
//
// "분실→학생 정지 연동"은 markLoanLost_ 안에 별도 정지 로직으로 추가하지 않았다 — checkout_
// (위쪽 936~941행)의 기존 unpaidReplacement 체크가 이미 그 역할을 한다(미변상 REPLACEMENT
// 벌금이 남아 있는 회원은 신규 대출 자체가 막힌다). 이 항목은 새 정지 로직이 아니라 그 기존
// 결과를 웹앱 화면에 드러내는 일이다(프론트가 markLost 응답의 replacementFineAmount로 안내
// 토스트를 띄운다 — services/loanActionsData.ts·views/book-detail/index.tsx 참고).
function apiWebRenew_(payload) {
  return executeWrite_('RENEW', payload || {}, function(actor, requestId, transaction) {
    return renew_(payload || {}, actor, requestId, transaction);
  });
}

function apiWebMarkLost_(payload) {
  return executeWrite_('MARK_LOAN_LOST', payload || {}, function(actor, requestId, transaction) {
    return markLoanLost_(payload || {}, actor, requestId, transaction);
  });
}

function apiWebPayFine_(payload) {
  return executeWrite_('PAY_FINE', payload || {}, function(actor, requestId, transaction) {
    return payFine_(payload || {}, actor, requestId, transaction);
  });
}

// 웹앱용 장서 점검 스캔(todo/14 「장서점검 + ZXing Worker」) — 위 apiWeb* 함수들과 정확히 같은
// 패턴(executeWrite_로 감싸 멱등·감사 로그를 얻는다, doPost가 이미 바깥 runApi_ 1겹을 제공하므로
// 이중 래핑하지 않음). inventoryScan_ 본문은 이 함수가 유일한 호출자이자 이 항목에서 처음
// 추가하는 함수라(기존 함수 수정 금지 규칙과 무관, 순수 추가) 별도 "손대지 않는다" 주석이
// 필요 없다 — payload 키는 updateCopyStatus_와 동일하게 copyKey(바코드 또는 copy_id) 하나뿐.
function apiWebInventoryScan_(payload) {
  return executeWrite_('INVENTORY_SCAN', payload || {}, function(actor, requestId, transaction) {
    return inventoryScan_(payload || {}, actor, requestId, transaction);
  });
}

// 읽기 전용 — 미변상(REPLACEMENT) 목록. reports 허브(웹앱 「미변상 목록」)와 book-detail(어느
// LOST 소장본에 「변상 완료」 버튼을 보여줄지 판단)이 함께 쓴다. FINES를 MEMBERS/LOANS/COPIES/
// TITLES와 조인해 화면에 바로 뿌릴 수 있는 모양으로 내려준다 — apiWebReservations_ 등과 같은
// indexBy_ 조인 패턴(새 로직 없음), 쓰기 없음(payFine_ 등 보호 로직을 호출하지 않는다).
function apiWebUnpaidFines_(payload) {
  var memberById = indexBy_(readTable_(LIBRARY_MVP.SHEETS.MEMBERS).rows, 'member_id');
  var loanById = indexBy_(readTable_(LIBRARY_MVP.SHEETS.LOANS).rows, 'loan_id');
  var copyById = indexBy_(readTable_(LIBRARY_MVP.SHEETS.COPIES).rows, 'copy_id');
  var titleById = indexBy_(readTable_(LIBRARY_MVP.SHEETS.TITLES).rows, 'title_id');

  var rows = readTable_(LIBRARY_MVP.SHEETS.FINES).rows
    .filter(function(row) {
      return row.fine_type_code === 'REPLACEMENT' && (row.status_code === 'UNPAID' || row.status_code === 'PARTIAL');
    })
    .sort(function(a, b) {
      var at = asDate_(a.assessed_at);
      var bt = asDate_(b.assessed_at);
      return (bt ? bt.getTime() : 0) - (at ? at.getTime() : 0);
    })
    .map(function(row) {
      var member = memberById[row.member_id] || {};
      var loan = loanById[row.loan_id] || {};
      var copy = copyById[loan.copy_id] || {};
      var title = titleById[copy.title_id] || {};
      var amount = Number(row.amount || 0);
      var paid = Number(row.paid_amount || 0);
      return {
        fineId: row.fine_id,
        memberId: row.member_id,
        memberNo: member.member_no || '',
        memberName: member.name || '',
        loanId: row.loan_id,
        copyId: copy.copy_id || '',
        barcode: copy.barcode || '',
        titleId: title.title_id || '',
        title: title.title || '',
        amount: amount,
        paidAmount: paid,
        remainingAmount: amount - paid,
        statusCode: row.status_code,
        assessedAt: formatDateTime_(row.assessed_at)
      };
    });

  return { rows: rows };
}

// 웹앱 데스크톱 대시보드 기저층(ADR-021)용 읽기 액션 — ROADMAP.md "백엔드 접점" dashboard.
// 사이드바 apiBootstrap()이 이미 쓰는 getDashboardData_()를 그대로 재사용한다(수정 없음, 순수 읽기).
// 웹앱은 이 액션이 아직 없는 배포(재배포 전)에서 UNKNOWN_ACTION을 받으면 샘플 데이터로 폴백한다
// (todo/04 「샘플 폴백」) — 그러니 재배포 전까지 UNKNOWN_ACTION이 뜨는 건 버그가 아니라 정상 상태다.
function apiWebDashboard_(payload) {
  return getDashboardData_();
}

// 웹앱 리포트 허브(FEATURES.md R1)용 읽기 액션 — todo/05. type 파라미터로 리포트 종류를
// 분기한다. 전부 읽기 전용(readTable_ 재사용, 쓰기 없음) — executeWrite_/checkout_/return_ 등
// 보호 대상 로직은 건드리지 않는다. 배포 전(이 action 자체가 UNKNOWN_ACTION)과 배포 후에
// type이 잘못된 경우(VALIDATION_ERROR)를 구분한다 — 웹앱은 전자만 샘플 폴백으로 다룬다.
function apiWebReport_(payload) {
  var type = cleanText_(payload && payload.type);
  if (type === 'no-loan-finder') return reportNoLoanFinder_(payload || {});
  if (type === 'homeroom-report') return reportHomeroomClass_(payload || {});
  if (type === 'weeding-recommend') return reportWeedingRecommend_(payload || {});
  if (type === 'recall-notice') return reportRecallNotice_(payload || {});
  if (type === 'donor-thanks') return reportDonorThanks_(payload || {});
  fail_('VALIDATION_ERROR', '지원하지 않는 리포트 종류입니다: ' + type);
}

// R1-1 미대출 학생 발굴 — FEATURES.md "MEMBERS - LOANS... 반별 이름 목록. '숫자'가 아니라
// '명단'". 기간(sinceDate) 기본값은 FEATURES.md가 정확한 창을 못박지 않아 "최근 3개월"로
// 임의 지정했다(docs/ASSUMPTIONS.md todo/05 참고) — payload.sinceDate(yyyy-MM-dd 등 Date
// 파싱 가능 문자열)로 호출측이 덮어쓸 수 있다.
function reportNoLoanFinder_(payload) {
  var now = new Date();
  var since = payload.sinceDate ? parseOptionalDate_(payload.sinceDate) : addDays_(now, -90);
  if (!since) fail_('VALIDATION_ERROR', 'sinceDate 형식이 올바르지 않습니다: ' + payload.sinceDate);

  var members = readTable_(LIBRARY_MVP.SHEETS.MEMBERS).rows.filter(function(row) {
    return row.member_type_code === 'STUDENT' && row.status_code === 'ACTIVE';
  });
  var loans = readTable_(LIBRARY_MVP.SHEETS.LOANS).rows;

  var loanedMemberIds = {};
  loans.forEach(function(loan) {
    var checkedOut = asDate_(loan.checked_out_at);
    if (checkedOut && checkedOut.getTime() >= since.getTime()) loanedMemberIds[loan.member_id] = true;
  });

  var noLoanMembers = members.filter(function(m) { return !loanedMemberIds[m.member_id]; });

  var classesByKey = {};
  noLoanMembers.forEach(function(m) {
    var grade = Number(m.grade) || 0;
    var classNo = Number(m.class_no) || 0;
    var key = grade + '-' + classNo;
    if (!classesByKey[key]) classesByKey[key] = { grade: grade, classNo: classNo, students: [] };
    classesByKey[key].students.push({
      memberNo: m.member_no || m.member_id,
      name: m.name || '',
      studentNo: Number(m.student_no) || 0
    });
  });

  var classes = Object.keys(classesByKey).map(function(key) { return classesByKey[key]; });
  classes.forEach(function(cls) {
    cls.students.sort(function(a, b) { return a.studentNo - b.studentNo; });
  });
  classes.sort(function(a, b) { return a.grade - b.grade || a.classNo - b.classNo; });

  return {
    libraryName: getConfig_('LIBRARY_NAME', 'MVP 도서관'),
    generatedAt: formatDateTime_(now),
    sinceDate: formatDate_(since),
    totalCount: noLoanMembers.length,
    classes: classes
  };
}

// R1-2 담임 리포트(월간·반별) — FEATURES.md "대출 현황, 미대출 명단, 연체, 우리 반 인기책...
// 인쇄 전제 A4 1장". LOANS -> MEMBERS(반 필터) -> COPIES -> TITLES 조인.
function reportHomeroomClass_(payload) {
  var grade = Number(payload.grade);
  var classNo = Number(payload.classNo);
  var month = cleanText_(payload.month); // 'yyyy-MM'
  if (!grade || !classNo) fail_('VALIDATION_ERROR', 'grade·classNo가 필요합니다.');
  if (!/^\d{4}-\d{2}$/.test(month)) fail_('VALIDATION_ERROR', 'month는 yyyy-MM 형식이어야 합니다: ' + month);

  var now = new Date();
  var members = readTable_(LIBRARY_MVP.SHEETS.MEMBERS).rows.filter(function(row) {
    return row.member_type_code === 'STUDENT' && row.status_code === 'ACTIVE' &&
      Number(row.grade) === grade && Number(row.class_no) === classNo;
  });
  var memberIds = toSet_(members, 'member_id');
  var memberById = indexBy_(members, 'member_id');

  var loans = readTable_(LIBRARY_MVP.SHEETS.LOANS).rows.filter(function(row) { return memberIds[row.member_id]; });
  var copyById = indexBy_(readTable_(LIBRARY_MVP.SHEETS.COPIES).rows, 'copy_id');
  var titleById = indexBy_(readTable_(LIBRARY_MVP.SHEETS.TITLES).rows, 'title_id');

  var monthLoans = loans.filter(function(loan) {
    var checkedOut = asDate_(loan.checked_out_at);
    return checkedOut && formatDate_(checkedOut).slice(0, 7) === month;
  });

  var countByMember = {};
  monthLoans.forEach(function(loan) { countByMember[loan.member_id] = (countByMember[loan.member_id] || 0) + 1; });
  var loanStatus = members.map(function(m) {
    return { memberNo: m.member_no || m.member_id, name: m.name || '', studentNo: Number(m.student_no) || 0, loanCount: countByMember[m.member_id] || 0 };
  }).sort(function(a, b) { return a.studentNo - b.studentNo; });

  var noLoanList = loanStatus.filter(function(item) { return item.loanCount === 0; });

  var overdueList = loans.filter(function(loan) {
    return loan.status_code === 'OPEN' && !loan.returned_at;
  }).map(function(loan) {
    var copy = copyById[loan.copy_id] || {};
    var title = titleById[copy.title_id] || {};
    var member = memberById[loan.member_id] || {};
    var due = asDate_(loan.due_at);
    var overdueDays = due && due.getTime() < now.getTime() ? Math.max(1, Math.ceil((now.getTime() - due.getTime()) / 86400000)) : 0;
    return {
      memberNo: member.member_no || loan.member_id,
      name: member.name || '',
      title: title.title || copy.title_id || '',
      dueAtText: due ? formatDate_(due) : '',
      overdueDays: overdueDays
    };
  }).filter(function(item) { return item.overdueDays > 0; })
    .sort(function(a, b) { return b.overdueDays - a.overdueDays; });

  var countByTitle = {};
  monthLoans.forEach(function(loan) {
    var copy = copyById[loan.copy_id] || {};
    if (!copy.title_id) return;
    countByTitle[copy.title_id] = (countByTitle[copy.title_id] || 0) + 1;
  });
  var popularBooks = Object.keys(countByTitle).map(function(titleId) {
    return { title: (titleById[titleId] || {}).title || titleId, loanCount: countByTitle[titleId] };
  }).sort(function(a, b) { return b.loanCount - a.loanCount; }).slice(0, 5);

  return {
    libraryName: getConfig_('LIBRARY_NAME', 'MVP 도서관'),
    generatedAt: formatDateTime_(now),
    grade: grade,
    classNo: classNo,
    month: month,
    studentCount: members.length,
    loanStatus: loanStatus,
    noLoanList: noLoanList,
    overdueList: overdueList,
    popularBooks: popularBooks
  };
}

// R1-3 죽은 장서 / 구매 추천 — FEATURES.md "입수 2년↑·대출 0회 = 폐기 후보 / 예약 누적·회전율
// 상위 = 복본 구매 후보... 예산이 적을수록 '뭘 살지'가 데이터여야 함". "2년"은 FEATURES.md 원문이
// 그대로 명시한 값이라 todo/05의 sinceDate(90일)와 달리 임의 지정이 아니다.
var WEEDING_MIN_AGE_YEARS_ = 2;

function reportWeedingRecommend_(payload) {
  var now = new Date();
  var cutoff = new Date(now.getTime());
  cutoff.setFullYear(cutoff.getFullYear() - WEEDING_MIN_AGE_YEARS_);

  var copies = readTable_(LIBRARY_MVP.SHEETS.COPIES).rows;
  var titleById = indexBy_(readTable_(LIBRARY_MVP.SHEETS.TITLES).rows, 'title_id');
  var authorById = indexBy_(readTable_(LIBRARY_MVP.SHEETS.AUTHORS).rows, 'author_id');
  // title_id -> 저자 표시명 배열(sort_order 순) — apiWebCatalogSync_와 동일한 조인 패턴(중복
  // 로직이지만 두 함수 다 이미 존재하는 조회 전용 함수라 공유 헬퍼로 뽑지 않아도 위험이 없다).
  var authorNamesByTitle = {};
  readTable_(LIBRARY_MVP.SHEETS.TITLE_AUTHORS).rows
    .slice()
    .sort(function(a, b) { return Number(a.sort_order || 0) - Number(b.sort_order || 0); })
    .forEach(function(ta) {
      var author = authorById[ta.author_id];
      if (!author) return;
      (authorNamesByTitle[ta.title_id] || (authorNamesByTitle[ta.title_id] = [])).push(author.display_name || '');
    });

  var loanCountByCopy = {};
  readTable_(LIBRARY_MVP.SHEETS.LOANS).rows.forEach(function(loan) {
    loanCountByCopy[loan.copy_id] = (loanCountByCopy[loan.copy_id] || 0) + 1;
  });

  // 폐기 후보 — 이미 폐기(WITHDRAWN)·분실(LOST) 처리된 소장본은 제외(이미 결론 난 항목).
  // 정상 유통 상태(AVAILABLE/ON_LOAN/HOLD_READY/REPAIR)면서 입수 2년 이상 + 대출 이력 0회
  // (10_LOANS에 해당 copy_id 행이 하나도 없음 — 반납 여부와 무관하게 "한 번이라도 나간 적"을 본다).
  var weedingCandidates = copies.filter(function(copy) {
    if (copy.status_code === 'WITHDRAWN' || copy.status_code === 'LOST') return false;
    var acquired = asDate_(copy.acquired_at);
    if (!acquired || acquired.getTime() > cutoff.getTime()) return false;
    return !loanCountByCopy[copy.copy_id];
  }).map(function(copy) {
    var title = titleById[copy.title_id] || {};
    return {
      copyId: copy.copy_id,
      barcode: copy.barcode || '',
      title: title.title || copy.title_id || '',
      author: (authorNamesByTitle[copy.title_id] || []).join(' · '),
      shelfCode: copy.shelf_code || '',
      acquiredAtText: formatDate_(copy.acquired_at)
    };
  }).sort(function(a, b) { return a.acquiredAtText.localeCompare(b.acquiredAtText); });

  // 구매 후보(복본) — "회전율 상위"를 예약 대기열(WAITING/READY) ÷ 현재 복본 수 비율로
  // 근사한다(복본 1권에 대기 3명이 복본 10권에 대기 3명보다 훨씬 급하다). 분모(copyCount)는
  // 폐기·분실을 뺀 "실제 서가/유통 중 복본 수"다 — 대출 중인 복본도 유통 재고로 셈한다(그게
  // 대기가 생기는 이유이므로 분모에서 빼면 안 된다). 대기열이 있는 서명만 포함한다.
  var copyCountByTitle = {};
  copies.forEach(function(copy) {
    if (copy.status_code === 'WITHDRAWN' || copy.status_code === 'LOST') return;
    copyCountByTitle[copy.title_id] = (copyCountByTitle[copy.title_id] || 0) + 1;
  });
  var queueLengthByTitle = {};
  readTable_(LIBRARY_MVP.SHEETS.RESERVATIONS).rows.forEach(function(row) {
    if (row.status_code !== 'WAITING' && row.status_code !== 'READY') return;
    queueLengthByTitle[row.title_id] = (queueLengthByTitle[row.title_id] || 0) + 1;
  });

  var purchaseCandidates = Object.keys(queueLengthByTitle).map(function(titleId) {
    var title = titleById[titleId] || {};
    var queueLength = queueLengthByTitle[titleId];
    var copyCount = copyCountByTitle[titleId] || 0;
    return {
      titleId: titleId,
      title: title.title || titleId,
      queueLength: queueLength,
      copyCount: copyCount,
      ratio: queueLength / Math.max(copyCount, 1)
    };
  }).sort(function(a, b) { return b.ratio - a.ratio || b.queueLength - a.queueLength || a.title.localeCompare(b.title); });

  return {
    libraryName: getConfig_('LIBRARY_NAME', 'MVP 도서관'),
    generatedAt: formatDateTime_(now),
    minAgeYears: WEEDING_MIN_AGE_YEARS_,
    weedingCandidates: weedingCandidates,
    purchaseCandidates: purchaseCandidates
  };
}

// R1-4 회수 쪽지 — FEATURES.md "연체·방학 미반납을 담임별로 쪽지 인쇄... 교실 전달용 절취 쪽지".
// "방학 미반납"은 학사력(방학 시작·종료일) 개념이 CONFIG/스키마 어디에도 없어(getConfig_로 조회
// 가능한 키가 없음, 새로 만들려면 CONFIG 스키마를 건드려야 해 이번 스코프 밖) "현재 연체 전체"로
// 단순화했다(docs/ASSUMPTIONS.md todo/09 참고). 담임(학급)별로 그룹화해서 반환한다 — 프론트가
// "한 반 = 한 열" 절취 인쇄 레이아웃을 그대로 그릴 수 있도록.
function reportRecallNotice_(payload) {
  var now = new Date();
  var memberById = indexBy_(readTable_(LIBRARY_MVP.SHEETS.MEMBERS).rows, 'member_id');
  var copyById = indexBy_(readTable_(LIBRARY_MVP.SHEETS.COPIES).rows, 'copy_id');
  var titleById = indexBy_(readTable_(LIBRARY_MVP.SHEETS.TITLES).rows, 'title_id');

  var groupsByKey = {};
  readTable_(LIBRARY_MVP.SHEETS.LOANS).rows.forEach(function(loan) {
    if (loan.status_code !== 'OPEN' || loan.returned_at) return;
    var due = asDate_(loan.due_at);
    if (!due || due.getTime() >= now.getTime()) return;
    var member = memberById[loan.member_id];
    // 회수 쪽지는 담임 학급 배부용 — 학급이 있는 재학생 회원만 대상으로 한다(교직원 등은 제외).
    if (!member || member.member_type_code !== 'STUDENT') return;
    var copy = copyById[loan.copy_id] || {};
    var title = titleById[copy.title_id] || {};
    var overdueDays = Math.max(1, Math.ceil((now.getTime() - due.getTime()) / 86400000));
    var grade = Number(member.grade) || 0;
    var classNo = Number(member.class_no) || 0;
    var key = grade + '-' + classNo;
    if (!groupsByKey[key]) groupsByKey[key] = { grade: grade, classNo: classNo, items: [] };
    groupsByKey[key].items.push({
      studentNo: Number(member.student_no) || 0,
      name: member.name || '',
      title: title.title || copy.title_id || '',
      dueAtText: formatDate_(due),
      overdueDays: overdueDays
    });
  });

  var classes = Object.keys(groupsByKey).map(function(key) { return groupsByKey[key]; });
  classes.forEach(function(cls) {
    cls.items.sort(function(a, b) { return a.studentNo - b.studentNo || a.name.localeCompare(b.name); });
  });
  classes.sort(function(a, b) { return a.grade - b.grade || a.classNo - b.classNo; });
  var totalCount = classes.reduce(function(sum, cls) { return sum + cls.items.length; }, 0);

  return {
    libraryName: getConfig_('LIBRARY_NAME', 'MVP 도서관'),
    generatedAt: formatDateTime_(now),
    asOfDate: formatDate_(now),
    totalCount: totalCount,
    classes: classes
  };
}

// R1-5 기증 감사장 — FEATURES.md "연말 기증자별 목록·감사장 일괄 생성... 기증 선순환 유도".
// 08_COPIES에는 기증자 개인 식별 필드가 없다(HEADERS 배열은 절대 규칙상 수정 금지 — barcode·
// title_id·...·acquisition_source·price·...만 존재). acquisition_source는 CODEBOOK 코드군도
// 없는 순수 자유 텍스트다(registerCopy_가 validateCodeInput_ 없이 safeText_로만 저장, 현재
// 웹앱 등록 화면도 이 값을 아예 입력받지 않는다) — "기증자별"을 정확히 재현할 근거가 없어
// acquisition_source 문자열 자체를 그룹 키로 쓴다(입력값이 "기증-홍길동"처럼 사람 이름을
// 담고 있으면 사실상 기증자별 그룹이 되고, "DONATION" 같은 굵은 코드면 그룹이 하나로 뭉친다) —
// docs/ASSUMPTIONS.md todo/09 참고. acquisition_source가 빈 소장본은 그룹화 대상에서 빼고
// 개수만 skippedNoSource로 함께 내려 화면에 각주로 표시한다(VIZ.md 턴오버 사분면의
// skippedNoAcquiredDate와 같은 관례).
function reportDonorThanks_(payload) {
  var now = new Date();
  var titleById = indexBy_(readTable_(LIBRARY_MVP.SHEETS.TITLES).rows, 'title_id');

  var groupsBySource = {};
  var skippedNoSource = 0;
  readTable_(LIBRARY_MVP.SHEETS.COPIES).rows.forEach(function(copy) {
    var source = cleanText_(copy.acquisition_source);
    if (!source) { skippedNoSource++; return; }
    if (!groupsBySource[source]) groupsBySource[source] = { sourceLabel: source, items: [], totalPrice: 0 };
    var title = titleById[copy.title_id] || {};
    var price = Number(copy.price) || 0;
    groupsBySource[source].items.push({
      copyId: copy.copy_id,
      title: title.title || copy.title_id || '',
      price: price,
      acquiredAtText: copy.acquired_at ? formatDate_(copy.acquired_at) : ''
    });
    groupsBySource[source].totalPrice += price;
  });

  var donorGroups = Object.keys(groupsBySource).map(function(key) { return groupsBySource[key]; })
    .sort(function(a, b) { return b.totalPrice - a.totalPrice || a.sourceLabel.localeCompare(b.sourceLabel); });

  return {
    libraryName: getConfig_('LIBRARY_NAME', 'MVP 도서관'),
    generatedAt: formatDateTime_(now),
    donorGroups: donorGroups,
    skippedNoSource: skippedNoSource
  };
}

// 웹앱 시각화 허브(VIZ.md, todo/06)용 읽기 액션. 집계 자체는 dailyVizBatch()가 매일 미리
// 20_VIZ_CACHE에 적재해 두고(위 "VIZ_CACHE 일배치" 절), 이 함수는 그 캐시 행을 읽어 그대로
// 돌려줄 뿐이다(원장 재스캔 없음 — VIZ.md 원칙 ①). type 문자열은 프론트
// webapp/src/services/vizData.ts와 정확히 일치해야 한다.
//
// UNKNOWN_ACTION(이 action을 아직 모르는 배포 전)과 VIZ_NOT_READY(action은 있지만 일배치가
// 한 번도 안 돈 상태)는 원인이 다르므로 에러 코드를 하나로 합치지 않는다 — 프론트는 폴백
// 목적으로만 둘을 같이 다룬다(services/vizData.ts 주석 참고).
function apiWebViz_(payload) {
  var type = cleanText_(payload && payload.type);
  // todo/18 — 승인된 방식(추가만): 아래 4개는 새 타입이고, 앞 4개의 순서·값은 그대로다.
  // todo/19 — 같은 방식으로 한 번 더: 마지막 4개가 이번에 새로 추가한 타입이고, 앞 8개의
  // 순서·값은 그대로다. VIZ.md V1 12종 전체의 type 문자열이 이제 다 모였다.
  var validTypes = [
    'loan-heatmap', 'category-treemap', 'turnover-quadrant', 'reservation-pressure',
    'loan-time-of-day', 'overdue-flow', 'class-participation', 'monthly-loan-curve',
    'shelf-heatmap', 'collection-age', 'grade-reading-gap', 'budget-picture'
  ];
  if (validTypes.indexOf(type) === -1) fail_('VALIDATION_ERROR', '지원하지 않는 시각화 종류입니다: ' + type);
  var row = readTable_(LIBRARY_MVP.SHEETS.VIZ_CACHE).rows.find(function(r) { return r.viz_type === type; });
  if (!row) fail_('VIZ_NOT_READY', '아직 집계되지 않았습니다(일배치 미실행): ' + type);
  return { type: type, computedAt: formatDateTime_(row.computed_at), data: JSON.parse(row.payload_json) };
}

// --------------------------- 웹앱 catalog(장서 대장) 청크 동기화(ADR-024, todo/08) ---------------------------
//
// 🔴 서버 페이지네이션이 아니다 — GAS엔 부분 읽기가 없어 "페이지마다 시트 전체 스캔"은 할당량
// 폭탄이 된다(ADR-024). 대신 클라이언트(webapp/src/services/catalog.ts)가 IndexedDB에 COPIES
// 단위 미러를 만들고, 이 액션은 그 미러를 채우는 "청크 배달부" 역할만 한다 — 한 번 호출에 최대
// CATALOG_SYNC_MAX_LIMIT_행만 내려주고 hasMore로 더 있음을 알린다. 정렬·필터·페이지 자체는
// 전부 클라이언트가 미러에서 처리(이 함수는 그 요청을 아예 받지 않는다).
//
// 델타 커서: TITLES/COPIES 둘 다 이미 updated_at·row_version 컬럼이 있으므로(HEADERS 확인됨)
// 새 catalogVersion 카운터를 만들지 않는다. 클라이언트는 이전 응답의 serverTime을 다음 호출의
// afterUpdatedAt으로 그대로 돌려보낸다(자기 시계가 아니라 서버 시계를 커서로 씀 — 클럭 스큐로
// 인한 델타 누락 방지). "그 소장본이 바뀜" 판정은 COPIES.updated_at·TITLES.updated_at 둘 중
// 더 최신 것(effective)을 기준으로 한다 — 소장본 자체는 안 변해도 서명 정보가 바뀌면 미러가
// 갱신돼야 하기 때문.
var CATALOG_SYNC_MAX_LIMIT_ = 1000;

function apiWebCatalogSync_(payload) {
  payload = payload || {};
  var since = payload.afterUpdatedAt ? parseOptionalDate_(payload.afterUpdatedAt) : null;
  var limit = CATALOG_SYNC_MAX_LIMIT_;
  if (payload.limit !== undefined && payload.limit !== null && payload.limit !== '') {
    var requested = nonNegativeInteger_(payload.limit, '한도');
    if (requested > 0 && requested < CATALOG_SYNC_MAX_LIMIT_) limit = requested;
  }

  var now = new Date();
  var titleById = indexBy_(readTable_(LIBRARY_MVP.SHEETS.TITLES).rows, 'title_id');
  var authorById = indexBy_(readTable_(LIBRARY_MVP.SHEETS.AUTHORS).rows, 'author_id');
  var categoryById = indexBy_(readTable_(LIBRARY_MVP.SHEETS.CATEGORIES).rows, 'category_id');

  // title_id -> 저자 표시명 배열(sort_order 순) — 05_TITLE_AUTHORS -> 04_AUTHORS 조인.
  var authorNamesByTitle = {};
  readTable_(LIBRARY_MVP.SHEETS.TITLE_AUTHORS).rows
    .slice()
    .sort(function(a, b) { return Number(a.sort_order || 0) - Number(b.sort_order || 0); })
    .forEach(function(ta) {
      var author = authorById[ta.author_id];
      if (!author) return;
      (authorNamesByTitle[ta.title_id] || (authorNamesByTitle[ta.title_id] = [])).push(author.display_name || '');
    });

  // title_id -> 대표(primary) 분류 category_id — 07_TITLE_CATEGORIES -> 06_CATEGORIES 조인.
  // is_primary가 여러 개 없다는 전제하에 마지막 primary가 이기고, primary가 하나도 없으면
  // 처음 만난 분류를 폴백으로 쓴다(분류 미배정보다 아무 분류나 보여주는 편이 화면상 낫다).
  var primaryCategoryIdByTitle = {};
  readTable_(LIBRARY_MVP.SHEETS.TITLE_CATEGORIES).rows.forEach(function(tc) {
    var isPrimary = truthy_(tc.is_primary);
    if (isPrimary || !primaryCategoryIdByTitle[tc.title_id]) primaryCategoryIdByTitle[tc.title_id] = tc.category_id;
  });

  // copy_id -> { count, last } — 10_LOANS에서 대출횟수·최근대출일 집계(카탈로그 열 "대출횟수"·
  // "최근대출"). LOANS는 상태 변이 테이블이라(ADR-005 개정) 반납 여부와 무관하게 행 자체가
  // "그 소장본이 몇 번 대출됐는가"의 사건 이력으로 쓸 수 있다.
  var loanStatsByCopy = {};
  readTable_(LIBRARY_MVP.SHEETS.LOANS).rows.forEach(function(loan) {
    var stat = loanStatsByCopy[loan.copy_id] || (loanStatsByCopy[loan.copy_id] = { count: 0, last: null });
    stat.count++;
    var checkedOut = asDate_(loan.checked_out_at);
    if (checkedOut && (!stat.last || checkedOut.getTime() > stat.last.getTime())) stat.last = checkedOut;
  });

  var candidates = readTable_(LIBRARY_MVP.SHEETS.COPIES).rows.map(function(copy) {
    var title = titleById[copy.title_id] || {};
    var copyUpdated = asDate_(copy.updated_at);
    var titleUpdated = asDate_(title.updated_at);
    var effective = copyUpdated && titleUpdated
      ? (copyUpdated.getTime() >= titleUpdated.getTime() ? copyUpdated : titleUpdated)
      : (copyUpdated || titleUpdated);
    return { copy: copy, title: title, effective: effective };
  }).filter(function(item) {
    return !since || (item.effective && item.effective.getTime() > since.getTime());
  });

  // updated_at 오름차순 — since 커서로 다음 호출이 안전하게 이어받을 수 있는 재개형(resumable)
  // 정렬. 동시각 충돌은 copy_id로 안정 정렬한다.
  candidates.sort(function(a, b) {
    var at = a.effective ? a.effective.getTime() : 0;
    var bt = b.effective ? b.effective.getTime() : 0;
    return at - bt || String(a.copy.copy_id).localeCompare(String(b.copy.copy_id));
  });

  var page = candidates.slice(0, limit);
  var rows = page.map(function(item) {
    var copy = item.copy;
    var title = item.title;
    var categoryId = primaryCategoryIdByTitle[copy.title_id];
    var category = categoryId ? categoryById[categoryId] : null;
    var stat = loanStatsByCopy[copy.copy_id] || { count: 0, last: null };
    return {
      copyId: copy.copy_id,
      barcode: copy.barcode,
      titleId: copy.title_id,
      title: title.title || '',
      authors: (authorNamesByTitle[copy.title_id] || []).join(' · '),
      classification: category ? (category.name_ko || category.category_code || '') : '',
      statusCode: copy.status_code || '',
      loanCount: stat.count,
      lastLoanAt: stat.last ? formatDate_(stat.last) : '',
      shelfCode: copy.shelf_code || '',
      acquiredAt: copy.acquired_at ? formatDate_(copy.acquired_at) : '',
      updatedAt: item.effective ? formatDateTime_(item.effective) : ''
    };
  });

  return {
    rows: rows,
    hasMore: candidates.length > page.length,
    // 클라이언트가 다음 호출의 afterUpdatedAt으로 그대로 돌려보낼 서버 시각(클럭 스큐 방지).
    // toClient_(runApi_)가 JSON 왕복시키므로 Date는 자동으로 ISO 문자열이 된다.
    serverTime: now,
    // 전체 소장본 수 — 실제 델타 건수가 아니라 "동기화 중 N/전체" 진행률 표시용 힌트.
    totalCopies: readTable_(LIBRARY_MVP.SHEETS.COPIES).rows.length
  };
}

// --------------------------- 웹앱 최근 처리(recent-ops, todo/08 · entityId 필터 todo/11) ---------------------------
//
// 15_AUDIT_LOG는 executeWrite_ 성공 트랜잭션마다 writeAudit_()가 이미 채워온 이력 시트다(모든
// 쓰기 액션 공통 경로) — 이 액션은 그 시트를 읽기 전용으로 조회해 최신순으로 잘라 돌려줄 뿐,
// 새 쓰기·새 시트가 없다.
var RECENT_OPS_DEFAULT_LIMIT_ = 100;
var RECENT_OPS_MAX_LIMIT_ = 500;

// todo/11(book-detail) "최근 이력" — payload.entityId가 있으면 그 대상으로 좁힌다(없으면 기존
// 동작과 완전히 동일 — 하위호환 추가 파라미터, 절대 규칙 "추가만" 준수).
//
// 🔴 알려진 한계(writeAudit_ 호출부 전수 확인, checkout_/return_/renew_/markLoanLost_) —
// LOAN 이벤트의 entity_id는 barcode/copy_id가 아니라 loan_id다. 그중 CHECKOUT만
// after_json에 copy_id를 함께 남기고(대출 처리 시점엔 아직 소장본을 안다는 문맥이 있어서),
// RETURN/RENEW/MARK_LOST의 before/after JSON에는 copy_id 자체가 없다 — 이 셋은 entity_id
// 필터로도, JSON 안을 뒤져도 특정 소장본에 못 붙는다. checkout_/return_ 등은 이 항목에서
// 수정 금지 대상이라(절대 규칙) audit 기록 형태 자체를 못 바꾼다. 그러니 이 필터는 등록·상태
// 변경·CHECKOUT까지만 잡는 "부분" 이력이고, book-detail은 반납·연장까지 포함한 정확한 대출
// 이력은 이 액션이 아니라 apiWebTitleDetail_의 loanHistory(10_LOANS 직접 조회 — copy_id
// 컬럼을 항상 갖고 있어 훨씬 정확)로 보완한다(docs/ASSUMPTIONS.md todo/11 참고).
function apiWebRecentOps_(payload) {
  payload = payload || {};
  var limit = RECENT_OPS_DEFAULT_LIMIT_;
  if (payload.limit !== undefined && payload.limit !== null && payload.limit !== '') {
    var requested = nonNegativeInteger_(payload.limit, '한도');
    if (requested > 0) limit = requested;
  }
  if (limit > RECENT_OPS_MAX_LIMIT_) limit = RECENT_OPS_MAX_LIMIT_;

  var entityId = payload.entityId !== undefined && payload.entityId !== null ? cleanCode_(payload.entityId) : '';

  var candidateRows = readTable_(LIBRARY_MVP.SHEETS.AUDIT).rows;
  if (entityId) {
    candidateRows = candidateRows.filter(function(row) {
      if (cleanCode_(row.entity_id) === entityId) return true;
      if (row.entity_type === 'LOAN' && row.after_json) {
        var after = safeParseAuditJson_(row.after_json);
        if (after && after.copy_id && cleanCode_(after.copy_id) === entityId) return true;
      }
      return false;
    });
  }

  var rows = candidateRows
    .slice()
    .sort(function(a, b) {
      var at = asDate_(a.occurred_at);
      var bt = asDate_(b.occurred_at);
      return (bt ? bt.getTime() : 0) - (at ? at.getTime() : 0);
    })
    .slice(0, limit)
    .map(function(row) {
      return {
        logId: row.log_id,
        occurredAt: formatDateTime_(row.occurred_at),
        actionCode: row.action_code || '',
        entityType: row.entity_type || '',
        entityId: row.entity_id || '',
        summary: row.summary || '',
        actorId: row.actor_id || ''
      };
    });

  return { rows: rows };
}

// before_json/after_json은 항상 writeAudit_(safeJson_)이 만든 값이라 정상 상황에선 파싱이
// 실패할 이유가 없지만, 읽기 전용 조회 경로에서 방어적으로 감싼다(빈 문자열·손상값 방어).
function safeParseAuditJson_(text) {
  try {
    return JSON.parse(text);
  } catch (parseError) {
    return null;
  }
}

// --------------------------- 웹앱 도서 상세(book-detail, todo/11 신규 읽기 전용 액션) ---------------------------
//
// 선택 (a) vs (b) — catalog IndexedDB 미러(services/catalog.ts) 행 모양을 넓혀 cover_url·
// description·published_year 등 TITLES 전용 서지 필드까지 싣는 안도 가능했지만(사양이 명시적으로
// 허용), 그러면 그 서명의 소장본이 10권이면 같은 서지 데이터가 10번 중복 저장되고(미러는 COPY
// 단위 1행 = 소장본 1건, todo/08) catalog 목록 렌더엔 필요 없는 필드로 미러 크기만 불어난다.
// ADR-024 "미러는 목록 전용, 서버 페이지네이션 금지"가 풀려는 문제는 "5,000행 목록의 정렬·필터"
// 이지 "한 건 상세 조회"가 아니다 — book-detail은 한 번에 서명 1개만 보므로 왕복 1회의 실시간
// 조회가 목록용 미러를 부풀리는 것보다 훨씬 낫다고 판단했다(선택 (b), docs/ASSUMPTIONS.md 참고).
// 같은 이유로 각 소장본의 현재 대출자·반납예정일도 (loan-return처럼) 그때그때 살아있는
// 10_LOANS를 조인해서 내려준다 — 미러의 statusCode는 마지막 배경동기화 시점 스냅샷일 뿐이라
// "누가 지금 빌려갔는지"처럼 신선도가 중요한 값엔 애초에 안 맞는다.
//
// payload: { copyKey?: 바코드/copy_id, titleId?: title_id } 중 하나 이상. copyKey가 있으면
// 그 소장본이 속한 title로 좁힌다(딥링크 #/w/book-detail?copy=등록번호, catalog 행 클릭 둘 다
// barcode를 이 이름으로 보낸다) — titleId만 있으면 그 서명 전체를 보여준다(포커스 소장본 없음).
var TITLE_DETAIL_LOAN_HISTORY_LIMIT_ = 20;
var TITLE_DETAIL_RESERVATION_LIMIT_ = 50;

function apiWebTitleDetail_(payload) {
  payload = payload || {};
  var copyKeyInput = cleanText_(payload.copyKey || payload.barcode || '');
  var titleIdInput = cleanText_(payload.titleId || '');
  if (!copyKeyInput && !titleIdInput) fail_('VALIDATION_ERROR', 'copyKey 또는 titleId가 필요합니다.');

  var focusCopy = copyKeyInput ? findCopyByKey_(copyKeyInput) : null;
  var titleId = focusCopy ? focusCopy.title_id : titleIdInput;
  var title = findByIdRequired_(LIBRARY_MVP.SHEETS.TITLES, 'title_id', titleId, '도서');

  var authorById = indexBy_(readTable_(LIBRARY_MVP.SHEETS.AUTHORS).rows, 'author_id');
  var authorNames = readTable_(LIBRARY_MVP.SHEETS.TITLE_AUTHORS).rows
    .filter(function(ta) { return ta.title_id === titleId; })
    .sort(function(a, b) { return Number(a.sort_order || 0) - Number(b.sort_order || 0); })
    .map(function(ta) { return (authorById[ta.author_id] || {}).display_name || ''; })
    .filter(function(name) { return Boolean(name); });

  var categoryById = indexBy_(readTable_(LIBRARY_MVP.SHEETS.CATEGORIES).rows, 'category_id');
  var titleCategoryRows = readTable_(LIBRARY_MVP.SHEETS.TITLE_CATEGORIES).rows.filter(function(tc) { return tc.title_id === titleId; });
  var primaryCategoryRow = titleCategoryRows.filter(function(tc) { return truthy_(tc.is_primary); })[0] || titleCategoryRows[0];
  var primaryCategory = primaryCategoryRow ? categoryById[primaryCategoryRow.category_id] : null;

  // 03_TITLES에는 페이지수 컬럼이 없다(HEADERS 확인 — registerByIsbn_도 같은 이유로 description에
  // 문자열로만 보강 기록한다, 위 주석 참고). 대신 21_BOOK_CACHE(ISBN 조회 부가 캐시, 진위 데이터
  // 아님)에 이 서지의 isbn13으로 찾히는 행이 있으면 page_count를 "최선노력"으로만 곁들인다 —
  // 캐시가 없으면(폰 등록이 아니거나 캐시 갱신 전) 빈 값 그대로 두고 화면이 "정보 없음"으로 정직하게 표시한다.
  var pageCount = '';
  if (title.isbn13) {
    var cacheRow = findBookCacheRow_(normalizeIsbnLoose_(title.isbn13));
    if (cacheRow && cacheRow.page_count !== '' && cacheRow.page_count !== null && cacheRow.page_count !== undefined) {
      pageCount = cacheRow.page_count;
    }
  }

  var allCopies = readTable_(LIBRARY_MVP.SHEETS.COPIES).rows.filter(function(c) { return c.title_id === titleId; });
  var copyIdSet = toSet_(allCopies, 'copy_id');
  var memberById = indexBy_(readTable_(LIBRARY_MVP.SHEETS.MEMBERS).rows, 'member_id');
  var allLoans = readTable_(LIBRARY_MVP.SHEETS.LOANS).rows;

  var openLoanByCopy = {};
  allLoans.forEach(function(loan) {
    if (loan.status_code === 'OPEN' && !loan.returned_at) openLoanByCopy[loan.copy_id] = loan;
  });

  var copies = allCopies.map(function(copy) {
    var openLoan = openLoanByCopy[copy.copy_id];
    var member = openLoan ? memberById[openLoan.member_id] : null;
    return {
      copyId: copy.copy_id,
      barcode: copy.barcode,
      statusCode: copy.status_code || '',
      shelfCode: copy.shelf_code || '',
      conditionCode: copy.condition_code || '',
      acquiredAt: copy.acquired_at ? formatDate_(copy.acquired_at) : '',
      onLoan: Boolean(openLoan),
      dueAt: openLoan ? formatDateTime_(openLoan.due_at) : '',
      memberNo: member ? member.member_no : '',
      memberName: member ? member.name : ''
    };
  }).sort(function(a, b) { return String(a.barcode).localeCompare(String(b.barcode)); });

  // "최근 이력" 1차 소스 — 15_AUDIT_LOG가 아니라 10_LOANS를 직접 훑는다(위 함수 헤더 주석 +
  // apiWebRecentOps_ 주석 참고: LOAN 감사 로그는 RETURN/RENEW/MARK_LOST에 copy_id를 안 남겨
  // entityId로 재구성이 안 된다). LOANS는 copy_id 컬럼을 항상 갖고 있어 정확하다.
  var loanHistory = allLoans
    .filter(function(loan) { return copyIdSet[loan.copy_id]; })
    .sort(function(a, b) {
      var at = asDate_(a.checked_out_at);
      var bt = asDate_(b.checked_out_at);
      return (bt ? bt.getTime() : 0) - (at ? at.getTime() : 0);
    })
    .slice(0, TITLE_DETAIL_LOAN_HISTORY_LIMIT_)
    .map(function(loan) {
      var copy = allCopies.filter(function(c) { return c.copy_id === loan.copy_id; })[0];
      var member = memberById[loan.member_id];
      return {
        loanId: loan.loan_id,
        barcode: copy ? copy.barcode : loan.copy_id,
        memberNo: member ? member.member_no : '',
        memberName: member ? member.name : '',
        checkedOutAt: formatDateTime_(loan.checked_out_at),
        dueAt: formatDateTime_(loan.due_at),
        returnedAt: loan.returned_at ? formatDateTime_(loan.returned_at) : '',
        statusCode: loan.status_code || ''
      };
    });

  var activeReservationRows = readTable_(LIBRARY_MVP.SHEETS.RESERVATIONS).rows
    .filter(function(r) { return r.title_id === titleId && (r.status_code === 'WAITING' || r.status_code === 'READY'); })
    .sort(reservationSort_);
  var reservationItems = activeReservationRows.slice(0, TITLE_DETAIL_RESERVATION_LIMIT_).map(function(r) {
    var member = memberById[r.member_id];
    return {
      reservationId: r.reservation_id,
      memberNo: member ? member.member_no : '',
      memberName: member ? member.name : '',
      statusCode: r.status_code,
      queueSeq: Number(r.queue_seq || 0),
      requestedAt: formatDateTime_(r.requested_at),
      readyAt: r.ready_at ? formatDateTime_(r.ready_at) : '',
      pickupExpiresAt: r.pickup_expires_at ? formatDateTime_(r.pickup_expires_at) : ''
    };
  });

  return {
    titleId: titleId,
    isbn13: title.isbn13 || '',
    title: title.title || '',
    subtitle: title.subtitle || '',
    authors: authorNames.join(' · '),
    publisher: title.publisher || '',
    publishedYear: title.published_year || '',
    languageCode: title.language_code || '',
    materialTypeCode: title.material_type_code || '',
    classification: primaryCategory ? (primaryCategory.name_ko || primaryCategory.category_code || '') : '',
    description: title.description || '',
    coverUrl: title.cover_url || '',
    pageCount: pageCount,
    titleStatusCode: title.status_code || '',
    focusCopyId: focusCopy ? focusCopy.copy_id : '',
    copies: copies,
    loanHistory: loanHistory,
    reservations: {
      waitingCount: activeReservationRows.filter(function(r) { return r.status_code === 'WAITING'; }).length,
      readyCount: activeReservationRows.filter(function(r) { return r.status_code === 'READY'; }).length,
      items: reservationItems
    }
  };
}

// --------------------------- 웹앱 예약 관리(reservations, todo/12) ---------------------------
//
// 걸기(reserve)·취소(cancelReservation)는 위 apiWebReserve_/apiWebCancelReservation_이 담당한다
// (executeWrite_로 reserve_/cancelReservation_ 재사용, 쓰기 없음 아님 — 그 둘은 쓰기 액션이고
// 이 함수만 읽기 전용). 이 함수는 관리 뷰(webapp/src/views/reservations)의 목록 조회 전용 —
// 11_RESERVATIONS를 직접 읽어 TITLES/MEMBERS/COPIES와 조인한다(reportRecallNotice_·
// apiWebCatalogSync_·getDashboardData_와 같은 indexBy_ 조인 패턴 재사용, 새 로직 없음).
//
// payload.status(선택, 'WAITING'|'READY')로 목록(items)만 좁혀 받을 수 있다 — waitingCount/
// readyCount는 status 필터와 무관하게 항상 전체(WAITING+READY) 기준으로 돌려준다(탭 배지 숫자가
// 현재 보고 있는 탭에 따라 줄어들지 않게 하기 위함, docs/ASSUMPTIONS.md todo/12 참고). "만료임박"은
// 서버 개념이 아니다 — 프론트가 pickupExpiresAtMs를 now와 비교해 클라이언트에서 판정한다(todo
// 본문 지시, "no server-side urgency concept").
function apiWebReservations_(payload) {
  payload = payload || {};
  var statusFilter = cleanText_(payload.status || '');
  if (statusFilter && statusFilter !== 'WAITING' && statusFilter !== 'READY') {
    fail_('VALIDATION_ERROR', '지원하지 않는 status입니다: ' + statusFilter);
  }
  var titleById = indexBy_(readTable_(LIBRARY_MVP.SHEETS.TITLES).rows, 'title_id');
  var memberById = indexBy_(readTable_(LIBRARY_MVP.SHEETS.MEMBERS).rows, 'member_id');
  var copyById = indexBy_(readTable_(LIBRARY_MVP.SHEETS.COPIES).rows, 'copy_id');

  var active = readTable_(LIBRARY_MVP.SHEETS.RESERVATIONS).rows.filter(function(row) {
    return row.status_code === 'WAITING' || row.status_code === 'READY';
  });
  var rows = statusFilter ? active.filter(function(row) { return row.status_code === statusFilter; }) : active;

  // READY(만료 임박 우선) 먼저, 그다음 WAITING(queue_seq 순) — todo 지시 "READY-with-nearest
  // -expiry first, then WAITING by queue position".
  rows = rows.slice().sort(function(a, b) {
    if (a.status_code !== b.status_code) return a.status_code === 'READY' ? -1 : 1;
    if (a.status_code === 'READY') {
      var ae = asDate_(a.pickup_expires_at);
      var be = asDate_(b.pickup_expires_at);
      return (ae ? ae.getTime() : Number.MAX_SAFE_INTEGER) - (be ? be.getTime() : Number.MAX_SAFE_INTEGER);
    }
    return reservationSort_(a, b);
  });

  var items = rows.map(function(row) {
    var title = titleById[row.title_id] || {};
    var member = memberById[row.member_id] || {};
    var copy = row.assigned_copy_id ? copyById[row.assigned_copy_id] : null;
    var expires = asDate_(row.pickup_expires_at);
    return {
      reservationId: row.reservation_id,
      titleId: row.title_id,
      title: title.title || row.title_id,
      memberId: row.member_id,
      memberNo: member.member_no || row.member_id,
      memberName: member.name || '',
      statusCode: row.status_code,
      queueSeq: Number(row.queue_seq || 0),
      assignedCopyId: row.assigned_copy_id || '',
      assignedBarcode: copy ? copy.barcode : '',
      requestedAt: formatDateTime_(row.requested_at),
      readyAt: row.ready_at ? formatDateTime_(row.ready_at) : '',
      pickupExpiresAt: row.pickup_expires_at ? formatDateTime_(row.pickup_expires_at) : '',
      pickupExpiresAtMs: expires ? expires.getTime() : 0
    };
  });

  return {
    items: items,
    waitingCount: active.filter(function(row) { return row.status_code === 'WAITING'; }).length,
    readyCount: active.filter(function(row) { return row.status_code === 'READY'; }).length
  };
}

function normalizeIsbn13Strict_(value) {
  var raw = cleanText_(value).replace(/[^0-9]/g, '');
  if (raw.length !== 13) fail_('INVALID_ISBN', 'ISBN-13(13자리 숫자)만 지원합니다: ' + value);
  if (raw.slice(0, 3) !== '978' && raw.slice(0, 3) !== '979') {
    fail_('INVALID_ISBN', 'ISBN이 아닙니다(978/979로 시작해야 함) — 부가기호(5자리) 바코드는 지원하지 않습니다: ' + value);
  }
  var sum = 0;
  for (var i = 0; i < 12; i++) sum += Number(raw.charAt(i)) * (i % 2 === 0 ? 1 : 3);
  var checkDigit = (10 - (sum % 10)) % 10;
  if (checkDigit !== Number(raw.charAt(12))) fail_('INVALID_ISBN', 'ISBN 체크디지트가 올바르지 않습니다: ' + raw);
  return raw;
}

function apiLookupIsbn_(payload) {
  var isbn = normalizeIsbn13Strict_(payload.isbn);
  var existingTitle = readTable_(LIBRARY_MVP.SHEETS.TITLES).rows.find(function(row) {
    return normalizeIsbnLoose_(row.isbn13) === isbn;
  });

  var cache = CacheService.getScriptCache();
  var cacheKey = 'ISBN_' + isbn;
  var bibliographic;
  var cachedJson = cache.get(cacheKey);
  if (cachedJson) {
    bibliographic = JSON.parse(cachedJson);
  } else {
    var cachedRow = findBookCacheRow_(isbn);
    bibliographic = cachedRow ? bookCacheRowToPayload_(cachedRow) : lookupAladin_(isbn);
    if (!cachedRow) upsertBookCache_(isbn, bibliographic);
    cache.put(cacheKey, JSON.stringify(bibliographic), MOBILE_REG_CACHE_TTL_SECONDS_);
  }

  return {
    isbn: isbn,
    title: bibliographic.title,
    subtitle: bibliographic.subtitle,
    authors: bibliographic.authors,
    publisher: bibliographic.publisher,
    publishedYear: bibliographic.publishedYear,
    pageCount: bibliographic.pageCount,
    coverUrl: bibliographic.coverUrl,
    source: bibliographic.source,
    isDuplicate: Boolean(existingTitle),
    existingTitleId: existingTitle ? existingTitle.title_id : '',
    existingTitle: existingTitle ? existingTitle.title : ''
  };
}

// BOOK_CACHE는 조회 결과 재사용을 위한 부가 캐시 시트일 뿐 진위 데이터가 아니다(진위는 TITLES).
// 락 없이 조회-후-갱신하므로 동시 신규조회 레이스에서 드물게 중복 행이 생길 수 있으나
// find()가 첫 일치 행을 쓰므로 캐시 효과·정확성에는 영향 없다 — 매 조회마다 ScriptLock을 거는
// 비용이 더 크다고 판단해 의도적으로 잠그지 않는다.
function findBookCacheRow_(isbn) {
  return readTable_(LIBRARY_MVP.SHEETS.BOOK_CACHE).rows.find(function(row) {
    return normalizeIsbnLoose_(row.isbn13) === isbn;
  });
}

function bookCacheRowToPayload_(row) {
  return {
    isbn: row.isbn13,
    title: row.title,
    subtitle: row.subtitle,
    authors: row.authors,
    publisher: row.publisher,
    publishedYear: row.published_year,
    pageCount: row.page_count,
    coverUrl: row.cover_url,
    source: row.source
  };
}

function upsertBookCache_(isbn, data) {
  var record = {
    isbn13: isbn,
    title: safeText_(data.title || ''),
    subtitle: safeText_(data.subtitle || ''),
    authors: safeText_(data.authors || ''),
    publisher: safeText_(data.publisher || ''),
    published_year: integerOrBlank_(data.publishedYear),
    page_count: integerOrBlank_(data.pageCount),
    cover_url: safeText_(data.coverUrl || ''),
    source: cleanCode_(data.source || 'UNKNOWN'),
    cached_at: new Date()
  };
  var existing = findBookCacheRow_(isbn);
  if (existing) {
    updateRecord_(LIBRARY_MVP.SHEETS.BOOK_CACHE, 'isbn13', existing.isbn13, record, 'SYSTEM');
  } else {
    appendRecord_(LIBRARY_MVP.SHEETS.BOOK_CACHE, record);
  }
}

function lookupAladin_(isbn13) {
  var key = PropertiesService.getScriptProperties().getProperty('ALADIN_TTB_KEY');
  if (!key) fail_('ALADIN_KEY_MISSING', 'ScriptProperties에 ALADIN_TTB_KEY가 설정되어 있지 않습니다.');
  var url = 'https://www.aladin.co.kr/ttb/api/ItemLookUp.aspx'
    + '?ttbkey=' + encodeURIComponent(key)
    + '&itemIdType=ISBN13&ItemId=' + encodeURIComponent(isbn13)
    + '&output=js&Version=20131101&Cover=Big&OptResult=packing';
  var response;
  try {
    response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  } catch (networkError) {
    fail_('ALADIN_UNAVAILABLE', '알라딘 API 호출에 실패했습니다: ' + (networkError.message || networkError));
  }
  if (response.getResponseCode() !== 200) fail_('ALADIN_UNAVAILABLE', '알라딘 API 응답 오류: HTTP ' + response.getResponseCode());
  var parsed;
  try {
    parsed = JSON.parse(response.getContentText());
  } catch (parseError) {
    fail_('ALADIN_UNAVAILABLE', '알라딘 API 응답을 해석할 수 없습니다.');
  }
  var item = parsed && parsed.item && parsed.item[0];
  if (!item) fail_('NOT_FOUND', '알라딘에서 서지를 찾지 못했습니다. 수동 입력하세요.');
  // ⚠️ 필드명(author/pubDate/subInfo.itemPage/cover)은 알라딘 공식 문서 기준 — 실제 TTB 키로
  // 1회 이상 라이브 호출해 응답을 확인하기 전까지는 검증되지 않은 매핑입니다 (PATCH_NOTES 참고).
  return {
    isbn: isbn13,
    title: safeText_(item.title || ''),
    subtitle: '',
    authors: safeText_(String(item.author || '').replace(/\s*\((지은이|옮긴이|그림|엮은이)\)/g, '')),
    publisher: safeText_(item.publisher || ''),
    publishedYear: item.pubDate ? Number(String(item.pubDate).slice(0, 4)) || '' : '',
    pageCount: item.subInfo && item.subInfo.itemPage ? Number(item.subInfo.itemPage) || '' : '',
    coverUrl: safeText_(item.cover || ''),
    source: 'ALADIN'
  };
}

function apiRegisterByIsbn_(payload) {
  return executeWrite_('REGISTER_BY_ISBN', payload || {}, function(actor, requestId, transaction) {
    return registerByIsbn_(payload || {}, actor, requestId, transaction);
  });
}

function registerByIsbn_(payload, actor, requestId, transaction) {
  var isbn = normalizeIsbn13Strict_(payload.isbn);
  var operator = safeText_(requiredText_(payload.operator, '작업자'));
  var copyCount = 1;
  if (payload.copyCount !== undefined && payload.copyCount !== '' && payload.copyCount !== null) {
    copyCount = nonNegativeInteger_(payload.copyCount, '복본수');
  }
  if (copyCount < 1 || copyCount > 50) fail_('VALIDATION_ERROR', '복본수는 1~50 사이의 정수여야 합니다.');

  var title, created;
  try {
    var titleResult = registerTitle_({
      title: requiredText_(payload.title, '서명'),
      isbn: isbn,
      subtitle: payload.subtitle,
      publisher: payload.publisher,
      publishedYear: payload.publishedYear,
      authors: payload.authors,
      coverUrl: payload.coverUrl,
      // page_count는 TITLES 정식 컬럼이 아님(스키마 확장은 범위 밖 — 게이미피케이션 산식 확정 후 검토).
      // 유실 방지를 위해 서지 설명에 보강 기록만 한다.
      description: payload.pageCount ? ('페이지수 ' + payload.pageCount + ' · 폰 등록') : '폰 등록',
      createCopy: false
    }, actor, requestId, transaction);
    title = { title_id: titleResult.titleId, title: titleResult.title };
    created = true;
  } catch (error) {
    if (error.code !== 'DUPLICATE_ISBN') throw error;
    // 동시 등록 레이스: 이 요청이 락을 기다리는 동안 다른 기기가 같은 신규 ISBN을 먼저 커밋한 경우.
    // 클라이언트에는 에러로 보이지 않고 정상적인 "복본 추가"로 흡수된다 (TASK_MOBILE_REG §병렬).
    var existing = readTable_(LIBRARY_MVP.SHEETS.TITLES).rows.find(function(row) {
      return normalizeIsbnLoose_(row.isbn13) === isbn;
    });
    if (!existing) throw error; // 이론상 도달 불가 — 방어적 재throw
    if (existing.status_code !== 'ACTIVE') fail_('TITLE_INACTIVE', '비활성 도서에는 복본을 추가할 수 없습니다: ' + existing.title);
    title = { title_id: existing.title_id, title: existing.title };
    created = false;
  }

  var barcodes = [];
  for (var i = 0; i < copyCount; i++) {
    var copyResult = registerCopy_({
      titleKey: title.title_id,
      condition: payload.condition,
      locationCode: payload.locationCode,
      shelfCode: payload.shelfCode,
      note: '폰 등록 · ' + operator
    }, actor, requestId, transaction);
    barcodes.push(copyResult.barcode);
  }

  writeAudit_(actor, requestId, created ? 'CREATE' : 'APPEND', 'MOBILE_REG', title.title_id, {},
    { isbn: isbn, copyCount: copyCount, operator: operator, titleCreated: created, barcodes: barcodes },
    '폰 등록 · ' + operator + (created ? ' · 신규 서지' : ' · 기존 서지에 복본 추가'), transaction);

  return {
    targetType: 'TITLE', targetId: title.title_id,
    titleId: title.title_id, title: title.title, isbn: isbn,
    created: created, copyCount: copyCount, barcodes: barcodes, operator: operator
  };
}

// 웹앱용 무ISBN 수동 등록 + 복본 일괄 발급(todo/16 「등록 확장」) — 위 apiWeb* 함수들과 정확히
// 같은 패턴(executeWrite_로 감싸 멱등·감사 로그를 얻는다, doPost가 이미 바깥 runApi_ 1겹을
// 제공하므로 이중 래핑하지 않음). registerTitle_/registerCopy_/prepareCopyPayload_ 본문은 이
// 항목에서 전혀 수정하지 않는다(절대 규칙) — payload 키도 그 함수들이 이미 기대하는 이름을
// 그대로 쓴다(title/isbn(생략 가능)/authors/categoryCodes/createCopy+복본 필드 /
// titleKey+복본 필드).
//
// registerByIsbn_(위)이 ISBN 있는 경로에서 이미 registerTitle_(createCopy:false)+registerCopy_
// 반복을 "한 executeWrite_ 트랜잭션 안"에서 쓰는 것과 달리, 이 두 함수는 웹앱이 "무ISBN 등록
// 1건"과 "복본 N개 중 1개"를 각각 독립된 웹 요청으로 보내게 하기 위한 것이다. 복본 일괄 발급은
// 프론트가 apiWebRegisterCopy_를 N번 순차 호출한다(Promise.all이 아니라 하나씩 await) — 이유
// 둘: (1) executeWrite_ 안 withWriteLock_이 모든 쓰기를 서버에서 이미 직렬화하므로 N번 순차
// 호출이어야 매번 진짜 "다음 순번" 바코드(nextNumericCode_)를 받는다(병렬 호출도 락 때문에
// 결과적으로 순서대로 처리되긴 하지만, 그러면 "몇 번째 요청이 몇 번째 바코드를 받았는지"가
// 클라이언트 쪽에서 뒤섞여 진행률 표시·부분 실패 시 "몇 권까지 성공했는지"를 알 수 없게 된다),
// (2) "발급 중 3/5" 같은 실시간 진행률 표시와 부분 실패 시 "이미 발급된 것은 그대로 두고 나머지만
// 재시도"를 프론트가 구현하려면 각 호출의 성공/실패를 즉시 알아야 한다.
function apiWebRegisterTitle_(payload) {
  return executeWrite_('CREATE_TITLE', payload || {}, function(actor, requestId, transaction) {
    return registerTitle_(payload || {}, actor, requestId, transaction);
  });
}

function apiWebRegisterCopy_(payload) {
  return executeWrite_('CREATE_COPY', payload || {}, function(actor, requestId, transaction) {
    return registerCopy_(payload || {}, actor, requestId, transaction);
  });
}

// --------------------------- 서지 일괄 보강(todo/17, "약속 상환") ---------------------------
//
// ISBN은 있는데 페이지·표지가 비어 있는 03_TITLES를 알라딘 조회(21_BOOK_CACHE 우선)로 채운다.
// 03_TITLES에는 애초에 페이지수 컬럼이 없다(HEADERS 참고 · apiWebTitleDetail_ 주석 ·
// docs/ASSUMPTIONS.md todo/11) — 그래서 "페이지 채움"은 TITLES를 고치는 일이 아니라
// 21_BOOK_CACHE에 해당 isbn13의 캐시 행(page_count 포함)이 존재하도록 만드는 일이다. 이렇게 해야
// apiWebTitleDetail_의 기존 "최선노력" 조인이 실제로 값을 찾아낸다 — 예: registerByIsbn_(폰 등록)
// 경로를 거치지 않고 ISBN만 타이핑되어 등록된 서지(registerTitle_의 일반 경로, todo/16 이전부터
// 있던 수동 등록 화면 포함)나 대량 이관 서지가 대상이다. cover_url은 TITLES 정식 컬럼이라 비어
// 있으면 직접 채운다(이미 값이 있으면 절대 덮어쓰지 않는다 — "채움"이지 "재조회 갱신"이 아니다).
//
// UrlFetch(알라딘 실호출) 절약: 21_BOOK_CACHE에 page_count가 있는 캐시 히트면 절대 재호출하지
// 않는다(findBookCacheRow_/bookCacheRowToPayload_ 재사용, 무수정). 1회 실행 상한
// (ENRICH_BIBLIOGRAPHIC_BATCH_LIMIT_)을 두고, "재실행으로 이어가기"는 별도 커서/북마크 없이
// 구현했다 — 후보 집합 자체가 이번 실행에서 채운 만큼 자연히 줄어들므로, 매 실행이 "다음 N건"을
// 그대로 다시 뽑기만 해도 반복 호출이 전체 백로그를 순서대로 커버한다. 안정 순서는 title_id
// 정렬이 아니라 시트 원본 행 순서(= append-only 원장의 생성 순서, readTable_가 이미 보존)를
// 그대로 쓴다 — title_id가 newId_()의 UUID 기반이라 정렬해도 의미 있는 순서가 아니기 때문
// (docs/ASSUMPTIONS.md todo/17 참고).
var ENRICH_BIBLIOGRAPHIC_BATCH_LIMIT_ = 200;

function buildBookCacheIndexByIsbn_() {
  var index = {};
  readTable_(LIBRARY_MVP.SHEETS.BOOK_CACHE).rows.forEach(function(row) {
    var key = normalizeIsbnLoose_(row.isbn13);
    if (key) index[key] = row;
  });
  return index;
}

function hasCachedPageCount_(cacheRow) {
  return Boolean(cacheRow && cacheRow.page_count !== '' && cacheRow.page_count !== null && cacheRow.page_count !== undefined);
}

// 전체 TITLES를 훑는 후보 판정은 O(titles) 1회 + O(book_cache) 1회(인덱스 생성)로 끝낸다 — 후보
// 마다 findBookCacheRow_()(호출 시마다 21_BOOK_CACHE를 선형 탐색)를 부르면 O(titles × book_cache)가
// 되어 CLAUDE.md 절대 규칙 8번(파생 뷰 O(n²) 금지)에 걸린다. 실제 후보 "처리" 루프는 상한(≤200건)
// 으로 이미 개수가 고정돼 있으므로 그 안에서는 기존 findBookCacheRow_()를 그대로 재사용해도
// 안전하다(고정 상한 × book_cache 크기일 뿐, titles 전체 크기와 무관하다).
function findEnrichCandidates_(cacheByIsbn) {
  return readTable_(LIBRARY_MVP.SHEETS.TITLES).rows.filter(function(title) {
    var isbn = normalizeIsbnLoose_(title.isbn13);
    if (!isbn) return false;
    if (!cleanText_(title.cover_url)) return true;
    return !hasCachedPageCount_(cacheByIsbn[isbn]);
  });
}

function enrichBibliographicBatch_(payload, actor, requestId, transaction) {
  payload = payload || {};
  var limit = ENRICH_BIBLIOGRAPHIC_BATCH_LIMIT_;
  if (payload.limit !== undefined && payload.limit !== '' && payload.limit !== null) {
    var requested = Math.floor(Number(payload.limit));
    if (requested > 0) limit = Math.min(requested, ENRICH_BIBLIOGRAPHIC_BATCH_LIMIT_);
  }

  var cacheIndexBefore = buildBookCacheIndexByIsbn_();
  var beforeCandidates = findEnrichCandidates_(cacheIndexBefore);
  var blankBeforeCount = beforeCandidates.length;
  var candidates = beforeCandidates.slice(0, limit);

  var enrichedCount = 0;
  var skippedCacheHitCount = 0;
  var failedCount = 0;
  var failures = [];

  candidates.forEach(function(title) {
    var isbn = normalizeIsbnLoose_(title.isbn13);
    try {
      var cacheRow = findBookCacheRow_(isbn);
      var bibliographic;
      if (hasCachedPageCount_(cacheRow)) {
        bibliographic = bookCacheRowToPayload_(cacheRow);
        skippedCacheHitCount++;
      } else {
        // UrlFetchApp 실호출 — 알라딘 절판/네트워크 오류(lookupAladin_ 내부의
        // fail_('NOT_FOUND'|'ALADIN_UNAVAILABLE', ...))가 이 ISBN 하나 때문에 던져질 수 있다.
        // try/catch로 이 건만 실패 처리하고 배치 전체는 절대 중단하지 않는다(요구사항 그대로).
        bibliographic = lookupAladin_(isbn);
        upsertBookCache_(isbn, bibliographic);
        enrichedCount++;
      }
      if (!cleanText_(title.cover_url) && cleanText_(bibliographic.coverUrl)) {
        transactionUpdateRecord_(transaction, LIBRARY_MVP.SHEETS.TITLES, 'title_id', title.title_id, { cover_url: safeText_(bibliographic.coverUrl) }, actor.id);
      }
    } catch (error) {
      failedCount++;
      failures.push({ titleId: title.title_id, isbn: isbn, code: error.code || 'UNEXPECTED_ERROR', message: String(error.message || error).slice(0, 200) });
    }
  });

  var remainingBlankCount = findEnrichCandidates_(buildBookCacheIndexByIsbn_()).length;

  writeAudit_(actor, requestId, 'ENRICH_BIBLIOGRAPHIC', 'BATCH', 'BIBLIOGRAPHIC',
    { blankBeforeCount: blankBeforeCount, limit: limit },
    { processedCount: candidates.length, enrichedCount: enrichedCount, skippedCacheHitCount: skippedCacheHitCount, failedCount: failedCount, remainingBlankCount: remainingBlankCount },
    '서지 일괄 보강 · 빈 항목 ' + blankBeforeCount + '→' + remainingBlankCount + '건 · 처리 ' + candidates.length + '건(신규조회 ' + enrichedCount + ' · 캐시히트 ' + skippedCacheHitCount + ' · 실패 ' + failedCount + ')',
    transaction);

  return {
    targetType: 'BATCH', targetId: 'BIBLIOGRAPHIC',
    blankBeforeCount: blankBeforeCount,
    processedCount: candidates.length,
    enrichedCount: enrichedCount,
    skippedCacheHitCount: skippedCacheHitCount,
    failedCount: failedCount,
    remainingBlankCount: remainingBlankCount,
    failures: failures.slice(0, 50)
  };
}

// 웹앱 action = 'enrichBibliographic'. todo/26(웹앱 설정 뷰)이 이 액션에 버튼 하나만 wiring하면
// 된다 — 이 함수 자체로 이미 완결된 액션이다(payload 없이 apiWebEnrichBibliographic_({})만
// 호출해도 기본 상한(200건)으로 동작). 26번 항목 이전에는 아래 runBibliographicEnrichment()
// (사이드바 관리 메뉴)로 오늘 바로 실행/시연할 수 있다.
function apiWebEnrichBibliographic_(payload) {
  return executeWrite_('ENRICH_BIBLIOGRAPHIC', payload || {}, function(actor, requestId, transaction) {
    return enrichBibliographicBatch_(payload || {}, actor, requestId, transaction);
  });
}

// 사이드바 관리 메뉴("서지 일괄 보강")가 호출하는 진입점 — 완료 조건("빈 페이지수 항목이 실행
// 후 감소 로그")을 웹앱 버튼(todo/26) 이전에도 오늘 바로 확인할 수 있게 한다.
function runBibliographicEnrichment() {
  var result = apiWebEnrichBibliographic_({});
  SpreadsheetApp.getUi().alert(
    '서지 일괄 보강 완료',
    '실행 전 빈 항목 ' + result.blankBeforeCount + '건 → 실행 후 ' + result.remainingBlankCount + '건\n' +
      '이번 실행 처리 ' + result.processedCount + '건 (신규조회 ' + result.enrichedCount + ' · 캐시히트 ' + result.skippedCacheHitCount + ' · 실패 ' + result.failedCount + ')',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
  return result;
}

// --------------------------- 수기입력 (todo/21, 구 PATCH_SPEC P3) ---------------------------
//
// GAS 자체가 죽었을 때(배포 오류·네트워크 두절 등) 사서가 대출/반납을 시트에 손으로 적어 두었다가
// GAS가 돌아오면 한 번에 흡수하는 비상 경로(PATCH_SPEC.md "P3 · 수기입력" 원문). 그래서
// 22_MANUAL_ENTRY는 이 프로젝트에서 유일하게 protectDatabaseSheets_의 ADMIN 전용 보호를 걸지
// 않는 쓰기 시트여야 한다 — 사서가 "GAS 없이" 바로 타이핑할 수 있어야 이 경로의 존재 이유가
// 성립한다.
//
// 아키텍처 결정 — 왜 LIBRARY_MVP.HEADERS에 넣지 않았는가:
// ensureSchema_()(135행)와 protectDatabaseSheets_()(226행)는 둘 다 그대로
// Object.keys(LIBRARY_MVP.HEADERS)를 순회한다(둘 다 "기존 함수 수정 금지" 대상). HEADERS에 시트를
// 등록하는 순간 "누락 시 자동 생성"과 "자동 ADMIN 전용 보호"가 한 세트로 묶여 버려서, 이 시트만
// 전자는 원하고 후자는 원하지 않는 요구를 그 두 함수를 고치지 않고는 만족시킬 수 없다. 그래서:
//   1) LIBRARY_MVP.SHEETS에만 이름을 등록했다(위 SHEETS.MANUAL_ENTRY 참고) — 이 맵은
//      ensureSchema_/protectDatabaseSheets_ 어느 쪽도 순회하지 않으므로(둘 다 HEADERS의 키만
//      본다) 두 함수 입장에서는 완전히 보이지 않는다(inert). 다른 상수들과의 이름 관례 통일
//      목적뿐이다.
//   2) 생성은 이 파일에서 새로 만든 ensureManualEntrySheet_()가 멱등하게 담당한다(아래).
//   3) readTable_(sheetName)(2245행)은 `var requiredHeaders = LIBRARY_MVP.HEADERS[sheetName] || [];`
//      로 필수 헤더를 구한다 — HEADERS에 없는 시트는 requiredHeaders가 빈 배열이 되어 헤더 검사가
//      트리비얼하게 통과하고, 시트에 실제로 있는 헤더를 그대로 읽어 온다. 그래서 이 시트에도
//      readTable_를 무수정으로 재사용할 수 있다.
// 결과: ensureSchema_·protectDatabaseSheets_ 단 한 줄도 건드리지 않고 "자동 생성되지만 영구
// 비보호"인 시트를 만들었다 — 과제가 제시한 "강력히 선호되는 설계"를 그대로 따랐고, 대체안(
// protectDatabaseSheets_ 내부 제외 가드 한 줄)은 필요하지 않았다.
var MANUAL_ENTRY_HEADERS_ = ['일시', '구분(대출/반납)', 'barcode', '학생(학번 또는 이름)', '처리자', '메모', '처리상태', '처리결과'];

function ensureManualEntrySheet_() {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(LIBRARY_MVP.SHEETS.MANUAL_ENTRY);
  if (sheet) return sheet;
  sheet = ss.insertSheet(LIBRARY_MVP.SHEETS.MANUAL_ENTRY);
  sheet.getRange(1, 1, 1, MANUAL_ENTRY_HEADERS_.length).setValues([MANUAL_ENTRY_HEADERS_]);
  formatNewDbSheet_(sheet, MANUAL_ENTRY_HEADERS_.length);
  // barcode·학생(학번 또는 이름) 열은 formatIdTextColumns_(318행, 08_COPIES.barcode·
  // 09_MEMBERS.member_no/school_no에 하는 것과 같은 이유로) 텍스트 서식(@)을 걸어 둔다 —
  // 이 시트는 사서가 직접 타이핑하므로, 서식이 없으면 "0000123" 같은 값을 Sheets가 숫자 123으로
  // 바꿔 버려 앞자리 0이 사라지고 findCopyByKey_/resolveManualEntryMember_가 못 찾게 된다. 이건
  // formatIdTextColumns_ 자체를 부르거나 고치는 게 아니라 이 시트 전용으로 같은 기법을 한 번 더
  // 쓰는 것뿐이다(그 함수는 MEMBERS/COPIES만 대상으로 하드코딩돼 있어 애초에 이 시트를 모른다).
  ['barcode', '학생(학번 또는 이름)'].forEach(function(header) {
    var colIndex = MANUAL_ENTRY_HEADERS_.indexOf(header);
    sheet.getRange(2, colIndex + 1, Math.max(1, sheet.getMaxRows() - 1), 1).setNumberFormat('@');
  });
  invalidateTableCache_(LIBRARY_MVP.SHEETS.MANUAL_ENTRY);
  return sheet;
}

// 학생 해석 — "학번 정확일치 → 이름 유일일치, 실패 시 오류"(PATCH_SPEC 원문). 이 코드베이스에서
// "학번"이라는 이름표가 실제로 붙어 있는 필드는 09_MEMBERS.student_no가 아니라 school_no다 —
// registerMember_(632행대)의 중복 검사 오류 메시지가 "같은 학번의 회원이 있습니다"라고 school_no
// 중복을 가리킨다(646~647행). student_no는 라벨이 "번호"인 반 좌석 번호일 뿐이고 학년·반 조합
// 안에서만 유일하다(전교 유일이 아님 — 649~653행 dupSeat 검사가 grade+classNo+studentNo 세 개를
// 함께 봐야 하는 이유). 그래서 "학번 정확일치"는 school_no 기준으로 판단하고, 사서가 도서관
// 회원번호(member_no, findMemberByKey_가 이미 쓰는 식별자)를 그대로 적는 경우도 자주 있을 것 같아
// 같이 받아 준다(둘 중 하나만 정확히 일치해도 통과). docs/ASSUMPTIONS.md todo/21에 이 판단
// 근거를 남겼다 — 과제 메모가 예시로 든 "student_no"를 문자 그대로 따르지 않은 이유다.
function resolveManualEntryMember_(key) {
  var normalizedCode = cleanCode_(key);
  var members = readTable_(LIBRARY_MVP.SHEETS.MEMBERS).rows;
  if (normalizedCode) {
    var byCode = members.filter(function(row) {
      return row.status_code !== 'WITHDRAWN' &&
        (cleanCode_(row.member_no) === normalizedCode || cleanCode_(row.school_no) === normalizedCode);
    });
    if (byCode.length === 1) return byCode[0];
    if (byCode.length > 1) fail_('AMBIGUOUS_MANUAL_ENTRY_MEMBER', '학번/회원번호가 일치하는 회원이 여러 명입니다: ' + key);
  }
  var normalizedName = normalizeText_(key);
  var byName = members.filter(function(row) { return row.status_code === 'ACTIVE' && normalizeText_(row.name) === normalizedName; });
  if (byName.length === 1) return byName[0];
  if (byName.length > 1) fail_('AMBIGUOUS_MANUAL_ENTRY_MEMBER', '동명이인 — 이름이 일치하는 활성 회원이 ' + byName.length + '명입니다: ' + key);
  fail_('MANUAL_ENTRY_MEMBER_NOT_FOUND', '학번/이름과 일치하는 회원을 찾을 수 없습니다: ' + key);
}

function writeManualEntryResult_(table, rowNumber, status, resultText) {
  table.sheet.getRange(rowNumber, table.index['처리상태'] + 1).setValue(status);
  table.sheet.getRange(rowNumber, table.index['처리결과'] + 1).setValue(safeText_(String(resultText || '').slice(0, 500)));
  // 이 시트는 08_COPIES 등과 달리 transactionUpdateRecord_/row_version 관례를 쓰지 않는 자유형
  // 로그 시트라 직접 setValue한다(과제 지시 그대로 — 되돌릴 "도메인 행"이 아니라 로그일 뿐이다).
  // 같은 실행 안에서 이 시트를 다시 읽는 코드가 없어도, 다음 호출·다른 액션이 항상 최신 상태를
  // 보도록 캐시를 무효화해 둔다.
  invalidateTableCache_(LIBRARY_MVP.SHEETS.MANUAL_ENTRY);
}

function summarizeManualEntryResult_(kind, result) {
  // executeWrite_(2410행대, 무수정)가 이미 COMPLETED로 기록된 requestId를 다시 받으면
  // checkout_/return_을 재실행하지 않고 { idempotent: true, ... } 요약만 돌려준다(정상 —
  // "행 처리상태='완료'를 먼저 거른다"는 우리 쪽 1차 방어선이 어떤 이유로든 못 걸렀을 때의
  // 안전망이 정확히 여기서 작동한 것). 이 경우 checkout_/return_ 고유 필드(memberName·title·
  // dueAt 등)가 없으므로 그것들을 읽으려 하지 않고 그 사실 자체를 요약으로 남긴다.
  if (result && result.idempotent) return '완료(이미 처리된 요청 — 이전 실행에서 처리됨, 중복 실행 아님)';
  if (kind === '대출') {
    return '대출 완료 · ' + (result.memberName || '') + '(' + result.memberNo + ') · ' + (result.title || result.barcode) + ' · 반납예정 ' + formatDateTime_(result.dueAt);
  }
  var overdueText = result.overdueDays ? ' · 연체 ' + result.overdueDays + '일 · 연체료 ' + result.fineAmount : '';
  return '반납 완료 · ' + (result.title || result.barcode) + overdueText;
}

// 미처리 행을 위→아래로 재생한다. requestId = 'MANUAL-' + 행번호라서 같은 행을 다시 흡수해도
// executeWrite_(2410행대, 무수정)의 기존 멱등 체계가 두 번째 checkout_/return_ 실행 자체를 막는다
// — 다만 그건 "혹시 재시도해도 안전하다"는 안전망이고, 1차 방어선은 아래 pending 필터다: 이미
// 처리상태='완료'로 적어 둔 행은 애초에 이번 실행의 candidates에도 들어가지 않으므로
// executeWrite_까지 갈 일이 없다(더 싸고 더 명확하다 — 과제 지시 그대로, "재처리 자체를 앱
// 레벨에서 먼저 피한다").
//
// 오류난 행을 고쳐서 재시도하는 방법이 실패 지점에 따라 갈린다는 점을 README.md에도 적었다:
//  - resolveManualEntryMember_/구분 파싱처럼 executeWrite_ 호출 "이전"에 실패한 행은
//    18_SYS_OPERATIONS에 그 requestId가 아예 없으므로, 행 내용을 고치고 처리상태·처리결과 칸을
//    지우면 다음 실행에서 완전히 새로 시도된다.
//  - checkout_/return_이 executeWrite_ 안에서 실제로 실패한 행(이미 대출 중·회원 정지 등)은
//    18_SYS_OPERATIONS에 그 requestId가 FAILED로 이미 남는다 — 같은 행을 고쳐서 같은 행번호로
//    다시 흡수해도 executeWrite_ 자체가 FAILED_REQUEST_REQUIRES_REVIEW로 거부한다(2432행,
//    무수정 — "새 요청 ID로 다시 실행하라"는 기존 설계 그대로). 그래서 이런 행은 고치지 말고
//    새 행을 추가해 다시 입력해야 한다.
function absorbManualEntries_() {
  // 역할 확인을 행 루프보다 먼저 한 번만 한다 — executeWrite_도 각 행마다 같은 검사를 하지만,
  // 거기 맡기면 권한이 없는 계정이 실행했을 때 대상 행 전부가 "오류(권한 없음)"로 낙인찍혀
  // 버린다(그러면 정당한 ADMIN/LIBRARIAN이 나중에 실행해도 처리상태가 이미 채워져 있어 pending
  // 필터에 안 걸린다). 권한 문제는 배치 전체를 조용히 실패시키는 게 맞다 — 개별 행 오류(동명이인
  // 등)와는 성격이 다르다.
  var actor = getActor_();
  requireRole_(actor, ['ADMIN', 'LIBRARIAN']);
  ensureManualEntrySheet_();
  var table = readTable_(LIBRARY_MVP.SHEETS.MANUAL_ENTRY);
  MANUAL_ENTRY_HEADERS_.forEach(function(header) {
    if (table.index[header] === undefined) fail_('SCHEMA_MISMATCH', LIBRARY_MVP.SHEETS.MANUAL_ENTRY + '에 필요한 헤더가 없습니다: ' + header);
  });

  var pending = table.rows.filter(function(row) { return !cleanText_(row['처리상태']); });
  var processedCount = 0;
  var succeededCount = 0;
  var failedCount = 0;

  pending.forEach(function(row) {
    processedCount++;
    var rowNumber = row._row;
    try {
      var kind = cleanText_(row['구분(대출/반납)']);
      var barcode = requiredText_(row['barcode'], 'barcode');
      var studentKey = requiredText_(row['학생(학번 또는 이름)'], '학생(학번 또는 이름)');
      var operationType;
      var targetFn;
      if (kind === '대출') { operationType = 'MANUAL_CHECKOUT'; targetFn = checkout_; }
      else if (kind === '반납') { operationType = 'MANUAL_RETURN'; targetFn = return_; }
      else fail_('VALIDATION_ERROR', "구분은 '대출' 또는 '반납'이어야 합니다: " + kind);

      var member = resolveManualEntryMember_(studentKey);
      var noteParts = ['[수기입력 행 ' + rowNumber + ']'];
      if (cleanText_(row['메모'])) noteParts.push(cleanText_(row['메모']));
      // apiWebCheckout_/apiWebReturn_(3081·3087행)과 같은 관례 — executeWrite_에 넘기는
      // payload와 실제 checkout_/return_에 넘기는 payload를 같은 객체로 재사용해 이중 래핑하지
      // 않는다. requestId를 이 payload 안에 넣어야 executeWrite_의 payloadHash가 매 실행마다
      // 같은 값으로 계산돼(행 내용을 안 고쳤다면) 두 번째 실행에서도 REQUEST_ID_CONFLICT가 나지
      // 않는다.
      var writePayload = {
        requestId: 'MANUAL-' + rowNumber,
        copyKey: barcode,
        memberKey: member.member_no,
        note: noteParts.join(' ')
      };
      var result = executeWrite_(operationType, writePayload, function(writeActor, requestId, transaction) {
        return targetFn(writePayload, writeActor, requestId, transaction);
      });
      writeManualEntryResult_(table, rowNumber, '완료', summarizeManualEntryResult_(kind, result));
      succeededCount++;
    } catch (error) {
      // 동명이인·회원 없음·소장본 대출 중 등 어떤 이유로 실패해도 이 행 하나만 오류로 남기고
      // 배치는 계속한다(PATCH_SPEC 수용 기준 "오류 행은 건너뛰고 계속"). catch를 행 단위로 두어
      // 다음 forEach 반복이 자동으로 이어진다 — 별도 continue 로직이 필요 없다.
      failedCount++;
      writeManualEntryResult_(table, rowNumber, '오류', error.message || String(error));
    }
  });

  return { processedCount: processedCount, succeededCount: succeededCount, failedCount: failedCount };
}

// 사이드바 관리 메뉴("수기입력 흡수")가 호출하는 진입점 — runBibliographicEnrichment(todo/17,
// 위)와 정확히 같은 패턴(결과를 alert로 보여 준다).
function runAbsorbManualEntries() {
  try {
    var result = absorbManualEntries_();
    var message = '대상 ' + result.processedCount + '건 · 성공 ' + result.succeededCount + '건 · 오류 ' + result.failedCount + '건';
    if (result.failedCount) {
      message += '\n오류 행은 ' + LIBRARY_MVP.SHEETS.MANUAL_ENTRY + ' 시트의 처리결과 열을 확인하세요. ' +
        '입력 오류(학번/이름/구분 등)는 고쳐서 처리상태 칸을 지우면 재시도되고, ' +
        '실제 처리 거부(이미 대출 중 등)는 그 행은 그대로 두고 새 행에 다시 입력하세요.';
    }
    SpreadsheetApp.getUi().alert('수기입력 흡수 완료', message, SpreadsheetApp.getUi().ButtonSet.OK);
    return result;
  } catch (error) {
    SpreadsheetApp.getUi().alert('수기입력 흡수 실패', error.message || String(error), SpreadsheetApp.getUi().ButtonSet.OK);
    throw error;
  }
}

// 웹앱 대시보드용 읽기 전용 미처리 건수(todo/21) — apiWebDashboard_/getDashboardData_(3201행,
// 무수정)과 같은 자리에서 쓰이지만 별도 액션으로 분리했다: 대시보드 응답 모양은
// getDashboardData_()가 고정으로 반환하는 그대로라 그 함수를 고치지 않고는 필드를 더할 수 없다
// (todo/12 readyPickup이 이미 같은 이유로 apiWebReservations_를 dashboard와 별도 액션으로 뒀다
// — 3197행 주석 참고). 시트가 아직 없으면(=이 경로가 한 번도 안 쓰였으면) 오류를 던지지 않고
// 0을 돌려준다 — ensureManualEntrySheet_는 여기서 부르지 않는다(순수 읽기 액션이 부작용으로
// 시트를 새로 만들면 안 된다는 판단).
function apiWebManualEntryPendingCount_(payload) {
  var sheet = getSpreadsheet_().getSheetByName(LIBRARY_MVP.SHEETS.MANUAL_ENTRY);
  if (!sheet) return { pendingCount: 0 };
  var table = readTable_(LIBRARY_MVP.SHEETS.MANUAL_ENTRY);
  if (table.index['처리상태'] === undefined) return { pendingCount: 0 };
  var pendingCount = table.rows.filter(function(row) { return !cleanText_(row['처리상태']); }).length;
  return { pendingCount: pendingCount };
}
