# Especificación — PELVIA (Terapia de suelo pélvico guiada con electroestimulador y biofeedback)
Versión: 0.1 · Autor: Kilder Leyva · Fecha: 2026-11-03 · Proyecto personal (alias KOLH) · Clasificación: **app nueva → ciclo completo (6 fases)**

> Nota de alcance clínico: PELVIA es una herramienta de **apoyo y guía** para la rehabilitación conservadora del suelo pélvico.
> No diagnostica, no sustituye la valoración de un médico ni de un fisioterapeuta especializado, y no controla el equipo.
> Todo el contenido clínico proviene de guías y literatura publicada (ver §10) y está parametrizado como datos (`content/protocolos.json`).

## 1. Problema y contexto
Una amiga de Kilder tiene una disfunción del suelo pélvico y cuenta con un electroestimulador con biofeedback de uso doméstico.
Los manuales de estos equipos listan programas (STRESS, URGE, MIXED, etc.) pero no explican **cuál** usar según el malestar,
**cuántas veces por semana**, **cómo progresar** ni cómo combinarlos con los ejercicios voluntarios (Kegel/PFMT), que son el
tratamiento de primera línea según NICE. Sin esa guía, el uso es irregular, con intensidades mal elegidas y sin medir mejora.

## 2. Objetivo
Entregar una app de celular que, a partir de un cuestionario de seguridad y de síntomas, **reconozca el tipo de malestar**,
proponga un **programa de 12 semanas por niveles** (electroestimulación + biofeedback + ejercicios + hábitos), **guíe cada
sesión con temporizador** y **mida el progreso**, con calidad de contenido equivalente a una ficha de fisioterapia profesional.

## 3. Alcance
**Incluye**
- Cuestionario de seguridad (contraindicaciones absolutas, precauciones, banderas rojas).
- Cuestionario de síntomas con el ICIQ-UI SF integrado y clasificación automática en 8 perfiles.
- Autoevaluación de fuerza (esquema PERFECT simplificado: P, E, R, F) → nivel inicial (0–5) + mantenimiento.
- Catálogo completo de tipos de sesión (electroestimulación, biofeedback, ejercicios sin equipo, relajación, TENS para dolor,
  entrenamiento vesical, hábitos) con parámetros, pasos, ilustraciones originales y fuentes.
- Programas semanales por perfil con frecuencias (qué sesión, qué día, cuántos minutos, cuántas semanas).
- Sesión guiada con temporizador sincronizado a los ciclos ON/OFF del equipo, vibración y sonido.
- Progresión y regresión automática de nivel por reglas; re-evaluaciones programadas (semanas 2, 4, 8, 12).
- Progreso con gráficas (segundos de sostén, rápidas, mA, ICIQ, adherencia).
- "Mi equipo": modelo, programas preconfigurados y equivalencias con los parámetros recomendados.
- Caso ejemplo cargable con datos ficticios.
- Respaldo JSON (exportar/importar) e informe imprimible para llevar al profesional.
- PIN opcional de privacidad. Modo offline (PWA instalable).

**No incluye (fuera de alcance)**
- Conexión Bluetooth/USB al electroestimulador (ninguno de los equipos domésticos expone protocolo abierto; ver ADR-0002).
- Diagnóstico médico, lectura automática de EMG, interpretación de estudios urodinámicos.
- Multiusuario, cuentas, sincronización en la nube, notificaciones push con servidor.
- Publicación en Google Play / App Store (posible fase posterior con Capacitor/TWA; ver ADR-0001).
- Contenido para embarazo (la electroestimulación está contraindicada; la app lo bloquea y remite al profesional).
- Población pediátrica.

## 4. Actores / usuarios
| Actor | Descripción | Qué hace |
|---|---|---|
| USUARIA | La amiga de Kilder (adulta, uso personal en su celular) | Responde cuestionarios, sigue el plan, ejecuta sesiones guiadas, revisa progreso, exporta su informe |
| PROFESIONAL (indirecto) | Médico / fisioterapeuta de suelo pélvico que la atiende | Recibe el informe exportado; puede ajustar parámetros en "Mi equipo" si lo indica |
| DESARROLLADOR | Kilder | Mantiene el contenido clínico (`protocolos.json`) y la app; publica en GitHub Pages |

