import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Printer, Loader2 } from 'lucide-react';
import { getAllPeriodos, getPeriodoLabel, getCurrentPeriodo, formatNumber } from '@/lib/utils';
import { computeRankings, computeMunicipalRanking, computeComposicaoRanking } from '@/hooks/useProduction';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function ImprimirRankingDialog({ open, onClose, allProductions, organizations, composicoes, modeloAtivo, user }) {
  const [tipoRanking, setTipoRanking] = useState('grupos'); // 'grupos' | 'individual'
  const [abrangencia, setAbrangencia] = useState('geral'); // 'geral' | 'bpm' | 'cia' | 'pel' | 'gpm'
  const [nivel, setNivel] = useState('municipio'); // para individual: 'municipio'|'gpm'|'pelotao'|'companhia'
  const [periodo, setPeriodo] = useState(getCurrentPeriodo() || getAllPeriodos()[0] || '');
  const [printing, setPrinting] = useState(false);

  const isPersonalizado = modeloAtivo === 'personalizado' && composicoes.length > 0;

  const handleImprimir = () => {
    setPrinting(true);

    // Filtra produções pelo período selecionado
    const prods = allProductions.filter(p => !periodo || p.periodo === periodo);

    // Deduplication
    const seen = new Set();
    const deduped = [...prods]
      .sort((a, b) => (a.data || '').localeCompare(b.data || ''))
      .filter(p => {
        const key = `${p.organization_id}|${p.indicator_id}|${p.periodo}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    // Calcula ranking conforme tipo
    let ranking = [];
    let titulo = '';

    if (tipoRanking === 'grupos' && isPersonalizado) {
      ranking = computeComposicaoRanking(deduped, composicoes, null);
      titulo = 'Ranking por Grupos Concorrentes';
    } else {
      const lvl = tipoRanking === 'individual' ? nivel : 'municipio';
      ranking = lvl === 'municipio'
        ? computeMunicipalRanking(deduped)
        : computeRankings(deduped, lvl);
      titulo = tipoRanking === 'grupos'
        ? 'Ranking Individual por OPM (Modelo Padrão)'
        : `Ranking Individual — Nível ${nivel.charAt(0).toUpperCase() + nivel.slice(1)}`;
    }

    // Filtra por abrangência se necessário
    // (a abrangência aqui é informativa no cabeçalho — filtro futuro pode ser aplicado)
    const abrangenciaLabel = {
      geral: 'Geral do CRPM',
      bpm: 'Por Batalhão',
      cia: 'Por Companhia',
      pel: 'Por Pelotão',
      gpm: 'Por GPM',
    }[abrangencia];

    const geradoPor = user?.full_name || user?.nome_completo || user?.email || 'Sistema';
    const now = format(new Date(), 'dd/MM/yyyy HH:mm');
    const periodoLabel = getPeriodoLabel(periodo) || 'Todos';

    // Totais
    const totais = ranking.reduce((acc, r) => ({
      score: acc.score + r.score,
      preventiva: acc.preventiva + r.preventiva,
      repressiva: acc.repressiva + r.repressiva,
      apreensao: acc.apreensao + r.apreensao,
      atendimento: acc.atendimento + r.atendimento,
      economia: acc.economia + r.economia,
    }), { score: 0, preventiva: 0, repressiva: 0, apreensao: 0, atendimento: 0, economia: 0 });

    const medalsMap = ['🥇', '🥈', '🥉'];

    const rows = ranking.map((item, i) => {
      const pos = i < 3 ? medalsMap[i] : `${i + 1}º`;
      // Grupos: nome do grupo + municípios abaixo
      // Individual por município: município + opmLabel (cadeia completa)
      // Individual por OPM: cadeia completa (name) + município abaixo
      const isGrupos = tipoRanking === 'grupos' && isPersonalizado;
      const isMunicipio = tipoRanking === 'individual' && nivel === 'municipio';
      const nome = isGrupos
        ? item.name
        : isMunicipio
          ? item.municipio || item.name || '-'
          : item.name || '-';
      // Para grupos: usa observacao (município) como subtítulo; para individual por OPM: usa município
      const subInfoRaw = isGrupos
        ? (item.observacao || item.municipios || '')
        : isMunicipio
          ? (item.opmLabel || '')
          : (item.municipio || '');
      // Evita repetição: não exibe município se já consta na cadeia do nome
      const subInfo = (!isGrupos && !isMunicipio && subInfoRaw)
        ? (subInfoRaw.trim().toLowerCase() !== '' && nome.split('/').map(s => s.trim().toLowerCase()).includes(subInfoRaw.trim().toLowerCase()) ? '' : subInfoRaw)
        : subInfoRaw;
      return `
        <tr class="${i % 2 === 0 ? '' : 'odd'} ${i < 3 ? 'top3' : ''}">
          <td style="text-align:center;font-size:11pt">${pos}</td>
          <td>
            <div class="nome-unidade">${nome}</div>
            ${subInfo ? `<div class="sub-info">${subInfo}</div>` : ''}
          </td>
          <td class="num blue">${item.preventiva > 0 ? formatNumber(item.preventiva) : '—'}</td>
          <td class="num red">${item.repressiva > 0 ? formatNumber(item.repressiva) : '—'}</td>
          <td class="num orange">${item.apreensao > 0 ? formatNumber(item.apreensao) : '—'}</td>
          <td class="num green">${item.atendimento > 0 ? formatNumber(item.atendimento) : '—'}</td>
          <td class="num purple">${item.economia > 0 ? formatNumber(item.economia) : '—'}</td>
          <td class="num total-col">${formatNumber(item.score)}</td>
        </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <title>SISPROD BM — ${titulo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 9pt; color: #1a1a1a; background: #fff; padding: 10mm; }

    .header { display: flex; align-items: center; border-bottom: 3px solid #1e5631; padding-bottom: 8px; margin-bottom: 10px; }
    .header-logo { width: 52px; height: 52px; background: #1e5631; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-right: 12px; }
    .header-logo span { color: white; font-weight: 900; font-size: 14pt; }
    .header-text h1 { font-size: 12pt; font-weight: 900; color: #1e5631; text-transform: uppercase; }
    .header-text h2 { font-size: 9pt; font-weight: 600; color: #333; margin-top: 1px; }
    .header-text p  { font-size: 8pt; color: #666; margin-top: 1px; }

    .meta { display: grid; grid-template-columns: repeat(3,1fr); gap: 6px; background: #f0f4f0; border: 1px solid #c8dac8; border-radius: 6px; padding: 8px 10px; margin-bottom: 10px; }
    .meta-item label { font-size: 7pt; font-weight: 700; text-transform: uppercase; color: #1e5631; display: block; }
    .meta-item span  { font-size: 9pt; font-weight: 600; }

    .badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 7.5pt; font-weight: 700; margin-bottom: 8px; }
    .badge-grupos { background: #1e5631; color: white; }
    .badge-individual { background: #2563eb; color: white; }

    table { width: 100%; border-collapse: collapse; margin-top: 4px; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
    th { background: #1e5631; color: #fff; padding: 5px 6px; text-align: left; font-size: 8pt; font-weight: 700; text-transform: uppercase; white-space: nowrap; }
    th.num { text-align: right; }
    td { padding: 4px 6px; font-size: 8.5pt; border-bottom: 1px solid #e0e8e0; vertical-align: middle; }
    tr.odd td { background: #f7faf7; }
    tr.top3 td { font-weight: 700; }
    tr.top3:nth-child(1) td { background: #fff9e6; border-left: 3px solid #f59e0b; }
    tr.top3:nth-child(2) td { background: #f8f8f8; border-left: 3px solid #9ca3af; }
    tr.top3:nth-child(3) td { background: #fef3e8; border-left: 3px solid #b45309; }
    tr.total-row td { background: #d4e8d4; font-weight: 700; font-size: 9pt; border-top: 2px solid #1e5631; }

    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .blue { color: #1d4ed8; }
    .red { color: #b91c1c; }
    .orange { color: #c2410c; }
    .green { color: #15803d; }
    .purple { color: #7e22ce; }
    .total-col { color: #1a1a1a; font-weight: 900; font-size: 9.5pt; }

    .nome-unidade { font-weight: 600; }
    .sub-info { font-size: 7.5pt; color: #666; margin-top: 1px; }

    .footer { margin-top: 12px; padding-top: 8px; border-top: 1px solid #c8dac8; display: flex; justify-content: space-between; font-size: 7pt; color: #888; }

    @media print {
      @page { size: A4 landscape; margin: 8mm 10mm; }
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-logo"><span>BM</span></div>
    <div class="header-text">
      <h1>Brigada Militar — Rio Grande do Sul</h1>
      <h2>SISPROD BM — Sistema de Produtividade Operacional</h2>
      <p>${titulo} · ${abrangenciaLabel}</p>
    </div>
  </div>

  <div class="meta">
    <div class="meta-item"><label>Período</label><span>${periodoLabel}</span></div>
    <div class="meta-item"><label>Abrangência</label><span>${abrangenciaLabel}</span></div>
    <div class="meta-item"><label>Unidades Classificadas</label><span>${ranking.length}</span></div>
    <div class="meta-item"><label>Pontuação Total</label><span>${formatNumber(totais.score)} pts</span></div>
    <div class="meta-item"><label>Gerado em</label><span>${now}</span></div>
    <div class="meta-item"><label>Responsável</label><span>${geradoPor}</span></div>
  </div>

  <div class="badge ${tipoRanking === 'grupos' ? 'badge-grupos' : 'badge-individual'}">
    ${tipoRanking === 'grupos' ? '● Ranking por Grupos Concorrentes' : '● Ranking Individual por OPM'}
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:36px">#</th>
        <th>${tipoRanking === 'grupos' && isPersonalizado ? 'Grupo / Município Representado' : nivel === 'municipio' ? 'Município / OPM Responsável' : 'Unidade Operacional / Município'}</th>
        <th class="num" style="color:#93c5fd">Prev.</th>
        <th class="num" style="color:#fca5a5">Repr.</th>
        <th class="num" style="color:#fdba74">Apre.</th>
        <th class="num" style="color:#86efac">Aten.</th>
        <th class="num" style="color:#d8b4fe">Econ.</th>
        <th class="num">Total</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      ${ranking.length > 0 ? `
      <tr class="total-row">
        <td></td>
        <td><strong>TOTAL GERAL</strong></td>
        <td class="num blue">${formatNumber(totais.preventiva)}</td>
        <td class="num red">${formatNumber(totais.repressiva)}</td>
        <td class="num orange">${formatNumber(totais.apreensao)}</td>
        <td class="num green">${formatNumber(totais.atendimento)}</td>
        <td class="num purple">${formatNumber(totais.economia)}</td>
        <td class="num total-col">${formatNumber(totais.score)}</td>
      </tr>` : `<tr><td colspan="8" style="text-align:center;padding:20px;color:#888">Nenhum dado para o período selecionado.</td></tr>`}
    </tbody>
  </table>

  <div class="footer">
    <span>SISPROD BM — Brigada Militar / RS · Documento gerado automaticamente</span>
    <span>Emitido em ${now}</span>
  </div>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=1200,height=850');
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);

    setPrinting(false);
    toast.success('Ranking aberto para impressão/PDF!');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-primary" /> Imprimir Ranking
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Tipo de Ranking */}
          <div>
            <Label className="text-xs font-semibold">Tipo de Ranking</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                onClick={() => setTipoRanking('grupos')}
                className={`px-3 py-2.5 rounded-lg border text-xs font-semibold transition-all text-left ${tipoRanking === 'grupos' ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}
              >
                <div className="font-bold">Por Grupos</div>
                <div className="opacity-70 mt-0.5 text-[10px]">Soma de OPMs do grupo</div>
              </button>
              <button
                onClick={() => setTipoRanking('individual')}
                className={`px-3 py-2.5 rounded-lg border text-xs font-semibold transition-all text-left ${tipoRanking === 'individual' ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}
              >
                <div className="font-bold">Individual por OPM</div>
                <div className="opacity-70 mt-0.5 text-[10px]">Cada unidade separada</div>
              </button>
            </div>
            {tipoRanking === 'grupos' && !isPersonalizado && (
              <p className="text-[11px] text-amber-600 mt-1.5 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                Nenhum grupo concorrente ativo. Será usado ranking padrão por OPM.
              </p>
            )}
          </div>

          {/* Nível (apenas individual) */}
          {tipoRanking === 'individual' && (
            <div>
              <Label className="text-xs font-semibold">Nível de Classificação</Label>
              <Select value={nivel} onValueChange={setNivel}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="municipio">Por Município</SelectItem>
                  <SelectItem value="gpm">Por GPM</SelectItem>
                  <SelectItem value="pelotao">Por Pelotão</SelectItem>
                  <SelectItem value="companhia">Por Companhia</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Abrangência */}
          <div>
            <Label className="text-xs font-semibold">Abrangência</Label>
            <Select value={abrangencia} onValueChange={setAbrangencia}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="geral">Geral do CRPM</SelectItem>
                <SelectItem value="bpm">Por Batalhão</SelectItem>
                <SelectItem value="cia">Por CIA</SelectItem>
                <SelectItem value="pel">Por Pelotão</SelectItem>
                <SelectItem value="gpm">Por GPM</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Período */}
          <div>
            <Label className="text-xs font-semibold">Período</Label>
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                {getAllPeriodos().map(p => (
                  <SelectItem key={p} value={p}>{getPeriodoLabel(p)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleImprimir} disabled={printing} className="gap-1.5">
            {printing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
            {printing ? 'Gerando...' : 'Gerar e Imprimir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}