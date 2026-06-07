import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback } from 'react';
import { getCurrentPeriodo } from '@/lib/utils';
import { CONSOLIDACAO_MUNICIPAL, ORG_STRUCTURE } from '@/lib/orgData';

/**
 * Retorna o município da OPM principal (mais alta) da cadeia hierárquica.
 *
 * Para nível CIA  → município sede da CIA (ex: 1ª Cia → Santa Cruz do Sul)
 * Para nível PEL  → município sede do Pelotão (ex: 6º Pel → Sinimbu)
 * Para nível GPM  → município sede do Pelotão pai do GPM (não do GPM individual)
 *
 * Isso garante que subunidades com municípios diferentes não contaminem o display.
 */
function getMunicipioPrincipal(bpm, companhia, pelotao, _municipioRegistro) {
  if (bpm && companhia) {
    const ciaData = ORG_STRUCTURE?.[bpm]?.cias?.[companhia];
    if (ciaData) {
      if (pelotao) {
        // Pelotão ou GPM: usa o município do pelotão pai
        const pelMunicipio = ciaData.pelotoes?.[pelotao]?.municipio;
        if (pelMunicipio) return pelMunicipio;
      }
      // Cia sem pelotão especificado: usa município da Cia
      if (ciaData.municipio) return ciaData.municipio;
    }
  }
  // Fallback: município do registro (não deve acontecer com dados corretos)
  return _municipioRegistro || '';
}

export function useOrganizations() {
  return useQuery({
    queryKey: ['organizations'],
    queryFn: () => base44.entities.Organization.filter({ status: 'ativo' }),
    initialData: [],
  });
}

export function useIndicators() {
  return useQuery({
    queryKey: ['indicators'],
    queryFn: () => base44.entities.Indicator.filter({ status: 'ativo' }),
    initialData: [],
  });
}

export function useProductions(periodo) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsub = base44.entities.Production.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['productions'], exact: false });
    });
    return () => unsub();
  }, [queryClient]);

  return useQuery({
    queryKey: ['productions', periodo],
    queryFn: () => base44.entities.Production.filter({ periodo }, '-created_date', 99999),
    initialData: [],
    staleTime: 0,
  });
}

export function useAllProductions() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Atualização em tempo real para todos os usuários
    const unsubProduction = base44.entities.Production.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['all-productions'] });
      queryClient.invalidateQueries({ queryKey: ['productions'] });
      queryClient.invalidateQueries({ queryKey: ['hist-lancamento'] });
    });
    const unsubIndicator = base44.entities.Indicator.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['indicators'] });
    });
    const unsubOrg = base44.entities.Organization.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    });
    return () => {
      unsubProduction();
      unsubIndicator();
      unsubOrg();
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['all-productions'],
    queryFn: async () => {
      // Carrega todos os registros sem limite
      const records = await base44.entities.Production.list('-data', 99999);
      // Garante ordenação decrescente por data (mais recente primeiro)
      return (records || []).sort((a, b) => {
        const da = a.data || '';
        const db = b.data || '';
        if (db !== da) return db.localeCompare(da);
        // Desempate por created_date descendente
        return new Date(b.created_date || 0) - new Date(a.created_date || 0);
      });
    },
    initialData: [],
    staleTime: 0,            // sempre revalida ao receber invalidação em tempo real
    gcTime: 1000 * 60 * 30, // mantém em cache por 30 min
  });
}

/**
 * computeRankings — SEPARAÇÃO ESTRITA por nível.
 * level='gpm'       → somente registros que têm p.gpm preenchido
 * level='pelotao'   → somente registros que têm p.pelotao (e NÃO p.gpm, para não duplicar)
 * level='companhia' → somente registros que têm p.companhia (e NÃO p.pelotao nem p.gpm)
 * level='bpm'       → agrupa tudo por BPM (ignora subnível)
 */
