import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Check, X, MessageCircle, AlertCircle, Clock, Send, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format, addMinutes } from 'date-fns';

const PRAZOS = [
  { label: '30 minutos', minutos: 30 },
  { label: '1 hora', minutos: 60 },
  { label: '2 horas', minutos: 120 },
  { label: '4 horas', minutos: 240 },
  { label: '8 horas', minutos: 480 },
  { label: '24 horas', minutos: 1440 },
  { label: '48 horas', minutos: 2880 },
  { label: '72 horas', minutos: 4320 },
];

const PRAZO_PADRAO = '2880'; // 48 horas

function enviarWhatsAppLiberacao(req, liberadoAte, adminObs) {
  const telefone = (req.solicitante_telefone || '').replace(/\D/g, '');
  if (!telefone) return;
  const dtLib = liberadoAte ? format(new Date(liberadoAte), 'dd/MM/yyyy HH:mm') : 'indefinido';
  const tipoLabel = req.tipo_solicitacao === 'exclusao' ? 'exclusão' : 'edição';
  const msg = encodeURIComponent(
    `✅ *SISPROD BM — Solicitação Aprovada*\n\n` +
    `Olá, ${req.solicitante_nome || req.solicitante_email}!\n\n` +
    `Sua solicitação de *${tipoLabel}* foi *aprovada*.\n\n` +
    `📋 *Registro liberado:*\n` +
    `• Indicador: ${req.indicator_name}\n` +
    `• Unidade: ${req.organization_name}\n` +
    `• Data: ${req.data_registro}\n\n` +
    `⏱️ *Prazo para realizar a alteração:* até ${dtLib}\n` +
    `Após esse prazo a permissão será automaticamente encerrada.\n` +
    (adminObs ? `\n📝 Obs: ${adminObs}\n` : '') +
    `\nAcesse o sistema para realizar as alterações: ${window.location.origin}/lancamento`
  );
  window.open(`https://wa.me/55${telefone}?text=${msg}`, '_blank');
}

function enviarWhatsAppRejeicao(req, obs) {
  const telefone = (req.solicitante_telefone || '').replace(/\D/g, '');
  if (!telefone) return;
  const tipoLabel = req.tipo_solicitacao === 'exclusao' ? 'exclusão' : 'edição';
  const msg = encodeURIComponent(
    `❌ *SISPROD BM — Solicitação Não Aprovada*\n\n` +
    `Olá, ${req.solicitante_nome || req.solicitante_email}.\n\n` +
    `Sua solicitação de *${tipoLabel}* do registro:\n` +
    `• ${req.indicator_name} — ${req.organization_name}\n` +
    `• Data: ${req.data_registro}\n\n` +
    `não pôde ser aprovada.\n` +
    (obs ? `\nMotivo: ${obs}\n` : '') +
    `\nEm caso de dúvidas, entre em contato com a administração.`
  );
  window.open(`https://wa.me/55${telefone}?text=${msg}`, '_blank');
}

function TipoBadge({ tipo }) {
  if (tipo === 'exclusao') {
    return <Badge variant="destructive" className="text-xs gap-1"><Trash2 className="w-2.5 h-2.5" /> Exclusão</Badge>;
  }
  return <Badge variant="secondary" className="text-xs gap-1 bg-blue-100 text-blue-800"><Pencil className="w-2.5 h-2.5" /> Edição</Badge>;
}

