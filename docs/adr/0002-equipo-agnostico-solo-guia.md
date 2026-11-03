# ADR 0002 — La app guía el uso del electroestimulador; no se conecta a él (diseño agnóstico de equipo)
Estado: Aceptada
Fecha: 2026-11-03

## Contexto
No se conoce todavía la marca/modelo del electroestimulador con biofeedback. Los equipos domésticos habituales (TensCare Elise /
Viva / itouch Sure / Sure Pro, NeuroTrac Simplex / Pelvitone / MyoPlus, iStim V2, Kegel8, EMS/TENS genéricos) no publican un
protocolo Bluetooth abierto; los que tienen software de PC (NeuroTrac MyoPlus) usan protocolos propietarios. Además, la
evidencia clínica describe parámetros (Hz, µs, ON/OFF, duración, frecuencia semanal), no programas de una marca.

## Opciones consideradas
1. **Solo guía (equipo agnóstico)** — la app entrega la ficha de parámetros, sincroniza su temporizador con el ciclo ON/OFF que la
   usuaria configura a mano y registra lo que ella anota (mA, EMG). Pros: funciona con cualquier equipo, sin ingeniería inversa;
   contras: la usuaria debe configurar el equipo manualmente y leer el EMG ella misma.
2. **Integración Bluetooth** — pros: lectura automática del EMG y control del programa; contras: solo posible con un equipo concreto
   que exponga BLE abierto (no identificado), Web Bluetooth no existe en iOS, riesgo alto de no poder completarse.

## Decisión
Opción 1. Se añade la entidad EQUIPO ("Mi equipo"): marca/modelo, tipo de sonda, mA máximo, si permite ajuste manual y un mapeo
`programa del equipo → tipo de sesión` precargado para equipos conocidos y editable. La ficha muestra siempre los parámetros
recomendados **y** la equivalencia con el programa del equipo cuando existe. Pendiente externo: verificar el mapeo con el manual
del equipo real cuando se conozca.

## Consecuencias
+ El contenido clínico se mantiene independiente del fabricante y citable.
+ El mismo diseño sirve para equipos de ajuste manual y de programas fijos.
− Dependencia de que la usuaria configure bien el equipo: se mitiga con la ficha paso a paso y el checklist de inicio (RF-07, RF-21).
− El biofeedback es "asistido": la app guía y registra valores que la usuaria lee en el equipo (RF-09).
