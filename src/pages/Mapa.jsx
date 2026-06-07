import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, LayersControl, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getCurrentPeriodo, getPeriodoLabel, getAllPeriodos } from '@/lib/utils';
import { useAllProductions } from '@/hooks/useProduction';
import { BPMs, getCias, getPelotoes, getGPMs } from '@/lib/orgData';
import { Map, Filter, X, LocateFixed } from 'lucide-react';
import { format } from 'date-fns';

// ─── Coordenadas ──────────────────────────────────────────────────────────────
const MUNICIPIO_COORDS = {
  'Santa Cruz do Sul':   [-29.7174, -52.4260],
  'Venâncio Aires':      [-29.6097, -52.1906],
  'Candelária':          [-29.6666, -52.7813],
  'Sobradinho':          [-29.4161, -52.9830],
  'Rio Pardo':           [-29.9882, -52.3703],
  'Encruzilhada do Sul': [-30.5433, -52.5205],
  'Pantano Grande':      [-30.1883, -52.3725],
  'Vera Cruz':           [-29.7113, -52.5250],
  'Sinimbu':             [-29.5380, -52.5380],
  'Arroio do Tigre':     [-29.3364, -53.0995],
  'Ibarama':             [-29.4512, -53.0765],
  'Lagoa Bonita do Sul': [-29.3844, -52.9560],
  'Passa Sete':          [-29.4028, -53.0263],
  'Lagoão':              [-28.9180, -52.8240],
  'Tunas':               [-29.2817, -53.1741],
  'Estrela Velha':       [-29.2300, -53.1200],
  'Segredo':             [-29.3000, -53.0700],
  'Mato Leitão':         [-29.5880, -52.1200],
  'Gramado Xavier':      [-29.4200, -52.3100],
  'Boqueirão do Leão':   [-29.2760, -52.3680],
  'Vale Verde':          [-29.8167, -51.9833],
  'Passo do Sobrado':    [-29.7500, -52.0900],
  'Vale do Sol':         [-29.6600, -52.6700],
  'Herveiras':           [-29.7200, -52.6800],
};

// ─── Ícones por categoria (novos ícones oficiais) ─────────────────────────────
const CAT_ICONS = {
  'Apreensão':  'https://media.base44.com/images/public/6a0224e00e35938f780abe21/1c074c49d_apreenso.png',
  'Repressiva': 'https://media.base44.com/images/public/6a0224e00e35938f780abe21/759a8b5ad_repreenso.png',
  'Atendimento':'https://media.base44.com/images/public/6a0224e00e35938f780abe21/cf412dc74_atendimento.png',
  'Preventiva': 'https://media.base44.com/images/public/6a0224e00e35938f780abe21/bf8d0ad60_preveno.png',
  'Economia':   'https://media.base44.com/images/public/6a0224e00e35938f780abe21/17e729644_economia.png',
};

const CAT_COLORS = {
  Preventiva:  '#6ea8d8',
  Repressiva:  '#e07575',
  'Apreensão': '#e8aa55',
  Atendimento: '#5dab7a',
  Economia:    '#9d7fd4',
};

const CATEGORIAS = ['Todas', 'Preventiva', 'Repressiva', 'Apreensão', 'Atendimento', 'Economia'];

// ─── Detectores de tipo de indicador ─────────────────────────────────────────
const IS_DROGAS = (nome = '') =>
  /entorpecente|droga|narcótico|narcotico|maconha|cocaína|cocaina|crack|heroína|heroina|cannabis|skunk/i.test(nome);
const IS_AGUA  = (nome = '') => /água|agua/i.test(nome);
const IS_LUZ   = (nome = '') => /luz|energia/i.test(nome);

