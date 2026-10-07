# Gyroskop

Zdroj: `Gyroscope_gyzmo.obj` a `PPNeueMachina-Variable.ttf` dodané uživatelem
ve složce `Downloads/zasilka-WRX4KELNMHCAL3TY`.

`model.obj` je původní model. Po jeho aktualizaci spusťte:

```sh
python3 scripts/import-gyroscope.py
```

Skript sloučí duplicitní vrcholy a plochy a připraví `mesh.json`: normalizované
vrcholy, normály, sousednost hran a `lightRing` — 48 vrcholů horní vnější
hrany vodorovného prstence v rovině XZ. Při vykreslování se použijí ostré hrany a
siluety viditelné z aktuálního směru. Zobrazení je průhledný obrysový model;
všechny hrany mají stejnou barvu #BFBAB2 a plnou neprůhlednost bez tlumení
podle hloubky. Nejde o náhradu modelu ručně kreslenými kruhy.

OBJ odkazuje na nepřiložený MTL `Alpha`. Obrysový styl UI používá vlastní barvu
#BFBAB2, takže materiál ani textury nejsou potřeba. Runtime neparsuje OBJ,
nevytváří další WebGL kontext a nestahuje externí soubory. Model se promítá
ortograficky na malý 2D canvas, který dědí kalibraci celého pravého panelu.

`lib/gyroscope-pose.ts` převádí roll/pitch/yaw na quaternion a vyhlazuje orientaci.
Core Motion roll je rotace kolem osy Y, pitch kolem X; pořadí je Z-X-Y.
Před vykreslením se osy zařízení převedou do OBJ: X → X, Y → −Z, Z → Y.
Pevný pohled ilustrace se aplikuje až potom. Náklon proto sklápí vodorovný
prstenec na straně označené světlem; otáčení kolem normály jej nesklápí.
[Dokumentace Core Motion](https://developer.apple.com/documentation/coremotion/cmattitude/roll).
Safari beta/gamma jsou při příjmu sjednocené na stejné sloty pitch/roll.
Orientace displeje se uplatňuje i při vykreslení; nativní a BLE číselné údaje
zůstávají ve vlastních osách zařízení. Tři iPady mají mít souhlasnou montáž os.

Font `public/fonts/PPNeueMachina-Variable.ttf` má osy `wght` 100–900,
`inkt` 0–100 a `ital` 0–100. Živá čísla používají váhu 700, základní kresbu
bez kurzivy; ostatní texty návrhu zůstávají v originálních SVG křivkách.

Oranžový bod používá `sample.light` z hosta (V4). Kalibrovaný směr určuje
polohu po jediném obvodu `lightRing`: nula je vzdálená strana (−Z), čtvrt
otáčky pravá strana (+X). Mezi jeho vrcholy se poloha plynule interpoluje
a promítá se stejnou transformací jako model. Bod proto neopouští tento
prstenec ani při pohledu z hrany; nehledá vnější siluetu ostatních kruhů.
Směr sdílí s mísou, jeho obrazová poloha ale respektuje perspektivu prstence.
Stejný 55ms filtr jako u mísy vyhlazuje syrový kalibrovaný signál přijímaný
30× za sekundu, síla náklonu řídí jas.
Starší V1–V3 ani místní náhradní gyroskop tento sdílený signál nedodávají,
takže bod nevymýšlí odlišnou kalibraci a při výpadku zhasne.
