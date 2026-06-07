import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Building2, Users, User, MapPin } from 'lucide-react';
import { ORG_STRUCTURE, BPMs } from '@/lib/orgData';

// Gera chaves únicas para cada nó
function bpmKey(bpm) { return `bpm::${bpm}`; }
function ciaKey(bpm, cia) { return `cia::${bpm}|${cia}`; }
function pelKey(bpm, cia, pel) { return `pel::${bpm}|${cia}|${pel}`; }
function gpmKey(bpm, cia, pel, gpm) { return `gpm::${bpm}|${cia}|${pel}|${gpm}`; }

// Obtém todas as chaves-filhas de um BPM
function getDescendantsOf(bpm, cia, pel) {
  const keys = [];
  const bpmData = ORG_STRUCTURE[bpm];
  if (!bpmData) return keys;
  const cias = cia ? { [cia]: bpmData.cias[cia] } : bpmData.cias;
  Object.entries(cias).forEach(([ciaName, ciaData]) => {
    if (!ciaData) return;
    keys.push(ciaKey(bpm, ciaName));
    const pels = pel ? { [pel]: ciaData.pelotoes[pel] } : ciaData.pelotoes;
    Object.entries(pels).forEach(([pelName, pelData]) => {
      if (!pelData) return;
      keys.push(pelKey(bpm, ciaName, pelName));
      pelData.gpms.forEach(g => keys.push(gpmKey(bpm, ciaName, pelName, g.nome)));
    });
  });
  return keys;
}

function getLeafKeys(selected) {
  return [...selected].filter(k => k.startsWith('gpm::'));
}

// Calcula estado de um checkbox pai: all | none | partial
function getCheckState(parentKey, selected, allChildKeys) {
  if (allChildKeys.length === 0) return selected.has(parentKey) ? 'all' : 'none';
  const sel = allChildKeys.filter(k => selected.has(k)).length;
  if (sel === 0) return 'none';
  if (sel === allChildKeys.length) return 'all';
  return 'partial';
}

function CheckBox({ state, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all
        ${state === 'all' ? 'bg-primary border-primary' : state === 'partial' ? 'bg-primary/40 border-primary' : 'border-border bg-background hover:border-primary/60'}`}
    >
      {state === 'all' && <div className="w-2 h-0.5 bg-white rounded-full" style={{ boxShadow: '0 0 0 0' }}><svg width="8" height="6" viewBox="0 0 8 6"><path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg></div>}
      {state === 'partial' && <div className="w-2 h-0.5 bg-white rounded-full" />}
    </button>
  );
}

function GpmNode({ bpm, cia, pel, gpm, municipio, selected, onToggle }) {
  const key = gpmKey(bpm, cia, pel, gpm);
  const isSel = selected.has(key);
  return (
    <div
      className={`flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer hover:bg-muted/50 transition-colors
        ${isSel ? 'bg-primary/5' : ''}`}
      onClick={() => onToggle(key)}
    >
      <div className="w-4 flex-shrink-0" />
      <CheckBox state={isSel ? 'all' : 'none'} onClick={e => { e.stopPropagation(); onToggle(key); }} />
      <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0" />
      <span className="text-xs font-medium">{gpm}</span>
      <span className="text-[10px] text-muted-foreground">— {municipio}</span>
    </div>
  );
}

function PelNode({ bpm, cia, pel, pelData, selected, onToggle, expanded, onExpand }) {
  const key = pelKey(bpm, cia, pel);
  const allChildren = pelData.gpms.map(g => gpmKey(bpm, cia, pel, g.nome));
  const state = getCheckState(key, selected, allChildren);

  const handleCheck = (e) => {
    e.stopPropagation();
    const allSel = allChildren.every(k => selected.has(k));
    onToggle(allSel ? allChildren : [...allChildren, key], !allSel);
  };

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer hover:bg-muted/50 transition-colors
          ${state !== 'none' ? 'bg-blue-50/60' : ''}`}
        onClick={() => onExpand(key)}
      >
        <div className="w-4 flex-shrink-0">
          <button type="button" onClick={e => { e.stopPropagation(); onExpand(key); }} className="text-muted-foreground hover:text-foreground">
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </div>
        <CheckBox state={state} onClick={handleCheck} />
        <User className="w-3 h-3 text-blue-500 flex-shrink-0" />
        <span className="text-xs font-semibold text-blue-700">{pel}</span>
        <span className="text-[10px] text-muted-foreground">— {pelData.municipio}</span>
        <span className="ml-auto text-[10px] text-muted-foreground">{pelData.gpms.length} GPMs</span>
        {state === 'partial' && <span className="text-[9px] bg-amber-100 text-amber-700 border border-amber-300 rounded px-1 font-semibold">parcial</span>}
      </div>
      {expanded && (
        <div className="ml-8 border-l border-border pl-2 mt-0.5 space-y-0.5">
          {pelData.gpms.map(g => (
            <GpmNode key={g.nome} bpm={bpm} cia={cia} pel={pel} gpm={g.nome} municipio={g.municipio} selected={selected} onToggle={k => onToggle([k], !selected.has(k))} />
          ))}
        </div>
      )}
    </div>
  );
}

