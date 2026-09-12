# Concepto v1: F1 Recap Interactivo
**Fecha:** 7 agosto 2026
**Estado:** Formatos validados por Ernesto (feedback sobre IDEAS_FORMATOS.md). Este doc consolida la dirección.

---

## 1. El concepto paraguas (lo que une todo lo que validaste)

Al validar chat interactivo + tono cercano + "cuánto tiempo tienes" + honestidad sesión a sesión, el producto ya tiene alma, y es esta:

> **"Tu colega friki de la F1."**
> El amigo que se ha visto TODO el fin de semana y te lo cuenta como tú quieras: en 30 segundos o con calma, sin spoilers si se lo pides, sin hacerte sentir tonto por preguntar, y al que puedes interrumpir con cualquier duda.

Esto no es un eslogan: es el **criterio de diseño** para cada decisión futura: *"¿esto lo haría/diría tu colega friki, o lo haría un dashboard?"*. Un colega no te enseña una tabla; te dice "tío, la clave fue la parada de Sainz". Un colega no te spoilea si le dices que aún no la has visto. Un colega te dice "los libres 1 fueron un muermo, sáltatelos". Esa es la web.

---

## 2. Formatos validados + refinamientos

### ✅ F1. Stories · CON vuelta de tuerca (tu apunte: que no sea el IG de la F1)

Tienes razón en el riesgo. La diferencia de fondo: **el Instagram oficial enseña lo que se vio por TV (clips, fotos, resultado). Nosotros contamos lo que PASÓ y POR QUÉ: incluido lo que la TV no enseñó** (el undercut que decidió la carrera, la batalla de mitad de parrilla, por qué un equipo se hundió). Y encima, interactivo. Vueltas de tuerca concretas, combinables:

1. **Stories con predicción**: antes de revelar un momento, la card te pregunta: *"Alonso sale 12º con blandos. ¿Crees que le salió bien?"* → tap → revelación. Microjuego en cada card; el IG oficial jamás podrá (spoilea por naturaleza).
2. **Swipe-up de profundidad**: cada card tiene el dato detrás (deslizar arriba = el "saber más"). La story es la superficie; los datos son el sótano.
3. **Stories de lo invisible**: cards dedicadas a lo que NO salió por TV. "Mientras mirabas la batalla por la victoria, esto pasaba en la P8...". Nuestro material sale de datos, no de cámaras: esa es la ventaja estructural.
4. **La card final = card compartible** (conecta con F12): el resumen del GP en una imagen, lista para el grupo de WhatsApp.

**Regla anti-IG-oficial:** si una card podría existir en el Instagram de la F1, se rediseña o se corta.

### ✅ F2. "¿Cuánto tiempo tienes?": para TODAS las sesiones (tu apunte)

Confirmado: el selector 30 seg / 3 min / 15 min aplica a FP1, FP2, FP3, Quali y Carrera, no solo al domingo. Con un matiz honesto que refuerza el concepto colega: **los libres muchas veces no dan para 15 minutos, y decirlo es una feature**. "FP1 en 30 segundos: rodaje de neumáticos, un susto de Bearman y poco más. De verdad, no hay más." El colega friki no te rellena; te ahorra tiempo. Esa honestidad genera una confianza que ningún medio (que necesita clicks) puede permitirse.

### ✅ F3+chat. El chat que te CONTESTA (tu apunte: poder preguntarle como a un amigo)

Me encanta y sube muchísimo el techo del producto. Pero te lo digo ruthless porque aquí hay dos temas serios:

**Tema 1: Esto reintroduce un LLM (y está bien, pero cambia una decisión previa).** Un chat que responde preguntas libres no se hace con templates: necesita un modelo. La buena noticia: como es post-sesión y con contexto acotado, es barato (Groq tiene tier gratis, que es lo que usa Marc; o Claude Haiku por céntimos por conversación). La clave anti-humo: el chat **solo responde desde los datos y notas de ESA carrera** (se le pasa el análisis como contexto, como hace Marc). Si no lo sabe, dice "ni idea bro, eso no lo tengo": que además es exactamente lo que diría un colega, o sea que la limitación técnica ES coherente con el personaje.

