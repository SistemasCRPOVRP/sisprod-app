import { useQuery } from '@tanstack/react-query';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy
} from 'firebase/firestore';

//import { db } from '@/api/base44Client';
import { db } from '@/api/firebase';
import { CONSOLIDACAO_MUNICIPAL, ORG_STRUCTURE } from '@/lib/orgData';

/* =========================================================
   UTIL
========================================================= */

function getMunicipioPrincipal(bpm, companhia, pelotao, _municipioRegistro) {
  if (bpm && companhia) {
    const ciaData = ORG_STRUCTURE?.[bpm]?.cias?.[companhia];
    if (ciaData) {
      if (pelotao) {
        const pelMunicipio = ciaData.pelotoes?.[pelotao]?.municipio;
        if (pelMunicipio) return pelMunicipio;
      }
      if (ciaData.municipio) return ciaData.municipio;
    }
  }
  return _municipioRegistro || '';
}

function normalizeMunicipio(m) {
  if (!m) return '';
  return m.trim().toLowerCase().replace(/\s+/g, ' ');
}

/* =========================================================
   UTIL: NORMALIZA UM REGISTRO DE PRODUÇÃO
   Garante que pontuacao, quantidade e peso sejam SEMPRE
   números. Os dados importados do Excel vêm como string
   ('6' em vez de 6), o que zerava as somas do ranking.
========================================================= */

function normalizeProduction(doc) {
  const d = doc.data();
  return {
    id: doc.id,
    ...d,
    pontuacao: Number(d.pontuacao) || 0,
    quantidade: Number(d.quantidade) || 0,
    peso: Number(d.peso) || 0,
  };
}

/* =========================================================
   HOOK: ORGANIZATIONS
========================================================= */

export function useOrganizations() {
  return useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      // Busca todas e exclui só as explicitamente inativas (tolera as sem status).
      const snap = await getDocs(collection(db, 'Organization'));
      return snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(org => org.status !== 'inativo');
    },
    initialData: [],
    staleTime: 1000 * 60 * 5,
  });
}

/* =========================================================
   HOOK: INDICATORS
========================================================= */

export function useIndicators() {
  return useQuery({
    queryKey: ['indicators'],
    queryFn: async () => {
      // Busca TODOS os indicadores e filtra no código. Antes filtrava por
      // status=='ativo' no Firestore, mas indicadores importados sem o campo
      // 'status' ficavam invisíveis. Agora só exclui os explicitamente inativos.
      const snap = await getDocs(collection(db, 'Indicator'));
      return snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(ind => ind.status !== 'inativo');
    },
    initialData: [],
    staleTime: 1000 * 60 * 5,
  });
}

/* =========================================================
   HOOK: PRODUCTIONS (FILTRADO POR PERÍODO)
========================================================= */

export function useProductions(periodo) {
  return useQuery({
    queryKey: ['productions', periodo],
    queryFn: async () => {
      const qRef = query(
        collection(db, 'Production'),
        where('periodo', '==', periodo)
      );
      const snap = await getDocs(qRef);
      const data = snap.docs.map(normalizeProduction);
      return data.sort((a, b) => {
        const da = b.data || '';
        const dbd = a.data || '';
        if (da !== dbd) return da.localeCompare(dbd);
        return new Date(b.created_date || 0) - new Date(a.created_date || 0);
      });
    },
    initialData: [],
    staleTime: 1000 * 60 * 5,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });
}

/* =========================================================
   HOOK: ALL PRODUCTIONS (SEM LIMITE)
========================================================= */

export function useAllProductions() {
  return useQuery({
    queryKey: ['all-productions'],
    queryFn: async () => {
      const snap = await getDocs(collection(db, 'Production'));
      const records = snap.docs.map(normalizeProduction);
      return records.sort((a, b) => {
        const da = b.data || '';
        const dbd = a.data || '';
        if (da !== dbd) return da.localeCompare(dbd);
        return new Date(b.created_date || 0) - new Date(a.created_date || 0);
      });
    },
    initialData: [],
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });
}