## 5. Requisitos funcionales
| ID | Requisito | Prioridad |
|---|---|---|
| RF-01 | Onboarding con aviso ("no sustituye al profesional") y consentimiento explícito; sin aceptar no se accede a evaluación ni sesiones | Alta |
| RF-02 | Cuestionario de seguridad: contraindicaciones absolutas bloquean toda sesión de electroestimulación; precauciones muestran advertencia; banderas rojas muestran "consulta médica antes de continuar" | Alta |
| RF-03 | Cuestionario de síntomas (escalas 0–3 por dimensión: esfuerzo, urgencia, frecuencia/nocturia, fecal, prolapso, dolor/hipertonía, vaciado, contexto postparto/menopausia) con el ICIQ-UI SF (3 ítems, 0–21) | Alta |
| RF-04 | Clasificación automática del perfil: IUE, URGENCIA (vejiga hiperactiva), MIXTA, FECAL, DOLOR/HIPERTONÍA, PROLAPSO leve, POSTPARTO, PREVENCIÓN; severidad ICIQ (leve/moderada/severa/muy severa); mensaje de derivación cuando corresponde | Alta |
| RF-05 | Autoevaluación de fuerza guiada (P 0–5 con descripciones legas, E segundos 0–10, R repeticiones 0–10, F rápidas 0–10) que asigna el nivel inicial 0–4 | Alta |
| RF-06 | Generación del plan: programa de 12 semanas con sesiones por día, tipo, duración y frecuencia, según perfil + nivel + contraindicaciones; el plan se puede regenerar tras una re-evaluación | Alta |
| RF-07 | Ficha de parámetros por sesión de electroestimulación: frecuencia (Hz), ancho de pulso (µs), ON/OFF (s), rampa (s), duración (min), intensidad (guía en mA), sonda, posición, participación activa; equivalencia con los programas preconfigurados registrados en "Mi equipo" | Alta |
| RF-08 | Sesión guiada de electroestimulación: temporizador con fases CONTRAE/RELAJA sincronizadas al ON/OFF configurado, cuenta regresiva, vibración y sonido (configurables), pausa/reanudar, pantalla siempre encendida, y registro al cerrar (mA usados, esfuerzo 1–10, dolor sí/no, nota) | Alta |
| RF-09 | Sesión guiada de biofeedback/ejercicio (lentas, rápidas, resistencia, relajación, funcional) con series, repeticiones y descansos del nivel; registro opcional de valores EMG del equipo (pico y reposo en µV) y de repeticiones logradas | Alta |
| RF-10 | Biblioteca: todos los tipos de sesión y todos los niveles visibles, con ilustración, para qué sirve, parámetros, pasos y fuente; las no recomendadas para el perfil se marcan y explican | Alta |
| RF-11 | Progresión automática de nivel por reglas (mínimo 2 semanas por nivel, adherencia ≥ 70 %, metas de E y F alcanzadas, sin dolor en las últimas 3 sesiones) y regresión ante dolor en 2 sesiones consecutivas o < 50 % de repeticiones en 3 sesiones; notificación en pantalla del cambio y del motivo | Alta |
| RF-12 | Pantalla "Hoy": sesiones planificadas del día, estado (pendiente/hecha), próxima re-evaluación, racha semanal | Alta |
| RF-13 | Progreso: adherencia semanal (hechas/planificadas), evolución de E, F, intensidad (mA) y ICIQ; gráficas sin librerías externas | Media |
| RF-14 | Re-evaluaciones programadas: fuerza cada 2 semanas; ICIQ en semanas 0, 4, 8 y 12; comparación con la evaluación anterior y mensaje de "consulta al profesional" si a las 12 semanas no hay mejora (ICIQ sin bajar ≥ 2 puntos) | Media |
| RF-15 | Entrenamiento vesical para URGENCIA/MIXTA: diario miccional de 3 días (micciones, urgencias, escapes), intervalo objetivo que sube 15 min por semana hasta 3–4 h, y guía de la técnica de supresión de urgencia | Media |
| RF-16 | Caso ejemplo: botón "Ver ejemplo" que carga un perfil ficticio completo (evaluación, plan, 4 semanas de sesiones y progreso) claramente marcado como DEMO, y botón "Restablecer" que lo borra | Media |
| RF-17 | "Mi equipo": marca/modelo elegidos de una lista precargada de equipos conocidos (TensCare, NeuroTrac, Neen, Kegel8/iStim, Globus, I-Tech, Innovo, biofeedback Bluetooth, clínicos, genéricos), tipo de equipo (con sonda, con sonda y EMG, externo sin sonda, biofeedback sin estimulación, genérico, clínico), tipo de sonda, mA máximo y programas preconfigurados (nombre → tipo de sesión equivalente) con edición manual; el plan se recalcula al cambiar el equipo | Media |
| RF-18 | Exportar/importar respaldo JSON (todo el estado) e "Informe de progreso" imprimible (PDF desde el navegador) con evaluaciones, nivel, adherencia y gráficas | Media |
| RF-19 | Bloqueo por PIN de 4 dígitos opcional al abrir la app; recuperación = restablecer datos | Baja |
| RF-20 | Módulo "Aprende": anatomía, cómo contraer correctamente (sin glúteos/abdomen/respiración contenida), errores comunes, el "Knack", hábitos (cafeína, líquidos, estreñimiento, peso), higiene y cuidado de la sonda; con ilustraciones | Media |
| RF-21 | Mensajes de seguridad en cada sesión: intensidad nunca dolorosa, detener ante dolor/sangrado/irritación, no usar con infección activa, no dormirse con el equipo, limpiar la sonda; recordatorio de contraindicaciones al iniciar cada sesión de electroestimulación | Alta |