export default function SolicitacoesEdicao() {
  const queryClient = useQueryClient();
  const { data: editRequests = [] } = useQuery({
    queryKey: ['edit-requests'],
    queryFn: () => base44.entities.EditRequest.list('-created_date'),
  });

  const [prazos, setPrazos] = useState({});
  const [obs, setObs] = useState({});
  const [saving, setSaving] = useState({});

  const pendentes = editRequests.filter(r => r.status === 'pendente');
  const decididas = editRequests.filter(r => r.status !== 'pendente');

  const aprovar = async (req, notificar) => {
    const minutos = parseInt(prazos[req.id] || PRAZO_PADRAO);
    const liberadoAte = addMinutes(new Date(), minutos).toISOString();
    setSaving(s => ({ ...s, [req.id]: true }));
    await base44.entities.EditRequest.update(req.id, {
      status: 'aprovado',
      liberado_ate: liberadoAte,
      observacao_admin: obs[req.id] || '',
    });
    await base44.entities.AuditLog.create({
      usuario: 'admin',
      acao: 'editou',
      tabela: 'EditRequest',
      registro_id: req.id,
      detalhe: `Liberação aprovada — ${req.solicitante_nome} — ${req.tipo_solicitacao || 'edicao'} — ${req.indicator_name} — prazo: ${minutos} min`,
    });
    queryClient.invalidateQueries({ queryKey: ['edit-requests'] });
    toast.success('Liberação aprovada!');
    setSaving(s => ({ ...s, [req.id]: false }));
    if (notificar) setTimeout(() => enviarWhatsAppLiberacao(req, liberadoAte, obs[req.id]), 300);
  };

  const rejeitar = async (req) => {
    setSaving(s => ({ ...s, [req.id]: true }));
    await base44.entities.EditRequest.update(req.id, {
      status: 'rejeitado',
      observacao_admin: obs[req.id] || '',
    });
    await base44.entities.AuditLog.create({
      usuario: 'admin',
      acao: 'editou',
      tabela: 'EditRequest',
      registro_id: req.id,
      detalhe: `Solicitação rejeitada — ${req.solicitante_nome} — ${req.tipo_solicitacao || 'edicao'} — ${req.indicator_name}`,
    });
    queryClient.invalidateQueries({ queryKey: ['edit-requests'] });
    toast.success('Solicitação rejeitada');
    setSaving(s => ({ ...s, [req.id]: false }));
    if (obs[req.id]) setTimeout(() => enviarWhatsAppRejeicao(req, obs[req.id]), 300);
  };

  const isLiberacaoAtiva = (req) => {
    if (req.status !== 'aprovado' || !req.liberado_ate) return false;
    return new Date(req.liberado_ate) > new Date();
  };

  return (
    <div className="space-y-5">
      {/* Pendentes */}
      {pendentes.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-bold text-amber-800">{pendentes.length} solicitação(ões) pendente(s)</span>
          </div>
          {pendentes.map(r => (
            <div key={r.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
              {/* Header: tipo */}
              <div className="flex items-center justify-between">
                <TipoBadge tipo={r.tipo_solicitacao} />
                <span className="text-[10px] text-muted-foreground">
                  {r.created_date ? format(new Date(r.created_date), 'dd/MM/yyyy HH:mm') : '-'}
                </span>
              </div>

              {/* Dados do solicitante */}
              <div className="rounded-lg bg-white border border-border p-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div className="col-span-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Solicitante</div>
                <div><span className="text-muted-foreground">Nome:</span> <span className="font-semibold">{r.solicitante_nome || '—'}</span></div>
                <div>
                  <span className="text-muted-foreground">Matrícula:</span> <span className="font-mono">{r.solicitante_matricula || '—'}</span>
                </div>
                <div className="col-span-2"><span className="text-muted-foreground">Unidade:</span> <span className="font-medium">{r.organization_name}</span></div>
                <div className="flex items-center gap-1 col-span-2">
                  <span className="text-muted-foreground">Telefone:</span>
                  {r.solicitante_telefone ? (
                    <a href={`https://wa.me/55${(r.solicitante_telefone || '').replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                      className="text-green-700 font-semibold flex items-center gap-0.5 hover:underline">
                      <MessageCircle className="w-3 h-3" /> {r.solicitante_telefone}
                    </a>
                  ) : <span className="text-muted-foreground">—</span>}
                </div>
              </div>

              {/* Dados do lançamento */}
              <div className="rounded-lg bg-white border border-border p-3 text-xs space-y-1">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Lançamento</div>
                <div><span className="text-muted-foreground">Indicador:</span> <span className="font-medium">{r.indicator_name}</span></div>
                <div><span className="text-muted-foreground">Data:</span> <span className="font-mono">{r.data_registro}</span></div>
                {r.motivo && (
                  <div className="mt-1 pt-1 border-t border-border">
                    <span className="text-muted-foreground">Motivo:</span>
                    <p className="mt-0.5">{r.motivo}</p>
                  </div>
                )}
              </div>

              {/* Prazo */}
              <div className="rounded-lg bg-white border border-border p-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Prazo de Liberação
                </p>
                <Select value={prazos[r.id] || PRAZO_PADRAO} onValueChange={v => setPrazos(p => ({ ...p, [r.id]: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRAZOS.map(p => (
                      <SelectItem key={p.minutos} value={String(p.minutos)}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  Liberado até: <strong>{format(addMinutes(new Date(), parseInt(prazos[r.id] || PRAZO_PADRAO)), 'dd/MM/yyyy HH:mm')}</strong>
                </p>
              </div>

              {/* Obs admin */}
              <Input
                value={obs[r.id] || ''}
                onChange={e => setObs(o => ({ ...o, [r.id]: e.target.value }))}
                placeholder="Observação para o solicitante (opcional)"
                className="h-8 text-xs"
              />

              {/* Ações */}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" className="h-8 text-xs gap-1 flex-1 min-w-[160px] bg-green-700 hover:bg-green-800"
                  onClick={() => aprovar(r, true)} disabled={saving[r.id]}>
                  {saving[r.id] ? '...' : <><Check className="w-3.5 h-3.5" /> Aprovar e Notificar WhatsApp</>}
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1 text-green-700 border-green-300 hover:bg-green-50"
                  onClick={() => aprovar(r, false)} disabled={saving[r.id]}>
                  <Check className="w-3.5 h-3.5" /> Aprovar sem WhatsApp
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1 text-destructive border-destructive/30"
                  onClick={() => rejeitar(r)} disabled={saving[r.id]}>
                  <X className="w-3.5 h-3.5" /> Rejeitar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Histórico */}
      {decididas.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Histórico de Solicitações</p>
          <div className="bg-card rounded-xl border border-border divide-y divide-border">
            {decididas.map(r => {
              const ativo = isLiberacaoAtiva(r);
              return (
                <div key={r.id} className="px-3 py-3 flex flex-col sm:flex-row sm:items-start gap-2">
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{r.solicitante_nome}</p>
                      <TipoBadge tipo={r.tipo_solicitacao} />
                      <Badge variant={r.status === 'aprovado' ? 'default' : 'destructive'} className="text-xs">
                        {r.status}
                      </Badge>
                      {ativo && (
                        <Badge className="text-xs bg-green-700 text-white">⏱ Ativo</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{r.indicator_name} — {r.organization_name}</p>
                    {r.liberado_ate && (
                      <p className="text-xs text-muted-foreground">
                        Até: {format(new Date(r.liberado_ate), 'dd/MM/yyyy HH:mm')}
                      </p>
                    )}
                    {r.observacao_admin && <p className="text-xs text-muted-foreground italic">{r.observacao_admin}</p>}
                  </div>
                  {r.status === 'aprovado' && r.solicitante_telefone && (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-green-700 border-green-300 flex-shrink-0"
                      onClick={() => enviarWhatsAppLiberacao(r, r.liberado_ate, r.observacao_admin)}>
                      <Send className="w-3 h-3" /> Reenviar
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {editRequests.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">Nenhuma solicitação de edição/exclusão.</div>
      )}
    </div>
  );
}