/* =========================================================
   HOOK: PRODUCTIONS PARA HISTÓRICO / RELATÓRIOS
   Busca só ao abrir a aba (sem tempo real) e apenas o
   período/intervalo selecionado — economiza leituras.
========================================================= */

export function useProductionsHistorico({ periodo, useDateRange, dataInicio, dataFim }) {
  return useQuery({
    queryKey: ['hist-productions', periodo, useDateRange, dataInicio, dataFim],
    queryFn: async () => {
      let qRef;
      const usandoIntervalo = useDateRange && (dataInicio || dataFim);

      if (usandoIntervalo) {
        const constraints = [];
        if (dataInicio) constraints.push(where('data', '>=', dataInicio));
        if (dataFim)    constraints.push(where('data', '<=', dataFim));
        qRef = query(collection(db, 'Production'), ...constraints);
      } else {
        // Modo trimestre (ou intervalo sem datas escolhidas): busca só o período
        qRef = query(collection(db, 'Production'), where('periodo', '==', periodo));
      }

      const snap = await getDocs(qRef);
      return snap.docs.map(normalizeProduction);
    },
    initialData: [],
    staleTime: 1000 * 60 * 2,   // reaproveita por 2 min ao navegar entre abas
    refetchOnMount: 'always',   // busca de novo toda vez que abre a aba
  });
}

/* =========================================================
   RANKING PADRÃO
========================================================= */

export function computeRankings(productions, level = 'gpm') {
  const scoreMap = {};

  productions.forEach(p => {
    let key, name, municipio;

    if (level === 'gpm') {
      if (!p.gpm) return;
      key = `${p.bpm}|${p.companhia}|${p.pelotao}|${p.gpm}`;
      name = [p.gpm, p.pelotao, p.companhia, p.bpm].filter(Boolean).join(' / ');
      municipio = p.municipio || getMunicipioPrincipal(p.bpm, p.companhia, p.pelotao, p.municipio);
    } else if (level === 'pelotao') {
      if (!p.pelotao) return;
      key = `${p.bpm}|${p.companhia}|${p.pelotao}`;
      name = [p.pelotao, p.companhia, p.bpm].filter(Boolean).join(' / ');
      municipio = getMunicipioPrincipal(p.bpm, p.companhia, p.pelotao, p.municipio);
    } else if (level === 'companhia') {
      if (!p.companhia) return;
      key = `${p.bpm}|${p.companhia}`;
      name = [p.companhia, p.bpm].filter(Boolean).join(' / ');
      municipio = getMunicipioPrincipal(p.bpm, p.companhia, null, p.municipio);
    } else if (level === 'bpm') {
      if (!p.bpm) return;
      key = p.bpm;
      name = p.bpm;
      municipio = '';
    } else return;

    if (!scoreMap[key]) {
      scoreMap[key] = { name, municipio, score: 0, preventiva: 0, repressiva: 0, apreensao: 0, atendimento: 0, economia: 0 };
    }

    scoreMap[key].score += (p.pontuacao || 0);
    if (p.categoria === 'Preventiva') scoreMap[key].preventiva += (p.pontuacao || 0);
    if (p.categoria === 'Repressiva') scoreMap[key].repressiva += (p.pontuacao || 0);
    if (p.categoria === 'Apreensão') scoreMap[key].apreensao += (p.pontuacao || 0);
    if (p.categoria === 'Atendimento') scoreMap[key].atendimento += (p.pontuacao || 0);
    if (p.categoria === 'Economia') scoreMap[key].economia += (p.pontuacao || 0);
  });

  return Object.values(scoreMap).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.repressiva !== a.repressiva) return b.repressiva - a.repressiva;
    return b.apreensao - a.apreensao;
  });
}

/* =========================================================
   MUNICIPAL RANKING
========================================================= */

