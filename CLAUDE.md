# Racing Simplified: web y vídeo, desde un solo sitio

"The website that explains every F1 race." Es el proyecto personal de Ernesto: cada GP de la temporada 2026 contado desde los datos oficiales de cronometraje, con un vídeo oficial de lanzamiento. Desde el 22/10/2026 la web y el vídeo se llevan juntos desde aquí. Este archivo es el mapa: qué hay, cómo se arranca, qué no se toca y qué falta.

## 1. Mapa

| Carpeta | Qué es |
|---|---|
| `pipeline/` | Python. Lee FastF1 y OpenF1 y genera los JSON de cada GP en `data/<slug>/` |
| `data/` | Los JSON finales, uno por GP (15 en 2026, de Albert Park a Bakú) |
| `web/` | Next.js (versión con cambios incompatibles: leer `web/AGENTS.md` y la guía en `web/node_modules/next/dist/docs/` antes de tocar código). `web/scripts/sync-data.mjs` copia `data/` en `web/data/` |
| `video/` | Remotion. Vídeo 9:16 de 92 s a 60 fps, cortado al golpe de 110 BPM. Lo graba de la web real (`video/scripts/capture.mjs`) |
| raíz | Documentos de concepto: `MVP.md`, `PRODUCT_MAP.md`, `DESIGN_DIRECTION.md`, moodboards |

## 2. Arrancar

- **Web para trabajar:** configuración `f1-web-3005` de `.claude/launch.json` (puerto 3005). Es `next dev`: compila cada página la primera vez que se abre (hasta 20 s) y por eso va lenta; no sirve para juzgar la velocidad. El 3000 lo ocupa a veces otro Remotion. Si el servidor muere sin dejar rastro: `node web/scripts/serve.mjs --restart`.
- **Web publicada (desde el 26/10/2026):** https://racing-simplified.vercel.app, proyecto `racing-simplified` en la cuenta de Vercel de Ernesto (plan Hobby). Se sube desde `web/` con `vercel deploy --prod --yes` en su terminal (la sesión de Vercel vive ahí, no en el Bash de Claude). `web/vercel.json` fija `framework: nextjs`: sin él Vercel servía solo `public/` y todas las páginas daban 404. Vercel no ve `../data`: antes de subir, `node web/scripts/sync-data.mjs` para que `web/data` esté al día. Sin Git conectado: cada cambio se sube a mano.
- **Web como la verá la gente:** `node web/scripts/prod.mjs` sincroniza los datos, construye y sirve en el 3006; la configuración `f1-web-prod` sirve la última construcción sin rehacerla. Para enseñar la web a Ernesto o medir velocidad, siempre esta.
- **Vídeo:** desde `video/`, `npx remotion studio` para previsualizar y `npx remotion render Showcase out/racing-simplified-9x16.mp4` para el MP4. Hay que renderizar de uno en uno: dos renders a la vez escriben el mismo MP4. Si Chrome no conecta a tiempo, se añade `--timeout=120000`. Antes de dar un MP4 por bueno, comprobar que la fecha del archivo es la nueva.
- **Capturas del vídeo:** con la web levantada en el 3005, `node video/scripts/capture.mjs <clip...>` desde `video/`.

## 3. Cómo encaja una cosa con la otra

El vídeo enseña la web real: cada plano es una captura de una página. **Un cambio visible en la web deja viejas las capturas del vídeo que muestran esa página.** Cuando cambie una página que sale en el vídeo, hay que avisar y, si Ernesto quiere, regrabar esos clips y volver a renderizar.

| Página de la web | Clips del vídeo |
|---|---|
| Home (`/`) | `home`, `navhome` |
| Sesiones (`/gp/<slug>/sessions`) | `sWeek` |
| Carrera (`/gp/<slug>/race`): tarjetas, decisiones, guess y Alfred | `sTrack`, `sMoment`, `sPurple`, `sYellow`, `sPred`, `sSteward`, `sGuess`, `sMate`, `strips`, `race` |
| Blind test | `blind`, `blindplay` |
| Pit wall | `pitwall` |

### Cola para el vídeo final (regla de Ernesto, 22/10/2026)

Todo cambio de la web hasta la v1 definitiva se traslada al vídeo de presentación. No se va regrabando cambio a cambio: se apunta aquí, y con la v1 cerrada se monta el vídeo final con toda la cola de una vez.