## 6. Requisitos no funcionales
| ID | Tipo | Requisito |
|---|---|---|
| RNF-01 | Plataforma | PWA mobile-first instalable (Android Chrome ≥ 100, iOS Safari ≥ 15), usable al 100 % sin conexión tras la primera carga (service worker con precache) |
| RNF-02 | Stack | HTML + CSS + JavaScript (ES modules) sin build step ni dependencias npm; sin librerías externas en runtime (gráficas en SVG propio) |
| RNF-03 | Privacidad | Datos de salud solo en el dispositivo (localStorage con esquema versionado); sin backend, sin cuentas, sin analítica, sin llamadas de red salvo la carga de la propia app |
| RNF-04 | Idioma y unidades | Español claro (Perú), unidades Hz, µs, s, mA, min; lenguaje no técnico en pantallas de usuaria |
| RNF-05 | Accesibilidad | Objetivos táctiles ≥ 44 px, contraste AA, tipografía ≥ 16 px (≥ 28 px en el temporizador), vibración/sonido desactivables, `aria-label` en ilustraciones |
| RNF-06 | Rendimiento | Peso total < 2 MB; primera carga < 2 s en 4G; temporizador con desfase < 100 ms por ciclo (basado en `performance.now`, no en `setInterval` acumulativo) |
| RNF-07 | Contenido como datos | Todo el contenido clínico en `content/protocolos.json` versionado, con campo `fuentes` por protocolo; cambiar un parámetro no requiere tocar código |
| RNF-08 | Seguridad clínica | Ninguna sesión de electroestimulación puede iniciarse si la última evaluación de seguridad tiene una contraindicación absoluta o está vencida (> 90 días); aviso "no sustituye al profesional" visible en plan, sesiones e informe |
| RNF-09 | Calidad | Motor de reglas (`engine/`) puro, sin DOM, probado con `node --test` (sin dependencias); cobertura ≥ 80 % en `engine/`; cada RF con al menos un test nombrado con su ID |
| RNF-10 | Despliegue | Repositorio público `kilder16/pelvia-app`, GitHub Pages desde `main` (raíz); versión visible en "Acerca de"; rollback por tag |
| RNF-11 | Imágenes | Ilustraciones originales en SVG (sin material con derechos de terceros), esquemáticas, no explícitas, con texto en español |

## 7. Criterios de aceptación (Gherkin)
RF-01
  Dado que la app se abre por primera vez
  Cuando la usuaria no marca el consentimiento
  Entonces los botones "Evaluación", "Hoy" y "Biblioteca" permanecen deshabilitados y se muestra el aviso completo

RF-02 (a)
  Dado que en seguridad responde "sí" a "¿Estás o podrías estar embarazada?"
  Cuando termina el cuestionario
  Entonces el perfil queda con `contraindicacionEST = true`, ninguna sesión EST-*/TENS-* aparece en el plan y la pantalla muestra "Consulta con tu profesional antes de usar el electroestimulador"
RF-02 (b)
  Dado que responde "sí" a "¿Has visto sangre en la orina?"
  Cuando termina el cuestionario
  Entonces aparece el bloque "Bandera roja: consulta médica antes de continuar" y el plan se genera igualmente solo con ejercicios sin equipo

RF-03
  Dado que responde los 3 ítems del ICIQ-UI SF con 3, 2 y 6
  Cuando se calcula el puntaje
  Entonces el total es 11 y la severidad "moderada"

RF-04
  Dado esfuerzo = 3 y urgencia = 0 (resto 0)
  Cuando se clasifica
  Entonces el perfil es IUE
  Dado esfuerzo = 2 y urgencia = 3
  Entonces el perfil es MIXTA con predominio URGENCIA
  Dado dolor/hipertonía ≥ 2 con cualquier otro puntaje
  Entonces el perfil es DOLOR/HIPERTONÍA, el plan no incluye fortalecimiento con electroestimulación y se recomienda valoración profesional

