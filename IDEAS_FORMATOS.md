# Ideas y formatos: F1 Recap Interactivo
**Fecha:** 7 agosto 2026
**Estado:** Exploración de concepto. Esto va ANTES que MVP.md (que queda en pausa como borrador técnico).

---

## 0. La pregunta correcta

No es "¿cómo enseño los datos de una carrera?". Es: **¿por qué entra alguien a esta web?** Cada motivo de entrada pide un formato distinto. Si no elegimos el motivo, acabaremos haciendo un dashboard más.

### Los 6 motivos de entrada (jobs)

| # | El usuario piensa... | Lo que necesita |
|---|---------------------|-----------------|
| J1 | "Me perdí la carrera, ¿qué pasó?" | Ponerse al día rápido y entendiendo |
| J2 | "¿Merece la pena ver la repetición?" | Respuesta SIN spoilers |
| J3 | "Me dormí / dejé de mirar en la vuelta 30" | Ponerse al día parcial |
| J4 | "Vi la carrera pero no entendí por qué X era importante" | Contexto y explicación |
| J5 | "Quiero sentir la emoción sin echarle 2 horas" | Drama condensado, no datos |
| J6 | "Quiero tener algo que decir mañana con mis colegas / en redes" | Munición social compartible |

**Observación clave:** J2 no lo hace NADIE bien. Todos los recaps del mundo spoilean. Ahí hay una idea original de verdad (ver F4).

---

## 1. Ideas de formato

Cada una con: qué es, por qué funciona para masas, y su riesgo real.

### F1. La carrera en formato Stories 📱
La carrera contada en 12-15 tarjetas a pantalla completa que pasas con tap/swipe, como stories de Instagram. Una tarjeta = un momento. Foto/gráfico grande, una frase, y "toca para profundizar".
- **Por qué funciona:** es EL formato nativo de atención corta. Cero curva de aprendizaje: las masas ya saben usarlo. Mobile-first de verdad.
- **Riesgo:** en desktop pierde gracia; hay que diseñar el equivalente.

### F2. "¿Cuánto tiempo tienes?" ⏱️
Al entrar, eliges: **30 segundos / 3 minutos / 15 minutos**. La misma carrera en tres profundidades: titular con 3 datos → historia de momentos clave → finde completo con contexto. No son tres páginas: es el mismo contenido que se expande.
- **Por qué funciona:** convierte el problema (falta de atención) en la mecánica central del producto. Respeta al usuario en vez de pelearse con él. Es un pitch de una frase: *"la F1 en el tiempo que tengas"*.
- **Riesgo:** triplica el trabajo editorial de cada carrera si no se automatiza bien la condensación.

### F3. La carrera como chat de WhatsApp 💬
Revives la carrera como una conversación de grupo: mensajes que van llegando en secuencia ("🚨 SAFETY CAR vuelta 31", "no me jodas, Sainz se para AHORA??"), con la emoción del directo comprimida en 3 minutos. Puedes tocar cualquier mensaje para ver el dato detrás.
- **Por qué funciona:** así es como media generación VIVE ya la F1 (en el grupo de colegas). Replica la emoción del directo, que es justo lo que un recap normal mata. Tono humano gratis.
- **Riesgo:** el tono es un arma de doble filo: o suena auténtico o suena a marca haciéndose la joven. Hay que escribirlo MUY bien (y aquí tu voz de creador es la ventaja).

### F4. Modo sin spoilers: "¿La veo o me la cuentas?" 🙈
Al entrar a un GP la web pregunta: **¿ya sabes el resultado?** Si NO: te da una **nota de la carrera (0-10) sin revelar nada** ("un 8/10: llueve, hay caos y la batalla por la victoria llega a la última vuelta: VE A VERLA") + un mapa de calor de emoción por vueltas para saltar directo a lo bueno en la repetición. Si SÍ: te abre el recap completo.
- **Por qué funciona:** resuelve J2, que nadie resuelve. Es el tipo de feature que la gente comparte por sí sola ("mira, esta web te dice si la carrera merece la pena sin spoilearte"). La nota puede calcularse desde datos (SC, cambios de líder, batallas, meteo) → el Chaos Index de Marc reciclado para masas.
- **Riesgo:** la nota tiene que ser fiable; una carrera puntuada mal mata la confianza. Y la portada del GP debe estar libre de spoilers hasta en las miniaturas.

