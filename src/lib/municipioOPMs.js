/**
 * Utilitários para composição automática de grupos de concorrência
 * baseados na hierarquia organizacional da Brigada Militar.
 *
 * Hierarquia: BPM → Companhia → Pelotão → GPM
 *
 * Regra principal: ao selecionar uma OPM, o grupo inclui APENAS
 * as unidades subordinadas a ela (de cima para baixo), nunca superiores.
 */
import { ORG_STRUCTURE } from './orgData';

// ─── Classificação de nível de concorrência por município ──────────────────
// Definido pelas regras do normativo
export const NIVEL_CONCORRENCIA = {
  // Nível COMPANHIA
  'Rio Pardo':           'companhia',
  'Encruzilhada do Sul': 'companhia',
  'Santa Cruz do Sul':   'companhia',
  'Sobradinho':          'companhia',
  'Venâncio Aires':      'companhia',
  'Candelária':          'companhia',
  // Nível PELOTÃO
  'Pantano Grande':      'pelotao',
  'Vera Cruz':           'pelotao',
  'Sinimbu':             'pelotao',
  'Arroio do Tigre':     'pelotao',
  'Vale do Sol':         'pelotao',
  // Nível GPM
  'Ibarama':             'gpm',
  'Lagoa Bonita do Sul': 'gpm',
  'Passa Sete':          'gpm',
  'Lagoão':              'gpm',
  'Tunas':               'gpm',
  'Estrela Velha':       'gpm',
  'Segredo':             'gpm',
  'Mato Leitão':         'gpm',
  'Gramado Xavier':      'gpm',
  'Boqueirão do Leão':   'gpm',
  'Vale Verde':          'gpm',
  'Passo do Sobrado':    'gpm',
  'Herveiras':           'gpm',
};

// ─── Tipos de OPM ───────────────────────────────────────────────────────────
export const TIPO_OPM = { BPM: 'bpm', CIA: 'cia', PEL: 'pel', GPM: 'gpm' };

/**
 * Retorna todas as OPMs disponíveis para seleção na criação de grupos,
 * com metadados completos para busca e exibição.
 * Cada item: { id, tipo, label, municipio, bpm, companhia?, pelotao?, gpm?, nivel_concorrencia? }
 */
export function getOPMsDisponiveis() {
  const opms = [];

  Object.entries(ORG_STRUCTURE).forEach(([bpm, bpmData]) => {
    // BPM
    opms.push({
      id: bpm,
      tipo: TIPO_OPM.BPM,
      label: bpm,
      bpm,
      municipio: Object.values(bpmData.cias)[0]?.municipio || '',
    });

    Object.entries(bpmData.cias).forEach(([cia, ciaData]) => {
      // CIA
      opms.push({
        id: `${bpm}|${cia}`,
        tipo: TIPO_OPM.CIA,
        label: cia,
        bpm,
        companhia: cia,
        municipio: ciaData.municipio || '',
        nivel_concorrencia: NIVEL_CONCORRENCIA[ciaData.municipio] || null,
      });

      Object.entries(ciaData.pelotoes).forEach(([pel, pelData]) => {
        // Pelotão
        opms.push({
          id: `${bpm}|${cia}|${pel}`,
          tipo: TIPO_OPM.PEL,
          label: pel,
          bpm,
          companhia: cia,
          pelotao: pel,
          municipio: pelData.municipio || '',
          nivel_concorrencia: NIVEL_CONCORRENCIA[pelData.municipio] || null,
        });

        pelData.gpms.forEach(gpm => {
          // GPM
          opms.push({
            id: `${bpm}|${cia}|${pel}|${gpm.nome}`,
            tipo: TIPO_OPM.GPM,
            label: gpm.nome,
            bpm,
            companhia: cia,
            pelotao: pel,
            gpm: gpm.nome,
            municipio: gpm.municipio,
            nivel_concorrencia: NIVEL_CONCORRENCIA[gpm.municipio] || null,
          });
        });
      });
    });
  });

  return opms;
}

/**
 * Dado um item OPM selecionado, retorna as unidades que comporão o grupo.
 * Respeita a regra hierárquica: inclui APENAS subordinadas, nunca superiores.
 *
 * Retorna array de unidades no formato:
 * { bpm, companhia, pelotao, gpm?, municipio, nivel }
 */
