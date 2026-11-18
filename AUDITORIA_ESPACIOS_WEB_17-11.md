# Auditoría de espacios y simetría de la web publicada (17/11/2026)

Pedida por Ernesto el 17/11: «revisar la web de arriba abajo buscando asimetrías… textos demasiado compactos que no respetan el aire». La home y la entrada a los circuitos están bien (palabra suya); el foco son los scroll de sesión, Actividades y los dos juegos. El hub LED de cada circuito no se toca.

Hecha en solo lectura sobre https://racing-simplified.vercel.app, a 1440x900 y 390x844: Silverstone (fp1, sprint-quali, sprint, quali, race), Mónaco (race, quali, fp1), México (race, fp2), sessions y activities de los tres, y los dos juegos de Silverstone jugados hasta el resultado y el panel de compartir. Las líneas citadas son de `web/app/globals.css`. Capturas: scratchpad de la sesión del 17/11, `audit_spacing/shots/`.

**Estado (18/11/2026): aplicado y PUBLICADO** con su sí (despliegue `5mn58o4x5`), todo en `web/app/globals.css`. Del 1 al 13 hecho y medido en el build de producción, con estas decisiones suyas:
- 2: en móvil, la portada de Exchange pierde la fila LAPS / DRIVERS / TIME.
- 7: solo en PC; en móvil se queda como estaba («déjalo así» del 16/11).
- 8: solo en PC; en móvil se quitó el velo oscuro y vuelve a como estaba, con el dibujo visible.
- 14: hechas las etiquetas a 10 px y «WHAT THEY DID» a 15 px; `.cr-hhow` no existe y los puntos de la línea de tiempo no se tocaron (no estaba claro qué se pedía).
Además: «behind» sin línea propia en la bandera de cuadros (`text-wrap: pretty`) y la flecha de los enlaces de sprint pegada a la derecha. Sin commit.

## Hallazgos, por impacto

1. **Portada de Paddock exchange, escritorio (comprobado con captura):** «EXCHANGE» mide 844 px en una columna de 600 y se mete 244 px en la del circuito; empuja «Lights out» al borde inferior (y 851-900). `.cr-h1` (3114) a 98 px; el arreglo `.px-cover .cr-h1` (3625) solo vale a ≤960 px. Arreglo: `.px-cover .cr-h1 { font-size: clamp(40px, 4.6vw, 69px) }` también en escritorio.
2. **Botón fijo sobre el contenido en las portadas de los juegos (móvil):** las portadas miden 905 y 986 px en una pantalla de 844. El botón fijo «Lights out» y su anillo negro de 10 px (`.cr-cover .bt-go`, 3674) tapan las cifras LAPS/CALLS/TIME en Call the race, y la escalera de precios y las cifras en Exchange. Arreglo: a ≤600 px `.cr-cover-track { height: 18svh }` (3672, hoy 28svh); ocultar `.cr-stats` en Exchange en móvil; cambiar el anillo por un degradado de 24 px.
3. **«Roast the site» tapa los enlaces del pie de cada sesión:** `.tr-btn` (3897) sobre `.snext-row` (2697); en escritorio tapa «ALL SESSIONS» y en móvil «RACING SIMPLIFIED». Arreglo: `.snext { padding-bottom: calc(8vh + 48px) }` (2677).
4. **Tarjeta de la bandera de cuadros (`.v-final`, 450) con alineaciones mezcladas:** etiqueta a la izquierda y el resto centrado («behind» se queda sola en su línea); en la tabla, nombres centrados y puntos a la derecha. En móvil el popup del glosario de «POINTS SCORED» se sale 44 px (`.term-pop{left:0}`, 2106). Arreglo: `.v-final .kicker{justify-content:center}`, `.v-final .dato{text-align:left}`.
5. **Filas de operaciones sin margen interior (resultado de Exchange):** `.px-trades li` (3540) hereda la caja de `.cr-review li` (3220) con padding `10px 0`: el texto toca los bordes y el importe va 3 px más bajo que su etiqueta. Arreglo: `padding:12px 16px; align-items:baseline`.
6. **El margen lateral cambia de una página a otra:** la barra superior va a 5vw (72 px en escritorio). No lo siguen:
   - las tarjetas de sesión, a 3vw (`.flow`, 395);
   - el contador de vueltas, a 18 px del borde (`.lapbox`, 368; 12 px en móvil, 2726);
   - el póster y la franja «up next», a 6vw (`.poster --gut` 1055, `.snext-band`/`.snext-row` 2679/2697);
   - la pantalla de Call the race, a 3vw (`.cr-game` 3125, `.cr-sheet` 3177);
   - en móvil, la pantalla de juego a 12 px (3235), el texto de la hoja a 16 px (3243), y la portada y el resultado a 16 px (3232/3245).

   Arreglo: 5vw en todos, `.lapbox{padding-right:5vw}` y `.cr-sheet{bottom:4vh}` (hoy 27 px del fondo frente a 36 del resto). El panel izquierdo del mercado se deja en 28 px.
