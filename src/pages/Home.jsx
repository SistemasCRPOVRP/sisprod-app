import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Trophy, ClipboardPlus, BarChart3, Map, FileText, Target, Zap, Users, Calendar, Clock, BellRing, Pin, Info, AlertTriangle, RefreshCw, Megaphone, Wrench, Settings, X, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getCurrentPeriodo, getPeriodoLabel } from '@/lib/utils';
import { useProductions, useIndicators } from '@/hooks/useProduction';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { subDays, startOfWeek, startOfMonth, format } from 'date-fns';

const BM_BRASAO = 'https://media.base44.com/images/public/69ea1019a6b072f9661e6c7e/a5141bf0c_Braso_Brigada_Militar_do_Rio_Grande_do_Sul.png';

const quickLinks = [
  { label: 'Lançar Produção', icon: ClipboardPlus, path: '/lancamento', color: 'bg-primary text-primary-foreground', desc: 'Registre sua produtividade' },
  { label: 'Dashboard', icon: BarChart3, path: '/dashboard', color: 'bg-blue-600 text-white', desc: 'Visão geral e gráficos' },
  { label: 'Ranking', icon: Trophy, path: '/ranking', color: 'bg-amber-500 text-white', desc: 'Classificação das unidades' },
  { label: 'Mapa', icon: Map, path: '/mapa', color: 'bg-emerald-600 text-white', desc: 'Produtividade no mapa' },
  { label: 'Relatórios', icon: FileText, path: '/relatorios', color: 'bg-purple-600 text-white', desc: 'Exportar dados' },
  { label: 'Histórico', icon: Target, path: '/historico', color: 'bg-slate-600 text-white', desc: 'Registros lançados' },
];

const TIPO_CONFIG = {
  info:               { label: 'Informação',            color: 'border-blue-200 bg-blue-50',    badge: 'bg-blue-100 text-blue-800 border-blue-200',    icon: Info,         iconColor: 'text-blue-500' },
  aviso:              { label: 'Aviso',                 color: 'border-amber-200 bg-amber-50',  badge: 'bg-amber-100 text-amber-800 border-amber-200',  icon: AlertTriangle,iconColor: 'text-amber-500' },
  atualizacao:        { label: 'Atualização',           color: 'border-green-200 bg-green-50',  badge: 'bg-green-100 text-green-800 border-green-200',  icon: RefreshCw,    iconColor: 'text-green-500' },
  atualizacao_sistema:{ label: 'Atualização do Sistema',color: 'border-cyan-200 bg-cyan-50',    badge: 'bg-cyan-100 text-cyan-800 border-cyan-200',     icon: Settings,     iconColor: 'text-cyan-600' },
  manutencao:         { label: 'Manutenção do Sistema', color: 'border-orange-200 bg-orange-50',badge: 'bg-orange-100 text-orange-800 border-orange-200',icon: Wrench,       iconColor: 'text-orange-500' },
  urgente:            { label: 'Urgente',               color: 'border-red-200 bg-red-50',      badge: 'bg-red-100 text-red-800 border-red-200',        icon: Megaphone,    iconColor: 'text-red-500' },
  outro:              { label: 'Aviso',                 color: 'border-slate-200 bg-slate-50',  badge: 'bg-slate-100 text-slate-800 border-slate-200',  icon: BellRing,     iconColor: 'text-slate-500' },
};

function getTipoConfig(aviso) {
  if (aviso?.tipo === 'outro' && aviso?.tipo_personalizado) {
    return { ...TIPO_CONFIG.outro, label: aviso.tipo_personalizado };
  }
  return TIPO_CONFIG[aviso?.tipo] || TIPO_CONFIG.info;
}

// Chave localStorage para rastrear alertas já confirmados
const ALERT_KEY = 'sisprod_alertas_confirmados';

const catColors = {
  Preventiva: 'bg-blue-100 text-blue-800 border-blue-200',
  Repressiva: 'bg-red-100 text-red-800 border-red-200',
  'Apreensão': 'bg-orange-100 text-orange-800 border-orange-200',
  Atendimento: 'bg-green-100 text-green-800 border-green-200',
  Economia: 'bg-purple-100 text-purple-800 border-purple-200',
};

const catOrder = ['Preventiva', 'Repressiva', 'Apreensão', 'Atendimento', 'Economia'];