| Fecha | Cambio en la web | Qué toca en el vídeo |
|---|---|---|
| 22/10/2026 | Caja roja para bandera roja (carreras, libres y clasificación) y caja amarilla también en las tarjetas "Interruptions" | En Read it, junto a "Purple: the fastest lap" y "Yellow: safety car and flags", un plano "Red: the session is stopped" con una tarjeta roja real (Monza, carrera, vuelta 3, o Mónaco FP1) |
| 23/10/2026 | Las actividades definitivas: **Call the race** (`components/CallTheRace.tsx`, ruta `/gp/<slug>/race/call`, datos `pipeline/replay.py`) y **The ghost** (`components/TheGhost.tsx`, ruta `/gp/<slug>/race/ghost`, datos `pipeline/muro.py`), sobre un motor común: la carrera repetida en el trazado real (`components/ReplayTrack.tsx`, `lib/replay.ts`). Sustituyen al blind test, al pit wall y al piloto misterio en Actividades y en la home | 03 Play it entero se rehace con estas dos: la carrera corriendo en el circuito, una pregunta congelada y su respuesta; el fantasma blanco contra el piloto real |
| 22/10/2026 (descartada el 23/10) | Actividad 01 "The mystery driver" (`components/MysteryDriver.tsx`, datos de `pipeline/mystery.py`): un piloto misterio por carrera, 6 intentos, pistas de vagas a delatoras, flechas por fallo, veredicto y cuadrados para compartir; el blind test pasa a modo libre | Play it: el plano del blind test pasa a ser el del piloto misterio (clips `blind`, `blindplay`) |
| 25/10/2026 | Velocidad: la cortina entre secciones dura ~0,7 de lo que duraba y la página nueva se carga detrás de ella; el hub y Alfred ya no se congelan | Si algún plano del vídeo graba una transición entre páginas (`navhome`), se regraba con el nuevo ritmo |
| 26/10/2026 | **The ghost se retira** ("esperar media hora y dar un click no es una actividad") y entra **Paddock exchange** (`components/PaddockExchange.tsx`, ruta `/gp/<slug>/<race|sprint>/exchange`): cada piloto es una acción que vale su posición (último 5, +5 por puesto), la carrera real vuelta a vuelta en ~2 min, 1.000 de inicio, «Invest 100» / «Cash out», un abandono vale 0. Tarjeta de Actividades con la gráfica real de precios (`ExchangeArt`) | 03 Play it: el plano de The ghost pasa a ser la bolsa: el tablero moviéndose vuelta a vuelta, una compra barata y el «cash out» con ganancia |
| pendiente | Actividad 02 "Tu muro" (aprobada, por construir) y el tercer hueco (abierto) | 03 Play it entero: las tarjetas del drop, las infografías de Activities y las capturas `blind`, `blindplay` y `pitwall` |

## 4. Reglas que valen para todo

- **Nada sin fundamento en el dato.** Mejor no poner una tarjeta que poner una falsa.
- **El hub LED de cada circuito (GPHeroLED, GPBoard) no se toca.** Su texto solo se cambia con permiso explícito.
- **Paleta:** negro `#0a0a0a`, blanco, un solo rojo `#e10600` y grises. Tipografía: Anybody en los títulos, Space Grotesk en el texto corrido, mono en las etiquetas. Cero guiones largos.
- **Vídeo, lo que ya se ha rechazado:**
  - pulso constante al ritmo de la música;
  - flechas y anotaciones encima de la web;
  - su foto;
  - la tipografía pixel en el clímax;
  - "Coming soon";
  - planos de 2 s en los que no se lee nada.
- **Vídeo, lo que funciona:**
  - una idea por pantalla, quieta 2,5 s como mínimo;
  - zoom a lo que importa con el resto atenuado;
  - frase grande y línea pequeña;
  - cuchillas de luz en los cortes secos.
- **El final del vídeo (Built from scratch y el end card) está aprobado y no se toca.**
- **La música es provisional:** un rip de YouTube que no se puede publicar. Repetir trozos de la canción se oye roto. Cuando llegue la canción con licencia, se mide su tempo y se monta la banda nueva.
- **Forma de trabajar con Ernesto:** "bro", en español, directo. Una petición cada vez. No tocar lo que no ha pedido. Verificar con capturas o tira de fotogramas antes de entregar y contar con honestidad qué se ha comprobado y qué no.

## 5. Trampas conocidas

