# Zvukový scénář

Zdrojové WAV byly 3. 10. 2026 stažené přes přihlášený účet Epidemic Sound.
Originály zůstávají v Downloads; zde jsou výřezy pro offline instalaci.
Epidemic Sound soubory nemají licenci CC0 původních ukázek Kenney.

| Soubor | Zdroj | Výřez v sekundách | Přehrávání |
| --- | --- | --- | --- |
| wake.wav | [Old Quick Beep Sign Rising](https://www.epidemicsound.com/sound-effects/tracks/defcbcf9-21b2-46c7-82fc-90bda716a1f9/) | 0–0,379 | Prostřední iPad, začátek probuzení |
| typing.wav | [Digital Static Noise 02](https://www.epidemicsound.com/sound-effects/tracks/ce928278-8e74-4053-b885-dff4e0a4fd4b/) | 0–2,334 | 55ms impulzy při odhalování písmen |
| panels.wav | [Classic, Working, Loading, Short](https://www.epidemicsound.com/sound-effects/tracks/e545078c-20ec-4565-87e3-42ebfd188cd5/) | 0,18–0,85 | Levý a pravý iPad, jejich rozsvícení |
| countdown.wav | [Race Countdown](https://www.epidemicsound.com/sound-effects/tracks/671703b4-80a2-4dd4-92a6-4b61a67c6052/) | 0–0,38 | Prostřední iPad, číslice 3 / 2 / 1 |
| countdown-start.wav | Stejný Race Countdown | 3–3,36 | Prostřední iPad, Míchej |
| mixing.wav | [Jaguar I Pace, Driving, Slow](https://www.epidemicsound.com/sound-effects/tracks/cf2614f2-be04-44c1-830e-a6162104ad8d/) | 20–26 | Prostřední iPad, smyčka se spojem prolínaným 280 ms |
| riser.wav | [Mysterious 02](https://www.epidemicsound.com/sound-effects/tracks/b0d09809-7a66-4b79-8ef7-ce0dd4db5cd3/) | 2,05–5,10 | Prostřední iPad, jednou při potvrzeném domíchání |
| ding.wav | [Microwave, Ding, Finish](https://www.epidemicsound.com/sound-effects/tracks/1d7a267d-fa3e-4444-b6cc-2141fe64fc62/) | 0–1,20 | Prostřední iPad, potvrzený úspěch |
| sleep.wav | [Video Transition, Motion 09](https://www.epidemicsound.com/sound-effects/tracks/57cc8b10-04f8-465a-b66d-5c89e2c672cd/) | 0–1,35 | Každý iPad při dokončení restartu / uspání, nejvýše jednou |
| failure.wav | [Error Tone, Digital](https://www.epidemicsound.com/sound-effects/tracks/3fe93d65-ce64-4cf8-81ec-d40b2272cfbe/) | 0–0,42 | Pravý iPad, hláška o selhání |

`scripts/prepare-sound-design.py` reprodukuje výřezy z originálů pomocí ffmpeg.
Všechny soubory jsou mono PCM WAV 44 100 Hz / 16 bit, normalizované na špičku
0,8. Jednorázové efekty mají krátké náběhy a doběhy. Vite je vloží do iPadového
balíčku jako data URL, takže fungují přes `WKWebView.loadFileURL` bez sítě.

`lib/sound-design.ts` rozhoduje o spouštění zvuků a mapuje aktivitu 0–1
na energii motoru. Rychlost přehrávání je 0,7 + 0,65 × aktivita + 0,25 × vizuální
promíchání. `lib/installation-audio.ts` vyhlazuje hlasitost po 120 ms a rychlost
po 180 ms. Při zastavení motor utichne; při výpadku dat se hlasy zastaví.
Od UI `ios-2026.10.03.36` riser spouští až potvrzené domíchání. Běží jednou
v původní rychlosti po 3,05 s; nemění se s rychlostí pohybu a nesmyčkuje se.
Motor skončí ostře spolu s riserem. Následuje 200 ms ticha, potom cinknutí
a společné zobrazení výsledku. Časování řídí sdílená fáze `finishing` v
`MixingScenario`, takže nezávisí na hlasitosti ani na dostupnosti přehrávače.
Od UI `ios-2026.10.03.37` finále přidává čtyřnásobek maximální rotační síly
pohybu tácu ve směru posledního míchání. Síla běží také během 200 ms ticha;
při cinknutí se okamžitě vypne a kapalina se zastaví pod nápisem DOMÍCHÁNO.
Nová porce znovu odjistí
jednorázové efekty, neplatná data nikdy sama nevyvolají finále.

Typewriter impulzy se vážou na přibývající viditelné glyphy, včetně druhého
nápisu u QR a úvodní otázky na prostředním iPadu. Ta píše po 45 ms a může se
překrývat s probouzecím efektem. Opakované renderování, mazání starého textu, neviditelné úvodní
fáze, zastavené náhledy a reduced-motion přechody zvuk psaní nespouštějí.
Pokud vykreslování nestihne více písmen, zazní jeden impuls za snímek.

Zvuky lze jednotlivě poslouchat v záložce Zvuky ve správci na Macu. Hlasitost
knihovny ovládá pouze tento poslech. Sekce **Hlasitost instalace** nastavuje
celkovou hlasitost a jednotlivé efekty na všech třech iPadech; výchozí hodnoty
jsou v `lib/sound-settings.ts` (master 0,65, motor nejvýše 0,32, psaní 0,10).
Nastavení se odesílá jako celý profil, potvrzuje podle skutečného uložení
každého iPadu a přežije restart i aktualizaci UI. Testovací tlačítka přehrají
efekt panelu přímo na vybrané roli. Ovládání vyžaduje nativní build 22 a UI
ios-2026.10.03.35. V prohlížečovém náhledu se audio odemkne
prvním kliknutím nebo klávesou. Nativní iPad povoluje automatické přehrávání
a používá `AVAudioSession.playback`; tato změna vyžaduje nový nativní build,
samotná webová aktualizace původního kiosku nemusí odstranit blokaci autoplay.

Uspávací efekt používá rychlost 0,65 a hlasitost 0,18 (před masterem), takže
trvá přibližně 2,08 s. Od nativního buildu 23 obal zmrazí odchozí obraz, jednou krátce problikne
celou obrazovkou a do 0,42 s přejde do černé. Obraz se neposouvá ani netrhá. Nové probuzení
přechod okamžitě zruší; reduced-motion používá prosté stmívání bez probliknutí.
Při aktivaci a probuzení obal žádá systémový ovladač `MPVolumeView` o 90 %
hlasitosti. `AVAudioSession.outputVolume` nelze přímo nastavit; tento přístup
přes připojený `UISlider` je best-effort a je potřeba ověřit na cílovém iPadOS.
Správce čte skutečné `outputVolume`; při ověření buildu 22 všechny tři cílové
iPady hlásily 90 %. Mixer obnovuje také kontext ve stavu `interrupted`,
který může iPadOS použít po uspání; diagnostika ukazuje stav kontextu, počet
načtených efektů a počet spuštěných hlasů.

Ověření: `npm test`, `npx tsc --noEmit`, `npm run build:ios` a skutečné Web Audio
v `tests/sound-design-browser.mjs` proti Vite serveru (`npm run test:gpu`).