// ─── Formata linha de detalhe de um registro ─────────────────────────────────
function formatRegistroDetail(p) {
  const nome = p.indicator_name || '';
  const qtd = Number(p.quantidade || 0);
  const pts = Number(p.pontuacao || 0);

  if (IS_DROGAS(nome)) {
    // Drogas: extrai tipo e unidade da observação se disponível
    const unidade = p.observacao?.match(/\b(g|kg|gramas|porções|porcoes|pedras|unidades?|papelotes?)\b/i)?.[0] || 'g';
    return { detalhe: `${nome}`, qtdStr: `${qtd.toLocaleString('pt-BR')} ${unidade}`, pts };
  }

  if (p.categoria === 'Economia') {
    if (IS_AGUA(nome)) return { detalhe: nome, qtdStr: `${qtd.toLocaleString('pt-BR')} m³`, pts };
    if (IS_LUZ(nome))  return { detalhe: nome, qtdStr: `${qtd.toLocaleString('pt-BR')} kWh`, pts };
    // Outros tipos de economia: tenta ler unidade da observação
    const unidade = p.observacao?.match(/\b(maços|macos|unidades?|litros?|kg|caixas?|fardos?)\b/i)?.[0] || 'un';
    return { detalhe: nome, qtdStr: `${qtd.toLocaleString('pt-BR')} ${unidade}`, pts };
  }

  // Demais indicadores
  return { detalhe: nome, qtdStr: `${qtd.toLocaleString('pt-BR')} un`, pts };
}

// ─── Cria ícone tipo "gota" com imagem interna centralizada ──────────────────
function createMarkerIcon(cat, score, maxScore, isSelected) {
  const imgUrl = CAT_ICONS[cat] || CAT_ICONS['Preventiva'];
  const color  = CAT_COLORS[cat] || '#3b82f6';

  // Tamanho fixo 44px (uniforme), sobe até 58px conforme pontuação relativa
  const base = 44;
  const maxExtra = 14;
  const size = Math.round(base + (score / maxScore) * maxExtra);
  const dropHeight = Math.round(size * 1.32);

  // Imagem ocupa 68% do círculo, perfeitamente centralizada
  const imgSize = Math.round(size * 0.68);
  const imgOffset = Math.round((size - imgSize) / 2);

  const borderColor = isSelected ? '#ffffff' : 'rgba(255,255,255,0.9)';
  const borderWidth = isSelected ? '3px' : '2px';
  const shadow = isSelected
    ? `drop-shadow(0 0 8px ${color}99) drop-shadow(0 4px 10px rgba(0,0,0,0.45))`
    : `drop-shadow(0 2px 5px rgba(0,0,0,0.30))`;

  // Cor de fundo suave (versão clara da cor da categoria)
  const bgOpacity = '22';
  const html = `
    <div style="width:${size}px;height:${dropHeight}px;position:relative;filter:${shadow};">
      <!-- Círculo principal -->
      <div style="
        position:absolute;top:0;left:0;
        width:${size}px;height:${size}px;
        border-radius:50%;
        background:${color};
        overflow:hidden;
        border:${borderWidth} solid ${borderColor};
        box-sizing:border-box;
      ">
        <img src="${imgUrl}" style="
          position:absolute;
          top:50%;left:50%;
          transform:translate(-50%,-50%);
          width:${imgSize}px;height:${imgSize}px;
          object-fit:contain;
          object-position:center;
          mix-blend-mode:multiply;
        "/>
      </div>
      <!-- Ponta da gota -->
      <div style="
        position:absolute;bottom:0;left:50%;transform:translateX(-50%);
        width:0;height:0;
        border-left:${Math.round(size*0.26)}px solid transparent;
        border-right:${Math.round(size*0.26)}px solid transparent;
        border-top:${Math.round(dropHeight-size)}px solid ${color};
      "></div>
    </div>
  `;

  return L.divIcon({
    html,
    className: '',
    iconSize:   [size, dropHeight],
    iconAnchor: [size / 2, dropHeight],
    popupAnchor:[0, -(dropHeight + 4)],
  });
}

const MAP_CENTER = [-29.72, -52.43];
const MAP_ZOOM   = 9;

// ─── Controlador de voo no mapa + fechar popup ao clicar fora ────────────────
function MapController({ selectedMunicipio, resetView }) {
  const map = useMap();

  useEffect(() => {
    if (selectedMunicipio && MUNICIPIO_COORDS[selectedMunicipio]) {
      map.flyTo(MUNICIPIO_COORDS[selectedMunicipio], 13, { duration: 0.8 });
    }
  }, [selectedMunicipio, map]);

  useEffect(() => {
    if (resetView > 0) {
      map.closePopup();
      map.flyTo(MAP_CENTER, MAP_ZOOM, { duration: 1 });
    }
  }, [resetView, map]);

  // Fecha popup ao clicar em área vazia do mapa
  useMapEvents({
    click: () => { map.closePopup(); }
  });

  return null;
}

