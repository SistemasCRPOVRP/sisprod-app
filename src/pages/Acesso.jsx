import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Eye, EyeOff, Loader2, ChevronRight, ArrowLeft, Send, Lock, Key, Eraser } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { useAppAuth } from '@/lib/AppAuthContext';
import { CRPM, BPMs, getCias, getPelotoes, getGPMs } from '@/lib/orgData';
import { toast } from 'sonner';

// Busca configurações do sistema (WhatsApp e e-mail do admin)
async function getAdminContacts() {
  try {
    const configs = await base44.entities.SystemConfig.list();
    const wa = configs.find(c => c.chave === 'admin_whatsapp')?.valor || '';
    const email = configs.find(c => c.chave === 'admin_email')?.valor || '';
    return { wa, email };
  } catch {
    return { wa: '', email: '' };
  }
}

// Monta e abre link do WhatsApp com mensagem pré-preenchida + link direto para solicitação
function abrirWhatsApp(numeroAdmin, dadosSolicitante, requestId) {
  if (!numeroAdmin) return;
  const appUrl = `${window.location.origin}/admin?tab=requests&req=${requestId}`;
  const msg = encodeURIComponent(
    `🔔 *SISPROD BM — Nova Solicitação*\n\n` +
    `*Tipo:* ${dadosSolicitante.tipo === 'novo_acesso' ? 'Novo Acesso' : 'Recuperação de Senha'}\n` +
    `*Nome:* ${dadosSolicitante.nome_completo}\n` +
    `*Id. Funcional:* ${dadosSolicitante.id_funcional}\n` +
    `*Unidade:* ${dadosSolicitante.unidade_lotacao}\n` +
    `*Função:* ${dadosSolicitante.funcao}\n` +
    `*Telefone:* ${dadosSolicitante.telefone}\n` +
    `*E-mail:* ${dadosSolicitante.email}\n\n` +
    `👉 Clique para analisar e conceder acesso:\n${appUrl}`
  );
  window.open(`https://wa.me/${numeroAdmin}?text=${msg}`, '_blank');
}

// Funções compatíveis com os perfis de acesso cadastrados pelo administrador
const FUNCOES = [
  { label: 'Comandante CRPM', perfil: 'comandante_crpm' },
  { label: 'Comandante de Batalhão', perfil: 'comandante_btl' },
  { label: 'Comandante de Companhia', perfil: 'comandante_cia' },
  { label: 'Comandante de Pelotão', perfil: 'comandante_pel' },
  { label: 'Comandante GPM', perfil: 'comandante_gpm' },
  { label: 'P1', perfil: 'comandante_crpm' },
  { label: 'P2', perfil: 'comandante_crpm' },
  { label: 'P3', perfil: 'comandante_crpm' },
  { label: 'P4', perfil: 'comandante_crpm' },
  { label: 'Operador', perfil: 'operador' },
];

const FUNCOES_P = ['P1', 'P2', 'P3', 'P4'];