export function computeRankings(productions, organizations, level = 'gpm') {
  const scoreMap = {};

  productions.forEach(p => {
    let key, name, municipio;

    if (level === 'gpm') {
      if (!p.gpm) return; // ESTRITO: só registros com GPM
      key = `${p.bpm}|${p.companhia}|${p.pelotao}|${p.gpm}`;
      // Cadeia hierárquica completa: GPM / PEL / CIA / BPM
      const partsGpm = [p.gpm, p.pelotao, p.companhia, p.bpm].filter(Boolean);
      name = partsGpm.join(' / ');
      // Usa o município do próprio registro (município do GPM), não do Pelotão pai
      municipio = p.municipio || getMunicipioPrincipal(p.bpm, p.companhia, p.pelotao, p.municipio);
    } else if (level === 'pelotao') {
      if (!p.pelotao) return; // ESTRITO: só registros com Pelotão
      key = `${p.bpm}|${p.companhia}|${p.pelotao}`;
      // Cadeia: PEL / CIA / BPM
      const partsPel = [p.pelotao, p.companhia, p.bpm].filter(Boolean);
      name = partsPel.join(' / ');
      municipio = getMunicipioPrincipal(p.bpm, p.companhia, p.pelotao, p.municipio);
    } else if (level === 'companhia') {
      if (!p.companhia) return; // ESTRITO: só registros com Cia
      key = `${p.bpm}|${p.companhia}`;
      // Cadeia: CIA / BPM
      name = [p.companhia, p.bpm].filter(Boolean).join(' / ');
      municipio = getMunicipioPrincipal(p.bpm, p.companhia, null, p.municipio);
    } else if (level === 'bpm') {
      if (!p.bpm) return;
      key = p.bpm;
      name = p.bpm;
      municipio = '';
    } else {
      return;
    }

    if (!scoreMap[key]) {
      // Município fixado na primeira ocorrência = OPM principal do grupo
      scoreMap[key] = { name, municipio, score: 0, preventiva: 0, repressiva: 0, apreensao: 0, atendimento: 0, economia: 0 };
    }
    // NÃO sobrescreve municipio em iterações subsequentes — evita contaminação
    scoreMap[key].score += (p.pontuacao || 0);
    if (p.categoria === 'Preventiva')  scoreMap[key].preventiva  += (p.pontuacao || 0);
    if (p.categoria === 'Repressiva')  scoreMap[key].repressiva  += (p.pontuacao || 0);
    if (p.categoria === 'Apreensão')   scoreMap[key].apreensao   += (p.pontuacao || 0);
    if (p.categoria === 'Atendimento') scoreMap[key].atendimento += (p.pontuacao || 0);
    if (p.categoria === 'Economia')    scoreMap[key].economia    += (p.pontuacao || 0);
  });

  return Object.values(scoreMap).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.repressiva !== a.repressiva) return b.repressiva - a.repressiva;
    return b.apreensao - a.apreensao;
  });
}

/**
 * Ranking consolidado por município seguindo as regras I–V do normativo:
 * A produção de cada registro é atribuída à OPM de maior nível territorial do município.
 * – Se o município tem Cia: acumula na Cia (ignora Pel/GPM para fins de ranking).
 * – Se o município tem apenas Pel: acumula no Pel.
 * – Se só GPM: acumula no próprio GPM.
 */
export function computeMunicipalRanking(productions) {
  const scoreMap = {};

  productions.forEach(p => {
    const municipio = p.municipio;
    if (!municipio) return;

    const regra = CONSOLIDACAO_MUNICIPAL[municipio];

    let key, name, opmLabel;

    if (regra === undefined || regra === null) {
      // Município com apenas GPM — contabiliza no nível mais específico disponível
      if (p.gpm) {
        key = `${p.bpm}|${p.companhia}|${p.pelotao}|${p.gpm}|${municipio}`;
        opmLabel = [p.gpm, p.pelotao, p.companhia, p.bpm].filter(Boolean).join(' / ');
        name = municipio;
      } else if (p.pelotao) {
        key = `${p.bpm}|${p.companhia}|${p.pelotao}|${municipio}`;
        opmLabel = [p.pelotao, p.companhia, p.bpm].filter(Boolean).join(' / ');
        name = municipio;
      } else if (p.companhia) {
        key = `${p.bpm}|${p.companhia}|${municipio}`;
        opmLabel = [p.companhia, p.bpm].filter(Boolean).join(' / ');
        name = municipio;
      } else return;
    } else if (regra.pelotao && !regra.companhia) {
      // Maior OPM é Pelotão
      key = `${regra.bpm}|${regra.pelotao}|${municipio}`;
      opmLabel = [regra.pelotao, regra.bpm].filter(Boolean).join(' / ');
      name = municipio;
    } else if (regra.pelotao && regra.companhia) {
      // Cia existe mas Pel é a sede territorial
      key = `${regra.bpm}|${regra.companhia}|${regra.pelotao}|${municipio}`;
      opmLabel = [regra.pelotao, regra.companhia, regra.bpm].filter(Boolean).join(' / ');
      name = municipio;
    } else {
      // Maior OPM é Companhia
      key = `${regra.bpm}|${regra.companhia}|${municipio}`;
      opmLabel = [regra.companhia, regra.bpm].filter(Boolean).join(' / ');
      name = municipio;
    }

    if (!scoreMap[key]) {
      scoreMap[key] = { name, municipio, opmLabel, score: 0, preventiva: 0, repressiva: 0, apreensao: 0, atendimento: 0, economia: 0 };
    }
    scoreMap[key].score += (p.pontuacao || 0);
    if (p.categoria === 'Preventiva')  scoreMap[key].preventiva  += (p.pontuacao || 0);
    if (p.categoria === 'Repressiva')  scoreMap[key].repressiva  += (p.pontuacao || 0);
    if (p.categoria === 'Apreensão')   scoreMap[key].apreensao   += (p.pontuacao || 0);
    if (p.categoria === 'Atendimento') scoreMap[key].atendimento += (p.pontuacao || 0);
    if (p.categoria === 'Economia')    scoreMap[key].economia    += (p.pontuacao || 0);
  });

  return Object.values(scoreMap).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.repressiva !== a.repressiva) return b.repressiva - a.repressiva;
    return b.apreensao - a.apreensao;
  });
}

