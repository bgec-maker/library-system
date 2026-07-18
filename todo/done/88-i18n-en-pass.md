# 88 · i18n-en-pass — 영어 카피 품질 패스

배경: en.json은 기계적으로 따라온 문구가 있다 — 영어 화면의 어색한 직역을 한 번 훑을 때가 됐다.

할 일: en.json 전수 낭독 검토 — 명사구 통일(Checkout·Return 등), 문장부호·대소문자 규칙,
버튼=동사 원칙. ko와 의미 등가 유지(완전성 게이트가 짝을 보증).

완료 조건: 변경 목록 기록, i18n 게이트.

---

## 이행 노트 (완료) — 변경 목록 28건

**뷰 이름 참조 일관성** (실제 화면 제목과 자구 일치):
- recentOps.emptyAction: "Open Checkout·Return" → "Open Checkout / Return" (가운뎃점은 한국어 표기)
- register.trayIdempotentNote: "Recent Ops" → "Recent Activity" (실제 뷰 제목)
- dashboard.recentOps.openButton: "Open recent activity" → "Open Recent Activity"
- loanReturn.isbnHint: "the Register view" → "the Register Book view"
- settings COPY_STATUS_MISMATCH.hint / reservations.arrivalHint: "Checkout/Return" → "Checkout / Return"

**어법·동사 교정**:
- loanReturn.hint: "to automatically checkout"(명사를 동사로 오용) → "checkout or return is detected automatically"
- camera missHint: "add light" → "into brighter light" · continuousModeHint: "like lunch rush" → "like the lunch rush"
- register failReasonTimeout/Busy 자연화, errorSaveFailed "try again or retry" 중복 제거
- addAsDuplicate: "Add as copy" → "Add a copy" · bulkPencilHint: "Copy each number" → "Write each number"(연필 기입)
- bookDetail.invalidQuery: "registration number link" → "barcode link" (en 표기 통일: 등록번호=barcode)
- recall.subtitle: "perforated slips"(천공 아님) → "cut-apart slips" (절취선)
- manualEntryPending.hint: "Loan/return rows" → "Checkout/return rows" · overdueTop.title: "Top overdue" → "Longest overdue"

**표·수치 표기**: dataTable.pageStatus "({total} total)" → "({total} items)" · 트리거명 "(04:00 daily)" 중복 "daily" 제거 ×2 · enrichHint 괄호문 → 대시 연결

**viz 카피**: budgetPicture.skippedLine 목적어 누락("{date} with no…" → "{date} copies with no…") ·
collectionAge staleLine 어순/subtitle 자연화 · classParticipation 열머리 "No-loan count" → "No loans" ·
loanTimeOfDay "station and helper staffing" → "when the desk needs helpers" · shelfHeatmap "a basis for" → "grounds for"

ko 의미 등가 유지(완전성 게이트 통과) · smoke(언어 토글 포함) 통과.