### F5. Modo Estratega: "¿Tú qué habrías hecho?" 🎮
En 4-5 momentos clave de la carrera, la web te pone en el muro: *"Vuelta 28. Llueve más. Hamilton pide cambiar a full wet. El radar dice que para en 10 min. ¿Lo metes a boxes?"* → eliges → la web te enseña qué hizo el equipo real y cómo salió. Al final: "acertaste 3 de 5: mejor que el muro de Ferrari".
- **Por qué funciona:** convierte el recap en JUEGO. Es interactividad de verdad, no scroll con animaciones. Enseña estrategia (lo más opaco de la F1 para el casual) haciéndote sentirla, no explicándola. Resultado compartible → J6.
- **Riesgo:** requiere curación manual de cada dilema (no se automatiza del todo). Pero 4-5 momentos por carrera es asumible.

### F6. Team radio como hilo narrativo 📻
OpenF1 tiene las **grabaciones reales de radio de equipo**. El recap se cuenta con los audios como columna vertebral: el momento + la voz real del piloto cabreado/eufórico. El team radio es sistemáticamente el contenido más viral de la F1.
- **Por qué funciona:** emoción humana real, no datos. Es lo que las masas ya consumen en clips de TikTok, pero con contexto e hilo. Ningún recap estructurado lo usa así.
- **Riesgo:** derechos de uso: hay que revisar los términos de OpenF1 y de F1 para audio incrustado. Investigar ANTES de enamorarnos de esta idea. Plan B: transcripciones citadas + enlace.

### F7. La carrera como duelos, no como 20 coches ⚔️
El recap no es una cronología de 20 pilotos: son **4-5 duelos** ("La batalla por la victoria", "El drama interno de Alpine", "El rookie contra su ídolo"). Eliges el hilo que te importa y lo sigues de principio a fin.
- **Por qué funciona:** las personas siguen historias de PERSONAS, no clasificaciones. Es la fórmula Drive to Survive aplicada a datos. Reduce 20 coches de ruido a 3 historias con protagonistas.
- **Riesgo:** la detección automática de "qué duelos importaron" es el reto técnico narrativo más fino. Semi-manual al principio.

### F8. "Me dormí en la vuelta X" 😴
Un slider: marcas en qué vuelta te quedaste (o "me fui a mitad de quali") y la web te cuenta **solo desde ahí**, empezando por "vale, pues justo después de irte...".
- **Por qué funciona:** hiper-específico y nadie lo tiene. Es gracioso, humano, y exactamente J3. Feature pequeña con mucho encanto: de las que se enseñan en un tuit.
- **Riesgo:** ninguno serio; es una vista filtrada del timeline. Candidata a "detalle que enamora" más que a producto central.

### F9. Temporada como serie: episodios 🎬
Cada GP es un **"Episodio"** con su "Anteriormente en la F1..." (30 segundos de contexto: qué se juega cada protagonista al llegar). La temporada es la serie; el campeonato es el arco.
- **Por qué funciona:** el casual no arrastra contexto entre carreras: este formato se lo da masticado. Estructura mental que ya conoce (Netflix). Da identidad de producto a largo plazo.
- **Riesgo:** solo brilla con varios GPs acumulados; en el primer GP no aporta. Es capa de v2, pero conviene DISEÑAR la estructura desde v1.

### F10. Toggle de nivel de fan 🎚️
Un selector global: **"Nuevo total / Casual / Entendido"**. Cambia el lenguaje de toda la web: "los coches con suelo dañado pierden agarre" vs "el graining en el delantero izquierdo". Mismo contenido, tres registros.
- **Por qué funciona:** resuelve el mayor miedo del fan nuevo (sentirse tonto) sin aburrir al que ya sabe. Democratización real, no de nota de prensa.
- **Riesgo:** multiplica el trabajo de templates × 3. Quizá solo 2 niveles al principio.

