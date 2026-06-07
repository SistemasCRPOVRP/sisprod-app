import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Check, X, Search, ChevronDown, ChevronRight, Building2,
  Users, User, Shield, Loader2, Plus, Eye, EyeOff, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { ORG_STRUCTURE, MUNICIPIOS } from '@/lib/orgData';

// Retorna o município principal de uma OPM baseado na hierarquia
function getMunicipioOPM(nivel, bpm, cia, pel) {
  if (!bpm) return '';
  if ((nivel === 'pelotao' || nivel === 'gpm') && cia && pel) {
    return ORG_STRUCTURE[bpm]?.cias?.[cia]?.pelotoes?.[pel]?.municipio || '';
  }
  if (nivel === 'companhia' && cia) {
    return ORG_STRUCTURE[bpm]?.cias?.[cia]?.municipio || '';
  }
  return '';
}

// ── Key única por OPM ────────────────────────────────────────────────────────
function makeKey(nivel, bpm, cia = '', pel = '', gpm = '') {
  return `${nivel}|${bpm}|${cia}|${pel}|${gpm}`;
}

// ── Label amigável ────────────────────────────────────────────────────────────
function nomeOPM(nivel, bpm, cia, pel, gpm) {
  if (nivel === 'gpm')       return gpm;
  if (nivel === 'pelotao')   return pel;
  if (nivel === 'companhia') return cia;
  return bpm;
}

// ── Todas as OPMs de um município ────────────────────────────────────────────
function getOPMsDoMunicipio(municipio) {
  const result = [];
  Object.entries(ORG_STRUCTURE).forEach(([bpm, bpmData]) => {
    Object.entries(bpmData.cias).forEach(([cia, ciaData]) => {
      // CIA se o município da CIA bater
      if (ciaData.municipio === municipio) {
        result.push({ nivel: 'companhia', bpm, cia, pel: '', gpm: '', municipio });
      }
      Object.entries(ciaData.pelotoes).forEach(([pel, pelData]) => {
        // TODOS os Pelotões cujo município bate — independente de ser igual ou diferente da CIA
        if (pelData.municipio === municipio) {
          result.push({ nivel: 'pelotao', bpm, cia, pel, gpm: '', municipio });
        }
        // GPMs individuais do município
        pelData.gpms.forEach(g => {
          if (g.municipio === municipio) {
            result.push({ nivel: 'gpm', bpm, cia, pel, gpm: g.nome, municipio: g.municipio });
          }
        });
      });
    });
  });
  return result;
}

// ── Sugestão de nome ──────────────────────────────────────────────────────────
function sugerirNome(componentes) {
  const ativos = [...componentes.values()].filter(c => !c.excluida);
  if (ativos.length === 0) return '';
  const primeiro = ativos[0];
  if (primeiro.nivel === 'gpm')       return `${primeiro.gpm} / ${primeiro.pel} / ${primeiro.cia} / ${primeiro.bpm}`;
  if (primeiro.nivel === 'pelotao')   return `${primeiro.pel} / ${primeiro.cia} / ${primeiro.bpm}`;
  if (primeiro.nivel === 'companhia') return `${primeiro.cia} / ${primeiro.bpm}`;
  return primeiro.bpm;
}

// ── Ícones e cores por nível ──────────────────────────────────────────────────
const NIVEL_ICON = {
  bpm:       <Shield className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />,
  companhia: <Building2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />,
  pelotao:   <Users className="w-3 h-3 text-blue-500 flex-shrink-0" />,
  gpm:       <User className="w-2.5 h-2.5 text-orange-500 flex-shrink-0" />,
};
const NIVEL_LABEL = {
  companhia: 'CIA', pelotao: 'PEL', gpm: 'GPM', bpm: 'BPM',
};

