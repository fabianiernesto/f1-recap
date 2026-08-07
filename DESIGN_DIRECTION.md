# Design Direction — el look del producto
**Fecha:** 7 agosto 2026 · **Estado:** v1, aprobación pendiente de Ernesto
**Regla madre (de Ernesto):** profesional y realista en TODO. Cero look infantil.

---

## 1. La referencia mental

**Gráficos de retransmisión de F1** (lower thirds de F1 TV, pantallas de timing, muros de boxes) + **web técnica premium** (la sobriedad de un configurador de Porsche, no un juego para niños). Si un elemento podría salir en pantalla durante una carrera real sin cantar, va bien. Si parece sticker de Telegram, fuera.

## 2. Los "tells" infantiles que quedan PROHIBIDOS

- Emojis en la interfaz (en botones, kickers, HUD). El copy puede ser bar voice; la UI es seria.
- Bordes muy redondeados (el radio máximo es 6px; los pills redondos solo para estados de timing).
- Colores caramelo saturados sobre fondos lisos.
- Iconos "cute" o ilustración cartoon. El coche es un coche, con proporciones de F1 real.
- Sombras blandas gigantes y glows de neón.

## 3. Paleta (tokens)

| Token | Hex | Uso |
|---|---|---|
| `--carbon-0` | `#0A0B0E` | fondo base (carbono profundo) |
| `--carbon-1` | `#111318` | paneles / cards |
| `--carbon-2` | `#1A1D24` | superficies elevadas, asfalto |
| `--line` | `#272B33` | bordes hairline |
| `--ink` | `#F2F3F5` | texto principal |
| `--muted` | `#8B919D` | texto secundario |
| `--accent` | `#E10600` | acento primario: LA línea roja de carrera. Con cuentagotas |
| `--purple` | `#A855F7` | semántico timing: vuelta rápida |
| `--green` | `#22C55E` | semántico timing: posición ganada / correcto |
| `--yellow` | `#EAB308` | semántico timing: precaución / SC |

Regla: el rojo es señal, no decoración. Un elemento rojo por pantalla como máximo (la barra de progreso cuenta como cero: es cromo del sistema). Los semánticos solo significan lo que significan en un timing real.

## 4. Tipografía

| Rol | Fuente | Uso |
|---|---|---|
| Display | **Barlow Condensed** (600/700, uppercase, tracking +2%) | titulares de cards, HUD |
| Body | **Inter** (400/600) | párrafos, UI |
| Timing | **JetBrains Mono** (500, tabular) | vueltas, tiempos, gaps, tablas de datos |

Jerarquía de card: kicker (mono 10px, tracking ancho, con pestaña lateral de color) → titular (condensed 26-30px) → cuerpo (Inter 15px, interlineado 1.55). Los números SIEMPRE en mono tabular: es lo que hace que huela a timing real.

## 5. El coche y la pista

- **Coche:** top-view con proporciones reales de F1 (~2.6:1 largo/ancho), carbono oscuro, detalle de alerones con endplates, halo, ruedas con llanta. Una sola línea de acento en el morro. Nada de "cochecito".
- **Pista:** asfalto `--carbon-2` con **líneas de borde blancas finas** (las pistas reales no llevan línea central discontinua — eso es una autopista). Salida con parrilla insinuada, meta a cuadros fina. Kerbs rojo/blanco solo si se puede hacer bien; si no, nada.
- El coche se inclina en las curvas (rotación por tangente) y NO rebota ni hace animaciones de juguete.

## 6. Motion

Física sobria: ease-out corto (300-450ms), desplazamientos ≤ 24px, sin bounce, sin parallax gratuito. `prefers-reduced-motion` siempre respetado. La sensación objetivo: precisión de equipo de datos, no fiesta.

## 7. Aplicación

Este doc gobierna el prototipo (`web_preview/`) y sobre todo la Fase 2 (Next.js + Tailwind: estos tokens se convierten en el theme). Cualquier decisión visual nueva se contrasta contra la sección 2 antes de entrar.