### F11. Traducciones a la vida real 🍳
Cada dato técnico con una comparación cotidiana: *"Se juegan la pole por 0,072s: menos de lo que tarda en caerse tu móvil de la mesa"*. *"El pit stop duró 2,1s: no te da tiempo ni a leer esta frase"*.
- **Por qué funciona:** los números absolutos no significan NADA para el casual. La comparación es lo que se recuerda y se repite (→ J6). Baratísimo de implementar (banco de comparaciones reutilizables).
- **Riesgo:** si se abusa, cansa. Condimento, no plato.

### F12. Cards de momentos compartibles 🃏
Cada momento clave genera una **card visual** (imagen limpia: piloto, dato, frase) lista para compartir en WhatsApp/X/IG con enlace de vuelta a la web.
- **Por qué funciona:** es el growth loop. J6 puro: le das al usuario munición social y cada card comparte tu web. Además conecta con tu skill real (contenido + edición).
- **Riesgo:** ninguno técnico (generación de imágenes desde template). El riesgo es hacerlas feas: y ahí precisamente tú tienes ventaja.

---

## 2. Cómo se combinan (esto no es un menú, es un puzzle)

Las ideas no compiten: algunas son **esqueleto** (estructura del producto), otras son **capas** (se añaden encima) y otras son **condimento** (detalles).

- **Esqueletos posibles (elegir UNO):** F1 Stories · F2 Cuánto-tiempo-tienes · F7 Duelos
- **Capas (elegir 1-2 para v1):** F4 Sin spoilers · F5 Modo Estratega · F6 Team radio · F9 Episodios
- **Condimentos (baratos, casi todos entran):** F8 Me-dormí · F11 Traducciones · F12 Cards · F10 Toggle (este es caro, decidir)

### Tres combos con personalidad distinta

**Combo A: "El recap definitivo"** = F2 + F4 + F11 + F12
La web utilitaria perfecta: entras, dices cuánto tiempo tienes, sin spoilers si quieres. Producto serio, masivo, pitch clarísimo. *Personalidad: útil.*

**Combo B: "La carrera revivida"** = F3 + F6 + F8 + F12
El recap emocional: chat + radios reales + "me dormí en la 30". No informa de la carrera: te la hace SENTIR. Más original, más viral, más tú (voz, tono, contenido). *Personalidad: emocional.*

**Combo C: "La F1 jugable"** = F7 + F5 + F9 + F11
Duelos + modo estratega + episodios. El recap como juego narrativo. El más diferenciado y el más ambicioso de producción. *Personalidad: juguetona.*

---

## 3. Mi lectura (ruthless, como pediste)

1. **La decisión de concepto es una sola: ¿la web es ÚTIL, EMOCIONAL o JUGABLE?** Todo lo demás (nombre, idioma, stack, alcance) cuelga de eso. Intentar las tres personalidades a la vez = dashboard con disfraces.
2. Mi apuesta personal: **B como alma, con F4 (sin spoilers) robada del combo A** porque es la feature más original del lote y encaja en cualquier combo. La razón: los combos A y C los podría construir cualquier dev bueno. El B solo lo puede hacer bien alguien que sepa escribir y entienda el contenido: esa es tu ventaja injusta, no el código.
3. **F5 (Modo Estratega) es la mejor idea "wow" del documento**: si algún día enseñas este proyecto en una entrevista, es lo que van a recordar. Pero es la más cara de producir por carrera. La guardaría diseñada en el cajón para v2, no la tiraría.
4. **F6 (team radio) hay que validarla ya**: es potencialmente diferenciadora pero depende de derechos que no controlamos. Tarea concreta: leer términos de OpenF1 sobre audio antes de decidir nada que dependa de ella.

---

## 4. Qué decidir ANTES de tocar el MVP (en orden)

1. **Personalidad**: ¿útil, emocional o jugable? (= elegir combo o definir el tuyo)
2. **Esqueleto**: ¿stories, tiempo-elegido, duelos... u otra estructura que salga de mezclar?
3. **El momento "enséñamelo"**: ¿qué pantalla única, enseñada 10 segundos a un no-fan, hace que diga "quiero esto"? Esa pantalla ES el MVP.
4. Solo entonces: revisar MVP.md, y al final de todo, nombre e idioma.