- **Velocidad (25/10/2026).** Una página parada no puede gastar procesador. Animar sin fin `text-shadow`, `filter` o `stroke-dashoffset` obliga al navegador a repintar y recolocar la página entera en cada fotograma: el hub de un circuito llegó a gastar el 56 % de un núcleo sin que nadie lo tocara. Lo que respira va a saltos invisibles (`led-breathe`, muestreado cada 5 % con `steps(3)`); lo que solo cambia de opacidad o posición se anima con `opacity`/`transform`; un dibujo se hace una vez y se queda. Los bucles `requestAnimationFrame` se duermen cuando no hay nada que mover (`RaceScroll`, `ReplayTrack`), y nada mide el DOM en cada evento de scroll. La transición entre páginas (`PageFX`) carga la página siguiente detrás de la cortina, no después, y solo levanta la cortina cuando los fotogramas vuelven a fluir.
- **La tarjeta gráfica manda (25/10/2026).** El portátil de Ernesto tiene una Intel UHD integrada: redibujar texto grande con brillo (`text-shadow`) le cuesta ~450 ms por vez, y recalcular cada fotograma desenfoques (`filter: blur`), fusiones (`mix-blend-mode`) y máscaras sobre zonas grandes la satura. El hub LED ya no redibuja nunca: su respiración son dos brillos dibujados una vez (`data-t` + `::before`/`::after`) que se funden por opacidad, idénticos al original (diferencia máxima 7/255). Para medir, Chrome headless con `channel: "chrome"` usa esa misma GPU; los scripts de medida están descritos en la sesión del 25/10.
- **Estelas de las fotos del moodboard:** las del casco, el coche y el casco del 404 van pre-dibujadas (`web/scripts/bake_trails.py`, versión escritorio y móvil, idénticas al filtro en vivo). Si cambia una de esas fotos o su tamaño en pantalla, se vuelve a ejecutar el script. El caballo y el neumático siguen con el filtro en vivo, porque su caja recorta la foto distinto en cada pantalla.
- **Sonido:** crear el `AudioContext` despierta la tarjeta de sonido y bloquea ~230 ms la primera vez de cada sesión. Se decodifica con un `OfflineAudioContext` (gratis) y el contexto real se abre al pasar el ratón por el botón de Alfred.
- "CHEQUERED FLAG" contiene "RED FLAG".
- Los heredocs de Bash se comen las barras invertidas: los parches se escriben con Write y luego se ejecutan.
- El panel del navegador a veces pinta negro: se verifica con Chrome headless (Playwright desde `video/`).
- Los renders de Remotion llenan `%TEMP%`.
- No editar `web/AGENTS.md`.

## 6. Estado y pendientes (actualizar al cerrar cada sesión)

**Git:**
- Repositorio en esta carpeta, rama `home-redesign-sep26`. El último commit es del 30/09/2026.
- A 22/10 hay cambios de la web sin commitear (unos 15 archivos) y `video/` no está en git.
- Los mensajes de commit desde PowerShell van por archivo (`git commit -F`).

**Web:**
- Pendiente: what-if (actividad 03), decidir los headshots y la foto Ferrari del hero, fuentes de pago (slots en `web/public/fonts/README.md`).
- Pendiente: el panel de datos de la portada LED de Bakú pisa la S de R//S.
- **Actividades (desde 26/10/2026): Call the race y Paddock exchange.** Boceto aprobado en `web_preview/bolsa/`. Paddock exchange no modela nada: el precio es el puesto que da el cronometraje cuando el líder cruza la línea (`standings` de `lib/replay.ts`), así que hay partida en todas las carreras y sprints con replay (15 + 5). The ghost queda en `/race/ghost` sin enlazar, como el blind test y el pit wall.
- **Historia: Call the race y The ghost (23–26/10/2026).** Bocetos aprobados en `web_preview/actividades/`. El piloto oculto, Dibuja la carrera, el comisario y el duelo, rechazados ("ridícula e inútil"). Las páginas viejas (`/blind`, `/pitwall`) siguen existiendo pero ya no se enlazan.
  - Call the race: las preguntas salen de la carrera real (salida, safety car, pelea, paradas, abandono, vuelta rápida, remontada, final). Lo que la carrera no tiene, no se pregunta. Hay partida en las 15 carreras y en los sprints.
  - The ghost (en directo desde el 24/10/2026): la carrera no se para nunca. Cuando se abre la ventana de parada de tu piloto, va a cámara lenta (unos 22 s por ventana) y el botón BOX es tuyo; si no pulsas, el equipo para en la última vuelta de la ventana. Cada vuelta de la ventana se valora en `pipeline/muro.py` (`windows` por piloto) con el desgaste y la pérdida en boxes medidos en esa carrera, solo en las ventanas en que el modelo no se aleja más de 3 s del estratega real. Si hay un safety car después de tus paradas, cuenta el orden en que te pilló, no los segundos. Se descartó planear antes la estrategia completa: con un modelo lineal, parar una sola vez siempre "gana", y es falso. No hay partida en Shanghái, Montreal, Monza ni Bakú.
  - Call the race: de 12 a 16 preguntas por carrera y de 5 a 9 por sprint (desde el 24/10). Se eligen por importancia y luego se ordenan por vuelta.
  - Tarjetas de Actividades: sin fotos de moodboard ("cutre, IA"); llevan el circuito con los coches reales y la foto oficial del piloto (`components/ActArt.tsx`).
  - Tras `build_weekend.py` de un GP: `python pipeline/replay.py <slug>`, `python pipeline/muro.py <slug>` y `node web/scripts/sync-data.mjs`.
- GPs desde Singapur sin construir. El flujo por GP está en la memoria del proyecto y en `pipeline/`.

**Vídeo:**
- La v34 está aprobada (13/10/2026). El guion de Read it está en `video/GUION_INICIO.md`.
- Pendiente: canción con licencia (Pixabay, 105–115 BPM, drop hacia el segundo 48).
- `video/README.md` está desfasado: habla de 30 fps, del puerto 3000 y de `time.ts`.
