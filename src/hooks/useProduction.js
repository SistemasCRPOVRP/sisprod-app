import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import {
  collection,
  getDocs,
  query,
  where,
  onSnapshot,
  orderBy
} from 'firebase/firestore';

//import { db } from '@/api/base44Client';
import { db } from '@/api/firebase';
import { CONSOLIDACAO_MUNICIPAL, ORG_STRUCTURE } from '@/lib/orgData';

/* =========================================================
   UTIL (mesma lógica original mantida)
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
   HOOK: ORGANIZATIONS
========================================================= */

export function useOrganizations() {
  return useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const snap = await getDocs(
        query(collection(db, 'Organization'), where('status', '==', 'ativo'))
      );

      return snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    },
    initialData: [],
  });
}

/* =========================================================
   HOOK: INDICATORS
========================================================= */

export function useIndicators() {
  return useQuery({
    queryKey: ['indicators'],
    queryFn: async () => {
      const snap = await getDocs(
        query(collection(db, 'Indicator'), where('status', '==', 'ativo'))
      );

      return snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    },
    initialData: [],
  });
}

/* =========================================================
   HOOK: PRODUCTIONS (FILTRADO POR PERÍODO)
========================================================= */

export function useProductions(periodo) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const qRef = query(
      collection(db, 'Production'),
      where('periodo', '==', periodo)
    );

    const unsub = onSnapshot(qRef, () => {
      queryClient.invalidateQueries({ queryKey: ['productions'], exact: false });
    });

    return () => unsub();
  }, [queryClient, periodo]);

  return useQuery({
    queryKey: ['productions', periodo],
    queryFn: async () => {
      const qRef = query(
        collection(db, 'Production'),
        where('periodo', '==', periodo)
      );

      const snap = await getDocs(qRef);

      const data = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // ordenação mais recente primeiro
      return data.sort((a, b) => {
        const da = b.data || '';
        const dbd = a.data || '';
        if (da !== dbd) return da.localeCompare(dbd);
        return new Date(b.created_date || 0) - new Date(a.created_date || 0);
      });
    },
    initialData: [],
    staleTime: 0,
  });
}

/* =========================================================
   HOOK: ALL PRODUCTIONS (SEM LIMITE)
========================================================= */

export function useAllProductions() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'Production'), (snapshot) => {
      queryClient.invalidateQueries({ queryKey: ['all-productions'] });
      queryClient.invalidateQueries({ queryKey: ['productions'] });
      queryClient.invalidateQueries({ queryKey: ['hist-lancamento'] });
    });

    return () => unsub();
  }, [queryClient]);

  return useQuery({
    queryKey: ['all-productions'],
    queryFn: async () => {
      const snap = await getDocs(collection(db, 'Production'));

      const records = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return records.sort((a, b) => {
        const da = b.data || '';
        const dbd = a.data || '';
        if (da !== dbd) return da.localeCompare(dbd);
        return new Date(b.created_date || 0) - new Date(a.created_date || 0);
      });
    },
    initialData: [],
    staleTime: 0,
    gcTime: 1000 * 60 * 30,
  });
}

/* =========================================================
   RANKING (MANTIDO — NÃO DEPENDE MAIS DO BASE44)
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
    }

    else if (level === 'pelotao') {
      if (!p.pelotao) return;
      key = `${p.bpm}|${p.companhia}|${p.pelotao}`;
      name = [p.pelotao, p.companhia, p.bpm].filter(Boolean).join(' / ');
      municipio = getMunicipioPrincipal(p.bpm, p.companhia, p.pelotao, p.municipio);
    }

    else if (level === 'companhia') {
      if (!p.companhia) return;
      key = `${p.bpm}|${p.companhia}`;
      name = [p.companhia, p.bpm].filter(Boolean).join(' / ');
      municipio = getMunicipioPrincipal(p.bpm, p.companhia, null, p.municipio);
    }

    else if (level === 'bpm') {
      if (!p.bpm) return;
      key = p.bpm;
      name = p.bpm;
      municipio = '';
    }

    else return;

    if (!scoreMap[key]) {
      scoreMap[key] = {
        name,
        municipio,
        score: 0,
        preventiva: 0,
        repressiva: 0,
        apreensao: 0,
        atendimento: 0,
        economia: 0,
      };
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
   MUNICIPAL RANKING (SIMPLIFICADO FIREBASE)
========================================================= */

export function computeMunicipalRanking(productions) {
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
      };
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