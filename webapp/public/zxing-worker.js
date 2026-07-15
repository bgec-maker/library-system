// zxing-worker.js — todo/14 「부채 상환 세트」: ZXing 디코드를 메인 스레드에서 이 클래식(비-모듈)
// Web Worker로 옮긴다. webapp/src/services/camera.ts의 단일 호출점(new Worker(...))에서만
// 만들어진다 — 이 파일 자체는 순수 워커 스크립트라 어떤 서비스/뷰도 직접 import하지 않는다.
//
// zxing.js(벤더 UMD 번들, public/ 같은 디렉터리, 수정 금지)를 importScripts로 상대 경로 로드한다.
// zxing.js의 UMD 헤더:
//   !function(t,e){"object"==typeof exports&&"undefined"!=typeof module?e(exports)
//     :"function"==typeof define&&define.amd?define(["exports"],e)
//     :e((t="undefined"!=typeof globalThis?globalThis:t||self).ZXing={})}(this,(function(t){...
// exports/module/define이 전부 없으면 마지막 분기를 타 (globalThis가 있으면 globalThis, 없으면
// self)에 ZXing을 매단다. 이 워커 전역 스코프에도 self/globalThis가 존재하고(둘이 같은 객체를
// 가리킴) exports/module/define은 여전히 없으므로, <script> 태그로 메인 스레드에 로드할 때와
// 완전히 같은 폴백 분기를 타 self.ZXing = {...}가 되고, 이 파일 안에서도 전역 `ZXing`으로 그대로
// 참조할 수 있다(camera.ts의 옛 ensureZXingLoaded() 주석과 동일한 근거).
importScripts('zxing.js');

// initDecoder()(camera.ts)가 메인 스레드에서 하던 것과 정확히 같은 리더 하나 + 힌트 — 워커
// 시작 시 한 번만 만들고 그 뒤로는 재사용한다(reset()으로 프레임마다 상태만 비운다).
var reader = null;

function initReader() {
  var hints = new Map();
  hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.EAN_13]);
  hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
  reader = new ZXing.MultiFormatReader();
  reader.setHints(hints);
}

try {
  initReader();
  postMessage({ type: 'ready' });
} catch (err) {
  // 워커 생성 자체(importScripts 실패 등)는 camera.ts의 Worker.onerror가 잡지만, importScripts는
  // 성공했는데 ZXing 네임스페이스가 기대와 달라(예: 번들 버전 불일치) 리더 생성이 실패하는
  // 경우는 여기서만 알 수 있다 — camera.ts가 이 메시지로 setStatus({state:'error', ...})한다.
  postMessage({ type: 'error', message: String(err && err.message ? err.message : err) });
}

// camera.ts의 decodeFrame()이 크롭+draw+getImageData까지 메인 스레드에서 끝낸 뒤 픽셀 버퍼만
// (width/height와 함께) transfer로 넘겨준다 — 이 워커는 그 버퍼로 디코드만 하고 {text} 하나만
// 돌려준다. camera.ts는 zxingWorkerBusy로 미처리 프레임이 쌓이지 않게 막으므로, 이 핸들러는
// 항상 최대 한 번에 한 요청만 처리한다(별도 큐 로직 불필요).
onmessage = function (e) {
  if (!reader) return; // 초기화 실패 — 이미 위에서 'error'를 보냈고, camera.ts가 이 워커에 다시 postMessage하지 않는다.
  var width = e.data.width;
  var height = e.data.height;
  var buffer = e.data.buffer;
  var text = null;
  try {
    var luminanceSource = new ZXing.RGBLuminanceSource(new Uint32Array(buffer), width, height);
    var bitmap = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(luminanceSource));
    try {
      text = reader.decode(bitmap).getText();
    } catch (notFound) {
      // 프레임에 코드 없음 — 정상(메인 스레드의 옛 동기 디코드 루프와 동일한 방침).
    } finally {
      reader.reset();
    }
  } catch (frameErr) {
    // 프레임 처리 오류 — 다음 프레임에서 재시도(다음 postMessage를 기다릴 뿐, 워커를 다시
    // 만들지 않는다).
  }
  postMessage({ type: 'result', text: text });
};
