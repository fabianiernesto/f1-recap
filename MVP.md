# MVP — F1 Recap Interactivo
**Nombre provisional:** After the Flag *(guiño a tu web anterior, Before the Circuit — pendiente de decidir)*
**Fecha:** 7 agosto 2026
**Estado:** Borrador v1 — pendiente de validación por Ernesto

---

## 1. El problema

Ver F1 exige 2 horas de atención sostenida un domingo, más 4 sesiones previas que casi nadie ve. El fan casual (y cada vez más el fan joven) se pierde carreras, se duerme a mitad, o directamente no entiende por qué un momento importa. Las herramientas que existen para ponerse al día son para nerds de datos (dashboards, tablas de tiempos) o resúmenes de vídeo de 8 minutos que no puedes explorar.

**No es un problema de falta de datos. Es un problema de falta de atención.**

## 2. El producto

Una web que te cuenta **cualquier sesión de un Gran Premio como una historia interactiva**: qué pasó, en qué orden, y por qué importa — en lenguaje humano, no en tablas. Todo post-sesión (datos gratis vía OpenF1 + FastF1), pensado para responder una pregunta:

> *"Me he perdido la sesión (o me he dormido a mitad). ¿Qué ha pasado?"*

**Para quién:** el fan casual y el fan nuevo. NO para ingenieros — eso ya lo hace Pit Wall Engineer (el proyecto de Marc, nuestra referencia técnica). El dato duro existe, pero siempre **plegado** bajo un "¿quieres saber más?". La profundidad es opcional, nunca por defecto.

## 3. Qué entra en el MVP (y qué NO)

### Entra ✅

**1 Gran Premio completo, 5 sesiones (FP1, FP2, FP3, Quali, Carrera):**

- **Vista "El finde de un vistazo"** — landing del GP: qué pasó en cada sesión en 2-3 frases, quién llega fuerte al domingo, qué mirar en la carrera. Para el que solo ve la carrera.
- **Timeline narrativo de la carrera** — scroll vertical de momentos clave detectados desde datos: salida, adelantamientos relevantes, paradas que cambian posiciones, safety cars, abandonos, cambios de meteo, batallas (coches a <1s durante varias vueltas), última vuelta. Cada momento: una frase en lenguaje humano + contexto de por qué importa.
- **Capa "saber más"** — cada momento se despliega y enseña el dato que lo respalda (tiempos, posiciones, neumáticos). Aquí es donde reciclamos las ideas de análisis del proyecto de Marc.
- **Quali como historia** — no la tabla de resultados: quién sorprendió, quién la lió, por cuánto se decidió la pole.

### NO entra ❌ (v2 o nunca)

- ❌ Chat con IA (lo tiene Marc; para masas aporta menos de lo que parece)
- ❌ Replay de telemetría sobre el circuito (espectacular pero es feature de ingeniero; candidata a v2 simplificada)
- ❌ Datos en vivo (descartado por diseño)
- ❌ Todo el calendario (el MVP es 1 GP hecho excelente, luego escalamos)
- ❌ Cuentas de usuario, comentarios, social
- ❌ "Sigue a tu piloto" — la mejor idea para v2, pero es duplicar el trabajo narrativo × 20 pilotos; primero validamos el formato

## 4. Datos (todo gratis)

| Fuente | Qué nos da | Coste |
|--------|-----------|-------|
| **OpenF1 API** | Vueltas, posiciones, paradas, stints, race control (banderas, SC, investigaciones), meteo, intervalos, info de pilotos. 2023 en adelante, sin API key | 0 € |
| **FastF1** (Python) | Telemetría por vuelta, resultados de sesión, compuestos de neumático. Cache local propio | 0 € |

**Decisión clave de arquitectura:** los datos se procesan **offline** con un pipeline Python que genera JSON estáticos (`gp_madrid_2026/race_story.json`, etc.). La web solo lee esos JSON. Consecuencia: **no hay backend en producción → hosting gratis** (Vercel) y la web vuela. El "servidor" es un script que ejecutas tú una vez por GP.

## 5. Stack

| Capa | Tecnología | Por qué |
|------|-----------|---------|
| Pipeline de datos | Python 3.11+ (FastF1, httpx, Pandas) | FastF1 es Python sí o sí; mismo terreno que el repo de referencia |
| Narrativa | Templates en Python (determinista) | Frases generadas por reglas: "X adelanta a Y en la vuelta N por Z". Sin coste, sin alucinaciones. *Opcional v2: pulido con LLM offline, una pasada por GP, céntimos* |
| Frontend | Next.js 14 + TypeScript + Tailwind + Framer Motion | Estándar, gratis en Vercel, y las animaciones de scroll (Framer Motion) son EL producto aquí |
| Hosting | Vercel (free tier) | JSON estáticos, cero servidor |

## 6. Estructura del proyecto

```
after-the-flag/
├── pipeline/               # Python: de OpenF1/FastF1 → JSON de historia
│   ├── fetch/              # clientes OpenF1 + FastF1, cache crudo por sesión
│   ├── detect/             # detección de momentos (adelantamientos, SC, batallas...)
│   ├── narrate/            # templates → frases en lenguaje humano
│   └── build.py            # orquestador: python build.py --gp madrid-2026
├── data/                   # JSON generados (se commitean, son el "backend")
│   └── <gp-slug>/
│       ├── weekend.json    # resumen del finde
│       ├── quali_story.json
│       └── race_story.json
└── web/                    # Next.js
```

## 7. Fases

- **Fase 0 — Exploración (1ª sesión de curro):** script que baja los datos de 1 carrera de OpenF1, los mira, y confirmamos qué momentos son detectables con qué fiabilidad. Sin frontend. *Aquí es donde el proyecto se hace real.*
- **Fase 1 — Pipeline:** detección de momentos + templates de narrativa → `race_story.json` completo de 1 carrera.
- **Fase 2 — Web:** timeline narrativo con scroll + capa "saber más". Primero feo y funcional, luego bonito.
- **Fase 3 — Finde completo:** quali + libres + vista landing del GP. Deploy en Vercel.
- **Fase 4 — Validación:** se lo enseñas a 3-4 amigos NO fans de F1. Si entienden la carrera sin ayuda, el MVP funciona. Luego: más GPs, y decidimos v2.

## 8. Decisiones abiertas (las tuyas, Ernesto)

1. **Nombre** — ¿After the Flag? ¿Otro? (afecta a dominio y a cómo lo vendes en LinkedIn)
2. **Idioma** — Recomiendo **español primero** (tu audiencia de LinkedIn, tu diferenciación: casi todo esto existe solo en inglés). Bilingüe en v2.
3. **GP piloto** — Criterio: una carrera 2025-2026 caótica (SC + lluvia o batalla por la victoria). Cuanto más caos, mejor luce el formato. Dime cuál te marcó y esa usamos.

## 9. Trampas conocidas (para no caer)

- **Clonar a Marc con otra piel.** Si en algún momento estamos construyendo una gráfica antes que una frase, nos hemos desviado. La unidad del producto es el *momento contado*, no el dato.
- **Scope creep.** Todo lo de la lista ❌ está ahí por algo. V2 se gana entregando v1.
- **Perfeccionismo narrativo.** Los templates darán frases robóticas al principio. Se pulen iterando con carreras reales, no diseñando en abstracto.