// ── Componente: Linha de OPM no painel de membros ───────────────────────────
function MembroRow({ comp, onAtivo, onInativo, onExcluir }) {
  const isAtivo = comp.ativa !== false;
  const isExcluida = comp.excluida === true;

  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all ${
      isExcluida ? 'bg-red-50/50 border-red-200 opacity-60' :
      !isAtivo   ? 'bg-amber-50/50 border-amber-200' :
                   'bg-card border-border'
    }`}>
      {NIVEL_ICON[comp.nivel]}
      <div className="flex-1 min-w-0">
        <span className={`font-semibold text-xs ${isExcluida ? 'line-through text-muted-foreground' : ''}`}>
          {nomeOPM(comp.nivel, comp.bpm, comp.cia, comp.pel, comp.gpm)}
        </span>
        <span className="text-[10px] text-muted-foreground ml-1.5">· {comp.municipio}</span>
        <span className="text-[10px] text-muted-foreground ml-1">· {comp.bpm}</span>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {!isExcluida && (
          <>
            <button
              onClick={() => onAtivo(comp.key)}
              title="Ativo — pontua"
              className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                isAtivo
                  ? 'bg-green-100 text-green-700 border-green-300'
                  : 'bg-white text-muted-foreground border-border hover:bg-green-50 hover:text-green-700 hover:border-green-300'
              }`}
            >
              ATIVO
            </button>
            <button
              onClick={() => onInativo(comp.key)}
              title="Inativo — não pontua"
              className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                !isAtivo
                  ? 'bg-amber-100 text-amber-700 border-amber-300'
                  : 'bg-white text-muted-foreground border-border hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300'
              }`}
            >
              INATIVO
            </button>
          </>
        )}
        {isExcluida && (
          <button
            onClick={() => onAtivo(comp.key)}
            title="Reativar"
            className="px-2 py-0.5 rounded text-[10px] font-semibold border bg-white text-green-700 border-green-300 hover:bg-green-50"
          >
            REATIVAR
          </button>
        )}
        <button
          onClick={() => onExcluir(comp.key)}
          title="Remover do grupo"
          className="ml-1 p-1 rounded hover:bg-red-100 text-muted-foreground hover:text-red-600 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Nó da árvore hierárquica (colapsável) ────────────────────────────────────
function ArvoreNo({ nivel, label, municipio, children, onAdicionar, jaAdicionado, isOpen, onToggle }) {
  const hasChildren = !!children;

  return (
    <div className={nivel !== 'bpm' ? 'ml-4 border-l border-border/30 pl-2' : ''}>
      <div className="flex items-center gap-1.5 py-0.5 group min-h-[26px]">
        {hasChildren ? (
          <button onClick={onToggle} className="p-0.5 text-muted-foreground hover:text-foreground flex-shrink-0">
            {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}
        {NIVEL_ICON[nivel]}
        <span className={`text-xs ${
          nivel === 'bpm' ? 'font-bold text-purple-800' :
          nivel === 'companhia' ? 'font-semibold text-green-800' :
          nivel === 'pelotao' ? 'font-medium text-blue-700' : 'text-orange-700'
        }`}>{label}</span>
        {municipio && <span className="text-[10px] text-muted-foreground">· {municipio}</span>}
        {onAdicionar && (
          <button
            onClick={onAdicionar}
            disabled={jaAdicionado}
            className={`ml-auto opacity-0 group-hover:opacity-100 transition-all text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0 flex items-center gap-0.5 ${
              jaAdicionado
                ? 'text-muted-foreground border-border cursor-default bg-muted/30'
                : 'text-green-700 border-green-300 bg-white hover:bg-green-50 cursor-pointer'
            }`}
          >
            {jaAdicionado ? <Check className="w-2.5 h-2.5" /> : <Plus className="w-2.5 h-2.5" />}
            {jaAdicionado ? 'Adicionado' : 'Adicionar'}
          </button>
        )}
      </div>
      {isOpen && hasChildren && <div>{children}</div>}
    </div>
  );
}

// ── Árvore completa com estado de abertura ────────────────────────────────────
function ArvoreHierarquia({ busca, componentes, onAdicionar }) {
  const [openBPMs, setOpenBPMs] = useState({});
  const [openCIAs, setOpenCIAs] = useState({});
  const [openPELs, setOpenPELs] = useState({});

  const q = busca.trim().toLowerCase();

  const toggleBPM = (bpm) => setOpenBPMs(p => ({ ...p, [bpm]: !p[bpm] }));
  const toggleCIA = (k) => setOpenCIAs(p => ({ ...p, [k]: !p[k] }));
  const togglePEL = (k) => setOpenPELs(p => ({ ...p, [k]: !p[k] }));

  const jaAdicionado = (nivel, bpm, cia, pel, gpm) =>
    componentes.has(makeKey(nivel, bpm, cia, pel, gpm));

  // Auto-abre durante busca
  useEffect(() => {
    if (!q) return;
    const newBPMs = {}, newCIAs = {}, newPELs = {};
    Object.entries(ORG_STRUCTURE).forEach(([bpm, bpmData]) => {
      Object.entries(bpmData.cias).forEach(([cia, ciaData]) => {
        const ciaKey = `${bpm}|${cia}`;
        Object.entries(ciaData.pelotoes).forEach(([pel, pelData]) => {
          const pelKey = `${bpm}|${cia}|${pel}`;
          const matchPel = pel.toLowerCase().includes(q) || pelData.municipio?.toLowerCase().includes(q)
            || pelData.gpms.some(g => g.nome.toLowerCase().includes(q) || g.municipio?.toLowerCase().includes(q));
          if (matchPel) { newBPMs[bpm] = true; newCIAs[ciaKey] = true; newPELs[pelKey] = true; }
        });
        const matchCia = cia.toLowerCase().includes(q) || ciaData.municipio?.toLowerCase().includes(q);
        if (matchCia) { newBPMs[bpm] = true; newCIAs[ciaKey] = true; }
      });
      if (bpm.toLowerCase().includes(q)) newBPMs[bpm] = true;
    });
    setOpenBPMs(newBPMs);
    setOpenCIAs(newCIAs);
    setOpenPELs(newPELs);
  }, [q]);

  const rows = [];
  Object.entries(ORG_STRUCTURE).forEach(([bpm, bpmData]) => {
    const bpmMatch = !q || bpm.toLowerCase().includes(q) ||
      Object.entries(bpmData.cias).some(([cia, ciaData]) =>
        cia.toLowerCase().includes(q) || ciaData.municipio?.toLowerCase().includes(q) ||
        Object.entries(ciaData.pelotoes).some(([pel, pelData]) =>
          pel.toLowerCase().includes(q) || pelData.municipio?.toLowerCase().includes(q) ||
          pelData.gpms.some(g => g.nome.toLowerCase().includes(q) || g.municipio?.toLowerCase().includes(q))
        )
      );
    if (!bpmMatch) return;

    const bpmOpen = openBPMs[bpm] !== false && (openBPMs[bpm] || !q);

    const ciaNodes = Object.entries(bpmData.cias).map(([cia, ciaData]) => {
      const ciaKey = `${bpm}|${cia}`;
      const ciaMatch = !q || cia.toLowerCase().includes(q) || ciaData.municipio?.toLowerCase().includes(q) ||
        Object.entries(ciaData.pelotoes).some(([pel, pelData]) =>
          pel.toLowerCase().includes(q) || pelData.municipio?.toLowerCase().includes(q) ||
          pelData.gpms.some(g => g.nome.toLowerCase().includes(q) || g.municipio?.toLowerCase().includes(q))
        );
      if (!ciaMatch) return null;

      const ciaOpen = openCIAs[ciaKey] !== false && (openCIAs[ciaKey] || !q || true);

      const pelNodes = Object.entries(ciaData.pelotoes).map(([pel, pelData]) => {
        const pelKey = `${bpm}|${cia}|${pel}`;
        const pelMatch = !q || pel.toLowerCase().includes(q) || pelData.municipio?.toLowerCase().includes(q) ||
          pelData.gpms.some(g => g.nome.toLowerCase().includes(q) || g.municipio?.toLowerCase().includes(q));
        if (!pelMatch) return null;

        const pelOpen = openPELs[pelKey] !== false && (openPELs[pelKey] || !q);

        const gpmNodes = pelData.gpms
          .filter(g => !q || g.nome.toLowerCase().includes(q) || g.municipio?.toLowerCase().includes(q))
          .map(g => (
            <ArvoreNo
              key={g.nome}
              nivel="gpm"
              label={g.nome}
              municipio={g.municipio !== pelData.municipio ? g.municipio : ''}
              onAdicionar={() => onAdicionar('gpm', bpm, cia, pel, g.nome, g.municipio)}
              jaAdicionado={jaAdicionado('gpm', bpm, cia, pel, g.nome)}
              isOpen={false}
              onToggle={() => {}}
            />
          ));

        return (
          <ArvoreNo
            key={pel}
            nivel="pelotao"
            label={pel}
            municipio={pelData.municipio !== ciaData.municipio ? pelData.municipio : ''}
            onAdicionar={() => onAdicionar('pelotao', bpm, cia, pel, '', pelData.municipio)}
            jaAdicionado={jaAdicionado('pelotao', bpm, cia, pel, '')}
            isOpen={pelOpen}
            onToggle={() => togglePEL(pelKey)}
          >
            {gpmNodes.length > 0 ? gpmNodes : null}
          </ArvoreNo>
        );
      }).filter(Boolean);

      return (
        <ArvoreNo
          key={cia}
          nivel="companhia"
          label={cia}
          municipio={ciaData.municipio}
          onAdicionar={() => onAdicionar('companhia', bpm, cia, '', '', ciaData.municipio)}
          jaAdicionado={jaAdicionado('companhia', bpm, cia, '', '')}
          isOpen={ciaOpen}
          onToggle={() => toggleCIA(ciaKey)}
        >
          {pelNodes.length > 0 ? pelNodes : null}
        </ArvoreNo>
      );
    }).filter(Boolean);

    rows.push(
      <ArvoreNo
        key={bpm}
        nivel="bpm"
        label={bpm}
        municipio=""
        onAdicionar={null}
        jaAdicionado={false}
        isOpen={bpmOpen}
        onToggle={() => toggleBPM(bpm)}
      >
        {ciaNodes.length > 0 ? ciaNodes : null}
      </ArvoreNo>
    );
  });

  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-8">Nenhum resultado para "{busca}"</p>;
  }
  return <>{rows}</>;
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function GrupoDialog({ mode, initial, tipoNivel, onClose, onSave, isSaving, ordemSugerida }) {
  const [nome, setNome] = useState(initial?.nome || '');
  const [nomeEditado, setNomeEditado] = useState(!!initial?.nome);
  const [ordem, setOrdem] = useState(initial?.ordem ?? ordemSugerida ?? 1);
  const [observacao, setObservacao] = useState(initial?.observacao || '');
  const [busca, setBusca] = useState('');
  const [abaPainel, setAbaPainel] = useState('hierarquia'); // 'hierarquia' | 'municipio'
  const [municipioSelecionado, setMunicipioSelecionado] = useState('');
  const searchRef = useRef(null);

  // Map<key, { key, nivel, bpm, cia, pel, gpm, municipio, ativa, excluida }>
  const [componentes, setComponentes] = useState(() => {
    const map = new Map();
    if (!initial?.municipios_participantes?.length) return map;
    initial.municipios_participantes.forEach(m => {
      const key = m.comp_key || makeKey(m.nivel || 'gpm', m.bpm || '', m.companhia || '', m.pelotao || '', m.gpm || '');
      map.set(key, {
        key,
        nivel: m.nivel || 'gpm',
        bpm: m.bpm || '',
        cia: m.companhia || '',
        pel: m.pelotao || '',
        gpm: m.gpm || '',
        municipio: m.municipio || '',
        ativa: m.ativa !== false,
        excluida: m.excluida === true,
      });
    });
    return map;
  });

  useEffect(() => {
    setTimeout(() => searchRef.current?.focus(), 100);
  }, []);

  const adicionarOPM = (nivel, bpm, cia, pel, gpm, municipio) => {
    const key = makeKey(nivel, bpm, cia, pel, gpm);
    if (componentes.has(key)) {
      // Se estava excluída, reativa
      const c = componentes.get(key);
      if (c.excluida) {
        setComponentes(prev => { const n = new Map(prev); n.set(key, { ...c, excluida: false, ativa: true }); return n; });
      }
      return;
    }
    setComponentes(prev => {
      const n = new Map(prev);
      n.set(key, { key, nivel, bpm, cia, pel, gpm, municipio, ativa: true, excluida: false });
      return n;
    });
    if (!nomeEditado) {
      const proximo = new Map(componentes);
      proximo.set(key, { key, nivel, bpm, cia, pel, gpm, municipio, ativa: true, excluida: false });
      setNome(sugerirNome(proximo));
      // Sugere automaticamente o município principal no campo observações (apenas na primeira OPM)
      if (componentes.size === 0) {
        const municipioPrincipal = getMunicipioOPM(nivel, bpm, cia, pel) || municipio || '';
        if (municipioPrincipal) setObservacao(municipioPrincipal);
      }
    }
  };

  const setAtivo = (key) => setComponentes(prev => { const n = new Map(prev); const c = n.get(key); if (c) n.set(key, { ...c, ativa: true, excluida: false }); return n; });
  const setInativo = (key) => setComponentes(prev => { const n = new Map(prev); const c = n.get(key); if (c) n.set(key, { ...c, ativa: false }); return n; });
  const excluirComp = (key) => setComponentes(prev => { const n = new Map(prev); n.delete(key); return n; });

  const membros = useMemo(() => [...componentes.values()], [componentes]);
  const ativos = useMemo(() => membros.filter(c => !c.excluida && c.ativa), [membros]);
  const inativos = useMemo(() => membros.filter(c => !c.excluida && !c.ativa), [membros]);

  const opmsDoMunicipio = useMemo(() =>
    municipioSelecionado ? getOPMsDoMunicipio(municipioSelecionado) : [],
    [municipioSelecionado]
  );

  const handleSave = () => {
    if (!nome.trim()) { toast.error('Informe o nome do grupo'); return; }
    if (membros.length === 0) { toast.error('Adicione ao menos um componente ao grupo'); return; }

    onSave({
      nome: nome.trim(),
      observacao: observacao.trim(),
      ordem: Number(ordem) || 99,
      tipo_nivel: tipoNivel,
      municipios_vinculados: [...new Set(ativos.map(c => c.municipio).filter(Boolean))],
      municipios_participantes: membros.map(c => ({
        comp_key: c.key,
        municipio: c.municipio,
        nome_sugerido: nomeOPM(c.nivel, c.bpm, c.cia, c.pel, c.gpm),
        nivel: c.nivel,
        bpm: c.bpm,
        companhia: c.cia,
        pelotao: c.pel,
        gpm: c.gpm,
        ativa: c.ativa,
        excluida: c.excluida,
        unidades: [],
      })),
      unidades_vinculadas: ativos.map(c => ({
        bpm: c.bpm, companhia: c.cia, pelotao: c.pel, gpm: c.gpm,
        municipio: c.municipio, nivel: c.nivel,
      })),
      status: initial?.status || 'ativo',
    });
  };

  const tipoLabel = { companhia: 'CIA', pelotao: 'Pelotão', gpm: 'GPM', bpm: 'BPM' }[tipoNivel] || tipoNivel;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[94vh] flex flex-col overflow-hidden p-0">

        {/* Header */}
        <DialogHeader className="px-5 pt-4 pb-3 border-b border-border flex-shrink-0">
          <DialogTitle className="text-base">
            {mode === 'create' ? `Novo Grupo` : `Editar Grupo`}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex min-h-0">

          {/* ── Coluna Esquerda: Busca e Seleção ────────────────────────── */}
          <div className="w-[42%] flex flex-col border-r border-border overflow-hidden bg-muted/20">

            {/* Abas de busca */}
            <div className="flex border-b border-border flex-shrink-0">
              <button
                onClick={() => setAbaPainel('hierarquia')}
                className={`flex-1 py-2 text-xs font-semibold transition-colors ${abaPainel === 'hierarquia' ? 'bg-card text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Hierarquia
              </button>
              <button
                onClick={() => setAbaPainel('municipio')}
                className={`flex-1 py-2 text-xs font-semibold transition-colors ${abaPainel === 'municipio' ? 'bg-card text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Por Município
              </button>
            </div>

            {abaPainel === 'hierarquia' && (
              <>
                {/* Busca */}
                <div className="px-3 py-2 border-b border-border flex-shrink-0">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      ref={searchRef}
                      value={busca}
                      onChange={e => setBusca(e.target.value)}
                      placeholder="Buscar OPM, município..."
                      className="pl-8 h-8 text-xs bg-card"
                    />
                    {busca && (
                      <button className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setBusca('')}>
                        <X className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                  <ArvoreHierarquia
                    busca={busca}
                    componentes={componentes}
                    onAdicionar={adicionarOPM}
                  />
                </div>
              </>
            )}

            {abaPainel === 'municipio' && (
              <>
                <div className="px-3 py-2 border-b border-border flex-shrink-0">
                  <select
                    value={municipioSelecionado}
                    onChange={e => setMunicipioSelecionado(e.target.value)}
                    className="w-full h-8 rounded-md border border-input bg-card px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">Selecionar município...</option>
                    {MUNICIPIOS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                  {!municipioSelecionado && (
                    <p className="text-xs text-muted-foreground text-center py-8">Selecione um município acima</p>
                  )}
                  {municipioSelecionado && opmsDoMunicipio.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-8">Nenhuma OPM encontrada para este município</p>
                  )}
                  {opmsDoMunicipio.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold text-muted-foreground px-1 mb-2">
                        OPMs em {municipioSelecionado}
                      </p>
                      {opmsDoMunicipio.map((opm, i) => {
                        const key = makeKey(opm.nivel, opm.bpm, opm.cia, opm.pel, opm.gpm);
                        const jaAdicionado = componentes.has(key);
                        return (
                          <div key={i} className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${jaAdicionado ? 'bg-green-50 border-green-200' : 'bg-card border-border'}`}>
                            {NIVEL_ICON[opm.nivel]}
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-semibold">{nomeOPM(opm.nivel, opm.bpm, opm.cia, opm.pel, opm.gpm)}</span>
                              <span className="text-[10px] text-muted-foreground ml-1.5">
                                {NIVEL_LABEL[opm.nivel]} · {opm.bpm}
                              </span>
                            </div>
                            <button
                              onClick={() => adicionarOPM(opm.nivel, opm.bpm, opm.cia, opm.pel, opm.gpm, opm.municipio)}
                              disabled={jaAdicionado}
                              className={`text-[10px] px-2 py-1 rounded border font-semibold transition-colors flex-shrink-0 flex items-center gap-1 ${
                                jaAdicionado
                                  ? 'text-green-700 border-green-300 bg-green-100 cursor-default'
                                  : 'text-primary border-primary/30 bg-white hover:bg-primary/5'
                              }`}
                            >
                              {jaAdicionado ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                              {jaAdicionado ? 'Adicionado' : 'Adicionar'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ── Coluna Direita: Config + Membros ────────────────────────── */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">

              {/* Nome e Ordem */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Nome do Grupo *</Label>
                  <Input
                    value={nome}
                    onChange={e => { setNome(e.target.value); setNomeEditado(true); }}
                    placeholder="Ex: 1ª CIA / 23º BPM"
                    className="mt-1 h-8 text-sm"
                  />
                </div>
                <div className="w-16 flex-shrink-0">
                  <Label className="text-xs text-muted-foreground">Ordem</Label>
                  <Input
                    type="number" min={1}
                    value={ordem}
                    onChange={e => setOrdem(e.target.value)}
                    className="mt-1 h-8 text-sm"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Observações</Label>
                <Input
                  value={observacao}
                  onChange={e => setObservacao(e.target.value)}
                  placeholder="Município representado (ex: Santa Cruz do Sul)"
                  className="mt-1 h-8 text-sm"
                />
              </div>

              {/* Painel de membros */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs font-semibold">
                    Componentes do Grupo
                    <span className="ml-1.5 font-normal text-muted-foreground">
                      ({ativos.length} ativo{ativos.length !== 1 ? 's' : ''}{inativos.length > 0 ? `, ${inativos.length} inativo${inativos.length !== 1 ? 's' : ''}` : ''})
                    </span>
                  </Label>
                </div>

                {membros.length === 0 ? (
                  <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
                    <Building2 className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
                    <p className="text-xs text-muted-foreground">Nenhum componente adicionado</p>
                    <p className="text-[11px] text-muted-foreground/60 mt-0.5">Use a hierarquia ou busca por município à esquerda</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {/* Ativos */}
                    {ativos.length > 0 && (
                      <div className="space-y-1">
                        {ativos.map(c => (
                          <MembroRow key={c.key} comp={c} onAtivo={setAtivo} onInativo={setInativo} onExcluir={excluirComp} />
                        ))}
                      </div>
                    )}

                    {/* Inativos */}
                    {inativos.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-amber-700 mt-3 mb-1 flex items-center gap-1">
                          <EyeOff className="w-3 h-3" /> INATIVOS — não pontuam
                        </p>
                        <div className="space-y-1">
                          {inativos.map(c => (
                            <MembroRow key={c.key} comp={c} onAtivo={setAtivo} onInativo={setInativo} onExcluir={excluirComp} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Resumo */}
              {ativos.length > 0 && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 flex items-center gap-3 flex-wrap">
                  <span className="text-[10px] font-bold text-primary">COMPOSIÇÃO ATIVA:</span>
                  {[...new Set(ativos.map(c => c.municipio).filter(Boolean))].map(m => (
                    <Badge key={m} variant="outline" className="text-[10px] px-1.5 py-0">{m}</Badge>
                  ))}
                  <span className="text-[10px] text-muted-foreground ml-auto">{ativos.length} OPM{ativos.length !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="border-t border-border px-5 py-3 flex-shrink-0 bg-muted/10">
          <Button variant="outline" onClick={onClose} disabled={isSaving} size="sm">Cancelar</Button>
          <Button onClick={handleSave} disabled={isSaving} size="sm">
            {isSaving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1" />}
            {isSaving ? 'Salvando...' : mode === 'create' ? 'Criar Grupo' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