7. **Enlaces de sprint en Actividades descuadrados con las tarjetas** (`.acts-sprint`, 3347/3356/3357): anchos distintos (407 y 433 px) y los dos empiezan a la izquierda, con 97 px bajo una tarjeta y 34 bajo la otra, y esquinas redondeadas junto a tarjetas rectas. En móvil miden 337 px frente a los 351 de las tarjetas. Arreglo: `display:grid; width:calc(50% - 13px); margin:34px 0 0; border-radius:0` y `.acts-sprint + .acts-sprint{margin-left:26px; translate:0 7vh}`; fuera la regla `calc(7vh + 34px)`; a ≤900 px `width:100%; margin-left:0; translate:none`. (El 16/11 se descartó alinear su borde derecho en móvil: «déjalo así». Consultarlo antes.)
8. **El dibujo de las tarjetas de Actividades pasa por debajo del texto:** `.act p` (1424) llega a 602 px de una tarjeta de 635 y el trazado empieza entre 263 y 397 px. En escritorio, de 4 a 10 coches caen sobre el párrafo y la gráfica cruza «START WITH 1,000»; en móvil, de 11 a 16 coches y 4 líneas. Arreglo: `.act p, .act-meta{max-width:290px}`, `.act-track{width:50%; right:-2%}`, `.act-chart{width:44%}`; a ≤760 px `.act-art::after{background:linear-gradient(180deg,#0a0a0af0 0 60%,#0a0a0a4d)}`.
9. **Precios altos en las filas del mercado:** cada precio va 8 px por encima del centro, mientras el código del piloto y los botones están centrados; `.px-price small` (3519) reserva siempre 14 px. Arreglo: `.px-price{position:relative}`, `.px-price b{line-height:1.2}`, `.px-price small{position:absolute; right:0; top:calc(100% - 2px)}`.
10. **Resultado de Call the race:**
    - los puntos de resultado de 30 px no caben y el 16.º baja solo a otra fila (en móvil, 10 + 6). Arreglo: `.cr-marks{flex-wrap:nowrap}`, `.cr-marks i{flex:0 1 30px; height:auto; aspect-ratio:1}`;
    - en escritorio la columna izquierda acaba en 800 px y la lista sigue hasta 2.560. Arreglo: `.cr-final{position:sticky; top:13vh; align-self:start}` con `.cr-done{overflow:clip}`;
    - en móvil, en los dos juegos, el resultado y «Your calls/trades» están a 24-33 px, menos que los huecos de dentro. Arreglo: `.cr-done{row-gap:64px}` a ≤960 px (3245).
11. **Caja de respuesta y botón de saltar (Call the race):**
    - `.cr-toast b` (3170) hereda line-height 1.55: cuando el título parte en dos líneas, las líneas quedan tan separadas como el título del texto, y «−25» se queda solo. Arreglo: `line-height:1.05; text-wrap:balance`, `.cr-toast p{margin-top:10px}`;
    - en `.cr-skip` (3157/3242) la flecha baja a otra línea. Arreglo: `display:flex; align-items:center; gap:8px`.
12. **Título de la tarjeta de portada de cada sesión pegado a su texto** (`.v-cover h2`, 431/2620): está a 8 px, y su brillo se mete en la primera línea. Arreglo: `margin-bottom:20px`. En móvil el trazado del fondo pasa por su texto; a ≤1099 px `.v-cover::before{content:"";position:absolute;inset:-24px -20px;z-index:-1;background:radial-gradient(closest-side,#0a0a0ae0,#0a0a0a00)}`.
13. **Fila de Race descuadrada en la página de sesiones (móvil):** la banda roja mantiene `padding:34px 28px` (2582) y su número y título empiezan 20 px a la derecha del resto. Arreglo a ≤900 px: `margin:5vh -5vw 0; padding-left:calc(5vw + 8px); padding-right:calc(5vw + 8px)`. El título de esa página se queda en 24 px (tope de 6.2vw en 2572), casi igual que las etiquetas de 20 px.
14. **Menores:**
    - `.cr-hhow li` (3117) con `align-items:baseline`;
    - «WHAT THEY DID» `.call-opt em` (495) con `top:15px`;
    - las etiquetas de confianza y de escalera (3197/3473), de 8 a 10 px en escritorio;
    - los puntos de la línea de tiempo (3138), a 10 px en móvil.
    - (Solo observación, no espacio: las tarjetas usan Barlow Condensed (`.card h2`, 421) y la portada y las Actividades usan Anton, no Anybody.)

## Lo que está bien
- **Tarjetas de sesión:** coherentes en las 20 páginas (etiqueta-título unos 19,5 px, título-texto unos 16 px).
- **Paneles de respuesta**, el póster, la franja «up next» y la página de sesiones en escritorio.
- **Cabecera y tarjetas de Actividades.**
- **Hoja de preguntas** de Call the race.
- **Panel de compartir en móvil.**
- **Columnas del mercado.**
- `/weekend` redirige a `/activities`.