export function getUnidadesDoGrupo(opm) {
  const unidades = [];

  if (opm.tipo === TIPO_OPM.GPM) {
    // GPM: apenas ele próprio
    unidades.push({
      bpm: opm.bpm,
      companhia: opm.companhia,
      pelotao: opm.pelotao,
      gpm: opm.gpm,
      municipio: opm.municipio,
      nivel: 'gpm',
    });

  } else if (opm.tipo === TIPO_OPM.PEL) {
    // Pelotão: o próprio Pel + todos os GPMs subordinados
    const pelData = ORG_STRUCTURE[opm.bpm]?.cias?.[opm.companhia]?.pelotoes?.[opm.pelotao];
    if (pelData) {
      unidades.push({
        bpm: opm.bpm,
        companhia: opm.companhia,
        pelotao: opm.pelotao,
        gpm: null,
        municipio: pelData.municipio,
        nivel: 'pelotao',
      });
      pelData.gpms.forEach(gpm => {
        unidades.push({
          bpm: opm.bpm,
          companhia: opm.companhia,
          pelotao: opm.pelotao,
          gpm: gpm.nome,
          municipio: gpm.municipio,
          nivel: 'gpm',
        });
      });
    }

  } else if (opm.tipo === TIPO_OPM.CIA) {
    // Companhia: a própria CIA + todos os Pelotões + todos os GPMs
    const ciaData = ORG_STRUCTURE[opm.bpm]?.cias?.[opm.companhia];
    if (ciaData) {
      unidades.push({
        bpm: opm.bpm,
        companhia: opm.companhia,
        pelotao: null,
        gpm: null,
        municipio: ciaData.municipio,
        nivel: 'companhia',
      });
      Object.entries(ciaData.pelotoes).forEach(([pel, pelData]) => {
        unidades.push({
          bpm: opm.bpm,
          companhia: opm.companhia,
          pelotao: pel,
          gpm: null,
          municipio: pelData.municipio,
          nivel: 'pelotao',
        });
        pelData.gpms.forEach(gpm => {
          unidades.push({
            bpm: opm.bpm,
            companhia: opm.companhia,
            pelotao: pel,
            gpm: gpm.nome,
            municipio: gpm.municipio,
            nivel: 'gpm',
          });
        });
      });
    }

  } else if (opm.tipo === TIPO_OPM.BPM) {
    // BPM: o próprio BPM + todas as CIAs + todos os Pelotões + todos os GPMs
    const bpmData = ORG_STRUCTURE[opm.bpm];
    if (bpmData) {
      unidades.push({
        bpm: opm.bpm,
        companhia: null,
        pelotao: null,
        gpm: null,
        municipio: opm.municipio,
        nivel: 'bpm',
      });
      Object.entries(bpmData.cias).forEach(([cia, ciaData]) => {
        unidades.push({
          bpm: opm.bpm,
          companhia: cia,
          pelotao: null,
          gpm: null,
          municipio: ciaData.municipio,
          nivel: 'companhia',
        });
        Object.entries(ciaData.pelotoes).forEach(([pel, pelData]) => {
          unidades.push({
            bpm: opm.bpm,
            companhia: cia,
            pelotao: pel,
            gpm: null,
            municipio: pelData.municipio,
            nivel: 'pelotao',
          });
          pelData.gpms.forEach(gpm => {
            unidades.push({
              bpm: opm.bpm,
              companhia: cia,
              pelotao: pel,
              gpm: gpm.nome,
              municipio: gpm.municipio,
              nivel: 'gpm',
            });
          });
        });
      });
    }
  }

  return unidades;
}

/**
 * Gera o nome sugerido para um grupo com base na OPM selecionada.
 * Exibe a cadeia hierárquica completa para identificação visual.
 */
export function sugerirNomeGrupo(opm) {
  if (!opm) return '';

  if (opm.tipo === TIPO_OPM.GPM) {
    // Ex: 6º GPM / 1º Pel / 2ª Cia / 23º BPM - Passa Sete
    return `${opm.gpm} / ${opm.pelotao} / ${opm.companhia} / ${opm.bpm} - ${opm.municipio}`;
  }
  if (opm.tipo === TIPO_OPM.PEL) {
    // Ex: 4º Pel / 1ª Cia / 2º BPM - Pantano Grande
    return `${opm.pelotao} / ${opm.companhia} / ${opm.bpm} - ${opm.municipio}`;
  }
  if (opm.tipo === TIPO_OPM.CIA) {
    // Ex: 1ª Cia / 23º BPM - Santa Cruz do Sul
    return `${opm.companhia} / ${opm.bpm} - ${opm.municipio}`;
  }
  if (opm.tipo === TIPO_OPM.BPM) {
    // Ex: 23º BPM - Santa Cruz do Sul
    return `${opm.bpm} - ${opm.municipio}`;
  }
  return opm.label;
}

/**
 * Retorna o resumo de quantidades por nível de uma lista de unidades.
 */
export function calcResumoUnidades(unidades) {
  const gpms  = unidades.filter(u => u.nivel === 'gpm').length;
  const pels  = unidades.filter(u => u.nivel === 'pelotao').length;
  const cias  = unidades.filter(u => u.nivel === 'companhia').length;
  const bpms  = unidades.filter(u => u.nivel === 'bpm').length;
  const total = unidades.length;
  return { gpms, pels, cias, bpms, total };
}

/**
 * Retorna todos os municípios disponíveis no ORG_STRUCTURE.
 * @deprecated Use getOPMsDisponiveis() para seleção por OPM
 */
export function getMunicipiosDisponiveis() {
  const set = new Set();
  Object.values(ORG_STRUCTURE).forEach(bpmData => {
    Object.values(bpmData.cias).forEach(ciaData => {
      Object.values(ciaData.pelotoes).forEach(pelData => {
        pelData.gpms.forEach(gpm => set.add(gpm.municipio));
      });
    });
  });
  return [...set].sort();
}

/**
 * @deprecated Use getUnidadesDoGrupo(opm) com tipo CIA/PEL/GPM
 */
export function getUnidadesPorMunicipio(municipio) {
  const unidades = [];
  Object.entries(ORG_STRUCTURE).forEach(([bpm, bpmData]) => {
    Object.entries(bpmData.cias).forEach(([cia, ciaData]) => {
      Object.entries(ciaData.pelotoes).forEach(([pel, pelData]) => {
        pelData.gpms.forEach(gpm => {
          if (gpm.municipio === municipio) {
            unidades.push({
              bpm, companhia: cia, pelotao: pel,
              gpm: gpm.nome, municipio: gpm.municipio, nivel: 'gpm',
            });
          }
        });
      });
    });
  });
  return unidades;
}

/**
 * @deprecated Use sugerirNomeGrupo(opm)
 */
export function sugerirNomeConcorrente(municipio, unidades) {
  if (!unidades || unidades.length === 0) return municipio;
  const cias = [...new Set(unidades.map(u => u.companhia))];
  if (cias.length === 1) return `${cias[0]} — ${municipio}`;
  return municipio;
}
