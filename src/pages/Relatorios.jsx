import React, { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { getCurrentPeriodo, getPeriodoLabel, getAllPeriodos, formatNumber } from '@/lib/utils';
import { useProductionsHistorico, useIndicators } from '@/hooks/useProduction';
import { BPMs, getCias, getPelotoes, getGPMs, MUNICIPIOS } from '@/lib/orgData';
import { FileText, Download, Printer, FileSpreadsheet, Loader2, ExternalLink, X, BarChart3, List, TrendingUp, TrendingDown, Settings2, ChevronDown, ChevronUp, SlidersHorizontal, Layers, Trophy, Droplets, Lightbulb, ArrowDownUp, ArrowUpDown } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import ColunasPanel, { COLUNAS_DISPONIVEIS, COLUNAS_DEFAULT } from '@/components/relatorios/ColunasPanel';
import { exportXlsx } from '@/lib/exportXlsx';
import { useOrganizations, computeRankings, computeMunicipalRanking, computeComposicaoRanking } from '@/hooks/useProduction';
import { useRankingConfig } from '@/hooks/useRankingConfig';
import ImprimirRankingDialog from '@/components/ranking/ImprimirRankingDialog';

const CATEGORIAS = ['Todas', 'Preventiva', 'Repressiva', 'Apreensão', 'Atendimento', 'Economia'];

const catColors = {
  Preventiva: 'bg-blue-100 text-blue-800',
  Repressiva: 'bg-red-100 text-red-800',
  'Apreensão': 'bg-orange-100 text-orange-800',
  Atendimento: 'bg-green-100 text-green-800',
  Economia: 'bg-purple-100 text-purple-800',
};

// COLUNAS_DISPONIVEIS e COLUNAS_DEFAULT importados de ColunasPanel

// Extrai a unidade de medida do indicador com base no nome
function getUnidadeMedida(p) {
  const cat = p.categoria || '';
  const nome = (p.indicator_name || '').toLowerCase();
  if (cat === 'Economia') {
    if (nome.includes('água') || nome.includes('agua')) return 'm³';
    if (nome.includes('luz') || nome.includes('energia') || nome.includes('elétrica')) return 'kWh';
    return 'un.';
  }
  if (nome.includes('entorpecente') || nome.includes('droga') || nome.includes('narcótico')) return 'g';
  if (nome.includes('arma') || nome.includes('munição') || nome.includes('municao')) return 'un.';
  if (nome.includes('kg') || nome.includes('quilo')) return 'kg';
  if (nome.includes('veículo') || nome.includes('veiculo') || nome.includes('carro') || nome.includes('moto')) return 'un.';
  if (nome.includes('pessoa') || nome.includes('indivíduo') || nome.includes('individuo') || nome.includes('preso') || nome.includes('detido')) return 'pess.';
  return 'un.';
}

// Remove município embutido no organization_name (formato legado: "GPM — município")
function limparNomeUnidade(nome) {
  if (!nome) return '-';
  return nome.replace(/\s*—\s*.+$/, '').trim();
}

// Mesma lógica do Histórico: extrai varA (2atrás→anterior) e varB (anterior→atual)
function extrairVariacaoEconomia(p) {
  if (p.categoria !== 'Economia') return null;
  const nome = (p.indicator_name || '').toLowerCase();
  const isAgua = nome.includes('água') || nome.includes('agua');
  const isLuz  = nome.includes('luz') || nome.includes('energia');
  if (!isAgua && !isLuz) return null;
  const unidade = isAgua ? 'm³' : 'kWh';
  const obs = p.observacao || '';
  const antMatch      = obs.match(/Ant[^:]*:\s*([\d.,]+)\s*(?:m³|kWh)/i);
  const atualMatch    = obs.match(/Atual[^:]*:\s*([\d.,]+)\s*(?:m³|kWh)/i);
  const doisAtrasMatch = obs.match(/([\d.,]+)\s*(?:m³|kWh)\s*\|\s*Ant/i);
  const ant      = antMatch      ? parseFloat(antMatch[1].replace(',','.'))      : null;
  const atual    = atualMatch    ? parseFloat(atualMatch[1].replace(',','.'))    : null;
  const doisAtras = doisAtrasMatch ? parseFloat(doisAtrasMatch[1].replace(',','.')) : null;
  const varB = ant != null && atual != null ? atual - ant : null;
  const varA = doisAtras != null && ant != null ? ant - doisAtras : null;
  const delta = varB !== null && varA !== null ? varB - varA : varB;
  if (varB === null) return null;
  return { varA, varB, delta, unidade, ant, atual, doisAtras };
}

const IS_AGUA_REL = (nome) => (nome || '').toLowerCase().includes('água') || (nome || '').toLowerCase().includes('agua');
const IS_LUZ_REL  = (nome) => (nome || '').toLowerCase().includes('luz') || (nome || '').toLowerCase().includes('energia');

// Remove município duplicado do nome da unidade
function limparOrgName(nome) {
  if (!nome) return '-';
  return nome.replace(/\s*—\s*.+$/, '').trim();
}

// Agrupa por organização + mês para o relatório de evolução
function buildEvolucaoData(productions) {
  const econRegistros = productions.filter(p => p.categoria === 'Economia' && p.observacao);
  const byOrg = {};
  econRegistros.forEach(p => {
    const org = limparOrgName(p.organization_name) || p.bpm || 'Sem unidade';
    const mes = p.data ? p.data.substring(0, 7) : 'sem-data';
    const municipio = p.municipio || '';
    const key = `${org}|||${mes}`;
    if (!byOrg[key]) byOrg[key] = { org, mes, municipio, registros: [] };
    byOrg[key].registros.push(p);
  });
  return Object.values(byOrg).sort((a, b) => a.org.localeCompare(b.org) || a.mes.localeCompare(b.mes));
}

export default function Relatorios() {
  const { user } = useOutletContext();
  const { data: organizations } = useOrganizations();
  const { modeloAtivo, composicoes } = useRankingConfig();

  // Período
  const [useDateRange, setUseDateRange] = useState(false);
  const [periodo, setPeriodo] = useState(getCurrentPeriodo());
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  // Filtros de unidade
  const [bpmFilter, setBpmFilter] = useState('');
  const [ciaFilter, setCiaFilter] = useState('');
  const [pelFilter, setPelFilter] = useState('');
  const [gpmFilter, setGpmFilter] = useState('');

  // Filtros de conteúdo
  const [catFilter, setCatFilter] = useState('Todas');
  const [indicadorFilter, setIndicadorFilter] = useState('');
  const [municipioFilter, setMunicipioFilter] = useState('');

  // Tipo de relatório e ordenação
  const [tipoRelatorio, setTipoRelatorio] = useState('detalhado');
  const [ordenacao, setOrdenacao] = useState('data');
  const [sortDesc, setSortDesc] = useState(true); // true = decrescente (mais recente primeiro)
  const [exporting, setExporting] = useState('');

  // Colunas selecionadas (modo detalhado)
  const [colunasAtivas, setColunasAtivas] = useState(new Set(COLUNAS_DEFAULT));
  const [showColSelector, setShowColSelector] = useState(false);

  // Filtros colapsáveis (fechado por padrão em mobile)
  const [filtrosAbertos, setFiltrosAbertos] = useState(window.innerWidth >= 1024);

  const { data: allProductions = [] } = useProductionsHistorico({ periodo, useDateRange, dataInicio, dataFim });
  const { data: indicators } = useIndicators();

  const cias = getCias(bpmFilter);
  const pelotoes = getPelotoes(bpmFilter, ciaFilter);
  const gpms = getGPMs(bpmFilter, ciaFilter, pelFilter);

  const filtered = useMemo(() => {
    return allProductions.filter(p => {
      if (useDateRange) {
        if (dataInicio && p.data && p.data < dataInicio) return false;
        if (dataFim && p.data && p.data > dataFim) return false;
      } else {
        if (periodo && p.periodo !== periodo) return false;
      }
      if (bpmFilter && p.bpm !== bpmFilter) return false;
      if (ciaFilter && p.companhia !== ciaFilter) return false;
      if (pelFilter && p.pelotao !== pelFilter) return false;
      if (gpmFilter && p.gpm !== gpmFilter) return false;
      if (catFilter !== 'Todas' && p.categoria !== catFilter) return false;
      if (indicadorFilter && p.indicator_id !== indicadorFilter) return false;
      if (municipioFilter && p.municipio !== municipioFilter) return false;
      return true;
    });
  }, [allProductions, periodo, useDateRange, dataInicio, dataFim, bpmFilter, ciaFilter, pelFilter, gpmFilter, catFilter, indicadorFilter, municipioFilter]);

  const sortedFiltered = useMemo(() => {
    const arr = [...filtered];
    if (ordenacao === 'alfabetica') arr.sort((a, b) => (a.organization_name || '').localeCompare(b.organization_name || ''));
    else if (ordenacao === 'quantidade') {
      arr.sort((a, b) => sortDesc ? (b.quantidade || 0) - (a.quantidade || 0) : (a.quantidade || 0) - (b.quantidade || 0));
    } else {
      // Por data — respeita sortDesc
      arr.sort((a, b) => sortDesc
        ? (b.data || '').localeCompare(a.data || '') || new Date(b.created_date || 0) - new Date(a.created_date || 0)
        : (a.data || '').localeCompare(b.data || '') || new Date(a.created_date || 0) - new Date(b.created_date || 0)
      );
    }
    return arr;
  }, [filtered, ordenacao, sortDesc]);

  const totalPontos = filtered.reduce((s, p) => s + (p.pontuacao || 0), 0);
  const totalQtd = filtered.reduce((s, p) => s + (p.quantidade || 0), 0);

  const porCategoria = useMemo(() => {
    const acc = {};
    filtered.forEach(p => {
      const cat = p.categoria || 'Outros';
      if (!acc[cat]) acc[cat] = { qtd: 0, pts: 0 };
      acc[cat].qtd += (p.quantidade || 0);
      acc[cat].pts += (p.pontuacao || 0);
    });
    return Object.entries(acc).sort((a, b) => ordenacao === 'alfabetica' ? a[0].localeCompare(b[0]) : b[1].qtd - a[1].qtd);
  }, [filtered, ordenacao]);

  const porIndicador = useMemo(() => {
    const acc = {};
    filtered.forEach(p => {
      const ind = p.indicator_name || 'Sem indicador';
      const cat = p.categoria || '';
      const unidade = getUnidadeMedida(p);
      if (!acc[ind]) acc[ind] = { qtd: 0, pts: 0, cat, unidade };
      acc[ind].qtd += (p.quantidade || 0);
      acc[ind].pts += (p.pontuacao || 0);
    });
    return Object.entries(acc).sort((a, b) => ordenacao === 'alfabetica' ? a[0].localeCompare(b[0]) : b[1].qtd - a[1].qtd);
  }, [filtered, ordenacao]);

  const evolucaoData = useMemo(() => buildEvolucaoData(filtered), [filtered]);

  const clearFilters = () => {
    setPeriodo(getCurrentPeriodo());
    setDataInicio(''); setDataFim('');
    setBpmFilter(''); setCiaFilter(''); setPelFilter(''); setGpmFilter('');
    setCatFilter('Todas'); setIndicadorFilter(''); setMunicipioFilter('');
    setUseDateRange(false);
  };

  const hasActiveFilters = (useDateRange ? (dataInicio || dataFim) : false) || bpmFilter || ciaFilter || pelFilter || gpmFilter || catFilter !== 'Todas' || indicadorFilter || municipioFilter;
  const periodoLabel = useDateRange ? `${dataInicio || '?'} a ${dataFim || '?'}` : (getPeriodoLabel(periodo) || 'Todos');
  const indicadoresAtivos = indicators.filter(i => i.status !== 'inativo');

  const [showRankingDialog, setShowRankingDialog] = useState(false);

  // Toggle coluna
  const toggleColuna = (key) => {
    setColunasAtivas(prev => {
      const next = new Set(prev);
      if (next.has(key)) { if (next.size > 1) next.delete(key); }
      else next.add(key);
      return next;
    });
  };

  // Renderiza célula por chave de coluna
  const renderCell = (p, key) => {
    switch (key) {
      case 'data': return <td key={key} className="px-3 py-2 text-muted-foreground whitespace-nowrap">{p.data ? format(new Date(p.data + 'T00:00:00'), 'dd/MM/yy') : '-'}</td>;
      case 'bpm': return <td key={key} className="px-3 py-2 whitespace-nowrap">{p.bpm || '-'}</td>;
      case 'companhia': return <td key={key} className="px-3 py-2 whitespace-nowrap">{p.companhia || '-'}</td>;
      case 'pelotao': return <td key={key} className="px-3 py-2 whitespace-nowrap">{p.pelotao || '-'}</td>;
      case 'gpm': return <td key={key} className="px-3 py-2 whitespace-nowrap">{p.gpm || '-'}</td>;
      case 'organization_name': return <td key={key} className="px-3 py-2 font-medium whitespace-nowrap">{limparNomeUnidade(p.organization_name)}</td>;
      case 'municipio': return <td key={key} className="px-3 py-2 text-muted-foreground whitespace-nowrap">{p.municipio || '-'}</td>;
      case 'indicator_name': return <td key={key} className="px-3 py-2">{p.indicator_name || '-'}</td>;
      case 'categoria': return <td key={key} className="px-3 py-2"><Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${catColors[p.categoria] || ''}`}>{p.categoria || '-'}</Badge></td>;
      case 'quantidade': return <td key={key} className="px-3 py-2 text-right font-bold">{formatNumber(p.quantidade)}</td>;
      case 'unidade_medida': return <td key={key} className="px-3 py-2 text-center text-muted-foreground text-xs">{getUnidadeMedida(p)}</td>;
      case 'pontuacao': return <td key={key} className="px-3 py-2 text-right font-bold text-primary">{formatNumber(p.pontuacao)}</td>;
      case 'observacao': return <td key={key} className="px-3 py-2 text-xs text-muted-foreground max-w-[200px] truncate" title={p.observacao || ''}>{p.observacao || '-'}</td>;
      case 'anexo': return <td key={key} className="px-3 py-2 text-center">{p.anexo_url ? <a href={p.anexo_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline text-[10px] font-medium"><ExternalLink className="w-3 h-3" /> Abrir</a> : <span className="text-muted-foreground">—</span>}</td>;
      default: return <td key={key} className="px-3 py-2">-</td>;
    }
  };

  const colunasOrdenadas = COLUNAS_DISPONIVEIS.filter(c => colunasAtivas.has(c.key));

  // Gera dados tabulares conforme tipo de relatório (usado por CSV e PDF/Print)
  const buildReportData = () => {
    const geradoPor = user?.full_name || user?.email || 'Sistema';
    const now = format(new Date(), 'dd/MM/yyyy HH:mm');
    const meta = { geradoPor, now, periodoLabel, totalRegistros: filtered.length, totalQtd, totalPontos };

    let headers = [], rows = [], titulo = '';

    if (tipoRelatorio === 'por_categoria') {
      titulo = 'Relatório por Categoria';
      headers = ['Categoria', 'Quantidade Total', 'Pontuação Total'];
      rows = porCategoria.map(([cat, d]) => [cat, d.qtd, d.pts]);
      rows.push(['TOTAL GERAL', totalQtd, totalPontos]);
    } else if (tipoRelatorio === 'por_indicador') {
      titulo = 'Relatório por Indicador';
      headers = ['Indicador', 'Categoria', 'Unidade de Medida', 'Quantidade Total', 'Pontuação Total'];
      rows = porIndicador.map(([ind, d]) => [ind, d.cat, d.unidade, d.qtd, d.pts]);
      rows.push(['TOTAL GERAL', '', '', totalQtd, totalPontos]);
    } else if (tipoRelatorio === 'evolucao_economia') {
      titulo = 'Relatório de Evolução de Economia (Água e Luz)';
      headers = ['Unidade Operacional', 'Mês/Ano', 'Indicador', 'Unid.', '2 Meses Atrás', 'Mês Anterior', 'Mês Atual', 'Var A (ant-2ant)', 'Var B (atual-ant)', 'Delta (B-A)', 'Tendência', 'Pontos'];
      rows = evolucaoData.flatMap(e => e.registros.map(r => {
        const v = extrairVariacaoEconomia(r);
        const tendencia = v ? (v.delta < 0 ? 'Diminuiu ↓' : v.delta > 0 ? 'Aumentou ↑' : 'Manteve') : '-';
        return [
          e.org, e.mes, r.indicator_name || '-',
          v ? v.unidade : '-',
          v && v.doisAtras != null ? v.doisAtras : '-',
          v && v.ant != null ? v.ant : '-',
          v && v.atual != null ? v.atual : '-',
          v && v.varA != null ? `${v.varA >= 0 ? '+' : ''}${v.varA.toFixed(1)}` : '-',
          v && v.varB != null ? `${v.varB >= 0 ? '+' : ''}${v.varB.toFixed(1)}` : '-',
          v && v.delta != null ? `${v.delta >= 0 ? '+' : ''}${v.delta.toFixed(1)}` : '-',
          tendencia, r.pontuacao ?? 0,
        ];
      }));
    } else {
      titulo = 'Relatório Detalhado de Produtividade';
      const cols = colunasOrdenadas.filter(c => c.key !== 'anexo');
      headers = cols.map(c => c.label);
      rows = sortedFiltered.map(p => cols.map(c => {
        if (c.key === 'data') return p.data ? format(new Date(p.data + 'T00:00:00'), 'dd/MM/yyyy') : '';
        if (c.key === 'unidade_medida') return getUnidadeMedida(p);
        return p[c.key] ?? '';
      }));
      rows.push(cols.map((c, i) => i === 0 ? 'TOTAL GERAL' : c.key === 'quantidade' ? totalQtd : c.key === 'pontuacao' ? totalPontos : ''));
    }

    return { meta, headers, rows, titulo };
  };

  const exportExcel = () => {
    setExporting('xlsx');
    const { meta, headers, rows, titulo } = buildReportData();
    const filename = `SISPROD_${tipoRelatorio}_${meta.periodoLabel.replace(/[\s\/\-]/g, '_')}_${format(new Date(), 'yyyyMMdd_HHmm')}`;
    exportXlsx({
      titulo,
      periodoLabel: meta.periodoLabel,
      geradoPor: meta.geradoPor,
      now: meta.now,
      totalRegistros: meta.totalRegistros,
      totalQtd: meta.totalQtd,
      totalPontos: meta.totalPontos,
      headers,
      rows,
      filename,
      hasTotalRow: tipoRelatorio !== 'evolucao_economia',
    });
    setExporting('');
    toast.success('Planilha Excel exportada com sucesso!');
  };

  const buildPrintHTML = (forPrint = false) => {
    const { meta, headers, rows, titulo } = buildReportData();

    const thCells = headers.map(h => `<th>${h}</th>`).join('');
    const trRows = rows.map((row, ri) => {
      const isTotal = ri === rows.length - 1 && tipoRelatorio !== 'evolucao_economia';
      const cls = isTotal ? 'total-row' : ri % 2 === 0 ? '' : 'odd';
      return `<tr class="${cls}">${row.map(cell => `<td>${String(cell ?? '')}</td>`).join('')}</tr>`;
    }).join('');

    const filtrosAtivos = [
      bpmFilter && `BTL: ${bpmFilter}`,
      ciaFilter && `Cia: ${ciaFilter}`,
      pelFilter && `Pel: ${pelFilter}`,
      gpmFilter && `GPM: ${gpmFilter}`,
      catFilter !== 'Todas' && `Categoria: ${catFilter}`,
    ].filter(Boolean).join(' | ');

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <title>SISPROD BM — ${titulo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Arial', sans-serif; font-size: 9pt; color: #1a1a1a; background: #fff; padding: 10mm; }

    /* CABEÇALHO INSTITUCIONAL */
    .header { display: flex; align-items: center; border-bottom: 3px solid #1e5631; padding-bottom: 8px; margin-bottom: 10px; }
    .header-logo { width: 52px; height: 52px; background: #1e5631; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-right: 12px; }
    .header-logo span { color: white; font-weight: 900; font-size: 14pt; letter-spacing: -1px; }
    .header-text h1 { font-size: 12pt; font-weight: 900; color: #1e5631; letter-spacing: 0.5px; text-transform: uppercase; }
    .header-text h2 { font-size: 9pt; font-weight: 600; color: #333; margin-top: 1px; }
    .header-text p  { font-size: 8pt; color: #666; margin-top: 1px; }

    /* BLOCO DE METADADOS */
    .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; background: #f0f4f0; border: 1px solid #c8dac8; border-radius: 6px; padding: 8px 10px; margin-bottom: 10px; }
    .meta-item label { font-size: 7pt; font-weight: 700; text-transform: uppercase; color: #1e5631; display: block; }
    .meta-item span  { font-size: 9pt; font-weight: 600; color: #1a1a1a; }

    /* FILTROS */
    .filtros { font-size: 7.5pt; color: #555; margin-bottom: 8px; }
    .filtros strong { color: #1e5631; }

    /* TABELA */
    table { width: 100%; border-collapse: collapse; margin-top: 4px; page-break-inside: auto; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
    th {
      background: #1e5631;
      color: #ffffff;
      padding: 5px 6px;
      text-align: left;
      font-size: 8pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      white-space: nowrap;
    }
    td { padding: 4px 6px; font-size: 8.5pt; border-bottom: 1px solid #e0e8e0; vertical-align: middle; }
    tr.odd td { background: #f7faf7; }
    tr.total-row td { background: #d4e8d4; font-weight: 700; font-size: 9pt; border-top: 2px solid #1e5631; }

    /* RODAPÉ */
    .footer { margin-top: 12px; padding-top: 8px; border-top: 1px solid #c8dac8; display: flex; justify-content: space-between; font-size: 7pt; color: #888; }

    @media print {
      @page { size: A4 landscape; margin: 8mm 10mm; }
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-logo"><span>BM</span></div>
    <div class="header-text">
      <h1>Brigada Militar — Rio Grande do Sul</h1>
      <h2>Sistema de Produtividade Operacional — SISPROD BM</h2>
      <p>${titulo}</p>
    </div>
  </div>

  <div class="meta">
    <div class="meta-item">
      <label>Período de Referência</label>
      <span>${meta.periodoLabel}</span>
    </div>
    <div class="meta-item">
      <label>Total de Registros</label>
      <span>${meta.totalRegistros.toLocaleString('pt-BR')}</span>
    </div>
    <div class="meta-item">
      <label>Quantidade Total</label>
      <span>${Number(meta.totalQtd).toLocaleString('pt-BR')}</span>
    </div>
    <div class="meta-item">
      <label>Pontuação Total</label>
      <span>${Number(meta.totalPontos).toLocaleString('pt-BR')} pts</span>
    </div>
    <div class="meta-item">
      <label>Gerado em</label>
      <span>${meta.now}</span>
    </div>
    <div class="meta-item">
      <label>Responsável</label>
      <span>${meta.geradoPor}</span>
    </div>
  </div>

  ${filtrosAtivos ? `<div class="filtros"><strong>Filtros aplicados:</strong> ${filtrosAtivos}</div>` : ''}

  <table>
    <thead><tr>${thCells}</tr></thead>
    <tbody>${trRows}</tbody>
  </table>

  <div class="footer">
    <span>SISPROD BM — Brigada Militar / RS &nbsp;|&nbsp; Documento gerado automaticamente pelo sistema</span>
    <span>Página <span class="page-num"></span></span>
  </div>
</body>
</html>`;
  };

  const exportPDF = () => {
    setExporting('pdf');
    const html = buildPrintHTML(false);
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:297mm;height:210mm;border:none;';
    document.body.appendChild(iframe);
    iframe.contentDocument.open();
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();
    iframe.contentWindow.focus();
    setTimeout(() => {
      iframe.contentWindow.print();
      setTimeout(() => document.body.removeChild(iframe), 1500);
    }, 400);
    setExporting('');
    toast.success('Relatório PDF aberto para impressão/salvar!');
  };

  const printReport = () => {
    const html = buildPrintHTML(true);
    const win = window.open('', '_blank', 'width=1100,height=800');
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  return (
    <div className="flex flex-col gap-4 pb-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <FileText className="w-6 h-6 text-primary" /> Relatórios
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Filtre, personalize colunas e exporte os dados de produtividade</p>
      </div>

      {/* Banner de acesso rápido ao Ranking por Grupos */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <Trophy className="w-5 h-5 text-primary flex-shrink-0 mt-0.5 sm:mt-0" />
          <div>
            <p className="text-sm font-semibold text-primary">Relatório de Ranking</p>
            <p className="text-xs text-muted-foreground">Gere e imprima o ranking por Grupos Concorrentes ou individualmente por OPM</p>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10"
            onClick={() => setShowRankingDialog(true)}
          >
            <Layers className="w-3.5 h-3.5" /> Visualizar por Grupos
          </Button>
          <Button
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => setShowRankingDialog(true)}
          >
            <Printer className="w-3.5 h-3.5" /> Imprimir Ranking
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Cabeçalho sempre visível — clicável para recolher/expandir */}
        <button
          onClick={() => setFiltrosAbertos(v => !v)}
          className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Filtros</span>
            {hasActiveFilters && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">
                Ativos
              </Badge>
            )}
            {/* Resumo rápido quando fechado */}
            {!filtrosAbertos && (
              <span className="text-xs text-muted-foreground hidden sm:inline">
                · {periodoLabel}{bpmFilter ? ` · ${bpmFilter}` : ''}{catFilter !== 'Todas' ? ` · ${catFilter}` : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasActiveFilters && filtrosAbertos && (
              <span onClick={e => { e.stopPropagation(); clearFilters(); }}
                className="text-xs text-destructive font-medium flex items-center gap-0.5 hover:underline">
                <X className="w-3 h-3" /> Limpar
              </span>
            )}
            {filtrosAbertos ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </button>

        {/* Corpo dos filtros — colapsável */}
        {filtrosAbertos && (
        <div className="px-5 pb-5 space-y-4 border-t border-border pt-3">

        {/* Período */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <button onClick={() => setUseDateRange(false)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${!useDateRange ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
              Por Trimestre
            </button>
            <button onClick={() => setUseDateRange(true)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${useDateRange ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
              Por Intervalo de Datas
            </button>
          </div>
          {!useDateRange ? (
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
  {getAllPeriodos().map(p => <SelectItem key={p} value={p}>{getPeriodoLabel(p)}</SelectItem>)}
</SelectContent>
            </Select>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3">
              <div>
                <Label className="text-xs">Data inicial</Label>
                <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="mt-1 w-44" />
              </div>
              <div>
                <Label className="text-xs">Data final</Label>
                <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="mt-1 w-44" />
              </div>
              {(dataInicio || dataFim) && (
                <div className="flex items-end">
                  <Button variant="ghost" size="sm" onClick={() => { setDataInicio(''); setDataFim(''); }} className="gap-1 text-destructive text-xs h-9">
                    <X className="w-3.5 h-3.5" /> Limpar datas
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Filtros de unidade e conteúdo */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <Select value={bpmFilter} onValueChange={v => { setBpmFilter(v === '__all__' ? '' : v); setCiaFilter(''); setPelFilter(''); setGpmFilter(''); }}>
            <SelectTrigger className="text-xs h-8"><SelectValue placeholder="Todos os BTLs" /></SelectTrigger>
            <SelectContent><SelectItem value="__all__">Todos os BTLs</SelectItem>{BPMs.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={ciaFilter} onValueChange={v => { setCiaFilter(v === '__all__' ? '' : v); setPelFilter(''); setGpmFilter(''); }} disabled={!bpmFilter}>
            <SelectTrigger className="text-xs h-8"><SelectValue placeholder="Todas Cias" /></SelectTrigger>
            <SelectContent><SelectItem value="__all__">Todas</SelectItem>{cias.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={pelFilter} onValueChange={v => { setPelFilter(v === '__all__' ? '' : v); setGpmFilter(''); }} disabled={!ciaFilter}>
            <SelectTrigger className="text-xs h-8"><SelectValue placeholder="Todos Pels" /></SelectTrigger>
            <SelectContent><SelectItem value="__all__">Todos</SelectItem>{pelotoes.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={gpmFilter} onValueChange={v => setGpmFilter(v === '__all__' ? '' : v)} disabled={!pelFilter}>
            <SelectTrigger className="text-xs h-8"><SelectValue placeholder="Todos GPMs" /></SelectTrigger>
            <SelectContent><SelectItem value="__all__">Todos</SelectItem>{gpms.map(g => <SelectItem key={g.nome} value={g.nome}>{g.nome}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="text-xs h-8"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={indicadorFilter} onValueChange={v => setIndicadorFilter(v === '__all__' ? '' : v)}>
            <SelectTrigger className="text-xs h-8"><SelectValue placeholder="Todos os indicadores" /></SelectTrigger>
            <SelectContent className="max-h-60">
              <SelectItem value="__all__">Todos os indicadores</SelectItem>
              {indicadoresAtivos.map(i => <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={municipioFilter} onValueChange={v => setMunicipioFilter(v === '__all__' ? '' : v)}>
            <SelectTrigger className="text-xs h-8"><SelectValue placeholder="Todos os municípios" /></SelectTrigger>
            <SelectContent className="max-h-60">
              <SelectItem value="__all__">Todos os municípios</SelectItem>
              {MUNICIPIOS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={ordenacao} onValueChange={setOrdenacao}>
            <SelectTrigger className="text-xs h-8"><SelectValue placeholder="Ordenação" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="data">Por data (recente)</SelectItem>
              <SelectItem value="alfabetica">Ordem alfabética</SelectItem>
              <SelectItem value="quantidade">Por quantidade</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tipo de relatório */}
        <div className="flex flex-wrap gap-2 items-center pt-1 border-t border-border">
          <span className="text-xs font-semibold text-muted-foreground mr-1">Tipo:</span>
          {[
            { value: 'detalhado',         label: 'Detalhado',        icon: List },
            { value: 'por_categoria',     label: 'Por Categoria',    icon: BarChart3 },
            { value: 'por_indicador',     label: 'Por Indicador',    icon: BarChart3 },
            { value: 'evolucao_economia', label: 'Evolução Economia',icon: TrendingUp },
          ].map(({ value, label, icon: Icon }) => (
            <button key={value} onClick={() => { setTipoRelatorio(value); if (value !== 'detalhado') setShowColSelector(false); }}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${tipoRelatorio === value ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
              <Icon className="w-3 h-3" /> {label}
            </button>
          ))}

          {/* Botão Colunas — abre painel lateral ao lado do preview */}
          {tipoRelatorio === 'detalhado' && (
            <button onClick={() => setShowColSelector(v => !v)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ml-auto ${showColSelector ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
              <Settings2 className="w-3 h-3" /> Colunas ({colunasAtivas.size})
            </button>
          )}
        </div>

        {/* Resumo + Exportação */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-border">
          <div className="flex gap-4 text-sm flex-wrap">
            <span><strong>{filtered.length}</strong> registros</span>
            <span><strong>{totalQtd.toLocaleString('pt-BR')}</strong> qtd total</span>
            <span><strong>{totalPontos.toLocaleString('pt-BR')}</strong> pts totais</span>
          </div>
          <div className="grid grid-cols-4 sm:flex gap-2">
            {(ordenacao === 'data' || ordenacao === 'quantidade') && (
              <Button
                onClick={() => setSortDesc(v => !v)}
                variant="outline" size="sm"
                className="gap-1.5 text-xs"
                title={sortDesc ? 'Clique para inverter a ordem' : 'Clique para inverter a ordem'}
              >
                {sortDesc ? <ArrowDownUp className="w-4 h-4" /> : <ArrowUpDown className="w-4 h-4" />}
                <span className="hidden sm:inline">{sortDesc ? 'Desc' : 'Asc'}</span>
              </Button>
            )}
            <Button onClick={exportExcel} disabled={!!exporting || filtered.length === 0} variant="outline" size="sm" className="gap-1.5 text-xs">
              {exporting === 'xlsx' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
              <span className="hidden sm:inline">Excel</span><span className="sm:hidden">XLS</span>
            </Button>
            <Button onClick={exportPDF} disabled={!!exporting || filtered.length === 0} variant="outline" size="sm" className="gap-1.5 text-xs">
              {exporting === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} PDF
            </Button>
            <Button onClick={printReport} disabled={filtered.length === 0} variant="outline" size="sm" className="gap-1.5 text-xs">
              <Printer className="w-4 h-4" /> <span className="hidden sm:inline">Imprimir</span><span className="sm:hidden">Print</span>
            </Button>
          </div>
        </div>
        </div>
        )}

        {/* Barra de resumo + exportação sempre visível quando filtros fechados */}
        {!filtrosAbertos && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-5 py-3 border-t border-border">
            <div className="flex gap-3 text-xs flex-wrap text-muted-foreground">
              <span><strong className="text-foreground">{filtered.length}</strong> reg.</span>
              <span><strong className="text-foreground">{totalQtd.toLocaleString('pt-BR')}</strong> qtd</span>
              <span><strong className="text-foreground">{totalPontos.toLocaleString('pt-BR')}</strong> pts</span>
            </div>
            <div className="grid grid-cols-3 sm:flex gap-2">
              <Button onClick={exportExcel} disabled={!!exporting || filtered.length === 0} variant="outline" size="sm" className="gap-1 text-xs h-8">
                {exporting === 'xlsx' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />} XLS
              </Button>
              <Button onClick={exportPDF} disabled={!!exporting || filtered.length === 0} variant="outline" size="sm" className="gap-1 text-xs h-8">
                {exporting === 'pdf' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} PDF
              </Button>
              <Button onClick={printReport} disabled={filtered.length === 0} variant="outline" size="sm" className="gap-1 text-xs h-8">
                <Printer className="w-3.5 h-3.5" /> Print
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Preview + painel de colunas lado a lado */}
      <div className={`flex gap-3 items-start ${showColSelector && tipoRelatorio === 'detalhado' ? 'flex-col lg:flex-row' : ''}`}>

        {/* Tabela de preview */}
        <div className="bg-card rounded-xl border border-border overflow-hidden flex-1 min-w-0" id="relatorio-print">
        <div className="px-4 py-3 bg-muted/40 border-b border-border flex items-center justify-between">
          <span className="text-sm font-semibold">
            {tipoRelatorio === 'por_categoria' ? 'Por Categoria' : tipoRelatorio === 'por_indicador' ? 'Por Indicador' : tipoRelatorio === 'evolucao_economia' ? 'Evolução de Economia (Água e Luz)' : 'Preview Detalhado'}
          </span>
          <span className="text-xs text-muted-foreground">
            {`${filtered.length} registros`}
          </span>
        </div>
        <div className="overflow-auto">

          {/* ── Detalhado com colunas customizáveis ── */}
          {tipoRelatorio === 'detalhado' && (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {colunasOrdenadas.map(col => (
                    <th key={col.key} className={`px-3 py-2 font-semibold uppercase tracking-wider text-left ${['quantidade','pontuacao'].includes(col.key) ? 'text-right' : col.key === 'unidade_medida' ? 'text-center' : ''}`}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedFiltered.map(p => (
                  <tr key={p.id} className="hover:bg-muted/20">
                    {colunasOrdenadas.map(col => renderCell(p, col.key))}
                  </tr>
                ))}
                {sortedFiltered.length === 0 && (
                  <tr><td colSpan={colunasOrdenadas.length} className="px-4 py-12 text-center text-muted-foreground">Nenhum dado para os filtros selecionados</td></tr>
                )}
              </tbody>
              {sortedFiltered.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/40 font-bold">
                    {colunasOrdenadas.map((col, i) => (
                      <td key={col.key} className={`px-3 py-2 text-xs ${col.key === 'quantidade' ? 'text-right' : col.key === 'pontuacao' ? 'text-right text-primary' : ''}`}>
                        {i === 0 ? 'TOTAL' : col.key === 'quantidade' ? totalQtd.toLocaleString('pt-BR') : col.key === 'pontuacao' ? totalPontos.toLocaleString('pt-BR') : ''}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          )}

          {/* ── Por Categoria ── */}
          {tipoRelatorio === 'por_categoria' && (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2 font-semibold uppercase tracking-wider">Categoria</th>
                  <th className="text-right px-4 py-2 font-semibold uppercase tracking-wider">Quantidade</th>
                  <th className="text-right px-4 py-2 font-semibold uppercase tracking-wider">Pontuação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {porCategoria.map(([cat, d]) => (
                  <tr key={cat} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5"><Badge variant="secondary" className={`text-xs ${catColors[cat] || ''}`}>{cat}</Badge></td>
                    <td className="px-4 py-2.5 text-right font-bold">{formatNumber(d.qtd)}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-primary">{formatNumber(d.pts)}</td>
                  </tr>
                ))}
                {porCategoria.length === 0 && <tr><td colSpan={3} className="px-4 py-12 text-center text-muted-foreground">Nenhum dado</td></tr>}
              </tbody>
              {porCategoria.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/40 font-bold">
                    <td className="px-4 py-2 uppercase text-xs">TOTAL</td>
                    <td className="px-4 py-2 text-right">{totalQtd.toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-2 text-right text-primary">{totalPontos.toLocaleString('pt-BR')}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}

          {/* ── Por Indicador ── */}
          {tipoRelatorio === 'por_indicador' && (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2 font-semibold uppercase tracking-wider">Indicador</th>
                  <th className="text-left px-4 py-2 font-semibold uppercase tracking-wider">Categoria</th>
                  <th className="text-center px-4 py-2 font-semibold uppercase tracking-wider">Unidade</th>
                  <th className="text-right px-4 py-2 font-semibold uppercase tracking-wider">Quantidade</th>
                  <th className="text-right px-4 py-2 font-semibold uppercase tracking-wider">Pontuação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {porIndicador.map(([ind, d]) => (
                  <tr key={ind} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium">{ind}</td>
                    <td className="px-4 py-2.5"><Badge variant="secondary" className={`text-[10px] ${catColors[d.cat] || ''}`}>{d.cat}</Badge></td>
                    <td className="px-4 py-2.5 text-center text-muted-foreground font-mono text-[11px]">{d.unidade}</td>
                    <td className="px-4 py-2.5 text-right font-bold">{formatNumber(d.qtd)}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-primary">{formatNumber(d.pts)}</td>
                  </tr>
                ))}
                {porIndicador.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">Nenhum dado</td></tr>}
              </tbody>
              {porIndicador.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/40 font-bold">
                    <td colSpan={3} className="px-4 py-2 uppercase text-xs">TOTAL</td>
                    <td className="px-4 py-2 text-right">{totalQtd.toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-2 text-right text-primary">{totalPontos.toLocaleString('pt-BR')}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}

          {/* ── Evolução Economia ── */}
          {tipoRelatorio === 'evolucao_economia' && (
            <div>
              <div className="px-4 py-2 bg-purple-50 border-b border-purple-100 text-xs text-purple-700 font-medium flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5" />
                Exibe a variação de consumo de Água e Luz por unidade e mês. Var A = mês ant. − 2 meses atrás · Var B = atual − ant. · Delta = B − A.
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-2 font-semibold uppercase tracking-wider">Unidade</th>
                    <th className="text-left px-4 py-2 font-semibold uppercase tracking-wider whitespace-nowrap">Mês</th>
                    <th className="text-left px-4 py-2 font-semibold uppercase tracking-wider">Indicador</th>
                    <th className="text-center px-4 py-2 font-semibold uppercase tracking-wider whitespace-nowrap">Var A</th>
                    <th className="text-center px-4 py-2 font-semibold uppercase tracking-wider whitespace-nowrap">Var B</th>
                    <th className="text-center px-4 py-2 font-semibold uppercase tracking-wider whitespace-nowrap">Delta (B−A)</th>
                    <th className="text-right px-4 py-2 font-semibold uppercase tracking-wider">Pontos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {evolucaoData.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">Nenhum registro de Economia com variação disponível.<br /><span className="text-[10px]">Lance registros de Água ou Luz para visualizar aqui.</span></td></tr>
                  )}
                  {evolucaoData.map((e, ei) => e.registros.map((r, ri) => {
                    const v = extrairVariacaoEconomia(r);
                    return (
                      <tr key={`${ei}-${ri}`} className="hover:bg-muted/20">
                        {ri === 0 ? <td className="px-4 py-2.5 font-medium" rowSpan={e.registros.length}>{e.org}</td> : null}
                        {ri === 0 ? <td className="px-4 py-2.5 text-muted-foreground font-mono" rowSpan={e.registros.length}>{e.mes}</td> : null}
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            {IS_AGUA_REL(r.indicator_name) && <Droplets className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />}
                            {IS_LUZ_REL(r.indicator_name)  && <Lightbulb className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />}
                            <span>{r.indicator_name || '-'}</span>
                          </div>
                        </td>
                        {/* Var A */}
                        <td className="px-4 py-2.5 text-center font-mono text-[11px]">
                          {v && v.varA != null
                            ? <span className={v.varA < 0 ? 'text-green-700' : v.varA > 0 ? 'text-red-600' : 'text-muted-foreground'}>
                                {v.varA >= 0 ? '+' : ''}{v.varA.toFixed(1)} {v.unidade}
                              </span>
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                        {/* Var B */}
                        <td className="px-4 py-2.5 text-center font-mono text-[11px]">
                          {v && v.varB != null
                            ? <span className={v.varB < 0 ? 'text-green-700' : v.varB > 0 ? 'text-red-600' : 'text-muted-foreground'}>
                                {v.varB >= 0 ? '+' : ''}{v.varB.toFixed(1)} {v.unidade}
                              </span>
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                        {/* Delta */}
                        <td className="px-4 py-2.5 text-center">
                          {v && v.delta != null
                            ? <div className="flex flex-col items-center gap-0.5">
                                <span className={`flex items-center gap-0.5 font-mono font-bold text-xs ${v.delta < 0 ? 'text-green-600' : v.delta > 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                                  {v.delta < 0 ? <TrendingDown className="w-3 h-3" /> : v.delta > 0 ? <TrendingUp className="w-3 h-3" /> : null}
                                  {v.delta >= 0 ? '+' : ''}{v.delta.toFixed(1)} {v.unidade}
                                </span>
                                <span className={`text-[9px] font-medium ${v.delta < 0 ? 'text-green-600' : v.delta > 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                                  {v.delta < 0 ? '↓ Diminuiu' : v.delta > 0 ? '↑ Aumentou' : 'Manteve'}
                                </span>
                              </div>
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-primary">{r.pontuacao ?? 0}</td>
                      </tr>
                    );
                  }))}
                </tbody>
              </table>
            </div>
          )}

        </div>
        </div>{/* fim tabela preview */}

        {/* Painel de colunas — ao lado do preview, não sobrepõe */}
        {showColSelector && tipoRelatorio === 'detalhado' && (
          <ColunasPanel
            colunasAtivas={colunasAtivas}
            onToggle={toggleColuna}
            onReset={(newSet) => setColunasAtivas(newSet)}
            onClose={() => setShowColSelector(false)}
          />
        )}
      </div>{/* fim flex row preview + colunas */}

      {showRankingDialog && (
        <ImprimirRankingDialog
          open={showRankingDialog}
          onClose={() => setShowRankingDialog(false)}
          allProductions={allProductions}
          organizations={organizations}
          composicoes={composicoes}
          modeloAtivo={modeloAtivo}
          user={user}
        />
      )}
    </div>
  );
}