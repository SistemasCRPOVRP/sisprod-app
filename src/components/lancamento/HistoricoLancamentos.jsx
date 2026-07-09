import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { format, isAfter, subHours } from 'date-fns';
import {
  History, Pencil, Trash2, Lock, ExternalLink, X, ChevronDown, ChevronUp, Calendar, MessageCircle, Droplets, Lightbulb, Clock, AlertCircle, Search
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { getPeriodo } from '@/lib/utils';

const catColors = {
  'Preventiva': 'bg-primary/10 text-primary',
  'Repressiva': 'bg-destructive/10 text-destructive',
  'Apreensão': 'bg-amber-100 text-amber-800',
  'Atendimento': 'bg-blue-100 text-blue-700',
  'Economia': 'bg-green-100 text-green-700',
};

const IS_AGUA = (nome) => nome?.toLowerCase().includes('água') || nome?.toLowerCase().includes('agua');
const IS_LUZ  = (nome) => nome?.toLowerCase().includes('luz') || nome?.toLowerCase().includes('energia');
const IS_DROGAS = (nome) => nome?.toLowerCase().includes('entorpecente') || nome?.toLowerCase().includes('droga') || nome?.toLowerCase().includes('narcótico') || nome?.toLowerCase().includes('narcotico');

const PERFIS_ADMIN = ['administrador', 'comandante_crpm'];
const PERFIS_AMPLOS = ['administrador', 'comandante_crpm', 'p1', 'p2', 'p3', 'p4'];

function isAdmin(appUser) {
  return PERFIS_ADMIN.includes(appUser?.perfil);
}

// Verifica se o usuário pertence à mesma OPM do registro
function userBelongsToOrg(appUser, record) {
  if (!appUser || !record) return false;
  const perfil = appUser.perfil;
  if (PERFIS_AMPLOS.includes(perfil)) return true;

  const recBpm = record.bpm || '';
  const recCia = record.companhia || '';
  const recPel = record.pelotao || '';
  const recGpm = record.gpm || '';
  const uBpm = appUser.bpm || '';
  const uCia = appUser.companhia || '';
  const uPel = appUser.pelotao || '';
  const uGpm = appUser.gpm || '';

  if (perfil === 'comandante_btl') return uBpm === recBpm;
  if (perfil === 'comandante_cia') return uBpm === recBpm && uCia === recCia;
  if (perfil === 'comandante_pel') return uBpm === recBpm && uCia === recCia && uPel === recPel;
  if (perfil === 'comandante_gpm') return uBpm === recBpm && uCia === recCia && uPel === recPel && uGpm === recGpm;

  // operador e demais — mesmo organization_id
  const recOrgId = record.organization_id || [recBpm, recCia, recPel, recGpm].filter(Boolean).join('|');
  const uOrgId = appUser.organization_id || [uBpm, uCia, uPel, uGpm].filter(Boolean).join('|');
  return recOrgId === uOrgId;
}

// Verifica se está dentro das 48h de edição livre (created_date OU updated_date)
function canEditFree(record) {
  const ref = record.updated_date || record.created_date;
  if (!ref) return false;
  return isAfter(new Date(ref), subHours(new Date(), 48));
}

function extrairConsumoAtualObs(obs) {
  if (!obs) return null;
  const m = obs.match(/Atual\s*\([^)]*\):\s*([\d.,]+)\s*(?:m³|kWh)/i);
  if (m) return m[1].replace(',', '.');
  return null;
}