export function computeMunicipalRanking(productions) {
  const scoreMap = {};

  productions.forEach(p => {
    const municipio = p.municipio;
    if (!municipio) return;
    const key = normalizeMunicipio(municipio);
    if (!scoreMap[key]) {
      scoreMap[key] = { name: municipio, municipio, score: 0, preventiva: 0, repressiva: 0, apreensao: 0, atendimento: 0, economia: 0 };
    }
    const e = scoreMap[key];
    e.score += (p.pontuacao || 0);
    if (p.categoria === 'Preventiva') e.preventiva += (p.pontuacao || 0);
    if (p.categoria === 'Repressiva') e.repressiva += (p.pontuacao || 0);
    if (p.categoria === 'Apreensão') e.apreensao += (p.pontuacao || 0);
    if (p.categoria === 'Atendimento') e.atendimento += (p.pontuacao || 0);
    if (p.categoria === 'Economia') e.economia += (p.pontuacao || 0);
  });

  return Object.values(scoreMap).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.repressiva - a.repressiva;
  });
}

/* =========================================================
   RANKING POR COMPOSIÇÃO (grupos personalizados)
   Usado por Dashboard.jsx e ImprimirRankingDialog.jsx
========================================================= */

export function computeComposicaoRanking(productions, composicoes = [], tipoFiltro = null) {
  // composicoes: array de grupos concorrentes. Cada grupo tem:
  //   { id, nome, observacao, status, tipo_nivel, unidades_vinculadas: [{bpm, companhia, pelotao, gpm, nivel, municipio}] }
  // Soma a pontuação de TODOS os lançamentos cujas unidades pertencem ao grupo.
  const ativas = composicoes.filter(c => c.status === 'ativo');

  // Casa um lançamento (production) com uma unidade vinculada, respeitando o nível.
  function lancamentoPertence(p, unidade) {
    if (!unidade) return false;
    const nivel = unidade.nivel;
    if (nivel === 'gpm') {
      return p.bpm === unidade.bpm && p.companhia === unidade.companhia
          && p.pelotao === unidade.pelotao && p.gpm === unidade.gpm;
    }
    if (nivel === 'pelotao') {
      return p.bpm === unidade.bpm && p.companhia === unidade.companhia
          && p.pelotao === unidade.pelotao;
    }
    if (nivel === 'companhia') {
      return p.bpm === unidade.bpm && p.companhia === unidade.companhia;
    }
    if (nivel === 'bpm') {
      return p.bpm === unidade.bpm;
    }
    return false;
  }

  const resultado = ativas
    .filter(comp => !tipoFiltro || comp.tipo_nivel === tipoFiltro)
    .map(comp => {
      const unidades = comp.unidades_vinculadas || [];
      // Um lançamento entra se pertence a QUALQUER unidade vinculada do grupo
      const prods = productions.filter(p => unidades.some(u => lancamentoPertence(p, u)));

      const soma = (cat) => prods
        .filter(p => !cat || p.categoria === cat)
        .reduce((s, p) => s + (Number(p.pontuacao) || 0), 0);

      const municipios = [...new Set(unidades.map(u => u.municipio).filter(Boolean))].join(', ');

      return {
        id: comp.id,
        name: comp.nome,
        observacao: comp.observacao || '',
        municipios,
        municipio: '',
        score: soma(null),
        preventiva: soma('Preventiva'),
        repressiva: soma('Repressiva'),
        apreensao: soma('Apreensão'),
        atendimento: soma('Atendimento'),
        economia: soma('Economia'),
        tipo_nivel: comp.tipo_nivel,
      };
    });

  return resultado.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.repressiva !== a.repressiva) return b.repressiva - a.repressiva;
    return b.apreensao - a.apreensao;
  });
}

/* =========================================================
   CATEGORY BREAKDOWN
   Usado por Dashboard.jsx para gráfico de categorias
========================================================= */

export function computeCategoryBreakdown(productions) {
  const categorias = ['Preventiva', 'Repressiva', 'Apreensão', 'Atendimento', 'Economia'];
  return categorias.map(cat => {
    const prods = productions.filter(p => p.categoria === cat);
    return {
      categoria: cat,
      total: prods.reduce((s, p) => s + (p.pontuacao || 0), 0),
      quantidade: prods.reduce((s, p) => s + (p.quantidade || 0), 0),
      registros: prods.length,
    };
  }).filter(c => c.total > 0);
}