RF-05
  Dado P = 2, E = 4, R = 6, F = 4
  Cuando se asigna nivel
  Entonces el nivel inicial es 2
  Dado P = 0 o P = 1
  Entonces el nivel inicial es 0 y, sin contraindicación, el plan incluye EST-SENS

RF-06
  Dado perfil IUE moderada, nivel 2, equipo con sonda vaginal y sin contraindicaciones
  Cuando se genera el plan
  Entonces la semana tipo contiene 3 sesiones EST-IUE (L-X-V), PFMT diario (3 series) y BIO 2 veces (M-J), con re-evaluaciones en semanas 2, 4, 6, 8, 10, 12 (fuerza) y 4, 8, 12 (ICIQ)

RF-07
  Dado una sesión EST-IUE en semanas 1–4
  Cuando se abre la ficha
  Entonces muestra 35 Hz, 250 µs, ON 5 s / OFF 10 s, rampa 1 s, 20 min, intensidad "hasta notar contracción, cómoda, nunca dolor"; y si "Mi equipo" tiene un programa mapeado a EST-IUE, muestra "En tu equipo: programa STRESS"

RF-08
  Dado una sesión con ON 5 s / OFF 10 s y 20 min
  Cuando se inicia
  Entonces el temporizador alterna CONTRAE (5 s) y RELAJA (10 s) 80 veces, vibra/suena en cada cambio de fase, puede pausarse, y al terminar pide mA, esfuerzo y dolor antes de guardar

RF-09
  Dado nivel 2 y sesión PFMT-SERIE
  Cuando se inicia
  Entonces guía 8 contracciones de 5 s con 10 s de descanso y luego 5 rápidas, en 1 serie, y permite registrar cuántas repeticiones logró

RF-10
  Dado perfil DOLOR/HIPERTONÍA
  Cuando abre la biblioteca
  Entonces ve todos los tipos de sesión; EST-IUE aparece marcada "No recomendada para tu perfil" con el motivo

RF-11
  Dado nivel 2 durante ≥ 2 semanas, adherencia 80 %, E ≥ 6 s y F ≥ 5 en las 2 últimas autoevaluaciones, sin dolor en las 3 últimas sesiones
  Cuando se cierra la semana
  Entonces el nivel pasa a 3 y se muestra el motivo
  Dado dolor = sí en 2 sesiones consecutivas
  Entonces el nivel baja uno (mínimo 0), se sugiere consultar al profesional y se registra el motivo

RF-12
  Dado un plan activo y la fecha de hoy
  Cuando abre "Hoy"
  Entonces ve las sesiones del día con estado, y al completar una, su estado cambia a "hecha"

RF-13
  Dado 4 semanas de sesiones registradas
  Cuando abre "Progreso"
  Entonces ve adherencia por semana y las curvas de E, F, mA e ICIQ con sus fechas

RF-14
  Dado ICIQ 11 en semana 0 y 10 en semana 12
  Cuando se compara
  Entonces muestra "Mejora insuficiente: te recomendamos valoración por un profesional de suelo pélvico"

RF-15
  Dado perfil URGENCIA e intervalo basal de 90 min en el diario
  Cuando pasa la semana 1
  Entonces el intervalo objetivo es 105 min y así hasta 180–240 min

RF-16
  Dado la app recién instalada
  Cuando pulsa "Ver ejemplo"
  Entonces se carga el perfil DEMO (Ana, 34, IUE moderada, nivel 2, 4 semanas de datos) con la etiqueta DEMO en todas las pantallas, y "Restablecer" lo elimina por completo

RF-17
  Dado que selecciona "TensCare – Elise"
  Cuando guarda "Mi equipo"
  Entonces los programas STRESS/URGE/MIXED/TONE quedan mapeados a EST-IUE/EST-URG/EST-MIX/EST-TONO y las fichas muestran la equivalencia

RF-18
  Dado datos existentes
  Cuando exporta
  Entonces descarga `pelvia-respaldo-AAAA-MM-DD.json` y, al importarlo en otra instalación, el estado es idéntico; "Informe" abre una vista imprimible sin barra de navegación

RF-19
  Dado PIN configurado
  Cuando abre la app
  Entonces pide el PIN; tras 5 fallos ofrece "Restablecer datos" como única salida

RF-20
  Dado la pantalla "Aprende"
  Cuando abre "Cómo contraer correctamente"
  Entonces ve la ilustración de contracción correcta vs. incorrecta y la lista de errores comunes