/**
 * Ranking personalizado baseado em composições definidas pelo admin.
 *
 * REGRA: Cada grupo é INDEPENDENTE — conta apenas os GPMs explicitamente
 * listados em unidades_vinculadas (nível 'gpm'). Não há herança hierárquica.
 * Uma mesma OPM pode pontuar em múltiplos grupos simultaneamente.
 *
 * Suporta filtro por tipo_nivel ('companhia', 'pelotao', 'gpm') ou null para todos.
 */
export function computeComposicaoRanking(productions, composicoes, tipoNivelFiltro = null) {
  const compsAtivas = tipoNivelFiltro
    ? composicoes.filter(c => c.tipo_nivel === tipoNivelFiltro && c.status !== 'inativo')
    : composicoes.filter(c => c.status !== 'inativo');

  /**
   * Pré-processa: para cada composição, monta Sets de chaves por nível hierárquico.
   * Isso permite contabilizar lançamentos feitos em qualquer nível (CIA, Pelotão, GPM).
   * Chaves:
   *  - gpm:    "bpm|cia|pel|gpm"
   *  - pelotao: "bpm|cia|pel"
   *  - cia:    "bpm|cia"
   */
  const compKeysSets = new Map(); // comp.id → { gpms: Set, pels: Set, cias: Set }
  compsAtivas.forEach(comp => {
    const gpms = new Set();
    const pels = new Set();
    const cias = new Set();
    (comp.unidades_vinculadas || []).forEach(u => {
      if (u.nivel === 'gpm' && u.gpm) {
        gpms.add(`${u.bpm}|${u.companhia || ''}|${u.pelotao || ''}|${u.gpm}`);
      } else if (u.nivel === 'pelotao' && u.pelotao) {
        pels.add(`${u.bpm}|${u.companhia || ''}|${u.pelotao}`);
      } else if (u.nivel === 'companhia' && u.companhia) {
        cias.add(`${u.bpm}|${u.companhia}`);
      }
    });
    compKeysSets.set(comp.id, { gpms, pels, cias });
  });

  const scoreMap = {};
  compsAtivas.forEach(comp => {
    const municipios = (comp.municipios_participantes || [])
      .filter(m => !m.excluida && m.ativa !== false)
      .map(m => m.municipio).join(', ');
    scoreMap[comp.id] = {
      id: comp.id,
      name: comp.nome,
      tipo_nivel: comp.tipo_nivel,
      observacao: comp.observacao || '',
      municipios,
      score: 0,
      preventiva: 0,
      repressiva: 0,
      apreensao: 0,
      atendimento: 0,
      economia: 0,
    };
  });

  // Pré-processa sets de municípios vinculados por composição (normalizado)
  const compMunicipioSets = new Map();
  // Flag: grupo usa SOMENTE municípios vinculados (sem chaves hierárquicas)
  const compSoMunicipio = new Map();
  compsAtivas.forEach(comp => {
    const mvs = comp.municipios_vinculados;
    const municipioSet = mvs && mvs.length > 0 ? new Set(mvs.map(m => normalizeMunicipio(m))) : null;
    compMunicipioSets.set(comp.id, municipioSet);

    // Verifica se todas unidades_vinculadas não têm chaves hierárquicas preenchidas
    const uvs = comp.unidades_vinculadas || [];
    const temChaves = uvs.some(u =>
      (u.nivel === 'gpm' && u.gpm) ||
      (u.nivel === 'pelotao' && u.pelotao) ||
      (u.nivel === 'companhia' && u.companhia)
    );
    compSoMunicipio.set(comp.id, !temChaves && !!municipioSet);
  });

  productions.forEach(p => {
    // Contabiliza no nível mais específico preenchido (GPM > Pelotão > CIA)
    const gpmKey = p.gpm
      ? `${p.bpm}|${p.companhia || ''}|${p.pelotao || ''}|${p.gpm}`
      : null;
    const pelKey = p.pelotao
      ? `${p.bpm}|${p.companhia || ''}|${p.pelotao}`
      : null;
    const ciaKey = p.companhia
      ? `${p.bpm}|${p.companhia}`
      : null;

    const municipioNormP = normalizeMunicipio(p.municipio);

    // Cada grupo é independente — sem usedProductionIds
    compsAtivas.forEach(comp => {
      const sets = compKeysSets.get(comp.id);
      if (!sets) return;

      const municipioSet = compMunicipioSets.get(comp.id);
      const soMunicipio = compSoMunicipio.get(comp.id);

      // Modo "somente município": grupo foi criado sem chaves hierárquicas
      // — contabiliza toda produção cujo município pertença ao grupo
      if (soMunicipio) {
        if (!municipioSet || !municipioNormP || !municipioSet.has(municipioNormP)) return;
        // pertence por município — cai no acúmulo abaixo
      } else {
        // Modo normal: filtra por município E por chave hierárquica
        if (municipioSet && p.municipio && !municipioSet.has(municipioNormP)) return;

        // Verifica se a produção pertence a este grupo em qualquer nível
        const pertence =
          (gpmKey && sets.gpms.has(gpmKey)) ||
          (pelKey && sets.pels.has(pelKey)) ||
          (ciaKey && sets.cias.has(ciaKey));

        if (!pertence) return;
      }

      const entry = scoreMap[comp.id];
      if (!entry) return;
      entry.score += (p.pontuacao || 0);
      if (p.categoria === 'Preventiva')  entry.preventiva  += (p.pontuacao || 0);
      if (p.categoria === 'Repressiva')  entry.repressiva  += (p.pontuacao || 0);
      if (p.categoria === 'Apreensão')   entry.apreensao   += (p.pontuacao || 0);
      if (p.categoria === 'Atendimento') entry.atendimento += (p.pontuacao || 0);
      if (p.categoria === 'Economia')    entry.economia    += (p.pontuacao || 0);
    });
  });

  return Object.values(scoreMap).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.repressiva !== a.repressiva) return b.repressiva - a.repressiva;
    return b.apreensao - a.apreensao;
  });
}

