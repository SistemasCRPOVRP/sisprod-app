import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { UserPlus, Pencil, Eye, EyeOff, Trash2, Check, X, Search, Clock, AlertCircle, MessageCircle, Send, RotateCcw, LayoutDashboard, ClipboardPlus, Trophy, History, Target, Building2, Map, FileText, Home, LayoutGrid, Eraser } from 'lucide-react';
import GerenciarAbasUsuario from './GerenciarAbasUsuario';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { BPMs, getCias, getPelotoes, getGPMs } from '@/lib/orgData';

const PERFIS = [
  { value: 'administrador', label: 'Administrador', color: 'bg-red-100 text-red-800', desc: 'Acesso total ao sistema' },
  { value: 'comandante_crpm', label: 'Comandante CRPM', color: 'bg-purple-100 text-purple-800', desc: 'Acesso a todo CRPM/VRP' },
  { value: 'comandante_btl', label: 'Comandante de Batalhão', color: 'bg-blue-100 text-blue-800', desc: 'Acesso ao BTL e subordinados' },
  { value: 'comandante_cia', label: 'Comandante de Companhia', color: 'bg-indigo-100 text-indigo-800', desc: 'Acesso à Cia e subordinados' },
  { value: 'comandante_pel', label: 'Comandante de Pelotão', color: 'bg-cyan-100 text-cyan-800', desc: 'Acesso ao Pel e GPMs' },
  { value: 'comandante_gpm', label: 'Comandante de GPM', color: 'bg-teal-100 text-teal-800', desc: 'Acesso ao GPM' },
  { value: 'operador', label: 'Operador', color: 'bg-green-100 text-green-800', desc: 'Lançamento de produção' },
  { value: 'p1', label: 'P1', color: 'bg-purple-100 text-purple-800', desc: 'Mesmo acesso de Comandante CRPM/BTL' },
  { value: 'p2', label: 'P2', color: 'bg-purple-100 text-purple-800', desc: 'Mesmo acesso de Comandante CRPM/BTL' },
  { value: 'p3', label: 'P3', color: 'bg-purple-100 text-purple-800', desc: 'Mesmo acesso de Comandante CRPM/BTL' },
  { value: 'p4', label: 'P4', color: 'bg-purple-100 text-purple-800', desc: 'Mesmo acesso de Comandante CRPM/BTL' },
];

const emptyUser = { nome_completo: '', id_funcional: '', email: '', senha_hash: '', perfil: 'operador', bpm: '', companhia: '', pelotao: '', gpm: '', municipio: '', organization_id: '', organization_name: '', funcao: '', telefone: '', status: 'ativo', abas_permitidas: null };

// Todas as abas configuráveis (exceto Creator e Administração — sempre fixas)
const ABAS_CONFIG = [
  { path: '/', label: 'Início', icon: Home },
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/lancamento', label: 'Lançamento', icon: ClipboardPlus },
  { path: '/ranking', label: 'Ranking', icon: Trophy },
  { path: '/mapa', label: 'Mapa', icon: Map },
  { path: '/historico', label: 'Histórico', icon: History },
  { path: '/relatorios', label: 'Relatórios', icon: FileText },
  { path: '/indicadores', label: 'Indicadores', icon: Target },
  { path: '/unidades', label: 'Unidades', icon: Building2 },
];

const PERFIS_P = ['p1', 'p2', 'p3', 'p4'];

