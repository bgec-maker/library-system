# 도서관 관리 시스템

QR 기반 도서관 시스템. 장서 5,000권+, 무료 티어로만 구성.

```
GitHub Pages (React PWA)  →  Google Apps Script (JSON API)  →  Google Sheets (DB)
```

---

## 지금은 Phase 0 — 위험 검증 스파이크

**아직 앱이 아닙니다.** 이 프로젝트의 유일한 존재론적 위험을 확인하는 단계입니다.

> **설치형 PWA(홈 화면 추가) 안에서 카메라가 켜지고 QR이 연속으로 읽히는가?**

❌라면 PWA를 포기하거나 네이티브 래퍼를 검토해야 합니다. **React를 붙이기 전에** 알아야 합니다.

### 배포 (10분)

```bash
git init && git add . && git commit -m "Phase 0: 카메라·PWA 검증 스파이크"
git branch -M main
git remote add origin https://github.com/<ORG>/<REPO>.git
git push -u origin main
```

**Settings → Pages → Source: `GitHub Actions`** → 몇 분 뒤 배포됩니다.

### 검사 (30분)

`spike/README.md` 절차대로. **핵심은 아이폰입니다:**

Safari로 열기 → **공유 → 홈 화면에 추가** → **그 아이콘으로 다시 열기** → 카메라 시작 → 스캔

브라우저 탭에서 되는 건 이미 압니다. **설치형에서 되는지**가 관건입니다.

---

## 문서

| 문서 | 내용 |
|---|---|
| **`CLAUDE.md`** | 에이전트 작업 지침 — Claude Code가 먼저 읽습니다 |
| **`docs/HANDOFF.md`** | 확정된 결정 + **하드 제약 10개** |
| **`docs/WORKFLOW.md`** | Phase 0~10 지도 + 문서 계획 |
| **`docs/SCHEMA.md`** | 시트 13종, GAS API, 권한 매트릭스 |
| **`spike/README.md`** | 스파이크 배포·검사 절차 |

---

## Claude Code에게 넘길 때

```
CLAUDE.md를 읽고 시작해줘.
지금은 Phase 0이야. §2 하드 제약을 반드시 지키고, 🟡 미정 항목은 나에게 물어봐.
```