RF-21
  Dado cualquier sesión EST-*
  Cuando pulsa "Iniciar"
  Entonces antes del temporizador se muestra la lista de verificación (sin infección, sin dolor, sonda limpia con gel, intensidad desde 0) y requiere "Confirmo" para continuar

## 8. Supuestos
- La usuaria es adulta, no está embarazada y ha sido evaluada o será evaluada por un profesional de salud; la app lo recuerda.
- El equipo permite ajustar manualmente Hz, µs y ON/OFF **o** trae programas preconfigurados por condición; la app cubre ambos casos.
- La usuaria usa su propio celular (Android o iPhone) con Chrome o Safari actualizados.
- Kilder publica en GitHub Pages desde su cuenta personal `kilder16` (repo público sin datos personales).
- El logo KOLH para "Acerca de" lo provee Kilder (`D:\LOGO KOLH.png` en LAPTOP EMPRESA).

## 9. Riesgos y dependencias externas
| Riesgo / dependencia | Impacto | Mitigación / responsable |
|---|---|---|
| Uso con contraindicación no declarada (embarazo, marcapasos, infección) | Alto | Cuestionario obligatorio, re-chequeo cada 90 días, checklist antes de cada sesión EST (RF-02, RF-21) |
| Parámetros no coinciden con el equipo real (rangos no ajustables) | Medio | "Mi equipo" con mapeo a programas preconfigurados; ficha indica el rango aceptable (RF-17) |
| Modelo del electroestimulador desconocido al momento del diseño | Medio | Diseño agnóstico (ADR-0002); mapeo editable; verificar con el manual cuando se conozca — **pendiente externo** |
| Contenido clínico desactualizado | Medio | `protocolos.json` versionado con fuentes; revisión anual; cambios sin tocar código |
| Pérdida de datos (borrar caché del navegador) | Medio | Exportar respaldo JSON; aviso mensual de respaldo (RF-18) |
| Notificaciones no fiables en PWA (especialmente iOS) | Bajo | Sin push; pantalla "Hoy" + recomendación de alarma del celular |
| La app se perciba como dispositivo médico | Medio | Aviso en onboarding, plan, sesiones e informe; sin diagnóstico; derivación explícita en casos severos/dolor |

## 10. Fuentes clínicas (base de `protocolos.json`)
- NICE NG123 (2019) *Urinary incontinence and pelvic organ prolapse in women*: PFMT supervisado ≥ 3 meses, ≥ 8 contracciones × 3 veces/día; electroestimulación/biofeedback como apoyo cuando no se logra contraer; entrenamiento vesical ≥ 6 semanas para urgencia/mixta.
- POGP (2021) *Good practice statement: Safety and best practice in NMES for pelvic floor muscle dysfunction*: ≤ 10 Hz para vejiga hiperactiva; 35–50 Hz para fortalecer; 200–250 µs como rango más cómodo; relación ON:OFF mínima 1:2; rampa 0,5–2 s; sesiones 10–30 min, de diaria a 3×/semana; tabla de contraindicaciones y precauciones.
- Laycock & Jerwood (2001) esquema PERFECT y Escala de Oxford modificada (0–5).
- Dumoulin et al. (2018, Cochrane CD005654): PFMT vs. no tratamiento en incontinencia urinaria.
- Stewart et al. (2016, Cochrane CD010098 — vejiga hiperactiva) y (2017, Cochrane CD012390 — IUE): electroestimulación no implantada.
- Ensayos IVES en vejiga hiperactiva (Pamukkale, NCT04389307 / NCT04734301 / PMC8486445): 10 Hz, ciclo 5 s/10 s, 20 min, 2–5 sesiones/semana, 20 sesiones.
- Frontiers in Neuroscience (2024) iVES en IUE: 35 Hz, 250 µs, 5 s/10 s, 20 min.
- Dmochowski et al. (2019) comparador intravaginal en IUE: 50 Hz, 300 µs; rampa 1 s.
- Norton, Gibbs & Kamm (2006) estimulación anal 35 Hz diaria 8 semanas en incontinencia fecal; Vonthein et al. (2013) revisión sistemática: biofeedback + estimulación.
- Klovning et al. (2009) categorías de severidad ICIQ-UI SF: leve 1–5, moderada 6–12, severa 13–18, muy severa 19–21.
- Terzoni et al. (2023, Neurourol Urodyn) revisión de TENS en dolor pélvico; meta-análisis ICS 2025: ≥ 20 min, 50–400 µs, 2–120 Hz, alta frecuencia más efectiva.
- Bø et al. (2017) IUGA/ICS terminología del manejo conservador; IUJ (2021) prescripción genérica: 8 contracciones, sostén 8 s, 3 veces/día, ≥ 3 meses.
