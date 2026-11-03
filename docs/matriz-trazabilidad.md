# Matriz de trazabilidad — PELVIA
Estado al cierre de la Fase 2 (2026-11-03). Las columnas Código y Test se llenan en fases 3–4 (Claude Code) con el nombre real del
archivo y del test; el revisor marca ✅ solo cuando el test está verde.

| Req | Diseño (`docs/diseno.md`) | Catálogo (`protocolos.json`) | Código previsto | Test previsto (`tests/`) | Doc (manual usuario §) | Estado |
|---|---|---|---|---|---|---|
| RF-01 | §7 Onboarding | meta.aviso | js/app.js (onboarding), store/repo.js | ui.onboarding.test.js → `rf01_sinConsentimientoBloquea` | 1. Primer uso | Planificado |
| RF-02 | §4.1, §6.1 | seguridad.* | engine/seguridad.js, ui/componentes/checklist-seguridad.js | seguridad.test.js → `rf02a_embarazoBloqueaEST`, `rf02b_hematuriaBanderaRoja`, `rf02c_vigencia90dias` | 2. Evaluación de seguridad | Planificado |
| RF-03 | §4.1 | cuestionarioSintomas.*, iciq.* | ui/vistas/evaluacion.js, engine/clasificador.js (puntajeIciq) | clasificador.test.js → `rf03_iciq_3_2_6_da11_moderada` | 3. Cuestionario de síntomas | Planificado |
| RF-04 | §6.2 | reglasClasificacion.*, perfiles | engine/clasificador.js | clasificador.test.js → `rf04_iue`, `rf04_mixtaPredominioUrgencia`, `rf04_dolorDomina`, `rf04_prolapsoDeriva`, `rf04_prevencion` | 3. Resultado | Planificado |
| RF-05 | §6.3 | autoevaluacionFuerza.* | engine/nivel.js, ui (temporizador de prueba) | nivel.test.js → `rf05_p2e4r6f4_nivel2`, `rf05_p1_nivel0`, `rf05_maximoInicial4` | 4. Autoevaluación de fuerza | Planificado |
| RF-06 | §6.4 | programas.*, reglasPlanificador.* | engine/planificador.js | planificador.test.js → `rf06_iueNivel2_semanaTipo`, `rf06_sinEST_reemplazos`, `rf06_reevaluacionesInsertadas`, `rf06_filtroNivelMin` | 5. Tu plan | Planificado |
| RF-07 | §4.2 | tiposSesion[EST-*].parametros, progresionSemanal, equiposConocidos | ui/componentes/ficha-parametros.js, engine/catalogo.js | catalogo.test.js → `rf07_estIue_sem1_35hz15min`, `rf07_estIue_sem5_50hz`, `rf07_equivalenciaProgramaEquipo` | 6. Ficha de parámetros | Planificado |
| RF-08 | §4.2, §10 | tiposSesion[EST-*] | engine/sesion.js, ui/componentes/temporizador.js, util/audio.js, util/vibrar.js, util/wakelock.js | sesion.test.js → `rf08_lineaTiempo_5_10_20min_80ciclos`, `rf08_bloquesMix_10y10`; e2e manual: pausa/reanudar, drift | 7. Sesión guiada con el equipo | Planificado |
| RF-09 | §4.2 | niveles[].pfmt, tiposSesion[BIO-*, PFMT-*] | engine/sesion.js (modo ejercicio), ui/vistas/sesion.js | sesion.test.js → `rf09_pfmtNivel2_8x5s10s_5rapidas`, `rf09_bioRelaj_bloques` | 8. Ejercicios y biofeedback | Planificado |
| RF-10 | §7 | tiposSesion[].perfilesNoRecomendados | ui/vistas/biblioteca.js | biblioteca.test.js → `rf10_marcaNoRecomendadaDolor` | 9. Biblioteca | Planificado |
| RF-11 | §4.3, §6.5 | reglasProgresion.* | engine/progresion.js | progresion.test.js → `rf11_subeNivel`, `rf11_bajaPorDolor2`, `rf11_bajaPorReps50`, `rf11_mantieneMenos2Semanas`, `rf11_noPasaDe5` | 10. Cómo subes de nivel | Planificado |
| RF-12 | §7 | programas[].semanaTipo | ui/vistas/hoy.js, util/fechas.js | fechas.test.js → `rf12_semanaIso_diaPlan`; e2e manual | 11. Pantalla Hoy | Planificado |
| RF-13 | §4.4 | — | engine/reporte.js, ui/componentes/grafica-svg.js | reporte.test.js → `rf13_adherenciaSemanal`, `rf13_seriesEF` | 12. Progreso | Planificado |
| RF-14 | §4.3 | programas[].reevaluaciones, iciq.mejoraMinimaPuntos | engine/progresion.js (reevaluacionPendiente), engine/reporte.js (comparar) | progresion.test.js → `rf14_pendienteSemana4`, `rf14_mejoraInsuficiente_11a10` | 13. Re-evaluaciones | Planificado |
| RF-15 | §6.6 | entrenamientoVesical.*, tiposSesion[VES-*] | engine/vesical.js, ui (diario) | vesical.test.js → `rf15_intervaloObjetivo_90a105`, `rf15_tope240` | 14. Entrenamiento vesical | Planificado |
| RF-16 | §5 | casoEjemplo.* | store/repo.js (cargarDemo, restablecer) | repo.test.js → `rf16_cargaDemoConEtiqueta`, `rf16_restablecerBorraTodo` | 15. Ver ejemplo | Planificado |
| RF-17 | §5 | equiposConocidos.* | ui/vistas/equipo.js, store | equipo.test.js → `rf17_tenscareElise_mapeo` | 16. Mi equipo | Planificado |
| RF-18 | §4.4 | — | store/respaldo.js, ui/vistas/informe.js | respaldo.test.js → `rf18_exportImportIdentico`, `rf18_rechazaSinMeta` | 17. Respaldo e informe | Planificado |
| RF-19 | §5 | — | ui/componentes/pin.js | pin.test.js → `rf19_hashYVerifica`, `rf19_5fallosOfreceRestablecer` | 18. PIN | Planificado |
| RF-20 | §9 | educacion.* | ui/vistas/aprende.js, assets/il/IL-01..IL-11 | revisión visual (checklist del revisor) | 19. Aprende | Planificado |
| RF-21 | §4.2 | seguridad.checklistSesionEST, reglasIntensidad | ui/componentes/checklist-seguridad.js | e2e manual: no inicia sin "Confirmo" | 7. Sesión guiada | Planificado |
| RNF-01 | ADR-0001 | — | manifest.webmanifest, sw.js | Lighthouse PWA instalable; prueba offline manual | README | Planificado |
| RNF-02 | ADR-0001 | — | sin package.json; sin `<script src="http...">` | revisor: `grep -r "cdn\|unpkg\|jsdelivr" → 0` | README | Planificado |
| RNF-03 | ADR-0003 | — | store/repo.js | revisor: `grep -r "fetch(" js/` solo content/protocolos.json | Manual técnico | Planificado |
| RNF-04 | §8 | textos del catálogo en es-PE | toda la UI y `content/protocolos.json` | revisor: lectura de todas las pantallas; sin jerga técnica en vistas de usuaria | Manual usuario | Planificado |
| RNF-05 | §7, §8 | — | css/app.css, componentes | revisor: Lighthouse Accesibilidad ≥ 90; botones ≥ 44 px; `aria-label` en cada SVG | Manual usuario | Planificado |
| RNF-06 | §10 | — | componentes/temporizador.js | prueba manual 20 min con cronómetro externo (< 2 s desfase total) | Manual técnico | Planificado |
| RNF-07 | ADR-0005 | meta.version | engine/catalogo.js | catalogo.test.js → `rnf07_jsonValido_referenciasYRangos` | Manual técnico | Planificado |
| RNF-08 | §6.1 | seguridad.vigenciaDias | engine/seguridad.js + ui | seguridad.test.js → `rnf08_noIniciaESTconContraindicacion` | 7. Sesión guiada | Planificado |
| RNF-09 | ADR-0004 | — | tests/ con `node --test` | cobertura `node --test --experimental-test-coverage` ≥ 80 % en engine/ | README | Planificado |
| RNF-10 | ADR-0001 | — | GitHub Pages | runbook.md + despliegues.md | Runbook | Planificado |
| RNF-11 | ADR-0006 | ilustraciones referenciadas IL-01..IL-14 | assets/il/*.svg | revisor: cada IL referenciada existe y tiene aria-label | Manual usuario | Planificado |
