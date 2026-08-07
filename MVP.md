# MVP v2 — F1 Recap Interactivo
**Fecha:** 7 agosto 2026
**Estado:** DEFINITIVO. Esqueleto decidido por Ernesto sobre maquetas interactivas: **cuerpo Story (B) + entrada Portero (A)**.
**Docs previos:** `IDEAS_FORMATOS.md` (exploración) → `CONCEPTO_V1.md` (formatos validados) → este doc (qué se construye).

---

## 1. El producto en una frase

> Tu colega friki de la F1: entras a un GP, te protege de spoilers, te pregunta cuánto tiempo tienes, y te cuenta el finde en stories interactivas con predicciones — en lenguaje humano, con el dato siempre a un swipe.

## 2. El flujo de usuario (decidido)

```
Portada del GP
  └─ "¿Ya sabes cómo acabó?"                        [entrada A]
       ├─ NO → Nota 0-10 sin spoilers + mapa de calor
       │        de vueltas + "vuelve cuando la veas"
       └─ SÍ → "¿Cuánto tiempo tienes?"  ⚡30s / ☕3min / 🛋️15min
                 └─ STORIES del GP                   [cuerpo B]
                      · cards a pantalla completa, tap para avanzar
                      · cards de predicción ("¿valiente o suicidio?")
                      · swipe-up = el dato detrás (capa "saber más")
                      · cards de "lo que la TV no enseñó"
                      · card final compartible (resumen + nota)
```

- **30s** = 5-6 cards · **3min** = 12-15 cards · **15min** = el finde entero (libres + quali + carrera).
- Cada sesión (FP1-FP3, Quali, Carrera) tiene sus stories; honestidad como feature: "FP1 en 30 segundos: no pasó nada, de verdad".
- **Glosario contextual**: términos técnicos marcados, tap = explicación de una línea. Un solo tono ("casual inteligente").

## 3. Alcance v1 / después

| v1 (se construye ya) | v1.1 | v2 / nevera |
|---|---|---|
| Entrada anti-spoiler + nota 0-10 | Chat "pregúntale al colega" (LLM + ficha editorial) | Modo Estratega (diseñado, esperando) |
| Selector de tiempo ×3 profundidades | Cards compartibles como imagen | Temporada como episodios |
| Stories de las 5 sesiones con predicciones | Team radio en cards (si derechos OK) | "Me dormí en la vuelta X" |
| Swipe-up con el dato | | Duelos como organización |
| Glosario (~40 términos) | | Toggle niveles de fan (muerto: lo absorbe el chat) |
| 1 GP completo, perfecto | | Más GPs |

## 4. Datos y pipeline

- **Fuentes:** OpenF1 (vueltas, posiciones, paradas, stints, race control, meteo, radio, pilotos) + FastF1 (compuestos, resultados, telemetría si hiciera falta). Gratis para histórico.
- **Pipeline offline** (Python): descarga → cache JSON inmutable por sesión → detección de momentos → templates de narrativa → `story.json` por sesión + `weekend.json`. Se ejecuta una vez por GP, a mano.
- **Sin backend en producción**: la web lee JSON estáticos. Hosting gratis.
- **Reutilización del Pit-Wall de Marc** (pendiente su OK — no hay LICENSE): cliente OpenF1 (retries/429), cache, `timeline_builder` (vuelta↔timestamp, vueltas SC/VSC), base matemática del chaos→nota. El resto, solo referencia.

## 5. Stack

Python 3.11+ (pipeline) · Next.js 14 + TypeScript + Tailwind + Framer Motion (web) · Vercel (deploy). Repo: `github.com/fabianiernesto/f1-recap` (nombre provisional).

## 6. Diseño: móvil manda, desktop no es el móvil estirado

- **Móvil = diseño de referencia.** Stories, predicciones y selector de tiempo nacen para el pulgar. El usuario tipo llega el domingo por la noche desde el sofá.
- **Desktop = composición propia:** stories al centro a tamaño de teléfono, y el espacio lateral trabaja — el swipe-up se convierte en panel de datos siempre visible a la derecha, el progreso del GP a la izquierda. Nunca cards estiradas a 1920px.

## 7. Fases

- **Fase 0 — Datos reales (siguiente sesión):** ① verificar qué pide hoy OpenF1 (token para sesiones nuevas — visto en el código de Marc; confirmar que histórico sigue libre) ② bajar el GP piloto completo ③ inventario honesto: qué momentos detectamos bien, regular o no. ④ Paralelo, Ernesto: mensaje a Marc pidiendo OK para reutilizar piezas · revisar términos del team radio.
- **Fase 1 — Pipeline:** detección de momentos + templates → `race_story.json` real del GP piloto.
- **Fase 2 — Web:** entrada A + stories B en móvil, feo pero funcional → luego bonito. Después la composición desktop.
- **Fase 3 — Finde completo:** quali + libres + nota sin spoilers + glosario + deploy en Vercel.
- **Fase 4 — Test de verdad:** 3-4 personas que no ven F1. Si entienden la carrera y una repite otra semana, v1 cumplida → v1.1 (chat).

## 8. Pendientes finales (por este orden, al final)

1. GP piloto — criterio: carrera 2025-2026 caótica (SC + lluvia o pelea por la victoria). **Ernesto elige.**
2. Nombre real del producto (+ renombrar repo) — sesión propia de naming/branding.
3. Idioma (recomendación en pie: español primero).