**Tema 2: Tu ejemplo exacto ("¿qué mejoras ha traído Aston?") NO está en los datos.** OpenF1 y FastF1 dan tiempos, posiciones, paradas, radio, meteo... pero las mejoras de coche, sanciones con contexto, o salseo de paddock **no existen en ninguna API gratuita**: eso sale de medios (Autosport, The Race, motorsport.com). Si el chat responde eso sin datos, se lo inventará. Solución que además juega a tu favor: una **"ficha editorial del GP"**: 10-15 bullets curados por ti por carrera (mejoras anunciadas, sanciones, contexto de mercado de pilotos) que se inyectan al chat junto a los datos. Eres creador de contenido de motor: curar 15 bullets por GP es tu terreno natural, te cuesta 20 minutos, y es un foso que un dev puro no puede copiar. El chat pasa de "IA sobre datos" a "IA con el conocimiento de un friki real".

**Diferencia con el chat de Marc** (que existe, seamos honestos): el suyo es un race engineer para ingenieros; el nuestro es un colega con otro tono, otro conocimiento (ficha editorial) y encajado en una experiencia narrativa, no al lado de un dashboard. La diferenciación es tono + curación, no la tecnología.

### ✅ F4. Modo sin spoilers: validado sin cambios

### ✅ F5. Modo Estratega: validado, con tu refinamiento (el porqué de cada decisión)

Tu apunte lo mejora mucho: no basta con "acertaste/fallaste": cada dilema lleva su **explicación de por qué tu decisión era razonable o no** comparada con la real: *"Elegiste parar. El equipo aguantó 3 vueltas más: el radar decía lluvia fuerte en 5 min y pararse antes te dejaba en tráfico detrás de Ocon. PERO se equivocaron: la lluvia llegó antes y perdieron 8 segundos. Tu instinto era bueno."* Esto convierte cada dilema en una microlección de estrategia. Requiere curación manual (4-5 dilemas por carrera): asumible y es de lo que más brilla en una demo.

### ✅ F6. Team radio: validado, pendiente de validar derechos de uso (tarea previa, sin cambios)

### ✅ F10. Nivel de fan: resuelto con tu restricción (un tono medio, no tres versiones)

De acuerdo total en no hacer el proyecto ×3. La solución barata que da el 80% del valor:

1. **UN solo tono para todo**: "casual inteligente" · el del colega friki: cercano, sin tecnicismos gratuitos, pero sin tratarte de tonto. (Es, no por casualidad, tu voz de LinkedIn.)
2. **Glosario contextual**: los términos técnicos inevitables (undercut, graining, DRS) van marcados y con tap/hover se despliega la explicación de una línea. El que sabe no lo toca; el nuevo lo tiene a un tap. Coste: un diccionario de ~40 términos escrito UNA vez para siempre.
3. El toggle de 3 niveles muere. El chat (F3) absorbe su función: si no entiendes algo, se lo preguntas.

---

## 3. Formatos en la nevera (no descartados, no v1)

- **F7 Duelos**: puede volver como forma de organizar cards dentro de las stories
- **F8 "Me dormí en la vuelta X"**: condimento barato, se decidirá cuando exista el timeline
- **F9 Episodios/temporada**: estructura v2, pero el modelo de datos debe prever multi-GP desde el día 1
- **F11 Traducciones cotidianas**: entra como recurso de escritura del tono, no como feature
- **F12 Cards compartibles**: validada implícitamente vía F1.4; se diseña con las stories

## 4. La foto del producto que queda

Entras a un GP → *"¿Ya sabes el resultado?"* (F4) → *"¿Cuánto tiempo tienes?"* (F2) → te lo cuenta en stories con predicciones y capas (F1) con radios reales (F6) → en cualquier momento le preguntas lo que sea como a un colega (F3+chat) → y si quieres jugar, te pones en el muro (F5). Todo en un solo tono con glosario a un tap (F10).

**Personalidad resultante: EMOCIONAL con capa jugable.** El combo B con el estratega dentro: coherente con la apuesta del doc anterior, pero decidido por tus tripas, que es como debía ser.

## 5. Qué queda abierto antes de rehacer el MVP

1. **Derechos del team radio** (investigación, 1 hora): condiciona F6
2. **El esqueleto de navegación**: ¿las stories SON la web, o son un modo dentro de una web más clásica? (afecta a todo el frontend)
3. **La pantalla de 10 segundos**: diseñar el momento "enséñamelo": propongo hacer maquetas visuales de 2-3 opciones antes de decidir
4. **Alcance real del chat en v1**: ¿entra desde el principio o el MVP sale sin chat y se añade en v1.1? (mi voto: la ficha editorial + chat entra pronto porque es tu diferenciación, pero NO en la primera demo)
5. Al final de todo: nombre, idioma, y reescritura completa de MVP.md con todo esto
