# 112 · gate-url-hint — 세션게이트 URL 오형식 침묵 (시각 감사 11R)

배경(증빙 /tmp/vis/r13-gate-invalid.png + 로직 확인): 버튼 비활성은 "빈 값"만 본다 —
"not-a-url" 같은 오형식은 그대로 저장돼 이후 모든 호출이 네트워크 오류로만 나타난다(원인
추적이 사서 몫). 최초 설정은 이 앱에서 가장 중요한 입력인데 형식 피드백이 침묵.

할 일: https URL 파싱 검증 — 비어 있지 않고 오형식이면 입력 아래 조용한 힌트(--fail,
aria-describedby·aria-invalid) + 버튼 비활성 유지. smoke 게이트 스텝에 오형식→힌트→정정
단정 추가. (components/**는 i18n 리터럴 면제 — 기존 한국어 리터럴 관례 유지.)

완료 조건: 재캡처, 전 게이트, e2e.

---

## 이행 노트 (완료)

- isLikelyWebAppUrl(https + URL 파싱) 검증 — 오형식이면 입력 아래 조용한 인라인 힌트(--fail,
  aria-invalid + aria-describedby) + 버튼 비활성. save()도 동일 기준(방어 이중화).
- smoke 게이트 스텝에 오형식→힌트 가시·버튼 비활성→정정→힌트 소멸 상주 단정.
- 재캡처(/tmp/vis/112-crop.png): 침묵 대신 이유가 보인다. 전 게이트 · 13 e2e 통과.