// Seletor hierárquico de unidade (igual ao do admin)
// Se isFuncaoP=true, oculta Cia/Pel/GPM — P1/P2/P3/P4 ficam no CRPM ou no BTL escolhido
function OrgSelectorReq({ bpm, setBpm, cia, setCia, pel, setPel, gpm, setGpm, isFuncaoP = false }) {
  const cias = getCias(bpm);
  const pelotoes = getPelotoes(bpm, cia);
  const gpms = getGPMs(bpm, cia, pel);

  const selectClass = 'bg-white/15 border-white/25 text-white text-sm h-9';
  const placeholderClass = '[&>span]:text-white/90';

  return (
    <div className="space-y-2">
      {/* CRPM — fixo */}
      <Input value={CRPM} readOnly className="bg-white/10 border-white/20 text-white/60 text-xs h-8 cursor-not-allowed" />

      {/* BTL */}
      <Select value={bpm} onValueChange={v => { setBpm(v === '__limpar__' ? '' : v); setCia(''); setPel(''); setGpm(''); }}>
        <SelectTrigger className={`${selectClass} ${placeholderClass}`}>
          <SelectValue placeholder={isFuncaoP ? 'Batalhão (opcional — deixe vazio p/ CRPM)' : 'Batalhão (BTL) *'} />
        </SelectTrigger>
        <SelectContent className="max-h-56">
          <SelectItem value="__crpm__">— Sede CRPM/VRP (sem BTL) —</SelectItem>
          {BPMs.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
        </SelectContent>
      </Select>

      {/* CIA, PEL, GPM — ocultos para P1/P2/P3/P4 */}
      {!isFuncaoP && bpm && bpm !== '__crpm__' && (
        <Select value={cia} onValueChange={v => { setCia(v === '__limpar__' ? '' : v); setPel(''); setGpm(''); }}>
          <SelectTrigger className={`${selectClass} ${placeholderClass}`}>
            <SelectValue placeholder="Companhia (Cia)" />
          </SelectTrigger>
          <SelectContent className="max-h-56">
            <SelectItem value="__btl__">— Nível BTL —</SelectItem>
            {cias.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      {!isFuncaoP && bpm && bpm !== '__crpm__' && cia && cia !== '__btl__' && (
        <Select value={pel} onValueChange={v => { setPel(v === '__limpar__' ? '' : v); setGpm(''); }}>
          <SelectTrigger className={`${selectClass} ${placeholderClass}`}>
            <SelectValue placeholder="Pelotão (opcional)" />
          </SelectTrigger>
          <SelectContent className="max-h-56">
            <SelectItem value="__cia__">— Nível Cia —</SelectItem>
            {pelotoes.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      {!isFuncaoP && bpm && bpm !== '__crpm__' && cia && cia !== '__btl__' && pel && pel !== '__cia__' && (
        <Select value={gpm} onValueChange={v => setGpm(v === '__limpar__' ? '' : v)}>
          <SelectTrigger className={`${selectClass} ${placeholderClass}`}>
            <SelectValue placeholder="GPM (opcional)" />
          </SelectTrigger>
          <SelectContent className="max-h-56">
            <SelectItem value="__pel__">— Nível Pel —</SelectItem>
            {gpms.map(g => <SelectItem key={g.nome} value={g.nome}>{g.nome} — {g.municipio}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

// Monta string de lotação a partir dos selects hierárquicos
// Se não selecionar BTL (ou __crpm__), retorna apenas CRPM (sede)
function buildLotacao(bpm, cia, pel, gpm) {
  const bpmVal = (!bpm || bpm === '__crpm__') ? '' : bpm;
  if (!bpmVal) return CRPM; // Sede CRPM/VRP
  return [
    gpm && gpm !== '__pel__' ? gpm : null,
    pel && pel !== '__cia__' ? pel : null,
    cia && cia !== '__btl__' ? cia : null,
    bpmVal,
    CRPM,
  ].filter(Boolean).join(' / ');
}

const BM_BRASAO = 'https://media.base44.com/images/public/69ea1019a6b072f9661e6c7e/a5141bf0c_Braso_Brigada_Militar_do_Rio_Grande_do_Sul.png';

const VIEWS = { LOGIN: 'login', CHANGE_PASS: 'change_pass', REQUEST: 'request' };

export default function Acesso() {
  const { login, changeAdminPassword } = useAppAuth();
  const [view, setView] = useState(VIEWS.LOGIN);
  const [idFuncional, setIdFuncional] = useState('');
  const [senha, setSenha] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  // Change password
  const [cpIdFunc, setCpIdFunc] = useState('');
  const [cpSenhaAtual, setCpSenhaAtual] = useState('');
  const [cpNovaSenha, setCpNovaSenha] = useState('');
  const [cpConfirmSenha, setCpConfirmSenha] = useState('');

  // Access request
  const [reqForm, setReqForm] = useState({
    nome_completo: '', id_funcional: '', email: '',
    funcao: '', telefone: '', tipo: 'novo_acesso'
  });
  // Seleção hierárquica de unidade
  const [reqBpm, setReqBpm] = useState('');
  const [reqCia, setReqCia] = useState('');
  const [reqPel, setReqPel] = useState('');
  const [reqGpm, setReqGpm] = useState('');
  // Refs para foco nos campos obrigatórios
  const refNome = useRef(null);
  const refIdFunc = useRef(null);
  const refEmail = useRef(null);
  const refTelefone = useRef(null);
  const refFuncao = useRef(null);

  const clearReqForm = () => {
    setReqForm({ nome_completo: '', id_funcional: '', email: '', funcao: '', telefone: '', tipo: 'novo_acesso' });
    setReqBpm(''); setReqCia(''); setReqPel(''); setReqGpm('');
  };

  const clearChangePassForm = () => {
    setCpIdFunc(''); setCpSenhaAtual(''); setCpNovaSenha(''); setCpConfirmSenha('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!idFuncional || !senha) { toast.error('Preencha o Id. Funcional e a Senha'); return; }
    setLoading(true);
    try {
      await login(idFuncional.trim(), senha);
    } catch (err) {
      toast.error(err.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!cpIdFunc || !cpSenhaAtual || !cpNovaSenha || !cpConfirmSenha) { toast.error('Preencha todos os campos'); return; }
    if (cpNovaSenha !== cpConfirmSenha) { toast.error('As senhas não conferem'); return; }
    if (cpNovaSenha.length < 6) { toast.error('A nova senha deve ter ao menos 6 caracteres'); return; }
    setLoading(true);
    try {
      await changeAdminPassword(cpIdFunc.trim(), cpSenhaAtual, cpNovaSenha);
      toast.success('Senha alterada com sucesso! Faça login com a nova senha.');
      setView(VIEWS.LOGIN);
      setCpIdFunc(''); setCpSenhaAtual(''); setCpNovaSenha(''); setCpConfirmSenha('');
    } catch (err) {
      toast.error(err.message || 'Erro ao alterar senha');
    } finally {
      setLoading(false);
    }
  };

  const handleRequest = async (e) => {
    e.preventDefault();
    const { nome_completo, id_funcional, email, funcao, telefone } = reqForm;
    const unidade_lotacao = buildLotacao(reqBpm, reqCia, reqPel, reqGpm);

    // Validação campo a campo com foco automático
    if (!nome_completo.trim()) {
      toast.error('Informe o Nome Completo');
      refNome.current?.focus(); return;
    }
    if (!id_funcional.trim()) {
      toast.error('Informe o Id. Funcional');
      refIdFunc.current?.focus(); return;
    }
    if (!email.trim()) {
      toast.error('Informe o E-mail Funcional');
      refEmail.current?.focus(); return;
    }
    if (!email.includes('@')) {
      toast.error('Informe um e-mail válido (ex: nome@bm.rs.gov.br)');
      refEmail.current?.focus(); refEmail.current?.select(); return;
    }
    if (!telefone.trim()) {
      toast.error('Informe o Telefone para Contato');
      refTelefone.current?.focus(); return;
    }
    if (!funcao) {
      toast.error('Selecione a Função Exercida');
      refFuncao.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return;
    }

    setLoading(true);

    // 1. Cria a solicitação no banco
    const dadosSolicitante = { ...reqForm, unidade_lotacao };
    const novaReq = await base44.entities.AccessRequest.create({ ...dadosSolicitante, status: 'pendente' });

    // 2. Reseta o formulário
    setReqForm({ nome_completo: '', id_funcional: '', email: '', funcao: '', telefone: '', tipo: 'novo_acesso' });
    setReqBpm(''); setReqCia(''); setReqPel(''); setReqGpm('');
    setLoading(false);

    // 3. Mostra o toast e DEPOIS navega (para garantir que apareça)
    toast.success('Solicitação enviada com sucesso! O administrador analisará e entrará em contato.', { duration: 6000 });
    setTimeout(() => setView(VIEWS.LOGIN), 800);

    // 4. Dispara notificações em background (sem bloquear a UI)
    getAdminContacts().then(({ wa, email: adminEmail }) => {
      const tipoLabel = reqForm.tipo === 'novo_acesso' ? 'Novo Acesso' : 'Recuperação de Senha';
      const promises = [];
      if (adminEmail) {
        promises.push(base44.integrations.Core.SendEmail({
          to: adminEmail,
          subject: `SISPROD BM — Solicitação de ${tipoLabel}: ${nome_completo}`,
          body: `
            <h2>🔔 Nova Solicitação — SISPROD BM</h2>
            <p><strong>Tipo:</strong> ${tipoLabel}</p>
            <p><strong>Nome:</strong> ${nome_completo}</p>
            <p><strong>Id. Funcional:</strong> ${id_funcional}</p>
            <p><strong>Unidade:</strong> ${unidade_lotacao}</p>
            <p><strong>Função:</strong> ${funcao}</p>
            <p><strong>Telefone:</strong> ${telefone}</p>
            <p><strong>E-mail:</strong> ${email}</p>
            <br/>
            <p>Acesse o SISPROD BM para analisar e responder a solicitação.</p>
          `,
        }));
      }
      Promise.allSettled(promises).then(() => {
        if (wa) setTimeout(() => abrirWhatsApp(wa, dadosSolicitante, novaReq?.id), 300);
      });
    });
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #0a1f11 0%, #16402a 50%, #0a1f11 100%)' }}
    >
      <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'repeating-linear-gradient(45deg, white 0, white 1px, transparent 0, transparent 50%)', backgroundSize: '24px 24px' }} />

      <div className="relative w-full max-w-sm">
        {/* Header */}
        <motion.div className="text-center mb-8" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <img src={BM_BRASAO} alt="Brasão BM" className="w-24 h-24 object-contain mx-auto mb-4 drop-shadow-2xl" />
          <h1 className="text-4xl font-black text-white tracking-tight">SISPROD</h1>
          <h2 className="text-3xl font-black leading-none" style={{ color: '#d4a017' }}>BM</h2>
          <p className="text-white/50 text-xs mt-2 tracking-widest uppercase">Brigada Militar · CRPM/VRP</p>
        </motion.div>

        <AnimatePresence mode="wait">
          {/* ── LOGIN ── */}
          {view === VIEWS.LOGIN && (
            <motion.div key="login" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-2xl">
                <div className="flex items-center gap-2 mb-5">
                  <Lock className="w-4 h-4 text-[#d4a017]" />
                  <h3 className="text-white font-bold text-base">Acesso ao Sistema</h3>
                </div>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <Label className="text-white/80 text-xs font-semibold uppercase tracking-wider">Id. Funcional</Label>
                    <Input
                      value={idFuncional}
                      onChange={e => setIdFuncional(e.target.value)}
                      placeholder="Ex: 1234567"
                      className="mt-1.5 bg-white/15 border-white/25 text-white placeholder:text-white/40 font-mono"
                      autoComplete="username"
                    />
                  </div>
                  <div>
                    <Label className="text-white/80 text-xs font-semibold uppercase tracking-wider">Senha</Label>
                    <div className="relative mt-1.5">
                      <Input
                        type={showPass ? 'text' : 'password'}
                        value={senha}
                        onChange={e => setSenha(e.target.value)}
                        placeholder="••••••••"
                        className="bg-white/15 border-white/25 text-white placeholder:text-white/40 pr-10"
                        autoComplete="current-password"
                      />
                      <button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80">
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" disabled={loading} className="w-full h-11 font-bold gap-2 mt-2"
                    style={{ background: 'linear-gradient(135deg, #1a5c30, #2d8a4e)', border: '1px solid rgba(255,255,255,0.12)' }}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4 text-[#d4a017]" />}
                    {loading ? 'Verificando...' : 'Acessar'}
                  </Button>
                </form>
              </div>

              <div className="mt-4 space-y-1.5">
                <button onClick={() => setView(VIEWS.CHANGE_PASS)}
                  className="w-full text-xs text-white/60 hover:text-white/90 transition-colors py-2 rounded-lg hover:bg-white/10 flex items-center justify-center gap-2">
                  <Key className="w-3.5 h-3.5" /> Alterar minha senha
                </button>
                <button onClick={() => { setView(VIEWS.REQUEST); setReqForm(f => ({ ...f, tipo: 'recuperacao_senha' })); }}
                  className="w-full text-xs text-white/60 hover:text-white/90 transition-colors py-2 rounded-lg hover:bg-white/10 flex items-center justify-center gap-2">
                  <Lock className="w-3.5 h-3.5" /> Esqueci / Solicitar recuperação de senha
                </button>
                <button onClick={() => { setView(VIEWS.REQUEST); setReqForm(f => ({ ...f, tipo: 'novo_acesso' })); }}
                  className="w-full text-xs text-[#d4a017]/80 hover:text-[#d4a017] transition-colors py-2 rounded-lg hover:bg-white/10 flex items-center justify-center gap-2">
                  <Shield className="w-3.5 h-3.5" /> Solicitar acesso ao sistema
                </button>
              </div>
            </motion.div>
          )}

          {/* ── ALTERAR SENHA ── */}
          {view === VIEWS.CHANGE_PASS && (
            <motion.div key="change" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-2xl">
                <div className="flex items-center gap-2 mb-5">
                  <button onClick={() => { setView(VIEWS.LOGIN); clearChangePassForm(); }} className="text-white/60 hover:text-white"><ArrowLeft className="w-4 h-4" /></button>
                  <Key className="w-4 h-4 text-[#d4a017]" />
                  <h3 className="text-white font-bold text-base flex-1">Alterar Senha</h3>
                  <button type="button" onClick={clearChangePassForm} title="Limpar campos"
                    className="text-white/40 hover:text-white/80 transition-colors p-1 rounded-lg hover:bg-white/10 flex items-center gap-1 text-xs">
                    <Eraser className="w-3.5 h-3.5" /> Limpar
                  </button>
                </div>
                <form onSubmit={handleChangePassword} className="space-y-3">
                  <div>
                    <Label className="text-white/80 text-xs font-semibold uppercase tracking-wider">Id. Funcional</Label>
                    <Input value={cpIdFunc} onChange={e => setCpIdFunc(e.target.value)} placeholder="Ex: 1234567"
                      className="mt-1.5 bg-white/15 border-white/25 text-white placeholder:text-white/40 font-mono" />
                  </div>
                  <div>
                    <Label className="text-white/80 text-xs font-semibold uppercase tracking-wider">Senha Atual</Label>
                    <Input type="password" value={cpSenhaAtual} onChange={e => setCpSenhaAtual(e.target.value)} placeholder="••••••••"
                      className="mt-1.5 bg-white/15 border-white/25 text-white placeholder:text-white/40" />
                  </div>
                  <div>
                    <Label className="text-white/80 text-xs font-semibold uppercase tracking-wider">Nova Senha</Label>
                    <Input type="password" value={cpNovaSenha} onChange={e => setCpNovaSenha(e.target.value)} placeholder="Min. 6 caracteres"
                      className="mt-1.5 bg-white/15 border-white/25 text-white placeholder:text-white/40" />
                  </div>
                  <div>
                    <Label className="text-white/80 text-xs font-semibold uppercase tracking-wider">Confirmar Nova Senha</Label>
                    <Input type="password" value={cpConfirmSenha} onChange={e => setCpConfirmSenha(e.target.value)} placeholder="Repita a nova senha"
                      className="mt-1.5 bg-white/15 border-white/25 text-white placeholder:text-white/40" />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full h-11 font-bold gap-2 mt-2"
                    style={{ background: 'linear-gradient(135deg, #1a5c30, #2d8a4e)', border: '1px solid rgba(255,255,255,0.12)' }}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                    {loading ? 'Salvando...' : 'Alterar Senha'}
                  </Button>
                </form>
              </div>
            </motion.div>
          )}

          {/* ── SOLICITAR ACESSO / RECUPERAR SENHA ── */}
          {view === VIEWS.REQUEST && (
            <motion.div key="request" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-2xl max-h-[70vh] overflow-y-auto">
                <div className="flex items-center gap-2 mb-4">
                  <button onClick={() => { setView(VIEWS.LOGIN); clearReqForm(); }} className="text-white/60 hover:text-white"><ArrowLeft className="w-4 h-4" /></button>
                  <Send className="w-4 h-4 text-[#d4a017]" />
                  <h3 className="text-white font-bold text-sm flex-1">
                    {reqForm.tipo === 'recuperacao_senha' ? 'Recuperação de Senha' : 'Solicitar Acesso'}
                  </h3>
                  <button type="button" onClick={clearReqForm} title="Limpar campos"
                    className="text-white/40 hover:text-white/80 transition-colors p-1 rounded-lg hover:bg-white/10 flex items-center gap-1 text-xs">
                    <Eraser className="w-3.5 h-3.5" /> Limpar
                  </button>
                </div>
                <div className="flex gap-2 mb-4">
                  {['novo_acesso', 'recuperacao_senha'].map(t => (
                    <button key={t} onClick={() => setReqForm(f => ({ ...f, tipo: t }))}
                      className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${reqForm.tipo === t ? 'bg-[#d4a017] text-black border-[#d4a017] font-bold' : 'border-white/25 text-white/60 hover:text-white/80'}`}>
                      {t === 'novo_acesso' ? 'Novo Acesso' : 'Recuperar Senha'}
                    </button>
                  ))}
                </div>
                <p className="text-white/50 text-xs mb-4 leading-relaxed">
                  Preencha os dados abaixo. O administrador analisará e entrará em contato.
                </p>
                <form onSubmit={handleRequest} className="space-y-3">
                  {/* Campos de texto */}
                  <div>
                    <Label className="text-white/80 text-xs font-semibold uppercase tracking-wider">Nome Completo *</Label>
                    <Input ref={refNome} value={reqForm.nome_completo}
                      onChange={e => setReqForm(f => ({ ...f, nome_completo: e.target.value }))}
                      placeholder="Nome completo"
                      className="mt-1 bg-white/15 border-white/25 text-white placeholder:text-white/40 text-sm" />
                  </div>
                  <div>
                    <Label className="text-white/80 text-xs font-semibold uppercase tracking-wider">Id. Funcional *</Label>
                    <Input ref={refIdFunc} value={reqForm.id_funcional}
                      onChange={e => setReqForm(f => ({ ...f, id_funcional: e.target.value }))}
                      placeholder="Ex: 1234567"
                      className="mt-1 bg-white/15 border-white/25 text-white placeholder:text-white/40 text-sm font-mono" />
                  </div>
                  <div>
                    <Label className="text-white/80 text-xs font-semibold uppercase tracking-wider">E-mail Funcional *</Label>
                    <Input ref={refEmail} type="email" value={reqForm.email}
                      onChange={e => setReqForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="nome@bm.rs.gov.br"
                      className="mt-1 bg-white/15 border-white/25 text-white placeholder:text-white/40 text-sm" />
                  </div>
                  <div>
                    <Label className="text-white/80 text-xs font-semibold uppercase tracking-wider">Telefone para Contato *</Label>
                    <Input ref={refTelefone} type="tel" value={reqForm.telefone}
                      onChange={e => setReqForm(f => ({ ...f, telefone: e.target.value }))}
                      placeholder="Ex: (51) 99999-9999"
                      className="mt-1 bg-white/15 border-white/25 text-white placeholder:text-white/40 text-sm" />
                  </div>

                  {/* Unidade de Lotação — seleção hierárquica */}
                  <div>
                    <Label className="text-white/80 text-xs font-semibold uppercase tracking-wider">Unidade de Lotação</Label>
                    <p className="text-white/40 text-[10px] mb-1 leading-relaxed">
                      {FUNCOES_P.includes(reqForm.funcao)
                        ? 'P1/P2/P3/P4: selecione o Batalhão ou deixe em branco para CRPM/VRP.'
                        : 'Se lotado na sede do CRPM/VRP, deixe o Batalhão em branco.'}
                    </p>
                    <div className="mt-1">
                      <OrgSelectorReq
                        bpm={reqBpm} setBpm={setReqBpm}
                        cia={reqCia} setCia={setReqCia}
                        pel={reqPel} setPel={setReqPel}
                        gpm={reqGpm} setGpm={setReqGpm}
                        isFuncaoP={FUNCOES_P.includes(reqForm.funcao)}
                      />
                    </div>
                    <p className="text-[10px] text-white/50 mt-1">
                      ✓ {buildLotacao(reqBpm, reqCia, reqPel, reqGpm)}
                    </p>
                  </div>

                  {/* Função Exercida — compatível com perfis do admin */}
                  <div ref={refFuncao}>
                    <Label className="text-white/80 text-xs font-semibold uppercase tracking-wider">Função Exercida *</Label>
                    <Select value={reqForm.funcao} onValueChange={v => {
                      const newVal = v === '__limpar__' ? '' : v;
                      setReqForm(f => ({ ...f, funcao: newVal }));
                      // Se mudar para P, limpa Cia/Pel/GPM pois não se aplicam
                      if (FUNCOES_P.includes(newVal)) { setReqCia(''); setReqPel(''); setReqGpm(''); }
                    }}>
                      <SelectTrigger className="mt-1 bg-white/15 border-white/25 text-white text-sm h-9 [&>span]:text-white/90">
                        <SelectValue placeholder="Selecione a função exercida" />
                      </SelectTrigger>
                      <SelectContent className="max-h-56">
                        {reqForm.funcao && <SelectItem value="__limpar__">— Limpar seleção —</SelectItem>}
                        {FUNCOES.map(fn => (
                          <SelectItem key={fn.label} value={fn.label}>
                            <span>{fn.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {reqForm.funcao && (() => {
                      const isFP = FUNCOES_P.includes(reqForm.funcao);
                      if (isFP) {
                        const bpmSel = reqBpm && reqBpm !== '__crpm__' ? reqBpm : null;
                        return (
                          <p className="text-[10px] mt-1 font-semibold text-purple-300">
                            → Perfil: {reqForm.funcao} · Vinculado a: {bpmSel ? bpmSel : 'CRPM/VRP (Sede)'}
                          </p>
                        );
                      }
                      const perfilMap = {
                        comandante_crpm: { label: 'Perfil: Comandante CRPM', color: 'text-purple-300' },
                        comandante_btl: { label: 'Perfil: Comandante de Batalhão', color: 'text-blue-300' },
                        comandante_cia: { label: 'Perfil: Comandante de Companhia', color: 'text-indigo-300' },
                        comandante_pel: { label: 'Perfil: Comandante de Pelotão', color: 'text-cyan-300' },
                        comandante_gpm: { label: 'Perfil: Comandante de GPM', color: 'text-teal-300' },
                        operador: { label: 'Perfil: Operador', color: 'text-green-300' },
                      };
                      const found = FUNCOES.find(f => f.label === reqForm.funcao);
                      const perfil = found ? perfilMap[found.perfil] : null;
                      return perfil ? (
                        <p className={`text-[10px] mt-1 font-semibold ${perfil.color}`}>→ {perfil.label}</p>
                      ) : null;
                    })()}
                  </div>

                  <Button type="submit" disabled={loading} className="w-full h-11 font-bold gap-2 mt-2"
                    style={{ background: 'linear-gradient(135deg, #1a5c30, #2d8a4e)', border: '1px solid rgba(255,255,255,0.12)' }}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {loading ? 'Enviando...' : 'Enviar Solicitação'}
                  </Button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.p className="text-center text-white/25 text-[10px] mt-6 tracking-widest uppercase"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
          Sistema restrito · Brigada Militar RS
        </motion.p>
      </div>
    </div>
  );
}