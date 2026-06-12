import React, { useState, useMemo, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import { getCurrentPeriodo, getPeriodoLabel, getAllPeriodos, formatNumber } from '@/lib/utils';
import { useAllProductions } from '@/hooks/useProduction';
import { Pencil, Trash2, Search, Lock, X, Droplets, Lightbulb, TrendingDown, TrendingUp, Download, FileText, Image, FileSpreadsheet, Printer, Loader2, ArrowUpDown, ArrowDownUp } from 'lucide-react';
import { toast } from 'sonner';
import { format, isAfter, subHours } from 'date-fns';
import { exportXlsx } from '@/lib/exportXlsx';

const IS_AGUA = (nome) => (nome || '').toLowerCase().includes('água') || (nome || '').toLowerCase().includes('agua');
const IS_LUZ  = (nome) => (nome || '').toLowerCase().includes('luz') || (nome || '').toLowerCase().includes('energia');
const IS_ECONOMIA_CONSUMO = (p) => p.categoria === 'Economia' && (IS_AGUA(p.indicator_name) || IS_LUZ(p.indicator_name));

// Extrai os três valores de consumo da observação gravada
function extrairConsumos(observacao, tipo) {
  if (!observacao) return null;
  const tipoLabel = tipo === 'agua' ? 'Água' : 'Luz';
  const pattern = new RegExp(`${tipoLabel}[^|]*\\| Ant[^:]*:\\s*([\\d.,]+)[^|]*m|kWh[^|]*\\| Atual[^:]*:\\s*([\\d.,]+)`, 'i');
  // Parse simples: extrai todos os valores numéricos do campo correto
  const antMatch = observacao.match(/Ant[^:]*:\s*([\d.,]+)\s*(?:m³|kWh)/i);
  const atualMatch = observacao.match(/Atual[^:]*:\s*([\d.,]+)\s*(?:m³|kWh)/i);
  const doisAtrasMatch = observacao.match(/:\s*([\d.,]+)\s*(?:m³|kWh)\s*\|.*Ant/i);
  return {
    anterior: antMatch ? parseFloat(antMatch[1].replace(',', '.')) : null,
    atual: atualMatch ? parseFloat(atualMatch[1].replace(',', '.')) : null,
    doisAtras: doisAtrasMatch ? parseFloat(doisAtrasMatch[1].replace(',', '.')) : null,
  };
}

// Remove município embutido no organization_name (formato legado: "GPM — município")
function limparNomeUnidade(nome) {
  if (!nome) return '-';
  return nome.replace(/\s*—\s*.+$/, '').trim();
}

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

const catColors = {
  'Preventiva': 'bg-primary/10 text-primary',
  'Repressiva': 'bg-destructive/10 text-destructive',
  'Apreensão': 'bg-amber-100 text-amber-800',
  'Atendimento': 'bg-blue-100 text-blue-700',
  'Economia': 'bg-green-100 text-green-700',
};

function canEditWithin24h(record, isAdmin) {
  if (isAdmin) return true;
  if (!record.created_date) return false;
  const created = new Date(record.created_date);
  return isAfter(created, subHours(new Date(), 24));
}

function buildVariacaoTexto(p) {
  const nome = (p.indicator_name || '').toLowerCase();
  const isAgua = nome.includes('água') || nome.includes('agua');
  const isLuz  = nome.includes('luz')  || nome.includes('energia');
  if (p.categoria !== 'Economia' || (!isAgua && !isLuz)) return '';
  const un = isAgua ? 'm³' : 'kWh';
  const obs = p.observacao || '';
  const antMatch       = obs.match(/Ant[^:]*:\s*([\d.,]+)\s*(?:m³|kWh)/i);
  const atualMatch     = obs.match(/Atual[^:]*:\s*([\d.,]+)\s*(?:m³|kWh)/i);
  const doisAtrasMatch = obs.match(/([\d.,]+)\s*(?:m³|kWh)\s*\|\s*Ant/i);
  const ant      = antMatch      ? parseFloat(antMatch[1].replace(',','.'))       : null;
  const atual    = atualMatch    ? parseFloat(atualMatch[1].replace(',','.'))     : null;
  const doisAtras = doisAtrasMatch ? parseFloat(doisAtrasMatch[1].replace(',','.')) : null;
  const varB = ant != null && atual != null ? atual - ant : null;
  const varA = doisAtras != null && ant != null ? ant - doisAtras : null;
  const delta = varB !== null && varA !== null ? varB - varA : varB;
  const parts = [];
  if (varA != null) parts.push(`A:${varA >= 0 ? '+' : ''}${varA.toFixed(1)} ${un}`);
  if (varB != null) parts.push(`B:${varB >= 0 ? '+' : ''}${varB.toFixed(1)} ${un}`);
  if (delta != null) parts.push(`Δ:${delta >= 0 ? '+' : ''}${delta.toFixed(1)} ${un}`);
  return parts.join(' | ');
}

export default function Historico() {
  const { appUser } = useOutletContext();
  const queryClient = useQueryClient();
  const [exporting, setExporting] = useState(false);
  const [periodo, setPeriodo] = useState(getCurrentPeriodo());
  const [useDateRange, setUseDateRange] = useState(false);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [search, setSearch] = useState('');
  const [filterEconomia, setFilterEconomia] = useState(null); // null | 'agua' | 'luz' | 'ambos'
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [editDialog, setEditDialog] = useState(null);
  const [requestDialog, setRequestDialog] = useState(null);
  const [sortDesc, setSortDesc] = useState(true); // true = decrescente (padrão)

  const { data: allProductions } = useAllProductions();
  const isAdmin = appUser?.perfil === 'administrador';

  // Indicadores para o dialog de edição completo (admin)
  const { data: indicators = [] } = useQuery({
    queryKey: ['indicators'],
    queryFn: () => base44.entities.Indicator.list(),
  });

  // Carrega EditRequests para verificar liberações ativas
  const { data: editRequests = [] } = useQuery({
    queryKey: ['edit-requests'],
    queryFn: () => base44.entities.EditRequest.list('-created_date', 200),
    initialData: [],
  });

  // Retorna o EditRequest aprovado e ativo para um production_id, se existir
  const getActiveLiberacao = (productionId) => {
    const now = new Date();
    return editRequests.find(r =>
      r.production_id === productionId &&
      r.status === 'aprovado' &&
      r.liberado_ate &&
      new Date(r.liberado_ate) > now
    );
  };

  const filtered = useMemo(() => {
    const arr = allProductions.filter(p => {
      if (useDateRange) {
        if (dataInicio && p.data && p.data < dataInicio) return false;
        if (dataFim && p.data && p.data > dataFim) return false;
      } else {
        if (periodo && p.periodo !== periodo) return false;
      }
      if (filterEconomia === 'agua' && !IS_AGUA(p.indicator_name)) return false;
      if (filterEconomia === 'luz' && !IS_LUZ(p.indicator_name)) return false;
      if (filterEconomia === 'ambos' && !(IS_AGUA(p.indicator_name) || IS_LUZ(p.indicator_name))) return false;
      const term = search.toLowerCase();
      if (term && !(
        (p.organization_name || '').toLowerCase().includes(term) ||
        (p.indicator_name || '').toLowerCase().includes(term) ||
        (p.municipio || '').toLowerCase().includes(term) ||
        (p.categoria || '').toLowerCase().includes(term) ||
        (p.bpm || '').toLowerCase().includes(term) ||
        (p.companhia || '').toLowerCase().includes(term) ||
        (p.pelotao || '').toLowerCase().includes(term) ||
        (p.gpm || '').toLowerCase().includes(term) ||
        (p.observacao || '').toLowerCase().includes(term) ||
        (p.lancado_por_nome || '').toLowerCase().includes(term) ||
        (p.data || '').includes(term) ||
        String(p.quantidade || '').includes(term) ||
        String(p.pontuacao || '').includes(term)
      )) return false;
      return true;
    });
    // Ordena por data — padrão decrescente, pode ser invertido pelo usuário
    return arr.sort((a, b) => {
      const da = a.data || '';
      const db = b.data || '';
      if (sortDesc) return db.localeCompare(da) || new Date(b.created_date || 0) - new Date(a.created_date || 0);
      return da.localeCompare(db) || new Date(a.created_date || 0) - new Date(b.created_date || 0);
    });
  }, [allProductions, periodo, useDateRange, dataInicio, dataFim, search, filterEconomia, sortDesc]);

  const handleDelete = async () => {
    if (!deleteDialog) return;
    await base44.entities.Production.delete(deleteDialog.id);
    await base44.entities.AuditLog.create({
      usuario: appUser?.email || appUser?.id_funcional || 'sistema',
      acao: 'excluiu',
      tabela: 'Production',
      registro_id: deleteDialog.id,
      detalhe: `Excluiu ${deleteDialog.indicator_name} de ${deleteDialog.organization_name}`,
    });
    queryClient.invalidateQueries({ queryKey: ['productions'] });
    setDeleteDialog(null);
    toast.success('Registro excluído');
  };

  // Estado do form de edição completo (admin)
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);

  const IS_DROGAS_IND = (nome) => (nome || '').toLowerCase().includes('entorpecente') || (nome || '').toLowerCase().includes('droga') || (nome || '').toLowerCase().includes('narcótico') || (nome || '').toLowerCase().includes('narcotico');

  const openEditDialog = (p) => {
    setEditDialog(p);
    setEditForm({
      data: p.data || '',
      indicator_id: p.indicator_id || '',
      quantidade: String(p.quantidade ?? ''),
      observacao: p.observacao || '',
    });
  };

  const selectedEditInd = indicators?.find(i => i.id === editForm.indicator_id);
  const isEditEco = selectedEditInd?.categoria === 'Economia';
  const isEditDroga = IS_DROGAS_IND(selectedEditInd?.nome || editDialog?.indicator_name || '');

  const calcEditPontuacao = () => {
    if (isEditEco) return editDialog?.pontuacao;
    if (isEditDroga) return editDialog?.pontuacao;
    const qtd = parseFloat(editForm.quantidade);
    const peso = selectedEditInd?.peso || editDialog?.peso || 0;
    return isNaN(qtd) ? 0 : qtd * peso;
  };

  const handleEdit = async () => {
    if (!editDialog) return;
    if (!editForm.indicator_id || !editForm.data || editForm.quantidade === '') {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    setEditSaving(true);
    const novaPontuacao = calcEditPontuacao();
    const novaQtd = parseFloat(editForm.quantidade);
    const updateData = {
      data: editForm.data,
      indicator_id: editForm.indicator_id,
      indicator_name: selectedEditInd?.nome || editDialog.indicator_name,
      categoria: selectedEditInd?.categoria || editDialog.categoria,
      peso: selectedEditInd?.peso || editDialog.peso,
      quantidade: novaQtd,
      pontuacao: novaPontuacao,
      observacao: editForm.observacao,
    };
    await base44.entities.Production.update(editDialog.id, updateData);
    await base44.entities.AuditLog.create({
      usuario: appUser?.email || appUser?.id_funcional || 'sistema',
      acao: 'editou',
      tabela: 'Production',
      registro_id: editDialog.id,
      detalhe: `Editou: qtd ${editDialog.quantidade}→${novaQtd} | indicador: ${editDialog.indicator_name}→${updateData.indicator_name} | data: ${editDialog.data}→${editForm.data}`,
    });
    queryClient.invalidateQueries({ queryKey: ['productions'] });
    queryClient.invalidateQueries({ queryKey: ['all-productions'] });
    setEditDialog(null);
    setEditSaving(false);
    toast.success('Registro atualizado');
  };

  const [requestMotivo, setRequestMotivo] = useState('');

  const handleRequestAccess = async () => {
    if (!requestDialog) return;
    await base44.entities.EditRequest.create({
      production_id: requestDialog.id,
      indicator_name: requestDialog.indicator_name,
      organization_name: requestDialog.organization_name,
      data_registro: requestDialog.data,
      solicitante_email: appUser?.email || appUser?.id_funcional || 'sistema',
      solicitante_nome: appUser?.nome_completo || '',
      solicitante_telefone: appUser?.telefone || '',
      motivo: requestMotivo,
      status: 'pendente',
    });
    await base44.entities.AuditLog.create({
      usuario: appUser?.email || appUser?.id_funcional || 'sistema',
      acao: 'editou',
      tabela: 'EditRequest',
      registro_id: requestDialog.id,
      detalhe: `Solicitação de liberação para editar/excluir: ${requestDialog.indicator_name} — ${requestDialog.organization_name} (${requestDialog.data})`,
    });

    // Busca telefone do administrador e notifica via WhatsApp
    try {
      const [adminConfig, adminUser] = await Promise.all([
        base44.entities.SystemConfig.filter({ chave: 'admin_whatsapp' }, '-created_date', 1),
        base44.entities.AppUser.filter({ perfil: 'administrador', status: 'ativo' }, '-created_date', 1),
      ]);
      const adminTel = (adminConfig?.[0]?.valor || adminUser?.[0]?.telefone || '').replace(/\D/g, '');
      if (adminTel) {
        const msg = encodeURIComponent(
          `🔔 *SISPROD BM — Nova Solicitação de Edição*\n\n` +
          `Usuário: *${appUser?.nome_completo || appUser?.id_funcional}*\n` +
          `Indicador: ${requestDialog.indicator_name}\n` +
          `Unidade: ${requestDialog.organization_name}\n` +
          `Data: ${requestDialog.data}\n` +
          (requestMotivo ? `Motivo: ${requestMotivo}\n\n` : '\n') +
          `Acesse o sistema para decidir: ${window.location.origin}/admin?tab=edicoes`
        );
        setTimeout(() => window.open(`https://wa.me/55${adminTel}?text=${msg}`, '_blank'), 300);
      }
    } catch {}

    setRequestDialog(null);
    setRequestMotivo('');
    toast.success('Solicitação enviada ao administrador!');
  };

  const periodoLabel = useDateRange
    ? `${dataInicio || '?'} a ${dataFim || '?'}`
    : (periodo ? `Período ${periodo}` : 'Todos');

  const exportHistoricoExcel = () => {
    setExporting(true);
    const headers = ['Data', 'Unidade', 'Município', 'Indicador', 'Categoria', 'Quantidade', 'Un. Medida', 'Variação (A / B / Δ)', 'Pontos', 'Observação'];
    const rows = filtered.map(p => [
      p.data ? format(new Date(p.data + 'T00:00:00'), 'dd/MM/yyyy') : '',
      limparNomeUnidade(p.organization_name),
      p.municipio || '',
      p.indicator_name || '',
      p.categoria || '',
      p.quantidade ?? 0,
      getUnidadeMedida(p),
      buildVariacaoTexto(p),
      p.pontuacao ?? 0,
      p.observacao || '',
    ]);
    const totalQtd = filtered.reduce((s, p) => s + (p.quantidade || 0), 0);
    const totalPts = filtered.reduce((s, p) => s + (p.pontuacao  || 0), 0);
    rows.push(['TOTAL GERAL', '', '', '', '', totalQtd, '', '', totalPts, '']);
    exportXlsx({
      titulo: 'Histórico de Produção',
      periodoLabel,
      geradoPor: appUser?.nome_completo || appUser?.email || 'Sistema',
      now: format(new Date(), 'dd/MM/yyyy HH:mm'),
      totalRegistros: filtered.length,
      totalQtd,
      totalPontos: totalPts,
      headers,
      rows,
      filename: `SISPROD_Historico_${periodoLabel.replace(/[\s\/\-]/g, '_')}_${format(new Date(), 'yyyyMMdd_HHmm')}`,
      hasTotalRow: true,
    });
    setExporting(false);
    toast.success('Planilha Excel exportada com sucesso!');
  };

  const printHistorico = () => {
    const totalQtd = filtered.reduce((s, p) => s + (p.quantidade || 0), 0);
    const totalPts = filtered.reduce((s, p) => s + (p.pontuacao  || 0), 0);
    const geradoPor = appUser?.nome_completo || appUser?.email || 'Sistema';
    const now = format(new Date(), 'dd/MM/yyyy HH:mm');
    const trRows = filtered.map((p, ri) => {
      const cls = ri % 2 === 0 ? '' : 'odd';
      const variacao = buildVariacaoTexto(p);
      return `<tr class="${cls}">
        <td>${p.data ? format(new Date(p.data + 'T00:00:00'), 'dd/MM/yyyy') : '-'}</td>
        <td>${limparNomeUnidade(p.organization_name)}</td>
        <td>${p.municipio || '-'}</td>
        <td>${p.indicator_name || '-'}</td>
        <td>${p.categoria || '-'}</td>
        <td style="text-align:right">${p.categoria === 'Economia' ? (p.quantidade > 0 ? '+' : '') + (p.quantidade ?? 0) : (p.quantidade ?? 0)}</td>
        <td style="text-align:center">${getUnidadeMedida(p)}</td>
        <td style="text-align:center;font-size:7.5pt">${variacao || '—'}</td>
        <td style="text-align:right;font-weight:700">${p.pontuacao ?? 0}</td>
      </tr>`;
    }).join('');
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/>
<title>SISPROD BM — Histórico de Produção</title>
<style>
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:Arial,sans-serif; font-size:9pt; color:#1a1a1a; background:#fff; padding:10mm; }
.header { display:flex; align-items:center; border-bottom:3px solid #1e5631; padding-bottom:8px; margin-bottom:10px; }
.header-logo { width:52px;height:52px;background:#1e5631;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-right:12px; }
.header-logo span { color:white;font-weight:900;font-size:14pt; }
.header-text h1 { font-size:12pt;font-weight:900;color:#1e5631;text-transform:uppercase; }
.header-text h2 { font-size:9pt;font-weight:600;color:#333;margin-top:1px; }
.meta { display:grid;grid-template-columns:repeat(3,1fr);gap:6px;background:#f0f4f0;border:1px solid #c8dac8;border-radius:6px;padding:8px 10px;margin-bottom:10px; }
.meta-item label { font-size:7pt;font-weight:700;text-transform:uppercase;color:#1e5631;display:block; }
.meta-item span { font-size:9pt;font-weight:600; }
table { width:100%;border-collapse:collapse;margin-top:4px; }
thead { display:table-header-group; }
tr { page-break-inside:avoid; }
th { background:#1e5631;color:#fff;padding:5px 6px;text-align:left;font-size:8pt;font-weight:700;text-transform:uppercase;white-space:nowrap; }
td { padding:4px 6px;font-size:8.5pt;border-bottom:1px solid #e0e8e0;vertical-align:middle; }
tr.odd td { background:#f7faf7; }
tr.total-row td { background:#d4e8d4;font-weight:700;font-size:9pt;border-top:2px solid #1e5631; }
.footer { margin-top:12px;padding-top:8px;border-top:1px solid #c8dac8;display:flex;justify-content:space-between;font-size:7pt;color:#888; }
@media print { @page { size:A4 landscape;margin:8mm 10mm; } body { padding:0; } }
</style></head><body>
<div class="header"><div class="header-logo"><span>BM</span></div>
<div class="header-text"><h1>Brigada Militar — Rio Grande do Sul</h1>
<h2>Sistema de Produtividade Operacional — SISPROD BM</h2>
<p>Histórico de Produção</p></div></div>
<div class="meta">
<div class="meta-item"><label>Período</label><span>${periodoLabel}</span></div>
<div class="meta-item"><label>Total de Registros</label><span>${filtered.length.toLocaleString('pt-BR')}</span></div>
<div class="meta-item"><label>Qtd Total</label><span>${totalQtd.toLocaleString('pt-BR')}</span></div>
<div class="meta-item"><label>Pontuação Total</label><span>${totalPts.toLocaleString('pt-BR')} pts</span></div>
<div class="meta-item"><label>Gerado em</label><span>${now}</span></div>
<div class="meta-item"><label>Responsável</label><span>${geradoPor}</span></div>
</div>
<table>
<thead><tr><th>Data</th><th>Unidade</th><th>Município</th><th>Indicador</th><th>Categoria</th><th>Qtd</th><th>Un.</th><th>Variação</th><th>Pontos</th></tr></thead>
<tbody>${trRows}</tbody>
<tfoot><tr class="total-row"><td>TOTAL GERAL</td><td colspan="4"></td><td style="text-align:right">${totalQtd.toLocaleString('pt-BR')}</td><td colspan="2"></td><td style="text-align:right">${totalPts.toLocaleString('pt-BR')}</td></tr></tfoot>
</table>
<div class="footer"><span>SISPROD BM — Brigada Militar / RS | Documento gerado automaticamente</span><span>${now}</span></div>
</body></html>`;
    const win = window.open('', '_blank', 'width=1100,height=800');
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-6rem)]">
      <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Histórico de Produção</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie os registros lançados — {filtered.length} registros</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setSortDesc(v => !v)}
            variant="outline" size="sm"
            className="gap-1.5 text-xs"
            title={sortDesc ? 'Ordem: mais recente primeiro. Clique para inverter.' : 'Ordem: mais antigo primeiro. Clique para inverter.'}
          >
            {sortDesc ? <ArrowDownUp className="w-4 h-4" /> : <ArrowUpDown className="w-4 h-4" />}
            <span className="hidden sm:inline">{sortDesc ? 'Mais recente' : 'Mais antigo'}</span>
          </Button>
          <Button onClick={exportHistoricoExcel} disabled={exporting || filtered.length === 0} variant="outline" size="sm" className="gap-1.5 text-xs">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            <span className="hidden sm:inline">Excel</span><span className="sm:hidden">XLS</span>
          </Button>
          <Button onClick={printHistorico} disabled={filtered.length === 0} variant="outline" size="sm" className="gap-1.5 text-xs">
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Imprimir</span><span className="sm:hidden">Print</span>
          </Button>
        </div>
      </div>

      {/* Filtro de período — fixo */}
      <div className="flex-shrink-0 bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-4 flex-wrap">
          <button
            onClick={() => setUseDateRange(false)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${!useDateRange ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}
          >
            Por Trimestre
          </button>
          <button
            onClick={() => setUseDateRange(true)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${useDateRange ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}
          >
            Por Intervalo de Datas
          </button>
        </div>
        {!useDateRange ? (
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {getAllPeriodos().map(p => (
                <SelectItem key={p} value={p}>{getPeriodoLabel(p)}</SelectItem>
              ))}
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
                <Button variant="ghost" size="sm" className="gap-1 text-destructive" onClick={() => { setDataInicio(''); setDataFim(''); }}>
                  <X className="w-3.5 h-3.5" /> Limpar datas
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filtros rápidos de Economia + Search */}
      <div className="flex-shrink-0 flex flex-col sm:flex-row gap-2 items-start sm:items-center">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterEconomia(filterEconomia === 'agua' ? null : 'agua')}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${filterEconomia === 'agua' ? 'bg-blue-600 text-white border-blue-600' : 'border-border text-muted-foreground hover:border-blue-400 hover:text-blue-700'}`}
          >
            <Droplets className="w-3.5 h-3.5" /> Água (m³)
          </button>
          <button
            onClick={() => setFilterEconomia(filterEconomia === 'luz' ? null : 'luz')}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${filterEconomia === 'luz' ? 'bg-yellow-500 text-white border-yellow-500' : 'border-border text-muted-foreground hover:border-yellow-400 hover:text-yellow-700'}`}
          >
            <Lightbulb className="w-3.5 h-3.5" /> Luz (kWh)
          </button>
          <button
            onClick={() => setFilterEconomia(filterEconomia === 'ambos' ? null : 'ambos')}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${filterEconomia === 'ambos' ? 'bg-purple-600 text-white border-purple-600' : 'border-border text-muted-foreground hover:border-purple-400 hover:text-purple-700'}`}
          >
            <Droplets className="w-3 h-3" /><Lightbulb className="w-3 h-3" /> Água + Luz
          </button>
          {filterEconomia && (
            <button onClick={() => setFilterEconomia(null)} className="text-xs text-destructive flex items-center gap-1 px-2 py-1 rounded-full border border-destructive/30 hover:bg-destructive/5">
              <X className="w-3 h-3" /> Limpar filtro
            </button>
          )}
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por unidade, indicador, município, data, quantidade..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table — rola independentemente */}
      <div className="flex-1 min-h-0 bg-card rounded-xl border border-border overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider whitespace-nowrap">Data</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider">Unidade</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider">Município</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider">Indicador</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider">Categoria</th>
                <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wider">Qtd</th>
                <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider">Un. Medida</th>
                <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider whitespace-nowrap">Evolução ∆</th>
                <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wider">Pontos</th>
                <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider whitespace-nowrap">Anexo</th>
                <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(p => {
                const within24h = canEditWithin24h(p, isAdmin);
                const isOwnRecord = p.created_by === appUser?.email || p.created_by === appUser?.id_funcional;
                const activeLiberacao = !isAdmin && isOwnRecord ? getActiveLiberacao(p.id) : null;
                const canEdit = isAdmin || (isOwnRecord && within24h) || !!activeLiberacao;
                const showRequestBtn = isOwnRecord && !within24h && !activeLiberacao && !isAdmin;

                return (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{p.data ? format(new Date(p.data + 'T00:00:00'), 'dd/MM/yyyy') : '-'}</td>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{limparNomeUnidade(p.organization_name)}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{p.municipio || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {IS_AGUA(p.indicator_name) && <Droplets className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />}
                        {IS_LUZ(p.indicator_name) && <Lightbulb className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />}
                        <span>{p.indicator_name || '-'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className={catColors[p.categoria] || ''}>{p.categoria || '-'}</Badge>
                    </td>
                    <td className={`px-4 py-3 text-right font-mono ${p.categoria === 'Economia' && p.quantidade > 0 ? 'text-red-600' : p.categoria === 'Economia' && p.quantidade < 0 ? 'text-green-700' : ''}`}>
                      {p.categoria === 'Economia'
                        ? (p.quantidade > 0 ? '+' : '') + formatNumber(p.quantidade)
                        : formatNumber(p.quantidade)}
                    </td>
                    <td className="px-4 py-3 text-center text-xs font-mono font-semibold">
                      {IS_AGUA(p.indicator_name) ? <span className="text-blue-600">m³</span> : IS_LUZ(p.indicator_name) ? <span className="text-yellow-600">kWh</span> : <span className="text-muted-foreground">{getUnidadeMedida(p)}</span>}
                    </td>
                    <td className="px-4 py-3 text-center text-xs">
                      {IS_ECONOMIA_CONSUMO(p) ? (() => {
                        const un = IS_AGUA(p.indicator_name) ? 'm³' : 'kWh';
                        const obs = p.observacao || '';
                        // Extrai os três consumos gravados na observação
                        // Formato: "Água — MM/YYYY: X m³ | Ant (MM/YYYY): X m³ | Atual (MM/YYYY): X m³ | VarB-VarA: ..."
                        const antMatch = obs.match(/Ant[^:]*:\s*([\d.,]+)\s*(?:m³|kWh)/i);
                        const atualMatch = obs.match(/Atual[^:]*:\s*([\d.,]+)\s*(?:m³|kWh)/i);
                        // Dois atrás: primeiro valor numérico antes de "| Ant"
                        const doisAtrasMatch = obs.match(/([\d.,]+)\s*(?:m³|kWh)\s*\|\s*Ant/i);
                        const ant = antMatch ? parseFloat(antMatch[1].replace(',', '.')) : null;
                        const atual = atualMatch ? parseFloat(atualMatch[1].replace(',', '.')) : null;
                        const doisAtras = doisAtrasMatch ? parseFloat(doisAtrasMatch[1].replace(',', '.')) : null;
                        const varB = ant != null && atual != null ? atual - ant : null;
                        const varA = doisAtras != null && ant != null ? ant - doisAtras : null;
                        // Delta = VarB − VarA (diferença entre as variações)
                        const delta = varB !== null && varA !== null ? varB - varA : null;
                        if (varB === null) return <span className="text-muted-foreground">—</span>;
                        return (
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex flex-col items-center gap-0.5 text-[10px] text-muted-foreground">
                              {varA !== null && <span>A: {varA >= 0 ? '+' : ''}{varA.toFixed(1)} {un}</span>}
                              <span>B: {varB >= 0 ? '+' : ''}{varB.toFixed(1)} {un}</span>
                            </div>
                            {delta !== null && (
                              <span className={`flex items-center gap-0.5 font-mono font-bold text-xs ${delta < 0 ? 'text-green-600' : delta > 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                                {delta < 0 ? <TrendingDown className="w-3 h-3" /> : delta > 0 ? <TrendingUp className="w-3 h-3" /> : null}
                                {delta >= 0 ? '+' : ''}{delta.toFixed(1)} {un}
                              </span>
                            )}
                          </div>
                        );
                      })() : <span className="text-muted-foreground text-[10px]">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-bold">{formatNumber(p.pontuacao)}</td>
                    <td className="px-4 py-3 text-center">
                      {p.anexo_url && isAdmin ? (() => {
                        const url = p.anexo_url;
                        const isImg = /\.(png|jpg|jpeg|gif|webp|svg)/i.test(url);
                        const isPdf = /\.pdf/i.test(url);
                        const Icon = isImg ? Image : isPdf ? FileText : Download;
                        const label = isImg ? 'Imagem' : isPdf ? 'PDF' : 'Arquivo';
                        return (
  <button
    onClick={async () => {
      try {
        // Extrai o public_id da URL do Cloudinary
        const match = url.match(/\/sisprod\/([^/.]+)/);
        const publicId = match ? `sisprod/${match[1]}` : null;
        if (!publicId) { window.open(url, '_blank'); return; }
        const res = await fetch('/api/download-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ publicId }),
        });
        const data = await res.json();
        if (data.url) window.open(data.url, '_blank');
        else window.open(url, '_blank');
      } catch {
        window.open(url, '_blank');
      }
    }}
    title={`Baixar ${label}`}
    className="inline-flex flex-col items-center gap-0.5 text-primary hover:text-primary/80 transition-colors cursor-pointer"
  >
    <Icon className="w-4 h-4" />
    <span className="text-[9px] font-medium">{label}</span>
  </button>
);
                      })() : p.anexo_url ? (
                        <span className="text-muted-foreground text-xs" title="Apenas administradores podem baixar anexos">
                          <Lock className="w-3.5 h-3.5 inline opacity-40" />
                        </span>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1 items-center">
                        {activeLiberacao && (
                          <span className="text-[9px] text-green-700 font-semibold hidden sm:inline">
                            ⏱ {format(new Date(activeLiberacao.liberado_ate), 'HH:mm')}
                          </span>
                        )}
                        {canEdit && isAdmin ? (
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(p)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteDialog(p)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        ) : showRequestBtn ? (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => setRequestDialog(p)} title="Solicitar liberação ao administrador">
                            <Lock className="w-3.5 h-3.5" />
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-muted-foreground">
                    Nenhum registro encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir "{deleteDialog?.indicator_name}" de "{deleteDialog?.organization_name}"? Essa ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog — completo para admin (igual ao do Lançamento) */}
      <Dialog open={!!editDialog} onOpenChange={() => setEditDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Lançamento</DialogTitle>
            <DialogDescription>
              {editDialog?.organization_name} — {editDialog?.municipio || ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Data *</Label>
              <Input type="date" value={editForm.data || ''} onChange={e => setEditForm(f => ({ ...f, data: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Indicador *</Label>
              <Select value={editForm.indicator_id || ''} onValueChange={v => setEditForm(f => ({ ...f, indicator_id: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione o indicador" /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {Object.entries((indicators || []).filter(i => i.status !== 'inativo').reduce((acc, ind) => {
                    if (!acc[ind.categoria]) acc[ind.categoria] = [];
                    acc[ind.categoria].push(ind);
                    return acc;
                  }, {})).map(([cat, inds]) => (
                    <React.Fragment key={cat}>
                      <div className="px-2 py-1 text-xs font-bold text-muted-foreground bg-muted/40">{cat}</div>
                      {inds.map(ind => (
                        <SelectItem key={ind.id} value={ind.id}>{ind.nome} (×{ind.peso})</SelectItem>
                      ))}
                    </React.Fragment>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Quantidade *</Label>
              <Input
                type="number" min="0" step="0.0001"
                value={editForm.quantidade || ''}
                onChange={e => setEditForm(f => ({ ...f, quantidade: e.target.value }))}
                className="mt-1 font-semibold"
              />
              {!isEditEco && !isEditDroga && editForm.quantidade && (
                <p className="text-xs text-muted-foreground mt-1">
                  Nova pontuação: <strong>{(calcEditPontuacao() || 0).toLocaleString('pt-BR')} pts</strong>
                </p>
              )}
              {(isEditEco || isEditDroga) && (
                <p className="text-xs text-muted-foreground mt-1">Pontuação especial mantida: {editDialog?.pontuacao} pts</p>
              )}
            </div>
            <div>
              <Label className="text-xs">Observação</Label>
              <textarea
                value={editForm.observacao || ''}
                onChange={e => setEditForm(f => ({ ...f, observacao: e.target.value }))}
                placeholder="Observações adicionais..."
                className="mt-1 w-full h-16 px-3 py-2 text-sm border border-input rounded-md bg-transparent resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)}>Cancelar</Button>
            <Button onClick={handleEdit} disabled={editSaving}>
              {editSaving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Access Dialog */}
      <Dialog open={!!requestDialog} onOpenChange={() => { setRequestDialog(null); setRequestMotivo(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar Liberação de Edição</DialogTitle>
            <DialogDescription>
              O prazo de 24h para edição expirou. Envie uma solicitação ao administrador para liberar edição/exclusão de:
              <br /><strong>{requestDialog?.indicator_name}</strong> — {requestDialog?.organization_name} ({requestDialog?.data})
            </DialogDescription>
          </DialogHeader>
          <div className="py-3">
            <Label className="text-xs font-semibold uppercase tracking-wider">Motivo da solicitação</Label>
            <textarea
              value={requestMotivo}
              onChange={e => setRequestMotivo(e.target.value)}
              placeholder="Descreva o motivo da necessidade de edição..."
              className="mt-1.5 w-full h-20 px-3 py-2 text-sm border border-input rounded-md bg-transparent resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRequestDialog(null); setRequestMotivo(''); }}>Cancelar</Button>
            <Button onClick={handleRequestAccess}>Enviar Solicitação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}