function formatQtdExibicao(p) {
  const isAgua = IS_AGUA(p.indicator_name);
  const isLuz  = IS_LUZ(p.indicator_name);
  const isDroga = IS_DROGAS(p.indicator_name);
  const isEco  = p.categoria === 'Economia' && (isAgua || isLuz);

  if (isEco) {
    const consumoAtual = extrairConsumoAtualObs(p.observacao);
    const sigla = isAgua ? 'm³' : 'kWh';
    if (consumoAtual) {
      return (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          {isAgua ? <Droplets className="w-3 h-3 text-blue-500" /> : <Lightbulb className="w-3 h-3 text-yellow-500" />}
          Atual: <span className="font-semibold font-mono">{parseFloat(consumoAtual).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} {sigla}</span>
        </span>
      );
    }
    const delta = Number(p.quantidade);
    return (
      <span className={`text-xs font-semibold ${delta < 0 ? 'text-green-700' : 'text-red-600'}`}>
        {delta >= 0 ? '+' : ''}{delta.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} {sigla} {delta < 0 ? '↓ diminuiu' : '↑ aumentou'}
      </span>
    );
  }

  if (isDroga) {
    return (
      <span className="text-xs text-muted-foreground">
        {Number(p.quantidade).toLocaleString('pt-BR', { maximumFractionDigits: 4 })} <span className="font-semibold">gr</span>
      </span>
    );
  }

  return (
    <span className="text-xs text-muted-foreground">
      Qtd: <span className="font-mono font-semibold">{Number(p.quantidade).toLocaleString('pt-BR', { maximumFractionDigits: 4 })}</span>
    </span>
  );
}

// Dialog de edição completo (data, indicador, quantidade, observação)
function EditDialog({ record, appUser, indicators, onClose, onSaved, onRecordUpdated }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    data: record?.data || '',
    indicator_id: record?.indicator_id || '',
    quantidade: String(record?.quantidade ?? ''),
    observacao: record?.observacao || '',
  });

  const selectedInd = indicators?.find(i => i.id === form.indicator_id);
  const isEco = selectedInd?.categoria === 'Economia';
  const isDroga = IS_DROGAS(selectedInd?.nome || record?.indicator_name || '');

  const calcPontuacao = () => {
    if (isEco) return record.pontuacao; // mantém original
    if (isDroga) return record.pontuacao; // mantém original
    const qtd = parseFloat(form.quantidade);
    const peso = selectedInd?.peso || record?.peso || 0;
    return isNaN(qtd) ? 0 : qtd * peso;
  };

  const handleSave = async () => {
    if (!form.indicator_id || !form.data || !form.quantidade) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    setSaving(true);
    const novaPontuacao = calcPontuacao();
    const novaQtd = parseFloat(form.quantidade);
    const updateData = {
      data: form.data,
      periodo: getPeriodo(form.data),
      indicator_id: form.indicator_id,
      indicator_name: selectedInd?.nome || record.indicator_name,
      categoria: selectedInd?.categoria || record.categoria,
      peso: selectedInd?.peso || record.peso,
      quantidade: novaQtd,
      pontuacao: novaPontuacao,
      observacao: form.observacao,
    };
    // Chamada direta ao Firestore — a permissão de editar (48h/admin/liberação)
    // já é verificada antes de mostrar o botão (ver podeEditar mais abaixo).
    // Antes chamava base44.functions.invoke('productionManager', ...), uma
    // função que não existe neste projeto (era da plataforma Base44 original,
    // nunca migrada) — o erro não tratado travava o botão em "salvando" para sempre.
    try {
      await base44.entities.Production.update(record.id, updateData);
    } catch (err) {
      toast.error('Erro ao salvar: ' + (err?.message || ''));
      setSaving(false);
      return;
    }
    // Atualização imediata local — sem esperar refetch
    const updatedRecord = { ...record, ...updateData };
    queryClient.setQueriesData({ queryKey: ['hist-lancamento'] }, (old) =>
      Array.isArray(old) ? old.map(r => r.id === record.id ? updatedRecord : r) : old
    );
    // Invalida demais caches em background
    queryClient.invalidateQueries({ queryKey: ['productions'] });
    queryClient.invalidateQueries({ queryKey: ['all-productions'] });
    queryClient.invalidateQueries({ queryKey: ['hist-lancamento'] });
    base44.entities.AuditLog.create({
      usuario: appUser?.email || appUser?.id_funcional || 'sistema',
      acao: 'editou',
      tabela: 'Production',
      registro_id: record.id,
      detalhe: `Editou registro: qtd ${record.quantidade}→${novaQtd} | indicador: ${record.indicator_name}→${updateData.indicator_name} | data: ${record.data}→${form.data}`,
    });
    setSaving(false);
    toast.success('Registro atualizado com sucesso!');
    onRecordUpdated?.(updatedRecord);
    onSaved?.();
    onClose();
  };

  const groupedIndicators = (indicators || []).reduce((acc, ind) => {
    if (ind.status === 'inativo') return acc;
    if (!acc[ind.categoria]) acc[ind.categoria] = [];
    acc[ind.categoria].push(ind);
    return acc;
  }, {});

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Lançamento</DialogTitle>
          <DialogDescription>
            Altere os campos necessários. A pontuação será recalculada automaticamente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs">Data *</Label>
            <Input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Indicador *</Label>
            <Select value={form.indicator_id} onValueChange={v => setForm(f => ({ ...f, indicator_id: v }))}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione o indicador" /></SelectTrigger>
              <SelectContent className="max-h-64">
                {Object.entries(groupedIndicators).map(([cat, inds]) => (
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
              value={form.quantidade}
              onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))}
              className="mt-1 font-semibold"
            />
            {!isEco && !isDroga && form.quantidade && (
              <p className="text-xs text-muted-foreground mt-1">
                Nova pontuação: <strong>{calcPontuacao().toLocaleString('pt-BR')} pts</strong>
              </p>
            )}
            {(isEco || isDroga) && (
              <p className="text-xs text-muted-foreground mt-1">Pontuação especial mantida: {record.pontuacao} pts</p>
            )}
          </div>
          <div>
            <Label className="text-xs">Observação</Label>
            <Textarea
              value={form.observacao}
              onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
              placeholder="Observações adicionais..."
              className="mt-1 h-16"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Dialog de solicitação de edição/exclusão