function CiaNode({ bpm, cia, ciaData, selected, onToggle, expanded, onExpand, expandedPels, onExpandPel }) {
  const key = ciaKey(bpm, cia);
  const allChildren = [];
  Object.entries(ciaData.pelotoes).forEach(([pel, pelData]) => {
    allChildren.push(pelKey(bpm, cia, pel));
    pelData.gpms.forEach(g => allChildren.push(gpmKey(bpm, cia, pel, g.nome)));
  });
  const state = getCheckState(key, selected, allChildren);

  const handleCheck = (e) => {
    e.stopPropagation();
    const allSel = allChildren.every(k => selected.has(k));
    onToggle(allSel ? allChildren : [...allChildren, key], !allSel);
  };

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer hover:bg-muted/50 transition-colors
          ${state !== 'none' ? 'bg-green-50/60' : ''}`}
        onClick={() => onExpand(key)}
      >
        <div className="w-4 flex-shrink-0">
          <button type="button" onClick={e => { e.stopPropagation(); onExpand(key); }} className="text-muted-foreground hover:text-foreground">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
        <CheckBox state={state} onClick={handleCheck} />
        <Users className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
        <span className="text-xs font-bold text-green-700">{cia}</span>
        <span className="text-[10px] text-muted-foreground">— {ciaData.municipio}</span>
        <span className="ml-auto text-[10px] text-muted-foreground">{Object.keys(ciaData.pelotoes).length} Pels</span>
        {state === 'partial' && <span className="text-[9px] bg-amber-100 text-amber-700 border border-amber-300 rounded px-1 font-semibold">parcial</span>}
      </div>
      {expanded && (
        <div className="ml-7 border-l border-border pl-2 mt-0.5 space-y-0.5">
          {Object.entries(ciaData.pelotoes).map(([pel, pelData]) => (
            <PelNode
              key={pel} bpm={bpm} cia={cia} pel={pel} pelData={pelData}
              selected={selected} onToggle={onToggle}
              expanded={expandedPels.has(pelKey(bpm, cia, pel))}
              onExpand={onExpandPel}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function OrgTree({ selected, onChange }) {
  const [expandedBpms, setExpandedBpms] = useState(new Set(BPMs.map(b => b.value)));
  const [expandedCias, setExpandedCias] = useState(new Set());
  const [expandedPels, setExpandedPels] = useState(new Set());

  const toggle = (keys, add) => {
    const next = new Set(selected);
    keys.forEach(k => add ? next.add(k) : next.delete(k));
    onChange(next);
  };

  const toggleExpand = (set, setFn, key) => {
    const next = new Set(set);
    next.has(key) ? next.delete(key) : next.add(key);
    setFn(next);
  };

  const selectAll = () => {
    const all = new Set();
    BPMs.forEach(({ value: bpm }) => {
      all.add(bpmKey(bpm));
      getDescendantsOf(bpm).forEach(k => all.add(k));
    });
    onChange(all);
  };

  const clearAll = () => onChange(new Set());

  const totalLeafs = useMemo(() => {
    let n = 0;
    BPMs.forEach(({ value: bpm }) => {
      Object.entries(ORG_STRUCTURE[bpm].cias).forEach(([, cd]) => {
        Object.entries(cd.pelotoes).forEach(([, pd]) => { n += pd.gpms.length; });
      });
    });
    return n;
  }, []);

  const selectedLeafs = [...selected].filter(k => k.startsWith('gpm::')).length;

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 border-b border-border">
        <span className="text-xs text-muted-foreground flex-1">
          {selectedLeafs} de {totalLeafs} GPMs selecionados
        </span>
        <button type="button" onClick={selectAll} className="text-[11px] text-primary hover:underline font-semibold">Selecionar todos</button>
        <span className="text-muted-foreground">·</span>
        <button type="button" onClick={clearAll} className="text-[11px] text-muted-foreground hover:text-foreground hover:underline">Limpar</button>
        <span className="text-muted-foreground">·</span>
        <button type="button" onClick={() => setExpandedBpms(new Set(BPMs.map(b => b.value)))} className="text-[11px] text-muted-foreground hover:text-foreground hover:underline">Expandir</button>
        <span className="text-muted-foreground">·</span>
        <button type="button" onClick={() => { setExpandedBpms(new Set()); setExpandedCias(new Set()); setExpandedPels(new Set()); }} className="text-[11px] text-muted-foreground hover:text-foreground hover:underline">Recolher</button>
      </div>

      {/* Tree */}
      <div className="max-h-72 overflow-y-auto p-2 space-y-1">
        {BPMs.map(({ value: bpm, label }) => {
          const bpmData = ORG_STRUCTURE[bpm];
          const allDesc = getDescendantsOf(bpm);
          const bStateChildren = allDesc;
          const state = getCheckState(bpmKey(bpm), selected, bStateChildren);
          const isExpanded = expandedBpms.has(bpm);

          const handleBpmCheck = (e) => {
            e.stopPropagation();
            const allSel = bStateChildren.every(k => selected.has(k));
            toggle(allSel ? bStateChildren : [...bStateChildren, bpmKey(bpm)], !allSel);
          };

          return (
            <div key={bpm}>
              <div
                className={`flex items-center gap-2 py-2 px-2 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors
                  ${state !== 'none' ? 'bg-primary/5' : ''}`}
                onClick={() => toggleExpand(expandedBpms, setExpandedBpms, bpm)}
              >
                <div className="w-4 flex-shrink-0">
                  <button type="button" onClick={e => { e.stopPropagation(); toggleExpand(expandedBpms, setExpandedBpms, bpm); }} className="text-muted-foreground hover:text-foreground">
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                </div>
                <CheckBox state={state} onClick={handleBpmCheck} />
                <Building2 className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-sm font-bold text-primary">{bpm}</span>
                <span className="text-[10px] text-muted-foreground">— {Object.keys(bpmData.cias).length} Cias</span>
                <span className="ml-auto text-[10px] text-muted-foreground">{label.split(' - ')[1]}</span>
                {state === 'partial' && <span className="text-[9px] bg-amber-100 text-amber-700 border border-amber-300 rounded px-1 font-semibold">parcial</span>}
              </div>
              {isExpanded && (
                <div className="ml-6 border-l border-border pl-2 mt-0.5 space-y-0.5">
                  {Object.entries(bpmData.cias).map(([cia, ciaData]) => (
                    <CiaNode
                      key={cia} bpm={bpm} cia={cia} ciaData={ciaData}
                      selected={selected} onToggle={toggle}
                      expanded={expandedCias.has(ciaKey(bpm, cia))}
                      onExpand={k => toggleExpand(expandedCias, setExpandedCias, k)}
                      expandedPels={expandedPels}
                      onExpandPel={k => toggleExpand(expandedPels, setExpandedPels, k)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Utilitário: converte Set de chaves para lista de unidades_vinculadas
// IMPORTANTE: salva apenas os GPMs (folhas) para evitar duplicidade de pontuação.
// CIA/Pel/BPM selecionados implicitamente incluem seus GPMs — que já são listados individualmente.
export function selectedKeysToUnidades(selectedKeys) {
  const unidades = [];
  selectedKeys.forEach(key => {
    if (!key.startsWith('gpm::')) return; // ignora nós intermediários (bpm/cia/pel)
    const parts = key.split('::')[1]?.split('|') || [];
    const [bpm, cia, pel, gpm] = parts;
    const gpmData = ORG_STRUCTURE[bpm]?.cias?.[cia]?.pelotoes?.[pel]?.gpms?.find(g => g.nome === gpm);
    unidades.push({ bpm, companhia: cia, pelotao: pel, gpm, municipio: gpmData?.municipio || '', nivel: 'gpm', key });
  });
  return unidades;
}

// Calcula resumo da composição a partir das selectedKeys
export function calcComposicaoResumo(selectedKeys) {
  const gpms = new Set();
  const pels = new Set();
  const cias = new Set();

  selectedKeys.forEach(key => {
    if (key.startsWith('gpm::')) {
      const parts = key.split('::')[1].split('|');
      const [bpm, cia, pel, gpm] = parts;
      gpms.add(key);
      pels.add(`${bpm}|${cia}|${pel}`);
      cias.add(`${bpm}|${cia}`);
    }
  });

  return {
    cias: cias.size,
    pels: pels.size,
    gpms: gpms.size,
    total: gpms.size,
  };
}

// Converte unidades_vinculadas de volta para Set de chaves
export function unidadesToSelectedKeys(unidades) {
  const keys = new Set();
  (unidades || []).forEach(u => {
    if (u.key) keys.add(u.key);
    else if (u.nivel === 'gpm') keys.add(gpmKey(u.bpm, u.companhia, u.pelotao, u.gpm));
    else if (u.nivel === 'pelotao') keys.add(pelKey(u.bpm, u.companhia, u.pelotao));
    else if (u.nivel === 'companhia') keys.add(ciaKey(u.bpm, u.companhia));
    else if (u.nivel === 'batalhao') keys.add(bpmKey(u.bpm));
  });
  return keys;
}