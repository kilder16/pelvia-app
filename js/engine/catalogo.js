// Acceso tipado y de solo lectura al catálogo clínico (content/protocolos.json). ADR-0005.
// El motor no conoce el DOM ni el store: recibe el JSON y devuelve datos planos.

export const ESQUEMA_CATALOGO = 1;

/**
 * Descarga y valida el catálogo. Único fetch permitido en la app (ADR-0003).
 * @param {string} url
 * @param {typeof fetch} [fetcher]
 */
export async function cargarCatalogo(url = 'content/protocolos.json', fetcher = globalThis.fetch) {
  const resp = await fetcher(url);
  if (!resp.ok) throw new Error(`No se pudo cargar el catálogo clínico (${resp.status}).`);
  const json = await resp.json();
  return crearCatalogo(json);
}

/** Validación mínima de compatibilidad (meta.esquema === 1) y secciones obligatorias. */
export function validarCatalogo(json) {
  const errores = [];
  if (!json || typeof json !== 'object') return ['El catálogo no es un objeto JSON.'];
  if (!json.meta || json.meta.esquema !== ESQUEMA_CATALOGO) {
    errores.push(`Esquema de catálogo incompatible: se esperaba ${ESQUEMA_CATALOGO}, llegó ${json.meta?.esquema}.`);
  }
  for (const s of ['seguridad', 'cuestionarioSintomas', 'perfiles', 'reglasClasificacion',
    'autoevaluacionFuerza', 'niveles', 'tiposSesion', 'programas', 'reglasPlanificador', 'reglasProgresion']) {
    if (json[s] == null) errores.push(`Falta la sección "${s}".`);
  }
  return errores;
}

/** Envuelve el JSON del catálogo con accesores. Lanza Error si no es compatible. */
export function crearCatalogo(json) {
  const errores = validarCatalogo(json);
  if (errores.length) throw new Error(errores.join(' '));

  const tipos = new Map(json.tiposSesion.map((t) => [t.id, t]));
  const niveles = new Map(json.niveles.map((n) => [n.id, n]));
  const perfiles = new Map(json.perfiles.map((p) => [p.id, p]));
  const programas = new Map(json.programas.map((p) => [p.id, p]));
  const fuentes = new Map((json.fuentes ?? []).map((f) => [f.id, f]));

  const cat = {
    json,
    meta: json.meta,
    seguridad: json.seguridad,
    cuestionarioSintomas: json.cuestionarioSintomas,
    iciq: json.cuestionarioSintomas.iciq,
    reglasClasificacion: json.reglasClasificacion,
    autoevaluacionFuerza: json.autoevaluacionFuerza,
    reglasPlanificador: json.reglasPlanificador,
    reglasProgresion: json.reglasProgresion,
    entrenamientoVesical: json.entrenamientoVesical,
    educacion: json.educacion ?? [],
    equiposConocidos: json.equiposConocidos ?? [],
    casoEjemplo: json.casoEjemplo,

    tiposSesion: () => json.tiposSesion,
    tipoSesion: (id) => tipos.get(id) ?? null,
    nivel: (id) => niveles.get(Number(id)) ?? null,
    niveles: () => json.niveles,
    perfil: (id) => perfiles.get(id) ?? null,
    perfiles: () => json.perfiles,
    programa: (id) => programas.get(id) ?? null,
    fuente: (id) => fuentes.get(id) ?? null,
    fuentes: () => json.fuentes ?? [],

    /** Programa asociado a un perfil (o el de mantenimiento si perfil === 'MANTENIMIENTO'). */
    programaDePerfil(perfil) {
      const p = perfiles.get(perfil);
      if (p) return programas.get(p.programaId) ?? null;
      return json.programas.find((pr) => pr.perfil === perfil) ?? null;
    },

    /**
     * Parámetros de un tipo de sesión para una semana concreta: base + campos sobrescritos de la fila
     * de `progresionSemanal` cuya ventana [a, b] contiene la semana. Devuelve null si el tipo no tiene parámetros.
     */
    parametrosParaSemana(tipoSesionId, semana) {
      const t = tipos.get(tipoSesionId);
      if (!t || !t.parametros) return null;
      const base = JSON.parse(JSON.stringify(t.parametros));
      const fila = (t.progresionSemanal ?? []).find(
        (f) => Array.isArray(f.semanas) && semana >= f.semanas[0] && semana <= f.semanas[1],
      );
      if (fila) {
        for (const [k, v] of Object.entries(fila)) {
          if (k !== 'semanas') base[k] = v;
        }
      }
      return base;
    },

    /**
     * Nombre del programa preconfigurado de "Mi equipo" equivalente a un tipo de sesión.
     * @returns {string|null}
     */
    equivalenciaEquipo(tipoSesionId, equipo) {
      if (!equipo || !equipo.programas) return null;
      for (const [nombre, tipo] of Object.entries(equipo.programas)) {
        if (tipo === tipoSesionId) return nombre;
      }
      return null;
    },

    /** Busca un equipo conocido por marca (y opcionalmente modelo). */
    equipoConocido(marca, modelo) {
      return (json.equiposConocidos ?? []).find(
        (e) => e.marca === marca && (!modelo || e.modelos.includes(modelo)),
      ) ?? null;
    },

    tiposEquipo: () => json.tiposEquipo ?? [],
    tipoEquipo: (id) => (json.tiposEquipo ?? []).find((t) => t.id === id) ?? null,
    equipoNoIdentificado: json.equipoNoIdentificado ?? '',

    /**
     * Equipo con valores por defecto resueltos desde tiposEquipo (tieneEstimulacion, tieneEMG, aplicaFicha).
     * Lo que la usuaria marcó explícitamente en "Mi equipo" tiene prioridad.
     */
    resolverEquipo(equipo) {
      if (!equipo) return null;
      const t = (json.tiposEquipo ?? []).find((x) => x.id === equipo.tipo) ?? {};
      const pick = (k, porDefecto) => (typeof equipo[k] === 'boolean' ? equipo[k]
        : typeof t[k] === 'boolean' ? t[k] : porDefecto);
      return {
        ...equipo,
        tieneEstimulacion: pick('tieneEstimulacion', true),
        tieneEMG: pick('tieneEMG', false),
        aplicaFicha: pick('aplicaFicha', true),
      };
    },

    /** true si el tipo usa corriente (EST-* o TENS-*). */
    usaCorriente(tipoSesionId) {
      const t = tipos.get(tipoSesionId);
      return !!t && (t.categoria === 'electroestimulacion' || t.categoria === 'tens');
    },
  };
  return Object.freeze(cat);
}