function RequestDialog({ record, appUser, orgName, onClose, onSaved }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [tipoSolicitacao, setTipoSolicitacao] = useState('edicao');
  const [motivo, setMotivo] = useState('');

  const handleSend = async () => {
    if (!motivo.trim()) {
      toast.error('Informe o motivo da solicitação');
      return;
    }
    setSaving(true);
    await base44.entities.EditRequest.create({
      production_id: record.id,
      indicator_name: record.indicator_name,
      organization_name: record.organization_name || orgName,
      data_registro: record.data,
      solicitante_email: appUser?.email || appUser?.id_funcional || 'sistema',
      solicitante_nome: appUser?.nome_completo || '',
      solicitante_matricula: appUser?.id_funcional || '',
      solicitante_telefone: appUser?.telefone || '',
      tipo_solicitacao: tipoSolicitacao,
      motivo,
      status: 'pendente',
    });
    await base44.entities.AuditLog.create({
      usuario: appUser?.email || appUser?.id_funcional || 'sistema',
      acao: 'editou',
      tabela: 'Production',
      registro_id: record.id,
      detalhe: `Solicitação de ${tipoSolicitacao} enviada. Motivo: ${motivo}`,
    });
    try {
      const [adminConfig, adminUser] = await Promise.all([
        base44.entities.SystemConfig.filter({ chave: 'admin_whatsapp' }, '-created_date', 1),
        base44.entities.AppUser.filter({ perfil: 'administrador', status: 'ativo' }, '-created_date', 1),
      ]);
      const adminTel = (adminConfig?.[0]?.valor || adminUser?.[0]?.telefone || '').replace(/\D/g, '');
      if (adminTel) {
        const tipoLabel = tipoSolicitacao === 'edicao' ? 'Edição' : 'Exclusão';
        const msg = encodeURIComponent(
          `🔔 *SISPROD BM — Nova Solicitação de ${tipoLabel}*\n\n` +
          `Solicitante: *${appUser?.nome_completo || appUser?.id_funcional}*\n` +
          `Unidade: ${record.organization_name || orgName}\n` +
          `Indicador: ${record.indicator_name}\n` +
          `Data do lançamento: ${record.data}\n` +
          `Tipo da solicitação: *${tipoLabel}*\n` +
          `Motivo: ${motivo}\n\n` +
          `Acesse o sistema para análise da solicitação:\n${window.location.origin}/admin?tab=edicoes`
        );
        setTimeout(() => window.open(`https://wa.me/55${adminTel}?text=${msg}`, '_blank'), 300);
      }
    } catch {}
    queryClient.invalidateQueries({ queryKey: ['edit-requests'] });
    setSaving(false);
    toast.success('Solicitação enviada ao administrador!');
    onSaved?.();
    onClose();
  };

  const dataFormatada = record.data ? format(new Date(record.data + 'T00:00:00'), 'dd/MM/yyyy') : '-';

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-600" /> Solicitar Edição / Exclusão
          </DialogTitle>
          <DialogDescription>
            O prazo de 48h expirou. Solicite autorização ao administrador.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {/* Dados pré-preenchidos */}
          <div className="rounded-lg bg-muted/40 border border-border p-3 space-y-1.5 text-xs">
            <p className="font-semibold text-muted-foreground uppercase tracking-wider mb-1">Dados do Solicitante</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <div><span className="text-muted-foreground">Nome:</span> <span className="font-medium">{appUser?.nome_completo || '—'}</span></div>
              <div><span className="text-muted-foreground">Matrícula:</span> <span className="font-medium font-mono">{appUser?.id_funcional || '—'}</span></div>
              <div className="col-span-2"><span className="text-muted-foreground">Unidade:</span> <span className="font-medium">{record.organization_name || orgName || '—'}</span></div>
              <div><span className="text-muted-foreground">Data solicitar:</span> <span className="font-mono">{format(new Date(), 'dd/MM/yyyy')}</span></div>
            </div>
          </div>
          <div className="rounded-lg bg-muted/40 border border-border p-3 space-y-1.5 text-xs">
            <p className="font-semibold text-muted-foreground uppercase tracking-wider mb-1">Lançamento</p>
            <div><span className="text-muted-foreground">Indicador:</span> <span className="font-medium">{record.indicator_name}</span></div>
            <div><span className="text-muted-foreground">Data:</span> <span className="font-mono">{dataFormatada}</span></div>
            <div><span className="text-muted-foreground">Quantidade:</span> <span className="font-mono">{record.quantidade}</span></div>
            <div><span className="text-muted-foreground">Pontuação:</span> <span className="font-semibold text-primary">{record.pontuacao} pts</span></div>
          </div>
          <div>
            <Label className="text-xs font-semibold">Tipo de Solicitação *</Label>
            <Select value={tipoSolicitacao} onValueChange={setTipoSolicitacao}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="edicao">✏️ Edição</SelectItem>
                <SelectItem value="exclusao">🗑️ Exclusão</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-semibold">Motivo da Solicitação *</Label>
            <Textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Descreva detalhadamente o motivo..."
              className="mt-1 h-20"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSend} disabled={saving || !motivo.trim()} className="gap-2">
            <MessageCircle className="w-4 h-4" /> {saving ? 'Enviando...' : 'Enviar Solicitação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function HistoricoLancamentos({ appUser, orgId, orgName, defaultOpen = false, hideToggle = false, onRecordUpdated, onRecordDeleted }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(defaultOpen);
  const [modo, setModo] = useState('data');
  const [dataSelecionada, setDataSelecionada] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [editDialog, setEditDialog] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [requestDialog, setRequestDialog] = useState(null);
  const [saving, setSaving] = useState(false);

  const admin = isAdmin(appUser);

  const { data: indicators = [] } = useQuery({
    queryKey: ['indicators'],
    queryFn: () => base44.entities.Indicator.list(),
  });

  const { data: registros = [], isLoading, refetch } = useQuery({
    queryKey: ['hist-lancamento', orgId, modo, dataSelecionada, dataInicio, dataFim],
    queryFn: async () => {
      if (!orgId) return [];
      // Limite abaixo de 10000, que é o máximo aceito pelo Firestore em uma
      // única consulta — 99999 fazia a consulta inteira falhar (silenciosamente,
      // sem mostrar erro), fazendo parecer que não havia lançamentos no período.
      // Sem orderBy no Firestore (evita exigir índice composto
      // organization_id+data, que não existe) — ordena por data no código.
      const raw = await base44.entities.Production.filter({ organization_id: orgId }, undefined, 9999);
      const all = [...raw].sort((a, b) => (b.data || '').localeCompare(a.data || ''));
      if (modo === 'data') return all.filter(r => r.data === dataSelecionada);
      return all.filter(r => {
        if (dataInicio && r.data < dataInicio) return false;
        if (dataFim && r.data > dataFim) return false;
        return true;
      });
    },
    enabled: open && !!orgId,
  });

  const { data: editRequests = [] } = useQuery({
    queryKey: ['edit-requests'],
    queryFn: () => base44.entities.EditRequest.list('-created_date'),
    enabled: open,
  });

  const getActiveLiberacao = (productionId) => {
    const now = new Date();
    return editRequests.find(r =>
      r.production_id === productionId &&
      r.status === 'aprovado' &&
      r.liberado_ate &&
      new Date(r.liberado_ate) > now
    );
  };

  const getPendingRequest = (productionId) => {
    return editRequests.find(r =>
      r.production_id === productionId &&
      r.status === 'pendente'
    );
  };

  const handleDelete = async () => {
    if (!deleteDialog) return;
    setSaving(true);
    // Chamada direta ao Firestore — a permissão de excluir (48h/admin/liberação)
    // já é verificada antes de mostrar o botão (ver podeEditar mais abaixo).
    // Antes chamava base44.functions.invoke('productionManager', ...), uma
    // função que não existe neste projeto (era da plataforma Base44 original,
    // nunca migrada) — o erro não tratado travava o botão em "excluindo" para sempre.
    try {
      await base44.entities.Production.delete(deleteDialog.id);
    } catch (err) {
      toast.error('Erro ao excluir: ' + (err?.message || ''));
      setSaving(false);
      return;
    }
    // Remove imediatamente da lista local — sem esperar refetch
    queryClient.setQueriesData({ queryKey: ['hist-lancamento'] }, (old) =>
      Array.isArray(old) ? old.filter(r => r.id !== deleteDialog.id) : old
    );
    // Invalida demais caches em background
    queryClient.invalidateQueries({ queryKey: ['productions'] });
    queryClient.invalidateQueries({ queryKey: ['all-productions'] });
    queryClient.invalidateQueries({ queryKey: ['hist-lancamento'] });
    base44.entities.AuditLog.create({
      usuario: appUser?.email || appUser?.id_funcional || 'sistema',
      acao: 'excluiu',
      tabela: 'Production',
      registro_id: deleteDialog.id,
      detalhe: `Excluiu ${deleteDialog.indicator_name} de ${deleteDialog.organization_name} (${deleteDialog.data})`,
    });
    onRecordDeleted?.(deleteDialog.id);
    setDeleteDialog(null);
    setSaving(false);
    toast.success('Registro excluído!');
  };

  // Filtragem por texto em todas as colunas
  const registrosFiltrados = searchTerm.trim()
    ? registros.filter(r => {
        const t = searchTerm.toLowerCase();
        return (
          (r.indicator_name || '').toLowerCase().includes(t) ||
          (r.categoria || '').toLowerCase().includes(t) ||
          (r.municipio || '').toLowerCase().includes(t) ||
          (r.organization_name || '').toLowerCase().includes(t) ||
          (r.bpm || '').toLowerCase().includes(t) ||
          (r.companhia || '').toLowerCase().includes(t) ||
          (r.pelotao || '').toLowerCase().includes(t) ||
          (r.gpm || '').toLowerCase().includes(t) ||
          (r.observacao || '').toLowerCase().includes(t) ||
          (r.lancado_por_nome || '').toLowerCase().includes(t) ||
          (r.data || '').includes(t) ||
          String(r.quantidade || '').includes(t) ||
          String(r.pontuacao || '').includes(t)
        );
      })
    : registros;

  const totalPts = registrosFiltrados.reduce((s, r) => s + (r.pontuacao || 0), 0);

  return (
    <>
      {!hideToggle && (
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-card hover:bg-muted/40 transition-colors text-sm font-medium"
        >
          <span className="flex items-center gap-2 text-muted-foreground">
            <History className="w-4 h-4 text-primary" />
            Consultar lançamentos anteriores
          </span>
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-card rounded-xl border border-border overflow-hidden"
          >
            {/* Filtros */}
            <div className="p-4 border-b border-border bg-muted/30 space-y-3">
              <div className="flex gap-2">
                <button type="button" onClick={() => setModo('data')}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${modo === 'data' ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'}`}>
                  <Calendar className="w-3 h-3" /> Por Data
                </button>
                <button type="button" onClick={() => setModo('intervalo')}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${modo === 'intervalo' ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'}`}>
                  <Calendar className="w-3 h-3" /> Por Intervalo
                </button>
              </div>

              {modo === 'data' ? (
                <div>
                  <Label className="text-xs">Data</Label>
                  <Input type="date" value={dataSelecionada} onChange={e => setDataSelecionada(e.target.value)} className="mt-1 w-44" />
                </div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  <div>
                    <Label className="text-xs">Data inicial</Label>
                    <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="mt-1 w-40" />
                  </div>
                  <div>
                    <Label className="text-xs">Data final</Label>
                    <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="mt-1 w-40" />
                  </div>
                  {(dataInicio || dataFim) && (
                    <div className="flex items-end">
                      <Button type="button" variant="ghost" size="sm" className="gap-1 text-destructive"
                        onClick={() => { setDataInicio(''); setDataFim(''); }}>
                        <X className="w-3 h-3" /> Limpar
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Campo de busca global */}
            <div className="px-4 py-2.5 border-b border-border bg-muted/20">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Pesquisar por indicador, município, data, quantidade..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 text-xs border border-input rounded-md bg-transparent focus:outline-none focus:ring-1 focus:ring-ring"
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Lista */}
            <div className="divide-y divide-border max-h-[480px] overflow-y-auto">
              {isLoading && <div className="px-4 py-8 text-center text-sm text-muted-foreground">Carregando...</div>}
              {!isLoading && registros.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Nenhum lançamento encontrado para o período selecionado.
                </div>
              )}
              {!isLoading && registros.length > 0 && registrosFiltrados.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Nenhum resultado para "<strong>{searchTerm}</strong>".
                </div>
              )}

              {registrosFiltrados.map(p => {
                const within48h = canEditFree(p);
                const liberacao = getActiveLiberacao(p.id);
                const pendente = getPendingRequest(p.id);
                const pertenceOPM = userBelongsToOrg(appUser, p);
                const podeEditar = pertenceOPM && (admin || within48h || !!liberacao);
                const podeSolicitar = pertenceOPM && !admin && !within48h && !liberacao && !pendente;

                return (
                  <div key={p.id} className={`flex items-start gap-2 px-4 py-3 hover:bg-muted/20 transition-colors ${pendente ? 'bg-amber-50/60' : ''}`}>
                    <div className="flex-1 min-w-0">
                      {/* Linha 1: data + categoria + status */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground font-mono">
                          {p.data ? format(new Date(p.data + 'T00:00:00'), 'dd/MM/yyyy') : '-'}
                        </span>
                        <Badge variant="secondary" className={`text-xs ${catColors[p.categoria] || ''}`}>{p.categoria}</Badge>
                        {within48h && (
                          <span className="text-[10px] text-primary font-semibold flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" /> dentro de 48h
                          </span>
                        )}
                        {liberacao && (
                          <span className="text-[10px] text-green-700 font-semibold">
                            ✓ liberado até {format(new Date(liberacao.liberado_ate), 'HH:mm dd/MM')}
                          </span>
                        )}
                        {pendente && (
                          <span className="text-[10px] text-amber-700 font-semibold flex items-center gap-0.5">
                            <AlertCircle className="w-2.5 h-2.5" /> Aguardando autorização
                          </span>
                        )}
                      </div>
                      {/* Linha 2: indicador */}
                      <p className="text-sm font-medium mt-0.5 truncate">{p.indicator_name}</p>
                      {/* Linha 3: quantidade */}
                      <div className="flex items-center gap-2 mt-0.5">
                        {formatQtdExibicao(p)}
                      {p.anexo_url && (
  <a href={p.anexo_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
    <ExternalLink className="w-3 h-3" />
  </a>
)}
                      </div>
                      {/* Linha 4: obs resumida */}
                      {p.observacao && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-xs">{p.observacao}</p>
                      )}
                    </div>

                    {/* Pontuação + ações */}
                    <div className="flex flex-col items-end gap-1 flex-shrink-0 pt-0.5">
                      <span className="text-sm font-bold text-primary">
                        {Number(p.pontuacao).toLocaleString('pt-BR')} pts
                      </span>
                      <div className="flex items-center gap-1">
                        {podeEditar && (
                          <>
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Editar"
                              onClick={() => setEditDialog(p)}>
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Excluir"
                              onClick={() => setDeleteDialog(p)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </>
                        )}
                        {podeSolicitar && (
                          <Button type="button" variant="outline" size="sm"
                            className="h-7 text-xs gap-1 text-amber-700 border-amber-300 hover:bg-amber-50 flex-shrink-0"
                            onClick={() => setRequestDialog(p)}>
                            <Lock className="w-3 h-3" />
                            <span className="hidden sm:inline">Solicitar Edição/Exclusão</span>
                            <span className="sm:hidden">Solicitar</span>
                          </Button>
                        )}
                        {pendente && (
                          <span className="text-[10px] text-amber-600 flex items-center gap-0.5 italic">
                            <AlertCircle className="w-3 h-3" /> Pendente
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Rodapé total */}
            {registros.length > 0 && (
              <div className="px-4 py-2.5 border-t border-border bg-muted/20 flex justify-between items-center">
                <span className="text-xs text-muted-foreground">
                  {registrosFiltrados.length}{registrosFiltrados.length !== registros.length ? ` de ${registros.length}` : ''} registro{registros.length !== 1 ? 's' : ''}
                </span>
                <span className="text-xs font-bold text-primary">Total: {totalPts.toLocaleString('pt-BR')} pts</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dialog Editar (completo) */}
      {editDialog && (
        <EditDialog
          record={editDialog}
          appUser={appUser}
          indicators={indicators}
          onClose={() => setEditDialog(null)}
          onSaved={refetch}
          onRecordUpdated={onRecordUpdated}
        />
      )}

      {/* Dialog Excluir */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir <strong>"{deleteDialog?.indicator_name}"</strong>?<br />
              Data: {deleteDialog?.data ? format(new Date(deleteDialog.data + 'T00:00:00'), 'dd/MM/yyyy') : ''} — {Number(deleteDialog?.pontuacao).toLocaleString('pt-BR')} pts<br />
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Solicitar Edição/Exclusão */}
      {requestDialog && (
        <RequestDialog
          record={requestDialog}
          appUser={appUser}
          orgName={orgName}
          onClose={() => setRequestDialog(null)}
          onSaved={refetch}
        />
      )}
    </>
  );
}