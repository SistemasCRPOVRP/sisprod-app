import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Plus, Pencil, Trash2, Pin, Send, MessageCircle, Users, BellRing } from 'lucide-react';

const TIPOS = [
  { value: 'info', label: 'Informação', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'aviso', label: 'Aviso', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'atualizacao', label: 'Atualização', color: 'bg-green-100 text-green-800 border-green-200' },
  { value: 'atualizacao_sistema', label: 'Atualização do Sistema', color: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  { value: 'manutencao', label: 'Manutenção do Sistema', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  { value: 'urgente', label: 'Urgente', color: 'bg-red-100 text-red-800 border-red-200' },
  { value: 'outro', label: 'Outro (personalizado)', color: 'bg-slate-100 text-slate-800 border-slate-200' },
];

function getTipoConfig(aviso) {
  if (aviso?.tipo === 'outro' && aviso?.tipo_personalizado) {
    return { value: 'outro', label: aviso.tipo_personalizado, color: 'bg-slate-100 text-slate-800 border-slate-200' };
  }
  return TIPOS.find(t => t.value === aviso?.tipo) || TIPOS[0];
}

const EMPTY_FORM = { titulo: '', mensagem: '', tipo: 'info', tipo_personalizado: '', status: 'ativo', fixado: false, alerta_destaque: false };

export default function GerenciarAvisos({ appUser }) {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState(null); // null | { mode: 'create'|'edit', data: {} }
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [sendDialog, setSendDialog] = useState(null); // aviso para envio em massa

  const { data: avisos = [], isLoading } = useQuery({
    queryKey: ['avisos'],
    queryFn: () => base44.entities.Aviso.list('-created_date', 200),
  });

  const { data: appUsers = [] } = useQuery({
    queryKey: ['app-users'],
    queryFn: () => base44.entities.AppUser.list('-created_date', 9999),
  });

  const usersAtivos = appUsers.filter(u => u.status === 'ativo' && u.telefone);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setDialog({ mode: 'create' });
  };

  const openEdit = (aviso) => {
    setForm({
      titulo: aviso.titulo || '',
      mensagem: aviso.mensagem || '',
      tipo: aviso.tipo || 'info',
      tipo_personalizado: aviso.tipo_personalizado || '',
      status: aviso.status || 'ativo',
      fixado: aviso.fixado || false,
      alerta_destaque: aviso.alerta_destaque || false,
    });
    setDialog({ mode: 'edit', id: aviso.id });
  };

  const handleSave = async () => {
    if (!form.titulo.trim() || !form.mensagem.trim()) {
      toast.error('Preencha o título e a mensagem.');
      return;
    }
    setSaving(true);
    const payload = { ...form, autor_nome: appUser?.nome_completo || appUser?.id_funcional || 'Admin' };
    if (dialog.mode === 'create') {
      await base44.entities.Aviso.create(payload);
      toast.success('Aviso criado com sucesso!');
    } else {
      await base44.entities.Aviso.update(dialog.id, payload);
      toast.success('Aviso atualizado!');
    }
    await queryClient.invalidateQueries({ queryKey: ['avisos'] });
    setSaving(false);
    setDialog(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Excluir este aviso?')) return;
    await base44.entities.Aviso.delete(id);
    await queryClient.invalidateQueries({ queryKey: ['avisos'] });
    toast.success('Aviso excluído.');
  };

  const handleToggleStatus = async (aviso) => {
    const novoStatus = aviso.status === 'ativo' ? 'inativo' : 'ativo';
    await base44.entities.Aviso.update(aviso.id, { status: novoStatus });
    await queryClient.invalidateQueries({ queryKey: ['avisos'] });
    toast.success(novoStatus === 'ativo' ? 'Aviso ativado.' : 'Aviso desativado.');
  };

  // Monta link WhatsApp para envio individual
  const sendWhatsApp = (telefone, aviso) => {
    const num = telefone.replace(/\D/g, '');
    const tipo = getTipoConfig(aviso.tipo);
    const texto = encodeURIComponent(
      `🔔 *SISPROD BM — ${tipo.label.toUpperCase()}*\n\n*${aviso.titulo}*\n\n${aviso.mensagem}\n\n_Mensagem automática do SISPROD BM_`
    );
    window.open(`https://wa.me/${num}?text=${texto}`, '_blank');
  };

  // Envio em massa: abre o WhatsApp para cada usuário sequencialmente via links
  const handleEnvioMassa = (aviso) => {
    setSendDialog({ aviso, usuarios: usersAtivos, index: 0 });
  };

  const sendNext = () => {
    const { aviso, usuarios, index } = sendDialog;
    if (index < usuarios.length) {
      sendWhatsApp(usuarios[index].telefone, aviso);
      setSendDialog(s => ({ ...s, index: s.index + 1 }));
    } else {
      setSendDialog(null);
      toast.success('Envio concluído!');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BellRing className="w-5 h-5 text-primary" />
          <h2 className="text-base font-bold">Avisos e Comunicados</h2>
          <Badge variant="outline">{avisos.filter(a => a.status === 'ativo').length} ativos</Badge>
        </div>
        <Button size="sm" onClick={openCreate} className="gap-1.5">
          <Plus className="w-4 h-4" /> Novo Aviso
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Os avisos ativos são exibidos na tela inicial para todos os usuários. Utilize o botão WhatsApp para enviar mensagens individualmente ou em massa.
      </p>

      {isLoading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>
      ) : avisos.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground border rounded-xl">Nenhum aviso cadastrado.</div>
      ) : (
        <div className="space-y-3">
          {avisos.map(aviso => {
            const tc = getTipoConfig(aviso);
            return (
              <div key={aviso.id} className={`rounded-xl border p-4 ${aviso.status === 'inativo' ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${tc.color}`}>{tc.label}</span>
                      {aviso.fixado && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-0.5"><Pin className="w-2.5 h-2.5" /> Fixado</span>}
                      {aviso.alerta_destaque && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300 flex items-center gap-0.5">🔔 Alerta</span>}
                      {aviso.status === 'inativo' && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border">Inativo</span>}
                    </div>
                    <p className="font-semibold text-sm">{aviso.titulo}</p>
                    <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line line-clamp-2">{aviso.mensagem}</p>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      {aviso.autor_nome && <>Por {aviso.autor_nome} · </>}
                      {aviso.created_date ? format(new Date(aviso.created_date), 'dd/MM/yyyy HH:mm') : ''}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(aviso)} title="Editar">
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(aviso.id)} title="Excluir">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-amber-600 hover:bg-amber-50" onClick={() => handleToggleStatus(aviso)} title={aviso.status === 'ativo' ? 'Desativar' : 'Ativar'}>
                      <BellRing className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600 hover:bg-green-50" onClick={() => setSendDialog({ aviso, usuarios: usersAtivos, index: 0, selectMode: true })} title="Enviar via WhatsApp">
                      <MessageCircle className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog criar/editar */}
      <Dialog open={!!dialog} onOpenChange={v => !v && setDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialog?.mode === 'create' ? 'Novo Aviso' : 'Editar Aviso'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Título *</Label>
              <Input className="mt-1" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Manutenção programada" />
            </div>
            <div>
              <Label>Mensagem *</Label>
              <textarea
                className="w-full mt-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                rows={5}
                value={form.mensagem}
                onChange={e => setForm(f => ({ ...f, mensagem: e.target.value }))}
                placeholder="Digite o conteúdo do aviso..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.tipo === 'outro' && (
              <div>
                <Label>Nome do Tipo Personalizado *</Label>
                <Input className="mt-1" value={form.tipo_personalizado} onChange={e => setForm(f => ({ ...f, tipo_personalizado: e.target.value }))} placeholder="Ex: Treinamento, Evento, etc." />
              </div>
            )}
            <div className="flex items-center gap-3">
              <Switch checked={form.fixado} onCheckedChange={v => setForm(f => ({ ...f, fixado: v }))} id="fixado" />
              <Label htmlFor="fixado" className="cursor-pointer">Fixar aviso no topo</Label>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
              <Switch checked={form.alerta_destaque} onCheckedChange={v => setForm(f => ({ ...f, alerta_destaque: v }))} id="alerta_destaque" />
              <div>
                <Label htmlFor="alerta_destaque" className="cursor-pointer font-semibold text-amber-800">🔔 Ativar Alerta de Destaque</Label>
                <p className="text-xs text-amber-700 mt-0.5">O usuário verá um modal piscante e precisará clicar em OK para fechar.</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de envio WhatsApp */}
      <Dialog open={!!sendDialog} onOpenChange={v => !v && setSendDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><MessageCircle className="w-5 h-5 text-green-600" /> Enviar via WhatsApp</DialogTitle>
          </DialogHeader>
          {sendDialog && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs font-bold uppercase text-muted-foreground mb-1">Aviso</p>
                <p className="font-semibold text-sm">{sendDialog.aviso.titulo}</p>
              </div>
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-800">
                <Users className="w-3.5 h-3.5 inline mr-1" />
                <strong>{usersAtivos.length} usuário{usersAtivos.length !== 1 ? 's' : ''}</strong> com telefone cadastrado
              </div>

              {sendDialog.selectMode ? (
                <>
                  <p className="text-sm text-muted-foreground">Escolha como deseja enviar:</p>
                  <div className="space-y-2 max-h-52 overflow-y-auto">
                    {usersAtivos.map(u => (
                      <div key={u.id} className="flex items-center justify-between p-2 rounded-lg border hover:bg-muted/50">
                        <div>
                          <p className="text-sm font-medium">{u.nome_completo}</p>
                          <p className="text-xs text-muted-foreground">{u.telefone} · {u.organization_name || u.bpm}</p>
                        </div>
                        <Button size="sm" variant="outline" className="gap-1 text-green-700 border-green-300 hover:bg-green-50"
                          onClick={() => { sendWhatsApp(u.telefone, sendDialog.aviso); }}>
                          <Send className="w-3 h-3" /> Enviar
                        </Button>
                      </div>
                    ))}
                    {usersAtivos.length === 0 && <p className="text-sm text-center text-muted-foreground py-4">Nenhum usuário com telefone cadastrado.</p>}
                  </div>
                  <Button className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white" onClick={() => handleEnvioMassa(sendDialog.aviso)}>
                    <MessageCircle className="w-4 h-4" /> Enviar para TODOS ({usersAtivos.length})
                  </Button>
                </>
              ) : (
                <>
                  <div className="text-center py-2">
                    <p className="text-sm text-muted-foreground mb-1">
                      Enviando para <strong>{sendDialog.index + 1}</strong> de <strong>{sendDialog.usuarios.length}</strong>
                    </p>
                    {sendDialog.index < sendDialog.usuarios.length ? (
                      <>
                        <p className="font-semibold">{sendDialog.usuarios[sendDialog.index]?.nome_completo}</p>
                        <p className="text-xs text-muted-foreground">{sendDialog.usuarios[sendDialog.index]?.telefone}</p>
                        <Button className="mt-4 gap-2 bg-green-600 hover:bg-green-700 text-white" onClick={sendNext}>
                          <Send className="w-4 h-4" /> Abrir WhatsApp e Enviar
                        </Button>
                      </>
                    ) : (
                      <div className="text-green-600 font-semibold mt-2">✓ Todos os usuários foram contatados!</div>
                    )}
                  </div>
                  {sendDialog.index > 0 && sendDialog.index < sendDialog.usuarios.length && (
                    <p className="text-xs text-center text-muted-foreground">Após enviar, clique novamente para o próximo usuário.</p>
                  )}
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialog(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}