export function computeCategoryBreakdown(productions) {
  const catMap = {};
  productions.forEach(p => {
    const cat = p.categoria || 'Outros';
    catMap[cat] = (catMap[cat] || 0) + (p.pontuacao || 0);
  });
  return Object.entries(catMap).map(([name, value]) => ({ name, value }));
}

/**
 * Normaliza string de município para comparação (lowercase + trim).
 */
export function normalizeMunicipio(m) {
  if (!m) return '';
  return m.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * computeConsolidadoGrupos — consolidação por município dentro de cada grupo.
 *
 * Modo "Somente Grupos":
 * Para cada grupo concorrente:
 *   1. Agrupa lançamentos por município.
 *   2. Para cada município, identifica a OPM de maior graduação (CIA > PEL > GPM).
 *   3. Consolida PONTOS (soma de pontuacao) e INDICADORES (soma de quantidade por indicator_id) separadamente.
 *   4. Vincula o resultado à OPM de maior graduação como representante.
 *
 * Retorna array de objetos com: id, name, municipio, opmLabel, tipo_nivel,
 *   score (pontos), preventiva, repressiva, apreensao, atendimento, economia (pontos por categoria),
 *   indicadores: { [indicator_id]: { nome, quantidade, categoria } }
 */
export function computeConsolidadoGrupos(productions, composicoes, tipoNivelFiltro = null) {
  const compsAtivas = tipoNivelFiltro
    ? composicoes.filter(c => c.tipo_nivel === tipoNivelFiltro && c.status !== 'inativo')
    : composicoes.filter(c => c.status !== 'inativo');

  // Pré-processa sets de chaves por nível hierárquico para cada composição
  const compKeysSets = new Map();
  compsAtivas.forEach(comp => {
    const gpms = new Set();
    const pels = new Set();
    const cias = new Set();
    (comp.unidades_vinculadas || []).forEach(u => {
      if (u.nivel === 'gpm' && u.gpm) {
        gpms.add(`${u.bpm}|${u.companhia || ''}|${u.pelotao || ''}|${u.gpm}`);
      } else if (u.nivel === 'pelotao' && u.pelotao) {
        pels.add(`${u.bpm}|${u.companhia || ''}|${u.pelotao}`);
      } else if (u.nivel === 'companhia' && u.companhia) {
        cias.add(`${u.bpm}|${u.companhia}`);
      }
    });
    compKeysSets.set(comp.id, { gpms, pels, cias });
  });

  // Pré-processa sets de municípios vinculados por composição
  const compMunicipioSets = new Map();
  // Flag: grupo usa SOMENTE municípios vinculados (sem chaves hierárquicas)
  const compSoMunicipioC = new Map();
  compsAtivas.forEach(comp => {
    const mvs = comp.municipios_vinculados;
    const municipioSet = mvs && mvs.length > 0 ? new Set(mvs.map(normalizeMunicipio)) : null;
    compMunicipioSets.set(comp.id, municipioSet);
    const uvs = comp.unidades_vinculadas || [];
    const temChaves = uvs.some(u =>
      (u.nivel === 'gpm' && u.gpm) ||
      (u.nivel === 'pelotao' && u.pelotao) ||
      (u.nivel === 'companhia' && u.companhia)
    );
    compSoMunicipioC.set(comp.id, !temChaves && !!municipioSet);
  });

  // Nível hierárquico numérico: quanto menor, mais alto na hierarquia
  const nivelOrdem = { 'companhia': 1, 'pelotao': 2, 'gpm': 3 };

  const scoreMap = {};
  compsAtivas.forEach(comp => {
    scoreMap[comp.id] = {
      _comp: comp,
      _municipios: {}, // keyed by municipioNorm
    };
  });

  productions.forEach(p => {
    const gpmKey = p.gpm ? `${p.bpm}|${p.companhia || ''}|${p.pelotao || ''}|${p.gpm}` : null;
    const pelKey = p.pelotao ? `${p.bpm}|${p.companhia || ''}|${p.pelotao}` : null;
    const ciaKey = p.companhia ? `${p.bpm}|${p.companhia}` : null;

    // Determina o nível da OPM deste lançamento
    let opmNivel, opmLabel;
    if (p.gpm) {
      opmNivel = 'gpm';
      opmLabel = [p.gpm, p.pelotao, p.companhia, p.bpm].filter(Boolean).join(' / ');
    } else if (p.pelotao) {
      opmNivel = 'pelotao';
      opmLabel = [p.pelotao, p.companhia, p.bpm].filter(Boolean).join(' / ');
    } else if (p.companhia) {
      opmNivel = 'companhia';
      opmLabel = [p.companhia, p.bpm].filter(Boolean).join(' / ');
    } else {
      return;
    }

    const municipioNorm = normalizeMunicipio(p.municipio);
    if (!municipioNorm) return;

    compsAtivas.forEach(comp => {
      const sets = compKeysSets.get(comp.id);
      if (!sets) return;

      const municipioSet = compMunicipioSets.get(comp.id);
      const soMunicipio = compSoMunicipioC.get(comp.id);

      if (soMunicipio) {
        // Modo somente-município: aceita qualquer produção do município vinculado
        if (!municipioSet || !municipioNorm || !municipioSet.has(municipioNorm)) return;
      } else {
        if (municipioSet && !municipioSet.has(municipioNorm)) return;
        const pertence =
          (gpmKey && sets.gpms.has(gpmKey)) ||
          (pelKey && sets.pels.has(pelKey)) ||
          (ciaKey && sets.cias.has(ciaKey));
        if (!pertence) return;
      }

      const compEntry = scoreMap[comp.id];
      if (!compEntry._municipios[municipioNorm]) {
        compEntry._municipios[municipioNorm] = {
          municipio: p.municipio,
          opmNivel,
          opmLabel,
          score: 0,
          preventiva: 0,
          repressiva: 0,
          apreensao: 0,
          atendimento: 0,
          economia: 0,
          indicadores: {},
        };
      }

      const mEntry = compEntry._municipios[municipioNorm];

      // Atualiza OPM de maior graduação (menor número = maior)
      if ((nivelOrdem[opmNivel] || 99) < (nivelOrdem[mEntry.opmNivel] || 99)) {
        mEntry.opmNivel = opmNivel;
        mEntry.opmLabel = opmLabel;
      }

      // Acumula PONTOS (separados por categoria)
      mEntry.score += (p.pontuacao || 0);
      if (p.categoria === 'Preventiva')  mEntry.preventiva  += (p.pontuacao || 0);
      if (p.categoria === 'Repressiva')  mEntry.repressiva  += (p.pontuacao || 0);
      if (p.categoria === 'Apreensão')   mEntry.apreensao   += (p.pontuacao || 0);
      if (p.categoria === 'Atendimento') mEntry.atendimento += (p.pontuacao || 0);
      if (p.categoria === 'Economia')    mEntry.economia    += (p.pontuacao || 0);

      // Acumula INDICADORES (quantidade, independente de pontos)
      if (p.indicator_id) {
        if (!mEntry.indicadores[p.indicator_id]) {
          mEntry.indicadores[p.indicator_id] = { nome: p.indicator_name, quantidade: 0, categoria: p.categoria };
        }
        mEntry.indicadores[p.indicator_id].quantidade += (p.quantidade || 0);
      }
    });
  });

  // Flatten: cada município de cada grupo vira uma entrada no resultado
  const result = [];
  compsAtivas.forEach(comp => {
    const compEntry = scoreMap[comp.id];
    Object.values(compEntry._municipios).forEach(mEntry => {
      result.push({
        id: `${comp.id}|${normalizeMunicipio(mEntry.municipio)}`,
        name: mEntry.municipio,
        opmLabel: mEntry.opmLabel,
        grupoNome: comp.nome,
        tipo_nivel: comp.tipo_nivel,
        municipio: mEntry.municipio,
        score: mEntry.score,
        preventiva: mEntry.preventiva,
        repressiva: mEntry.repressiva,
        apreensao: mEntry.apreensao,
        atendimento: mEntry.atendimento,
        economia: mEntry.economia,
        indicadores: mEntry.indicadores,
      });
    });
  });

  return result.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.repressiva !== a.repressiva) return b.repressiva - a.repressiva;
    return b.apreensao - a.apreensao;
  });
}