// ─── Popup agrupado por categoria ────────────────────────────────────────────
const CAT_ORDER = ['Preventiva', 'Repressiva', 'Apreensão', 'Atendimento', 'Economia'];
const CAT_BG = {
  Preventiva:  '#eff6ff',
  Repressiva:  '#fef2f2',
  'Apreensão': '#fff7ed',
  Atendimento: '#f0fdf4',
  Economia:    '#faf5ff',
};
const CAT_BORDER = {
  Preventiva:  '#bfdbfe',
  Repressiva:  '#fecaca',
  'Apreensão': '#fed7aa',
  Atendimento: '#bbf7d0',
  Economia:    '#e9d5ff',
};
const CAT_TITLE = {
  Preventiva:  'AÇÕES PREVENTIVAS',
  Repressiva:  'AÇÕES REPRESSIVAS',
  'Apreensão': 'APREENSÕES',
  Atendimento: 'ATENDIMENTOS',
  Economia:    'CONSUMO / ECONOMIA',
};

function MunicipioPopup({ mun, data }) {
  const topCat = Object.entries(data.cats).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Preventiva';
  const color = CAT_COLORS[topCat];

  // Agrupa registros por categoria → indicador (soma quantidades e pontuações)
  const grouped = {};
  data.registros.forEach(p => {
    const cat = p.categoria || 'Outros';
    if (!grouped[cat]) grouped[cat] = {};
    const nome = p.indicator_name || 'Sem indicador';
    if (!grouped[cat][nome]) {
      grouped[cat][nome] = { qtd: 0, pts: 0, isAgua: IS_AGUA(nome), isLuz: IS_LUZ(nome), isDrogas: IS_DROGAS(nome) };
    }
    grouped[cat][nome].qtd += Number(p.quantidade || 0);
    grouped[cat][nome].pts += Number(p.pontuacao || 0);
  });

  const catsPresentes = CAT_ORDER.filter(c => grouped[c]);

  return (
    <div style={{ fontFamily: 'system-ui,sans-serif', minWidth: 240, maxWidth: 300 }}>
      {/* Cabeçalho */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, paddingBottom:8, borderBottom:'2px solid #e5e7eb' }}>
        <img src={CAT_ICONS[topCat]} alt={topCat}
          style={{ width:34, height:34, borderRadius:'50%', objectFit:'cover', border:`2.5px solid ${color}`, flexShrink:0 }} />
        <div>
          <p style={{ fontWeight:800, fontSize:14, margin:0, lineHeight:1.2 }}>{mun}</p>
          <p style={{ fontSize:10, color:'#6b7280', margin:'2px 0 0' }}>
            {data.count} lançamento{data.count !== 1 ? 's' : ''} •{' '}
            <span style={{ color, fontWeight:700 }}>{data.pontuacao.toLocaleString('pt-BR')} pts</span>
          </p>
        </div>
      </div>

      {/* OPM */}
      <div style={{ fontSize:10, color:'#374151', marginBottom:8, padding:'4px 6px', background:'#f9fafb', borderRadius:4 }}>
        <span style={{ fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.05em' }}>OPM: </span>
        {data.opm}
      </div>

      {/* Blocos por categoria */}
      <div style={{ maxHeight:320, overflowY:'auto' }}>
        {catsPresentes.map(cat => {
          const inds = grouped[cat];
          const catTotal = Object.values(inds).reduce((s, v) => s + v.pts, 0);
          return (
            <div key={cat} style={{
              marginBottom:6,
              border:`1px solid ${CAT_BORDER[cat] || '#e5e7eb'}`,
              borderRadius:6,
              overflow:'hidden',
            }}>
              {/* Header da categoria */}
              <div style={{
                background: CAT_BORDER[cat] || '#e5e7eb',
                padding:'4px 8px',
                display:'flex', alignItems:'center', justifyContent:'space-between',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <img src={CAT_ICONS[cat]} alt={cat}
                    style={{ width:14, height:14, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
                  <span style={{ fontWeight:700, fontSize:10, color: CAT_COLORS[cat], textTransform:'uppercase', letterSpacing:'0.04em' }}>
                    {CAT_TITLE[cat] || cat}
                  </span>
                </div>
                <span style={{ fontSize:10, fontWeight:700, color: CAT_COLORS[cat] }}>
                  {catTotal.toLocaleString('pt-BR')} pts
                </span>
              </div>
              {/* Indicadores */}
              <div style={{ background: CAT_BG[cat] || '#fff', padding:'4px 8px' }}>
                {Object.entries(inds).sort((a, b) => b[1].qtd - a[1].qtd).map(([nome, vals]) => {
                  let unidade = 'un';
                  if (vals.isAgua) unidade = 'm³';
                  else if (vals.isLuz) unidade = 'kWh';
                  else if (vals.isDrogas) unidade = 'g';
                  return (
                    <div key={nome} style={{
                      display:'flex', justifyContent:'space-between', alignItems:'center',
                      padding:'2px 0', borderBottom:'1px dashed #e5e7eb',
                      fontSize:11,
                    }}>
                      <span style={{ color:'#374151', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {nome}
                      </span>
                      <span style={{ fontWeight:700, color:'#111', flexShrink:0, marginLeft:6 }}>
                        {vals.qtd.toLocaleString('pt-BR')} {unidade}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Total geral */}
      <div style={{
        marginTop:6, paddingTop:6, borderTop:'2px solid #e5e7eb',
        display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:800,
      }}>
        <span>PONTUAÇÃO TOTAL</span>
        <span style={{ color:'#166534' }}>{data.pontuacao.toLocaleString('pt-BR')} pts</span>
      </div>
    </div>
  );
}

// ─── Offsets para separar ícones de mesma localização (por categoria) ────────
// Distribui os ícones em círculo bem pequeno ao redor do ponto central
function getCategoryOffset(catIndex, totalCats) {
  if (totalCats === 1) return [0, 0];
  // Raio pequeno fixo em pixels (convertido depois em graus)
  const radius = 28;
  const angle = (2 * Math.PI * catIndex) / totalCats - Math.PI / 2;
  return [Math.round(Math.sin(angle) * radius), Math.round(-Math.cos(angle) * radius)];
}

// ─── Popup de categoria específica ────────────────────────────────────────────
function CategoriaPopup({ mun, cat, registros, opm }) {
  const color = CAT_COLORS[cat] || '#3b82f6';

  // Agrupa por indicador
  const inds = {};
  registros.forEach(p => {
    const nome = p.indicator_name || 'Sem indicador';
    if (!inds[nome]) {
      inds[nome] = { qtd: 0, pts: 0, isAgua: IS_AGUA(nome), isLuz: IS_LUZ(nome), isDrogas: IS_DROGAS(nome) };
    }
    inds[nome].qtd += Number(p.quantidade || 0);
    inds[nome].pts += Number(p.pontuacao || 0);
  });

  const catTotal = Object.values(inds).reduce((s, v) => s + v.pts, 0);
  const catCount = registros.length;

  return (
    <div style={{ fontFamily: 'system-ui,sans-serif', minWidth: 220, maxWidth: 280 }}>
      {/* Cabeçalho */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, paddingBottom:8, borderBottom:`2px solid ${CAT_BORDER[cat] || '#e5e7eb'}` }}>
        <img src={CAT_ICONS[cat]} alt={cat}
          style={{ width:32, height:32, borderRadius:'50%', objectFit:'cover', border:`2.5px solid ${color}`, flexShrink:0 }} />
        <div>
          <p style={{ fontWeight:800, fontSize:13, margin:0, lineHeight:1.2 }}>{mun}</p>
          <p style={{ fontSize:10, color: color, fontWeight:700, margin:'2px 0 0' }}>{CAT_TITLE[cat] || cat}</p>
          <p style={{ fontSize:10, color:'#6b7280', margin:'1px 0 0' }}>
            {catCount} lançamento{catCount !== 1 ? 's' : ''} •{' '}
            <span style={{ color, fontWeight:700 }}>{catTotal.toLocaleString('pt-BR')} pts</span>
          </p>
        </div>
      </div>

      {/* OPM */}
      <div style={{ fontSize:10, color:'#374151', marginBottom:8, padding:'4px 6px', background:'#f9fafb', borderRadius:4 }}>
        <span style={{ fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.05em' }}>OPM: </span>
        {opm}
      </div>

      {/* Bloco da categoria */}
      <div style={{ border:`1px solid ${CAT_BORDER[cat] || '#e5e7eb'}`, borderRadius:6, overflow:'hidden' }}>
        <div style={{ background: CAT_BORDER[cat] || '#e5e7eb', padding:'4px 8px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
            <img src={CAT_ICONS[cat]} alt={cat} style={{ width:13, height:13, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
            <span style={{ fontWeight:700, fontSize:10, color, textTransform:'uppercase', letterSpacing:'0.04em' }}>
              {CAT_TITLE[cat] || cat}
            </span>
          </div>
          <span style={{ fontSize:10, fontWeight:700, color }}>{catTotal.toLocaleString('pt-BR')} pts</span>
        </div>
        <div style={{ background: CAT_BG[cat] || '#fff', padding:'4px 8px', maxHeight:260, overflowY:'auto' }}>
          {Object.entries(inds).sort((a, b) => b[1].qtd - a[1].qtd).map(([nome, vals]) => {
            let unidade = 'un';
            if (vals.isAgua) unidade = 'm³';
            else if (vals.isLuz) unidade = 'kWh';
            else if (vals.isDrogas) unidade = 'g';
            return (
              <div key={nome} style={{
                display:'flex', justifyContent:'space-between', alignItems:'center',
                padding:'3px 0', borderBottom:'1px dashed #e5e7eb', fontSize:11,
              }}>
                <span style={{ color:'#374151', maxWidth:155, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {nome}
                </span>
                <span style={{ fontWeight:700, color:'#111', flexShrink:0, marginLeft:6 }}>
                  {vals.qtd.toLocaleString('pt-BR')} {unidade}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Total */}
      <div style={{ marginTop:6, paddingTop:6, borderTop:'2px solid #e5e7eb', display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:800 }}>
        <span>TOTAL</span>
        <span style={{ color }}>{catTotal.toLocaleString('pt-BR')} pts</span>
      </div>
    </div>
  );
}

// ─── Conteúdo do mapa (desmontado ao sair da rota) ───────────────────────────
function MapaContent({ allProductions }) {
  const [periodo, setPeriodo]               = useState(getCurrentPeriodo());
  const [bpmFilter, setBpmFilter]           = useState('');
  const [ciaFilter, setCiaFilter]           = useState('');
  const [pelFilter, setPelFilter]           = useState('');
  const [gpmFilter, setGpmFilter]           = useState('');
  const [catFilter, setCatFilter]           = useState('Todas');
  const [selectedMunicipio, setSelectedMunicipio] = useState(null);
  const [resetView, setResetView] = useState(0);
  const markerRefs = useRef({});

  const filtered = useMemo(() => allProductions.filter(p => {
    if (periodo && p.periodo !== periodo) return false;
    if (bpmFilter && p.bpm !== bpmFilter) return false;
    if (ciaFilter && p.companhia !== ciaFilter) return false;
    if (pelFilter && p.pelotao !== pelFilter) return false;
    if (gpmFilter && p.gpm !== gpmFilter) return false;
    if (catFilter !== 'Todas' && p.categoria !== catFilter) return false;
    return true;
  }), [allProductions, periodo, bpmFilter, ciaFilter, pelFilter, gpmFilter, catFilter]);

  // Agrupa por município → por categoria
  const municipioData = useMemo(() => {
    const acc = {};
    filtered.forEach(p => {
      const mun = p.municipio;
      if (!mun || !MUNICIPIO_COORDS[mun]) return;
      if (!acc[mun]) {
        acc[mun] = {
          pontuacao: 0,
          count: 0,
          opm: [p.bpm, p.companhia, p.pelotao, p.gpm].filter(Boolean).join(' / '),
          porCategoria: {}, // cat → { pontuacao, count, registros[] }
        };
      }
      acc[mun].pontuacao += (p.pontuacao || 0);
      acc[mun].count     += 1;
      const cat = p.categoria || 'Outros';
      if (!acc[mun].porCategoria[cat]) {
        acc[mun].porCategoria[cat] = { pontuacao: 0, count: 0, registros: [] };
      }
      acc[mun].porCategoria[cat].pontuacao += (p.pontuacao || 0);
      acc[mun].porCategoria[cat].count     += 1;
      acc[mun].porCategoria[cat].registros.push(p);
    });
    return acc;
  }, [filtered]);

  // Pontuação máxima por categoria (para escalar ícones)
  const maxCatScore = useMemo(() => {
    let max = 1;
    Object.values(municipioData).forEach(d => {
      Object.values(d.porCategoria).forEach(c => { if (c.pontuacao > max) max = c.pontuacao; });
    });
    return max;
  }, [municipioData]);

  const maxScore = Math.max(...Object.values(municipioData).map(d => d.pontuacao), 1);
  const totalPontos = filtered.reduce((s, p) => s + (p.pontuacao || 0), 0);
  const hasFilters = bpmFilter || ciaFilter || pelFilter || gpmFilter || catFilter !== 'Todas';

  const cias     = getCias(bpmFilter);
  const pelotoes = getPelotoes(bpmFilter, ciaFilter);
  const gpms     = getGPMs(bpmFilter, ciaFilter, pelFilter);

  const clearFilters = () => {
    setBpmFilter(''); setCiaFilter(''); setPelFilter(''); setGpmFilter('');
    setCatFilter('Todas'); setSelectedMunicipio(null);
  };

  const handleResetView = () => {
    setSelectedMunicipio(null);
    setResetView(v => v + 1);
  };

  return (
    <div className="space-y-4">
      {/* Título */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Map className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Mapa de Produtividade</h1>
        </div>
        <Badge variant="secondary" className="text-xs w-fit">
          {filtered.length} registros • {totalPontos.toLocaleString('pt-BR')} pts
        </Badge>
      </div>

      {/* Filtros */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Filtros</span>
          </div>
          {(hasFilters || selectedMunicipio) && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-destructive text-xs h-7">
              <X className="w-3.5 h-3.5" /> Limpar
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Select value={periodo} onValueChange={v => setPeriodo(v || getCurrentPeriodo())}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Período" /></SelectTrigger>
            <SelectContent style={{ zIndex: 9999 }} position="popper">
              {getAllPeriodos().map(p => <SelectItem key={p} value={p}>{getPeriodoLabel(p)}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={bpmFilter} onValueChange={v => { setBpmFilter(v === '__all__' ? '' : v); setCiaFilter(''); setPelFilter(''); setGpmFilter(''); }}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="BTL" /></SelectTrigger>
            <SelectContent style={{ zIndex: 9999 }} position="popper">
              <SelectItem value="__all__">Todos BTLs</SelectItem>
              {BPMs.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={ciaFilter} onValueChange={v => { setCiaFilter(v === '__all__' ? '' : v); setPelFilter(''); setGpmFilter(''); }} disabled={!bpmFilter}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Cia" /></SelectTrigger>
            <SelectContent style={{ zIndex: 9999 }} position="popper">
              <SelectItem value="__all__">Todas Cias</SelectItem>
              {cias.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={pelFilter} onValueChange={v => { setPelFilter(v === '__all__' ? '' : v); setGpmFilter(''); }} disabled={!ciaFilter}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pelotão" /></SelectTrigger>
            <SelectContent style={{ zIndex: 9999 }} position="popper">
              <SelectItem value="__all__">Todos Pels</SelectItem>
              {pelotoes.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={gpmFilter} onValueChange={v => setGpmFilter(v === '__all__' ? '' : v)} disabled={!pelFilter}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="GPM" /></SelectTrigger>
            <SelectContent style={{ zIndex: 9999 }} position="popper">
              <SelectItem value="__all__">Todos GPMs</SelectItem>
              {gpms.map(g => <SelectItem key={g.nome} value={g.nome}>{g.nome}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent style={{ zIndex: 9999 }} position="popper">
              {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Legenda */}
        <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-border">
          {Object.entries(CAT_ICONS).map(([cat, url]) => (
            <div key={cat} className="flex items-center gap-1.5 text-xs">
              <img src={url} alt={cat} className="w-5 h-5 rounded-full object-cover border border-border flex-shrink-0" />
              <span>{cat}</span>
            </div>
          ))}
          <span className="text-xs text-muted-foreground ml-auto">Um ícone por categoria • tamanho proporcional à pontuação</span>
        </div>

        {/* Zoom por município */}
        {Object.keys(municipioData).length > 0 && (
          <div className="mt-3 pt-3 border-t border-border">
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-muted-foreground self-center">Zoom em:</span>
              {Object.keys(municipioData).sort().map(mun => (
                <button
                  key={mun}
                  onClick={() => setSelectedMunicipio(mun === selectedMunicipio ? null : mun)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    selectedMunicipio === mun
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:border-primary/50 bg-background'
                  }`}
                >
                  {mun}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Mapa */}
      <div className="rounded-xl border border-border overflow-hidden relative" style={{ height: 520 }}>
        {/* Botão Centralizar — sobreposto ao mapa */}
        <button
          onClick={handleResetView}
          className="absolute top-3 left-3 z-[1000] flex items-center gap-1.5 bg-white/95 hover:bg-white border border-border shadow-md rounded-lg px-3 py-1.5 text-xs font-semibold text-foreground transition-colors"
          title="Voltar ao mapa inicial"
        >
          <LocateFixed className="w-3.5 h-3.5 text-primary" />
          Centralizar
        </button>
        <MapContainer
          center={MAP_CENTER}
          zoom={MAP_ZOOM}
          style={{ height: '100%', width: '100%' }}
          zoomControl
        >
          <MapController selectedMunicipio={selectedMunicipio} resetView={resetView} />

          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Padrão">
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                attribution='&copy; CARTO &copy; OSM'
                maxZoom={19}
                crossOrigin="anonymous"
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Claro">
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; CARTO'
                maxZoom={19}
                crossOrigin="anonymous"
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Escuro">
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; CARTO'
                maxZoom={19}
                crossOrigin="anonymous"
              />
            </LayersControl.BaseLayer>
          </LayersControl>

          {Object.entries(municipioData).flatMap(([mun, data]) => {
            const coords = MUNICIPIO_COORDS[mun];
            if (!coords) return [];

            // Ordena categorias pela ordem canônica
            const catsPresentes = CAT_ORDER.filter(c => data.porCategoria[c]);
            const totalCats = catsPresentes.length;

            return catsPresentes.map((cat, catIdx) => {
              const catData = data.porCategoria[cat];
              const isSelected = selectedMunicipio === mun;
              const icon = createMarkerIcon(cat, catData.pontuacao, maxCatScore, isSelected);
              const markerKey = `${mun}__${cat}`;

              // Offset pequeno: raio ~28px no zoom 9 ≈ ~0.0008° lat / 0.0010° lng
              // Mantém ícones agrupados próximos ao centro sem se sobrepor
              const [dx, dy] = getCategoryOffset(catIdx, totalCats);
              const latOff = -dy * 0.0008;
              const lngOff =  dx * 0.0010;

              const pos = [coords[0] + latOff, coords[1] + lngOff];

              return (
                <Marker
                  key={markerKey}
                  position={pos}
                  icon={icon}
                  ref={el => { if (el) markerRefs.current[markerKey] = el; }}
                  eventHandlers={{
                    click: () => {
                      setSelectedMunicipio(mun);
                      setTimeout(() => {
                        markerRefs.current[markerKey]?.openPopup();
                      }, 900);
                    }
                  }}
                >
                  <Popup minWidth={220} maxWidth={280}>
                    <CategoriaPopup mun={mun} cat={cat} registros={catData.registros} opm={data.opm} />
                  </Popup>
                </Marker>
              );
            });
          })}
        </MapContainer>
      </div>
    </div>
  );
}

// ─── Wrapper principal — desmonta o mapa instantaneamente ao sair da rota ────
export default function Mapa() {
  const location = useLocation();
  const { data: allProductions = [] } = useAllProductions();
  const isActive = location.pathname === '/mapa';

  // Quando não estamos na rota /mapa, renderiza null imediatamente
  // Isso desmonta o MapContainer e libera todos os recursos do Leaflet
  if (!isActive) return null;

  return <MapaContent key="mapa-content" allProductions={allProductions} />;
}
