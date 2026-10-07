# Local portrait processing

Only model/runtime downloads use the network. Captured pixels are processed in a reusable CPU worker and never uploaded or stored. The two temporary preview canvases retain only the last capture in page memory; reset, hiding the page and replacement by a new capture clear it.

Runtime: `@mediapipe/tasks-vision` 1.1.0 (Apache-2.0), pinned in package-lock.json. `postinstall` copies its runtime and WASM files into `runtime/` for same-origin static hosting. Model preparation needs WebGL-enabled OffscreenCanvas in a worker (iPadOS/Safari 17 or newer; https://webkit.org/blog/14445/webkit-features-in-safari-17-0/).

Pinned model version 1, downloaded from the official MediaPipe model repository:
- https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite → face.tflite
- https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite → selfie.tflite

The bundled Selfie Segmenter contains one output label, `selfie`, representing foreground confidence. Failed detections are rejected; the application never substitutes an unsegmented camera frame.

Local browser fixtures use Google's public sample https://storage.googleapis.com/mediapipe-assets/portrait.jpg at `outputs/portrait-test.jpg` (ignored, not published). `tests/browser-isolated-portrait.html` checks alpha isolation and crop. `tests/browser-portrait.html` replaces getUserMedia with a canvas stream, verifies visitor flow and can freeze the actual liquid portrait for inspection. Neither fixture accesses a hardware camera.

The optional Roztažení switch applies a smooth centered funhouse stretch to the isolated portrait, before the monochrome liquid mask. It defaults off, updates the preview and an active portrait on the same capture, and does not modify the source photograph. Switching while holding extends that hold for comparison; it preserves the original saved fluid field and the normal dissolve.

The Čtverečky slider changes the actual portrait guide texture from 16 × 16 to 160 × 160, default 128 × 128. It updates both the monochrome preview and the active liquid guide. The Bob/QR patterns retain their original resolutions.
