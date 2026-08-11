# Mapa de producto — qué secciones tiene la web
**Fecha:** 10 agosto 2026 · **Estado:** plan de construcción (el diseño queda congelado, ahora toca utilidad)

---

## Lo que hay hoy

| Ruta | Qué es | Estado |
|---|---|---|
| `/` | Lista con un GP | Placeholder |
| `/gp/silverstone-2026` | Portada + recap de carrera en scroll + póster final | ✅ Diseño cerrado |

Solo existe **la carrera**. El resto del finde (FP1, Sprint Quali, Sprint, Quali) está cacheado pero no se cuenta. Y falta lo que hace único al producto: la entrada anti-spoiler y el selector de tiempo.

## Lo que hay que construir (por orden de valor)

### 1. Home real — la puerta del producto
Hoy es una lista sin alma. Debe: explicar en dos líneas qué es esto, destacar **el último GP** con su portada, listar el resto de carreras de la temporada, y dejar claro el tono ("tu colega friki"). Sin cuentas, sin registro, sin fricción.

### 2. Hub del GP — el finde completo
`/gp/[slug]` deja de ser el recap y pasa a ser **el índice del fin de semana**:
- La portada que ya tenemos (circuito, monumento, piloto).
- **Puerta anti-spoiler**: "¿ya sabes cómo acabó?" → si no, nota 0-10 + mapa de calor de vueltas, sin nombres.
- **Selector de tiempo**: 30 s / 3 min / 15 min, que decide cuántos momentos ves.
- **Las 5 sesiones** como tarjetas, cada una con su titular honesto ("FP1: no pasó nada, sáltatelo") y su enlace.

### 3. Historias por sesión
`/gp/[slug]/[session]` reutiliza el scroll que ya funciona:
- **race** (hecho), **quali**, **sprint**, **sprint-quali**, **fp1**.
- Cada sesión tiene su propia lógica de momentos: la quali se cuenta por eliminaciones y milésimas, los libres por ritmo y sustos, la carrera por adelantamientos y estrategia.

### 4. La nota sin spoilers (0-10)
Calculada desde datos: safety cars, cambios de líder, adelantamientos limpios, abandonos, meteo y margen final. Va con una frase que **no revela nada** ("un 8,7: ve a verla") y el **mapa de calor por vuelta** para saltar a lo bueno en la repetición.

### 5. Glosario contextual
~40 términos (undercut, DRS, graining...) marcados en los textos; un toque los explica en una línea. Se escribe una vez, sirve para siempre.

### 6. Después
Cards compartibles · chat "pregúntale al colega" · modo estratega · más GPs.

## Orden de trabajo

1. **Pipeline multi-sesión** — que los datos existan para las 5 sesiones + nota + mapa de calor. *(sin esto, todo lo demás es maqueta)*
2. Hub del GP con puerta anti-spoiler y selector de tiempo.
3. Historias de quali y sprint.
4. Home real.
5. Glosario.