export default function Home() {
  const { appUser } = useOutletContext();
  const [periodoFiltro, setPeriodoFiltro] = useState('mes');
  const [horaAtual, setHoraAtual] = useState(new Date());

  // Atualiza o relógio a cada minuto
  useEffect(() => {
    const timer = setInterval(() => setHoraAtual(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const periodo = getCurrentPeriodo();
  const { data: productions } = useProductions(periodo);
  const { data: indicators } = useIndicators();

  const queryClient = useQueryClient();
  const [alertaAtual, setAlertaAtual] = useState(null);
  const [alertaPiscando, setAlertaPiscando] = useState(true);

  const { data: avisos = [] } = useQuery({
    queryKey: ['avisos'],
    queryFn: () => base44.entities.Aviso.list('-created_date'),
    staleTime: 0,
  });

  const avisosAtivos = avisos
    .filter(a => a.status === 'ativo')
    .sort((a, b) => (b.fixado ? 1 : 0) - (a.fixado ? 1 : 0));

  const avisosFixados = avisosAtivos.filter(a => a.fixado);
  const avisosNaoFixados = avisosAtivos.filter(a => !a.fixado);

  // Alerta destaque: mostra modal para avisos não confirmados
  useEffect(() => {
    if (!avisosAtivos.length) return;
    const confirmados = JSON.parse(localStorage.getItem(ALERT_KEY) || '[]');
    const pendente = avisosAtivos.find(a => a.alerta_destaque && !confirmados.includes(a.id));
    if (pendente) setAlertaAtual(pendente);
  }, [avisos]);

  // Piscar a cada 700ms
  useEffect(() => {
    if (!alertaAtual) return;
    const t = setInterval(() => setAlertaPiscando(v => !v), 700);
    return () => clearInterval(t);
  }, [alertaAtual]);

  const confirmarAlerta = () => {
    if (!alertaAtual) return;
    const confirmados = JSON.parse(localStorage.getItem(ALERT_KEY) || '[]');
    localStorage.setItem(ALERT_KEY, JSON.stringify([...confirmados, alertaAtual.id]));
    setAlertaAtual(null);
  };

  // Filtra produções conforme período selecionado
  const hoje = new Date();
  const filteredProductions = (productions || []).filter(p => {
    if (!p.data) return true;
    const d = new Date(p.data);
    if (periodoFiltro === 'hoje') return p.data === format(hoje, 'yyyy-MM-dd');
    if (periodoFiltro === 'semana') return d >= startOfWeek(hoje, { weekStartsOn: 1 });
    if (periodoFiltro === 'mes') return d >= startOfMonth(hoje);
    return true; // 'periodo' = trimestre atual (todos)
  });

  const totalLancamentos = filteredProductions.length;
  const unidades = new Set(filteredProductions.map(p => p.organization_id)).size;

  const agora = horaAtual;
  const hora = agora.getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const nome = appUser?.nome_completo?.split(' ')[0] || appUser?.id_funcional || 'Usuário';
  const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const diaSemana = diasSemana[agora.getDay()];
  const dataFormatada = agora.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const horaFormatada = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const periodoLabels = {
    hoje: 'Hoje',
    semana: 'Esta Semana',
    mes: 'Este Mês',
    periodo: getPeriodoLabel(periodo),
  };

  const grouped = catOrder.reduce((acc, cat) => {
    const inds = (indicators || []).filter(i => i.categoria === cat && i.status !== 'inativo');
    if (inds.length) acc[cat] = inds;
    return acc;
  }, {});

  // ── Componente reutilizável para renderizar um aviso ──
  const AvisoCard = ({ aviso }) => {
    const tc = getTipoConfig(aviso);
    const IconComp = tc.icon;
    return (
      <div className={`rounded-xl border ${tc.color} p-4`}>
        <div className="flex items-start gap-3">
          <IconComp className={`w-4 h-4 flex-shrink-0 mt-0.5 ${tc.iconColor}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${tc.badge}`}>{tc.label}</span>
              {aviso.fixado && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-0.5"><Pin className="w-2.5 h-2.5 inline" /> Fixado</span>}
              {aviso.alerta_destaque && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300">🔔 Alerta</span>}
            </div>
            <p className="font-semibold text-sm">{aviso.titulo}</p>
            <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">{aviso.mensagem}</p>
            {(aviso.autor_nome || aviso.created_date) && (
              <p className="text-[10px] text-muted-foreground mt-2">
                {aviso.autor_nome && <>Por {aviso.autor_nome}{aviso.created_date ? ' · ' : ''}</>}
                {aviso.created_date && format(new Date(aviso.created_date), 'dd/MM/yyyy HH:mm')}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── MAIN HOME ──
  return (
    <div className="min-h-full space-y-6">
      {/* Modal Alerta Destaque */}
      <AnimatePresence>
        {alertaAtual && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          >
            <motion.div
              animate={{ scale: alertaPiscando ? 1.02 : 1, boxShadow: alertaPiscando ? '0 0 0 6px rgba(239,68,68,0.4)' : '0 0 0 2px rgba(239,68,68,0.2)' }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-2xl border-2 border-red-500 shadow-2xl max-w-md w-full overflow-hidden"
            >
              <div className="bg-red-500 px-6 py-4 flex items-center gap-3">
                <span className={`text-2xl ${alertaPiscando ? 'opacity-100' : 'opacity-40'} transition-opacity`}>🔔</span>
                <div>
                  <p className="text-white font-black text-sm uppercase tracking-wider">Aviso Importante</p>
                  <p className="text-red-100 text-xs">{(() => { const tc = getTipoConfig(alertaAtual); return tc.label; })()}</p>
                </div>
              </div>
              <div className="p-6 space-y-3">
                <p className="font-bold text-lg text-foreground">{alertaAtual.titulo}</p>
                <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{alertaAtual.mensagem}</p>
                {alertaAtual.autor_nome && (
                  <p className="text-xs text-muted-foreground">Por {alertaAtual.autor_nome} · {alertaAtual.created_date ? format(new Date(alertaAtual.created_date), 'dd/MM/yyyy HH:mm') : ''}</p>
                )}
              </div>
              <div className="px-6 pb-6">
                <Button onClick={confirmarAlerta} className="w-full gap-2 bg-red-500 hover:bg-red-600 text-white font-bold h-11">
                  <CheckCircle className="w-5 h-5" /> OK, Entendi
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[hsl(150,20%,10%)] via-[hsl(142,30%,16%)] to-[hsl(142,40%,20%)] text-white">
        <div className="absolute inset-0 opacity-5" style={{backgroundImage: 'repeating-linear-gradient(45deg, white 0, white 1px, transparent 0, transparent 50%)', backgroundSize: '20px 20px'}} />
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-white/5 to-transparent" />
        <div className="relative flex flex-col md:flex-row items-center gap-6 p-7 md:p-10">
          <motion.div initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, type: 'spring' }} className="flex-shrink-0 text-center">
            <img src={BM_BRASAO} alt="Brasão Brigada Militar RS" className="w-28 h-28 md:w-36 md:h-36 object-contain drop-shadow-2xl" onError={e => { e.target.style.display = 'none'; }} />
          </motion.div>
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className="flex-1 text-center md:text-left">
            <p className="text-white/50 text-xs font-semibold uppercase tracking-[0.2em] mb-1">Brigada Militar — CRPM/VRP</p>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-1 leading-tight">SISPROD BM</h1>
            <p className="text-white/70 text-sm mb-3">Sistema de Análise da Produtividade Operacional do CRPM/VRP</p>
            <div className="flex flex-col sm:flex-row items-center md:items-start gap-2">
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur rounded-full px-4 py-1.5 text-sm">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
                Bem-vindo, {nome}!
              </div>
              <div className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur rounded-full px-4 py-1.5 text-xs text-white/80">
                <Clock className="w-3 h-3 text-white/60" />
                {diaSemana}, {dataFormatada} – {horaFormatada}
              </div>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className="flex flex-row md:flex-col gap-3 flex-shrink-0">
            {[
              { label: 'Lançamentos', value: totalLancamentos, icon: Zap },
              { label: 'Unidades', value: unidades, icon: Users },
            ].map(stat => (
              <div key={stat.label} className="bg-white/10 backdrop-blur rounded-xl px-5 py-3 text-center min-w-[80px]">
                <stat.icon className="w-4 h-4 mx-auto mb-1 text-white/60" />
                <p className="text-2xl font-black">{stat.value}</p>
                <p className="text-[10px] text-white/50 uppercase tracking-wider">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Seletor de Período */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
          <Calendar className="w-3.5 h-3.5" />
          Período de análise:
        </div>
        <Select value={periodoFiltro} onValueChange={setPeriodoFiltro}>
          <SelectTrigger className="h-8 text-xs w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hoje">Hoje</SelectItem>
            <SelectItem value="semana">Esta Semana</SelectItem>
            <SelectItem value="mes">Este Mês</SelectItem>
            <SelectItem value="periodo">{getPeriodoLabel(periodo)} (Trimestre)</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground hidden sm:inline">
          {totalLancamentos} lançamento{totalLancamentos !== 1 ? 's' : ''} · {unidades} unidade{unidades !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Avisos Fixados (acima do Acesso Rápido) */}
      {avisosFixados.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          <div className="flex items-center gap-2 mb-3">
            <Pin className="w-3.5 h-3.5 text-primary" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Avisos Fixados</h2>
            <Badge variant="outline" className="text-[10px]">{avisosFixados.length}</Badge>
          </div>
          <div className="space-y-3">
            {avisosFixados.map(aviso => <AvisoCard key={aviso.id} aviso={aviso} />)}
          </div>
        </motion.div>
      )}

      {/* Acesso Rápido */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Acesso Rápido</h2>
        <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {quickLinks.map((item, i) => (
            <motion.div key={item.path} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
              <Link to={item.path}>
                <div className="group rounded-xl border border-border bg-card p-3 md:p-4 hover:shadow-md transition-all cursor-pointer hover:-translate-y-0.5">
                  <div className={`w-9 h-9 rounded-lg ${item.color} flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform`}>
                    <item.icon className="w-4 h-4" />
                  </div>
                  <p className="text-xs md:text-sm font-semibold leading-tight">{item.label}</p>
                  <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 hidden md:block">{item.desc}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Avisos Não-Fixados (antes dos Indicadores) */}
      {avisosNaoFixados.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          <div className="flex items-center gap-2 mb-3">
            <BellRing className="w-3.5 h-3.5 text-primary" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Avisos e Comunicados</h2>
            <Badge variant="outline" className="text-[10px]">{avisosNaoFixados.length}</Badge>
          </div>
          <div className="space-y-3">
            {avisosNaoFixados.map(aviso => <AvisoCard key={aviso.id} aviso={aviso} />)}
          </div>
        </motion.div>
      )}

      {/* Indicadores de Produtividade */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Indicadores de Produtividade Analisados</h2>
        <div className="bg-card rounded-xl border border-border p-4 space-y-4">
          {Object.entries(grouped).map(([cat, inds]) => (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${catColors[cat]}`}>{cat}</span>
                <span className="text-xs text-muted-foreground">{inds.length} indicador{inds.length > 1 ? 'es' : ''}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {inds.map(ind => (
                  <span key={ind.id} className={`text-xs px-2.5 py-1 rounded-lg border ${catColors[cat]} font-medium`}>{ind.nome}</span>
                ))}
              </div>
            </div>
          ))}
          {Object.keys(grouped).length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum indicador ativo cadastrado.</p>
          )}
        </div>
      </motion.div>

      {/* Banner institucional */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="rounded-xl border border-primary/20 bg-primary/5 p-5">
        <div className="flex items-start gap-4">
          <Shield className="w-7 h-7 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-sm mb-1">Sistema de Análise da Produtividade Operacional do CRPM/VRP</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              O SISPROD BM foi desenvolvido para o registro, acompanhamento e avaliação da produtividade operacional das unidades da Brigada Militar na Região de Ação do CRPM/VRP, em cumprimento à Nota de Serviço nº 08/CRPM/VRP-P3/2026.
            </p>
            <div className="flex gap-3 mt-3">
              <Link to="/lancamento"><Button size="sm" className="gap-1.5 text-xs"><ClipboardPlus className="w-3.5 h-3.5" /> Lançar Produção</Button></Link>
              <Link to="/dashboard"><Button size="sm" variant="outline" className="gap-1.5 text-xs"><BarChart3 className="w-3.5 h-3.5" /> Ver Dashboard</Button></Link>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}