# Aktuální scénář — 30. září 2026

Source: [Interakce_FlowMap_final, 330:163](https://www.figma.com/design/sUxmZReZMJJuCFsxLwVYp6/Designblok-26--UTB-?node-id=330-163).

The outlined SVG comes directly from the main arrow-connected tray mockups.
Artboards keep the original 744 × 1073 coordinates, colors and outlined labels.
Manufacturing safe zones are excluded. The left panel is re-exported too. Its geometry is normalized back to the existing
intro coordinate system; stable animation/colony IDs survive exporter renumbering.

| Stage | Right panel suffix in section SVG |
| --- | --- |
| standby / detected | 18 |
| authorized / decision | no suffix |
| countdown (3 / 2 / 1) | 2 |
| countdown-start (Míchej) | 5 |
| analysis | 6 |
| mixing | 9 |
| keep-mixing | 10 |
| stir-prompt | 7 |
| not-mixing | 8 |
| success | 11 |
| bon-appetit | 12 |
| failure | 13 |
| hungry | 14 |
| connecting | 15 |
| welcome | 16 |
| restart | 17 |

Suffixes are export layer IDs, not Figma node IDs. Regenerate using
`python3 scripts/import-figma-flow.py /path/to/export.svg`, with **Include id
attribute** and **Outline text** enabled in Figma's SVG export settings.

Live mixing replaces the sample percentage and blue bar fill. The bar is at
402 / 548, size 299 × 40, with the 7 px minimum fill from Figma. The countdown
panel places both readings 39 px higher. Percentage typography is PP Neue
Machina Bold, 74 px, at baseline 520.69. Preparing stages show 0%; later stages use measured
GPU mixing, including decreases during separation. Missing data shows a dash.
The earlier clumpiness, RPM and activity badges are absent from the new design.
Gyro row baselines are 852 / 873 / 894; status baseline is 975.3. The supplied
3D model stays at 565 / 839, size 140 × 140. Both fonts and artwork are bundled
for offline operation. Calibration previews use representative fluid values and
hide live sensor numbers.

The story retains the actual-measurement rules: success requires at least 90%
for 0.5 seconds; failure follows seven seconds without starting/resuming. Success
shows the meal result and the colony message/QR. Failure shows “Kaše nezamíchána”,
then the retry instruction for 10 seconds, with the numeral counting down from 10 to 1 using the same scenario clock (including pauses for missing motion data), and returns to standby without showing
the successful colony welcome. After the colony message, the success branch shows “Restart mise za 30 sekund” for 30 seconds before returning to standby (with the existing quiet-motion condition). Missing motion pauses the story.

Latest source: the September 30, 18:58 SVG export. The restart artwork retains the designer’s “Lorem ipsum” placeholder exactly as supplied.

The center captions in `center/` also come directly from the tray SVG, cropped
against its 620 px bowl. The central story clock shows “Jsi ready?”, 3, 2, 1 and
“Míchej” over the fluid with the original 80% black overlay. Captions render
white. Fluid physics stays frozen until the numbers finish; rendering and
telemetry clocks remain active. The blue ring extinguishes clockwise once
per numeral, flashes twice at “Míchej”, then collapses to the live gyro heading.
Intro/sleep clears
the caption, and normal mixing removes both text and darkening.

Central captions now retain the exact Figma placement, including numeral 1; no additional optical offset is applied.

The ring and motion-light accent use panel blue `#1279FF`; the mixing indicator switches from ready white to that exact blue, without pale-blue intermediate shades. Completion uses `#7DDE07`, matching ON and biosignál.detekován in the Figma artwork.

The Kolonie ADD warning icon stays hidden while all five readings are positive (blue). It appears as soon as any reading is medium (orange) or negative (red), and hides again when all readings recover.

Main right-screen captions retain the outlined Figma lettering and use a simultaneous typewriter transition: old glyphs erase from left to right at twice the incoming rate while new glyphs appear in the same direction, reading each line top to bottom. The shared clock uses 55 ms per glyph, capped at 1400 ms. Identical captions do not replay, interrupted transitions discard stale layers, and reduced-motion mode switches immediately. The retry numeral remains live without retyping the entire caption. `tests/typewriter.html` previews every caption and the live numeral.

Outgoing glyphs are also erased wherever incoming glyph regions reach them, so different letter widths or line positions cannot stack old and new ink. Each glyph is a separate original vector path, including its counters and accents; visibility never uses a mask over neighbouring letters. The source SVG is replaced only when the artwork changes, so React telemetry/countdown renders cannot restore the hidden static caption. Detection replays from an empty caption on wake, even though standby uses the same artwork.

When the destination caption panel is shorter, outgoing rows outside its bounds disappear immediately rather than spilling into the mixing readout.

The browser audit in `tests/typewriter.html` samples every transition at 60 Hz, including interruption after 180 ms, and checks both intersecting visible glyphs and a restored static source. It also captures the initial detection and representative transitions for visual inspection.

The right mixing readout stays at one fixed position throughout preparation, countdown, and mixing: percent baseline y=520.69, bar y=548. The countdown SVG progress frame is shifted down 39 px to match the other screens instead of moving the live readings up.

Success eases the actual frozen mixing value to 100% over 700 ms. Percentage and blue bar share one clock and finish together before the default 1.5 s result phase exits. Reduced-motion mode shows 100% immediately. The preview includes a 90% completion check with per-frame synchronization sampling.

October 1: restart is 20 seconds in both the scenario and its outlined headline (other restart artwork is retained). Right-screen percentage and bar normalize physical mixing against the unchanged success threshold: 45% physical = 50% displayed, 81% = 90%, 90% = 100%. This replaces the need for an artificial final 90-to-100 jump when live mixing reaches success. Physics and success confirmation still use raw mixing values.