/**
 * Calcula ranking por município simples (sem grupos concorrentes).
 * Pontos = soma de pontuacao. Indicadores = soma de quantidade por indicator_id.
 */
export function computeMunicipalRankingComIndicadores(productions) {
  const scoreMap = {};

  productions.forEach(p => {
    const municipio = p.municipio;
    if (!municipio) return;
    const key = normalizeMunicipio(municipio);

    if (!scoreMap[key]) {
      scoreMap[key] = {
        name: municipio,
        municipio,
        score: 0,
        preventiva: 0,
        repressiva: 0,
        apreensao: 0,
        atendimento: 0,
        economia: 0,
        indicadores: {},
      };
    }
    const e = scoreMap[key];
    e.score += (p.pontuacao || 0);
    if (p.categoria === 'Preventiva')  e.preventiva  += (p.pontuacao || 0);
    if (p.categoria === 'Repressiva')  e.repressiva  += (p.pontuacao || 0);
    if (p.categoria === 'Apreensão')   e.apreensao   += (p.pontuacao || 0);
    if (p.categoria === 'Atendimento') e.atendimento += (p.pontuacao || 0);
    if (p.categoria === 'Economia')    e.economia    += (p.pontuacao || 0);
    if (p.indicator_id) {
      if (!e.indicadores[p.indicator_id]) {
        e.indicadores[p.indicator_id] = { nome: p.indicator_name, quantidade: 0, categoria: p.categoria };
      }
      e.indicadores[p.indicator_id].quantidade += (p.quantidade || 0);
    }
  });

  return Object.values(scoreMap).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.repressiva - a.repressiva;
  });
}