function OrgSelector({ bpm, setBpm, cia, setCia, pel, setPel, gpm, setGpm, perfil }) {
  const isCrpm = ['administrador', 'comandante_crpm'].includes(perfil);
  const isFuncaoP = PERFIS_P.includes(perfil);

  if (isCrpm) return (
    <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-xs text-primary font-medium">
      ✓ Acesso total ao CRPM/VRP — sem restrição de unidade
    </div>
  );

  const cias = getCias(bpm);
  const pelotoes = getPelotoes(bpm, cia);
  const gpms = getGPMs(bpm, cia, pel);

  return (
    <div className="space-y-2">
      {isFuncaoP && (
        <p className="text-[11px] text-muted-foreground">
          P1/P2/P3/P4: selecione o BTL para vincular ao Batalhão, ou deixe vazio para acesso ao CRPM/VRP.
        </p>
      )}
      <Select value={bpm} onValueChange={v => { setBpm(v); setCia(''); setPel(''); setGpm(''); }}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder={isFuncaoP ? 'Batalhão (opcional)' : 'Batalhão (BTL) *'} />
        </SelectTrigger>
        <SelectContent>
          {BPMs.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
        </SelectContent>
      </Select>

      {/* Cia/Pel/GPM — ocultos para P1/P2/P3/P4 */}
      {!isFuncaoP && bpm && (
        <Select value={cia} onValueChange={v => { setCia(v); setPel(''); setGpm(''); }}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Companhia (Cia)" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__btl__">— Nível BTL —</SelectItem>
            {cias.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      {!isFuncaoP && bpm && cia && cia !== '__btl__' && (
        <Select value={pel} onValueChange={v => { setPel(v); setGpm(''); }}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pelotão (opcional)" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__cia__">— Nível Cia —</SelectItem>
            {pelotoes.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      {!isFuncaoP && bpm && cia && cia !== '__btl__' && pel && pel !== '__cia__' && (
        <Select value={gpm} onValueChange={setGpm}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="GPM (opcional)" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__pel__">— Nível Pel —</SelectItem>
            {gpms.map(g => <SelectItem key={g.nome} value={g.nome}>{g.nome} — {g.municipio}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

function UserFormDialog({ open, onClose, editData, onSaved }) {
  const [form, setForm] = useState(editData || emptyUser);
  const [bpm, setBpm] = useState(editData?.bpm || '');
  const [cia, setCia] = useState(editData?.companhia || '');
  const [pel, setPel] = useState(editData?.pelotao || '');
  const [gpm, setGpm] = useState(editData?.gpm || '');
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [useCustomAbas, setUseCustomAbas] = useState(!!(editData?.abas_permitidas && editData.abas_permitidas.length > 0));
  const [abasSel, setAbasSel] = useState(editData?.abas_permitidas || []);

  React.useEffect(() => {
    if (editData) {
      setForm(editData);
      setBpm(editData.bpm || '');
      setCia(editData.companhia || '');
      setPel(editData.pelotao || '');
      setGpm(editData.gpm || '');
      const hasCustom = !!(editData.abas_permitidas && editData.abas_permitidas.length > 0);
      setUseCustomAbas(hasCustom);
      setAbasSel(editData.abas_permitidas || []);
    } else {
      setForm(emptyUser);
      setBpm(''); setCia(''); setPel(''); setGpm('');
      setUseCustomAbas(false);
      setAbasSel([]);
    }
  }, [editData, open]);

  const isSavingP = PERFIS_P.includes(form.perfil);

  const buildOrgId = () => {
    if (isSavingP) return `${bpm}|||`; // P: só BTL, resto vazio
    const g = (gpm && gpm !== '__pel__') ? gpm : '';
    const p = (pel && pel !== '__cia__') ? pel : '';
    const c = (cia && cia !== '__btl__') ? cia : '';
    return `${bpm}|${c}|${p}|${g}`;
  };
  const buildOrgName = () => {
    if (isSavingP) return bpm || ''; // P: vincula ao BTL ou vazio (CRPM)
    if (gpm && gpm !== '__pel__') return gpm;
    if (pel && pel !== '__cia__') return pel;
    if (cia && cia !== '__btl__') return cia;
    return bpm;
  };

  const handleSave = async () => {
    if (!form.nome_completo || !form.id_funcional || !form.senha_hash) {
      toast.error('Nome, Id. Funcional e Senha são obrigatórios'); return;
    }
    if (!form.telefone) {
      toast.error('Telefone para contato é obrigatório'); return;
    }
    setSaving(true);
    const orgId = buildOrgId();
    const orgName = buildOrgName();
    const payload = {
      ...form,
      bpm: bpm || '',
      companhia: isSavingP ? '' : (cia && cia !== '__btl__') ? cia : '',
      pelotao: isSavingP ? '' : (pel && pel !== '__cia__') ? pel : '',
      gpm: isSavingP ? '' : (gpm && gpm !== '__pel__') ? gpm : '',
      organization_id: orgId,
      organization_name: orgName,
      abas_permitidas: useCustomAbas ? abasSel : null,
    };
    if (editData?.id) {
      await base44.entities.AppUser.update(editData.id, payload);
      toast.success('Usuário atualizado!');
    } else {
      await base44.entities.AppUser.create(payload);
      toast.success('Usuário cadastrado!');
    }
    onSaved();
    onClose();
    setSaving(false);
  };

  const perfilInfo = PERFIS.find(p => p.value === form.perfil);

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editData?.id ? 'Editar Usuário' : 'Cadastrar Novo Usuário'}</DialogTitle>
          {editData?.id && <DialogDescription>{editData.nome_completo}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Dados pessoais */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Dados Pessoais</p>
            <div>
              <Label>Nome Completo *</Label>
              <Input value={form.nome_completo} onChange={e => setForm(f => ({ ...f, nome_completo: e.target.value }))} placeholder="Nome completo do usuário" className="mt-1.5" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Id. Funcional *</Label>
                <Input value={form.id_funcional} onChange={e => setForm(f => ({ ...f, id_funcional: e.target.value }))} placeholder="Ex: 1234567" className="mt-1.5 font-mono" />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@bm.rs.gov.br" className="mt-1.5" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Função Exercida</Label>
                <Select value={form.funcao} onValueChange={v => setForm(f => ({ ...f, funcao: v }))}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione a função" /></SelectTrigger>
                  <SelectContent>
                    {['Comandante CRPM','Comandante de Batalhão','Comandante de Companhia','Comandante de Pelotão','Comandante GPM','P1','P2','P3','P4','Operador'].map(fn => (
                      <SelectItem key={fn} value={fn}>{fn}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Telefone <span className="text-destructive">*</span></Label>
                <Input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="(51) 99999-9999" className="mt-1.5" />
              </div>
            </div>
          </div>

          {/* Acesso */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Dados de Acesso</p>
            <div>
              <Label>Senha *</Label>
              <div className="relative mt-1.5">
                <Input type={showPass ? 'text' : 'password'} value={form.senha_hash} onChange={e => setForm(f => ({ ...f, senha_hash: e.target.value }))} placeholder="Senha de acesso" className="pr-10" />
                <button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Perfil */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Perfil de Acesso</p>
            <div className="grid grid-cols-1 gap-2">
              {PERFIS.map(p => (
                <button key={p.value} type="button" onClick={() => setForm(f => ({ ...f, perfil: p.value }))}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors ${form.perfil === p.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${form.perfil === p.value ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{p.label}</p>
                    <p className="text-xs text-muted-foreground">{p.desc}</p>
                  </div>
                  <Badge className={`text-xs flex-shrink-0 ${p.color}`} variant="secondary">{p.label}</Badge>
                </button>
              ))}
            </div>

            {/* Unidade */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Unidade Vinculada</p>
              <OrgSelector bpm={bpm} setBpm={setBpm} cia={cia} setCia={setCia} pel={pel} setPel={setPel} gpm={gpm} setGpm={setGpm} perfil={form.perfil} />
            </div>
          </div>
        </div>

        {/* Abas permitidas */}
        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Abas do Menu</p>
            <button
              type="button"
              onClick={() => { setUseCustomAbas(v => !v); if (!useCustomAbas) setAbasSel(ABAS_CONFIG.map(a => a.path)); }}
              className={`text-xs px-2 py-1 rounded-md border transition-colors ${useCustomAbas ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border text-muted-foreground hover:border-primary/40'}`}
            >
              {useCustomAbas ? 'Personalizado' : 'Padrão do perfil'}
            </button>
          </div>

          {!useCustomAbas ? (
            <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
              O usuário verá as abas conforme definido pelo perfil selecionado. Ative "Personalizado" para controlar individualmente.
            </p>
          ) : (
            <div className="space-y-1.5">
              <div className="flex gap-2 mb-2">
                <button type="button" onClick={() => setAbasSel(ABAS_CONFIG.map(a => a.path))}
                  className="text-xs text-primary hover:underline">Selecionar todas</button>
                <span className="text-muted-foreground text-xs">·</span>
                <button type="button" onClick={() => setAbasSel([])}
                  className="text-xs text-muted-foreground hover:underline">Limpar</button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {ABAS_CONFIG.map(aba => {
                  const sel = abasSel.includes(aba.path);
                  return (
                    <button
                      key={aba.path}
                      type="button"
                      onClick={() => setAbasSel(prev => sel ? prev.filter(p => p !== aba.path) : [...prev, aba.path])}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs text-left transition-colors ${sel ? 'border-primary bg-primary/5 text-primary font-semibold' : 'border-border text-muted-foreground hover:border-primary/30'}`}
                    >
                      <aba.icon className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{aba.label}</span>
                      {sel && <Check className="w-3 h-3 ml-auto flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
              {abasSel.length === 0 && (
                <p className="text-xs text-destructive/80">Nenhuma aba selecionada — o usuário não verá nenhum item no menu.</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const SENHA_PADRAO = 'nova';

function enviarRespostaWhatsApp(req, senhaGerada) {
  const telefone = (req.telefone || '').replace(/\D/g, '');
  if (!telefone) { toast.error('Solicitante sem telefone cadastrado'); return; }
  const msg = encodeURIComponent(
    `✅ *SISPROD BM — Acesso Concedido*\n\n` +
    `Olá, ${req.nome_completo}!\n\n` +
    `Sua solicitação de ${req.tipo === 'novo_acesso' ? 'novo acesso' : 'recuperação de senha'} foi *aprovada*.\n\n` +
    `🔑 *Seus dados de acesso:*\n` +
    `• Login (Id. Funcional): *${req.id_funcional}*\n` +
    `• Senha provisória: *${senhaGerada}*\n\n` +
    `⚠️ Recomendamos alterar sua senha no primeiro acesso.\n\n` +
    `Acesse: ${window.location.origin}/acesso`
  );
  window.open(`https://wa.me/55${telefone}?text=${msg}`, '_blank');
}

function enviarRejeicaoWhatsApp(req, obs) {
  const telefone = (req.telefone || '').replace(/\D/g, '');
  if (!telefone) return;
  const msg = encodeURIComponent(
    `❌ *SISPROD BM — Solicitação Não Aprovada*\n\n` +
    `Olá, ${req.nome_completo}.\n\n` +
    `Sua solicitação de acesso não pôde ser aprovada no momento.\n` +
    (obs ? `Motivo: ${obs}\n\n` : '\n') +
    `Em caso de dúvidas, entre em contato com a administração.`
  );
  window.open(`https://wa.me/55${telefone}?text=${msg}`, '_blank');
}

function AccessRequestsTab({ highlightId }) {
  const queryClient = useQueryClient();
  const { data: requests = [] } = useQuery({
    queryKey: ['access-requests'],
    queryFn: () => base44.entities.AccessRequest.list('-created_date', 100),
  });
  const [senhas, setSenhas] = useState({});
  const [obs, setObs] = useState({});
  const [showSenha, setShowSenha] = useState({});
  const [saving, setSaving] = useState({});
  const [editingId, setEditingId] = useState(null); // reabre pendente para editar decisão
  const [deletingReqId, setDeletingReqId] = useState(null);

  // Pré-preenche senha padrão ao carregar
  React.useEffect(() => {
    const map = {};
    requests.filter(r => r.status === 'pendente').forEach(r => {
      if (!senhas[r.id]) map[r.id] = SENHA_PADRAO;
    });
    if (Object.keys(map).length) setSenhas(prev => ({ ...prev, ...map }));
  }, [requests]);

  // Scroll para a solicitação destacada
  React.useEffect(() => {
    if (highlightId) {
      setTimeout(() => {
        const el = document.getElementById(`req-${highlightId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 400);
    }
  }, [highlightId, requests]);

  // Infere perfil e unidade a partir da solicitação
  const inferirPerfilEUnidade = (req) => {
    const funcao = (req.funcao || '').toLowerCase().trim();
    const unidade = (req.unidade_lotacao || '');
    const isFuncaoP = ['p1', 'p2', 'p3', 'p4'].includes(funcao);

    // Inferência de perfil pela função
    let perfil = 'operador';
    if (funcao.includes('comandante') && funcao.includes('crpm')) perfil = 'comandante_crpm';
    else if (funcao.includes('comandante') && funcao.includes('batalh')) perfil = 'comandante_btl';
    else if (funcao.includes('comandante') && funcao.includes('compan')) perfil = 'comandante_cia';
    else if (funcao.includes('comandante') && funcao.includes('pelot')) perfil = 'comandante_pel';
    else if (funcao.includes('comandante') && (funcao.includes('gpm') || funcao.includes('grupo'))) perfil = 'comandante_gpm';
    else if (funcao === 'p1') perfil = 'p1';
    else if (funcao === 'p2') perfil = 'p2';
    else if (funcao === 'p3') perfil = 'p3';
    else if (funcao === 'p4') perfil = 'p4';

    // Extrai unidade da string de lotação (ex: "23º BPM / 1ª Cia / 2º Pel / GPM-X")
    let bpm = '', companhia = '', pelotao = '', gpm = '', municipio = '';
    const bpmMatch = unidade.match(/(\d+[ºª°]?\s*BPM)/i);
    if (bpmMatch) bpm = bpmMatch[1].trim();

    // Para P1/P2/P3/P4: só extrai BTL — sem Cia/Pel/GPM
    if (!isFuncaoP) {
      const ciaMatch = unidade.match(/(\d+[ºª°]?\s*Cia)/i);
      if (ciaMatch) companhia = ciaMatch[1].trim();
      const pelMatch = unidade.match(/(\d+[ºª°]?\s*Pel(?:ot[ãa]o)?)/i);
      if (pelMatch) pelotao = pelMatch[1].trim();
      // GPM: suporta "GPM-X", "GPM X", "1º GPM", "2º GPM" etc.
      const gpmMatchDash = unidade.match(/GPM[-\s](\S+)/i);
      const gpmMatchOrd  = unidade.match(/(\d+[ºª°]?\s*GPM)/i);
      if (gpmMatchDash) {
        gpm = `GPM-${gpmMatchDash[1]}`;
      } else if (gpmMatchOrd) {
        gpm = gpmMatchOrd[1].trim();
      }
    }

    const organization_id = `${bpm}|${companhia}|${pelotao}|${gpm}`;
    // organization_name = unidade mais específica disponível (GPM > Pelotão > Cia > BPM)
    const organization_name = isFuncaoP
      ? (bpm || '')
      : (gpm || pelotao || companhia || bpm || unidade);

    return { perfil, bpm, companhia, pelotao, gpm, municipio, organization_id, organization_name };
  };

  const handleAprovar = async (req) => {
    const senha = senhas[req.id] || SENHA_PADRAO;
    setSaving(s => ({ ...s, [req.id]: true }));
    const { perfil, bpm, companhia, pelotao, gpm, organization_id, organization_name } = inferirPerfilEUnidade(req);
    // Atualiza/cria o usuário no AppUser com a senha gerada e unidade inferida
    const existing = await base44.entities.AppUser.filter({ id_funcional: req.id_funcional }, '-created_date', 1);
    if (existing && existing.length > 0) {
      await base44.entities.AppUser.update(existing[0].id, {
        senha_hash: senha, status: 'ativo',
        perfil, bpm, companhia, pelotao, gpm, organization_id, organization_name,
        funcao: req.funcao, telefone: req.telefone,
      });
    } else {
      await base44.entities.AppUser.create({
        nome_completo: req.nome_completo,
        id_funcional: req.id_funcional,
        email: req.email,
        telefone: req.telefone,
        funcao: req.funcao,
        senha_hash: senha,
        perfil,
        bpm, companhia, pelotao, gpm,
        organization_id, organization_name,
        status: 'ativo',
      });
    }
    await base44.entities.AccessRequest.update(req.id, { status: 'aprovado', observacao_admin: obs[req.id] || `Senha: ${senha} | Perfil: ${perfil} | Unidade: ${organization_name}` });
    queryClient.invalidateQueries({ queryKey: ['access-requests'] });
    queryClient.invalidateQueries({ queryKey: ['app-users'] });
    toast.success('Aprovado! Enviando resposta ao solicitante via WhatsApp...');
    setSaving(s => ({ ...s, [req.id]: false }));
    setTimeout(() => enviarRespostaWhatsApp(req, senha), 300);
  };

  const handleRejeitar = async (req) => {
    setSaving(s => ({ ...s, [req.id]: true }));
    await base44.entities.AccessRequest.update(req.id, { status: 'rejeitado', observacao_admin: obs[req.id] || '' });
    queryClient.invalidateQueries({ queryKey: ['access-requests'] });
    toast.success('Solicitação rejeitada');
    setSaving(s => ({ ...s, [req.id]: false }));
    if (obs[req.id]) setTimeout(() => enviarRejeicaoWhatsApp(req, obs[req.id]), 300);
  };

  const handleReabrirParaDecisao = async (req) => {
    setSaving(s => ({ ...s, [req.id]: true }));
    await base44.entities.AccessRequest.update(req.id, { status: 'pendente', observacao_admin: '' });
    queryClient.invalidateQueries({ queryKey: ['access-requests'] });
    setSaving(s => ({ ...s, [req.id]: false }));
    toast.success('Solicitação reaberta para nova decisão');
  };

  const [confirmDeleteReqId, setConfirmDeleteReqId] = useState(null);

  const handleDeleteReq = async (req) => {
    if (confirmDeleteReqId !== req.id) { setConfirmDeleteReqId(req.id); return; }
    setConfirmDeleteReqId(null);
    setDeletingReqId(req.id);
    try {
      await base44.entities.AccessRequest.delete(req.id);
      queryClient.invalidateQueries({ queryKey: ['access-requests'] });
      toast.success('Solicitação excluída');
    } finally {
      setDeletingReqId(null);
    }
  };

  const pendentes = requests.filter(r => r.status === 'pendente');
  const decididas = requests.filter(r => r.status !== 'pendente');

  return (
    <div className="space-y-4">
      {pendentes.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-bold text-amber-800">{pendentes.length} solicitação(ões) pendente(s)</span>
          </div>
          {pendentes.map(r => {
            const isHighlight = r.id === highlightId;
            return (
              <div
                key={r.id}
                id={`req-${r.id}`}
                className={`rounded-lg border p-4 space-y-3 transition-all ${isHighlight ? 'border-primary bg-primary/5 ring-2 ring-primary/30' : 'border-amber-200 bg-amber-50'}`}
              >
                {isHighlight && (
                  <div className="flex items-center gap-1.5 text-xs text-primary font-bold">
                    <AlertCircle className="w-3.5 h-3.5" /> Solicitação recebida via WhatsApp
                  </div>
                )}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div><span className="text-muted-foreground">Nome:</span> <span className="font-semibold">{r.nome_completo}</span></div>
                  <div><span className="text-muted-foreground">Id. Func.:</span> <span className="font-mono font-semibold">{r.id_funcional}</span></div>
                  <div><span className="text-muted-foreground">E-mail:</span> {r.email}</div>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Telefone:</span>
                    <a href={`https://wa.me/55${(r.telefone || '').replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                      className="text-green-700 font-semibold flex items-center gap-0.5 hover:underline">
                      <MessageCircle className="w-3 h-3" /> {r.telefone}
                    </a>
                  </div>
                  <div className="col-span-2"><span className="text-muted-foreground">Unidade:</span> <span className="font-medium">{r.unidade_lotacao}</span></div>
                  <div><span className="text-muted-foreground">Função:</span> {r.funcao}</div>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Tipo:</span>
                    <Badge variant="outline" className="text-xs">{r.tipo === 'novo_acesso' ? 'Novo Acesso' : 'Recuperar Senha'}</Badge>
                  </div>
                  <div className="text-muted-foreground text-[10px] col-span-2">{r.created_date ? format(new Date(r.created_date), 'dd/MM/yyyy HH:mm') : '-'}</div>
                </div>

                {/* Preview perfil/unidade inferido */}
                {(() => {
                  const inf = inferirPerfilEUnidade(r);
                  const perfilInfo = PERFIS.find(p => p.value === inf.perfil);
                  const unidadeLabel = inf.bpm
                    ? inf.bpm
                    : 'CRPM/VRP (Sede)';
                  return (
                    <div className="rounded-md bg-blue-50 border border-blue-200 p-3 space-y-1">
                      <p className="text-xs font-semibold text-blue-800 uppercase tracking-wider">Acesso que será concedido</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        <Badge className={`text-xs ${perfilInfo?.color || 'bg-secondary'}`} variant="secondary">
                          {perfilInfo?.label || inf.perfil}
                        </Badge>
                        <Badge variant="outline" className="text-xs">{unidadeLabel}</Badge>
                      </div>
                      <p className="text-[10px] text-blue-700">Inferido a partir da função "<strong>{r.funcao}</strong>" e unidade "<strong>{r.unidade_lotacao}</strong>". Pode ser ajustado após aprovação em Gestão de Usuários.</p>
                    </div>
                  );
                })()}

                {/* Senha a conceder */}
                <div className="rounded-md bg-white border border-border p-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Senha a Conceder</p>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showSenha[r.id] ? 'text' : 'password'}
                        value={senhas[r.id] || SENHA_PADRAO}
                        onChange={e => setSenhas(s => ({ ...s, [r.id]: e.target.value }))}
                        className="w-full h-8 px-3 pr-9 text-sm font-mono border border-input rounded-md bg-transparent focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <button type="button" onClick={() => setShowSenha(s => ({ ...s, [r.id]: !s[r.id] }))}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showSenha[r.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setSenhas(s => ({ ...s, [r.id]: SENHA_PADRAO }))}>
                      Padrão
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" title="Limpar senha"
                      onClick={() => setSenhas(s => ({ ...s, [r.id]: '' }))}>
                      <Eraser className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Senha padrão: "<strong>{SENHA_PADRAO}</strong>" — pode ser alterada antes do envio. O usuário poderá mudar no primeiro acesso.</p>
                </div>

                {/* Observação */}
                <div className="flex gap-1.5">
                  <input
                    value={obs[r.id] || ''}
                    onChange={e => setObs(o => ({ ...o, [r.id]: e.target.value }))}
                    placeholder="Observação para o solicitante (opcional)"
                    className="flex-1 h-8 px-3 text-xs border border-input rounded-md bg-transparent focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  {obs[r.id] && (
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" title="Limpar observação"
                      onClick={() => setObs(o => ({ ...o, [r.id]: '' }))}>
                      <Eraser className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>

                {/* Ações */}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="h-8 text-xs gap-1 flex-1 min-w-[160px] bg-green-700 hover:bg-green-800" onClick={() => handleAprovar(r)} disabled={saving[r.id]}>
                    {saving[r.id] ? '...' : <><Check className="w-3.5 h-3.5" /> Aprovar e Enviar via WhatsApp</>}
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1 text-destructive border-destructive/30" onClick={() => handleRejeitar(r)} disabled={saving[r.id]}>
                    <X className="w-3.5 h-3.5" /> Rejeitar
                  </Button>
                  {confirmDeleteReqId === r.id ? (
                    <div className="flex items-center gap-1">
                      <Button size="sm" className="h-8 text-xs gap-1 bg-destructive hover:bg-destructive/90" onClick={() => handleDeleteReq(r)} disabled={deletingReqId === r.id}>
                        {deletingReqId === r.id ? <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin block" /> : <Check className="w-3.5 h-3.5" />}
                        Confirmar
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setConfirmDeleteReqId(null)}><X className="w-3.5 h-3.5" /></Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1 text-muted-foreground" onClick={() => handleDeleteReq(r)} disabled={deletingReqId === r.id}>
                      <Trash2 className="w-3.5 h-3.5" /> Excluir
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {decididas.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Histórico</p>
          <div className="bg-card rounded-xl border border-border divide-y divide-border">
            {decididas.map(r => (
              <div key={r.id} className="px-3 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium">{r.nome_completo}</p>
                    <Badge variant={r.status === 'aprovado' ? 'default' : 'destructive'} className="text-xs">
                      {r.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{r.id_funcional} · {r.funcao}</p>
                  <p className="text-xs text-muted-foreground truncate">{r.unidade_lotacao}</p>
                  {r.observacao_admin && <p className="text-xs text-muted-foreground mt-0.5 italic">{r.observacao_admin}</p>}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap flex-shrink-0">
                  {r.status === 'aprovado' && r.telefone && (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-green-700 border-green-300"
                      onClick={() => enviarRespostaWhatsApp(r, r.observacao_admin?.replace('Senha gerada: ', '') || SENHA_PADRAO)}>
                      <Send className="w-3 h-3" /> Reenviar
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                    onClick={() => handleReabrirParaDecisao(r)} disabled={saving[r.id]}>
                    <RotateCcw className="w-3 h-3" /> Editar
                  </Button>
                  {confirmDeleteReqId === r.id ? (
                    <div className="flex items-center gap-1">
                      <Button size="sm" className="h-7 text-xs gap-1 bg-destructive hover:bg-destructive/90" onClick={() => handleDeleteReq(r)} disabled={deletingReqId === r.id}>
                        {deletingReqId === r.id ? <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin block" /> : <Check className="w-3 h-3" />}
                        OK
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setConfirmDeleteReqId(null)}><X className="w-3 h-3" /></Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-destructive border-destructive/30"
                      onClick={() => handleDeleteReq(r)} disabled={deletingReqId === r.id}>
                      <Trash2 className="w-3 h-3" /> Excluir
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {requests.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">Nenhuma solicitação de acesso.</div>
      )}
    </div>
  );
}

export default function GestaoUsuarios({ highlightRequestId, openRequestsTab }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [showPass, setShowPass] = useState({});
  const [activeSubTab, setActiveSubTab] = useState(openRequestsTab ? 'requests' : 'users');
  const [abasModalOpen, setAbasModalOpen] = useState(false);

  React.useEffect(() => {
    if (openRequestsTab) setActiveSubTab('requests');
  }, [openRequestsTab]);

  const { data: appUsers = [] } = useQuery({
    queryKey: ['app-users'],
    queryFn: () => base44.entities.AppUser.list('-created_date', 200),
  });

  const { data: requests = [] } = useQuery({
    queryKey: ['access-requests'],
    queryFn: () => base44.entities.AccessRequest.list('-created_date', 100),
  });

  const pendingCount = requests.filter(r => r.status === 'pendente').length;

  const filtered = appUsers.filter(u => {
    const term = search.toLowerCase();
    return !term || (u.nome_completo || '').toLowerCase().includes(term) || (u.id_funcional || '').includes(term) || (u.email || '').toLowerCase().includes(term);
  });

  const handleEdit = (u) => { setEditData(u); setDialogOpen(true); };
  const handleNew = () => { setEditData(null); setDialogOpen(true); };
  const handleSaved = () => queryClient.invalidateQueries({ queryKey: ['app-users'] });

  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const handleDelete = async (u) => {
    if (confirmDeleteId !== u.id) { setConfirmDeleteId(u.id); return; }
    setConfirmDeleteId(null);
    setDeletingId(u.id);
    try {
      await base44.entities.AppUser.delete(u.id);
      queryClient.invalidateQueries({ queryKey: ['app-users'] });
      toast.success('Usuário excluído');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <TabsList>
            <TabsTrigger value="users">
              Usuários <Badge variant="secondary" className="ml-1.5 text-xs">{appUsers.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="requests">
              Solicitações
              {pendingCount > 0 && <Badge className="ml-1.5 text-xs bg-amber-500 text-white">{pendingCount}</Badge>}
            </TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setAbasModalOpen(true)} className="gap-1.5">
              <LayoutGrid className="w-4 h-4" /> Gerenciar Abas
            </Button>
            <Button size="sm" onClick={handleNew} className="gap-1.5">
              <UserPlus className="w-4 h-4" /> Novo Usuário
            </Button>
          </div>
        </div>

        <TabsContent value="users" className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome, Id. Funcional ou e-mail..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wider">Usuário</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wider">Perfil</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wider">Unidade</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wider">Senha</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wider">Status</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map(u => {
                    const perfilInfo = PERFIS.find(p => p.value === u.perfil);
                    return (
                      <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-3">
                          <p className="font-semibold text-sm">{u.nome_completo}</p>
                          <p className="text-xs font-mono text-primary">{u.id_funcional}</p>
                          {u.email && <p className="text-xs text-muted-foreground">{u.email}</p>}
                        </td>
                        <td className="px-3 py-3">
                          <Badge className={`text-xs ${perfilInfo?.color || 'bg-secondary'}`} variant="secondary">
                            {perfilInfo?.label || u.perfil}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">
                          <div>{u.organization_name || '—'}</div>
                          {u.abas_permitidas && u.abas_permitidas.length > 0 && (
                            <span className="inline-flex items-center gap-0.5 mt-0.5 text-[10px] text-primary font-medium bg-primary/10 px-1.5 py-0.5 rounded">
                              {u.abas_permitidas.length} aba(s) customizadas
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-mono">{showPass[u.id] ? u.senha_hash : '••••••'}</span>
                            <button onClick={() => setShowPass(p => ({ ...p, [u.id]: !p[u.id] }))} className="text-muted-foreground hover:text-foreground">
                              {showPass[u.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <Badge variant={u.status === 'inativo' ? 'outline' : 'secondary'} className="text-xs">
                            {u.status || 'ativo'}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(u)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            {confirmDeleteId === u.id ? (
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(u)} disabled={deletingId === u.id}>
                                  {deletingId === u.id ? <span className="w-3.5 h-3.5 border-2 border-destructive/40 border-t-destructive rounded-full animate-spin block" /> : <Check className="w-3.5 h-3.5" />}
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setConfirmDeleteId(null)}>
                                  <X className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            ) : (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(u)} disabled={deletingId === u.id}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Nenhum usuário encontrado</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="requests">
          <AccessRequestsTab highlightId={highlightRequestId} />
        </TabsContent>
      </Tabs>

      <UserFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} editData={editData} onSaved={handleSaved} />
      <GerenciarAbasUsuario open={abasModalOpen} onClose={() => setAbasModalOpen(false)} />
    </div>
  );
}