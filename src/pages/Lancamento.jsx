import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useIndicators } from '@/hooks/useProduction';
import { getPeriodo } from '@/lib/utils';
import { format, subMonths } from 'date-fns';
import {
  CRPM, BPMs, ORG_STRUCTURE, getCias, getPelotoes, getGPMs, getMunicipioPel, getMunicipioCia
} from '@/lib/orgData';
import { CheckCircle, Upload, Loader2, Star, Lock, Pencil, Zap, Droplets, Lightbulb, Plus, Info, Trash2, History, X } from 'lucide-react';
import HistoricoLancamentos from '@/components/lancamento/HistoricoLancamentos';
import EconomiaAguaForm, { calcPontosAgua, calcDeltaAgua } from '@/components/lancamento/EconomiaAguaForm';
import EconomiaLuzForm, { calcPontosLuz, calcDeltaLuz } from '@/components/lancamento/EconomiaLuzForm';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';

const catColors = {
  Preventiva: 'bg-blue-100 text-blue-800',
  Repressiva: 'bg-red-100 text-red-800',
  'Apreensão': 'bg-orange-100 text-orange-800',
  Atendimento: 'bg-green-100 text-green-800',
  Economia: 'bg-purple-100 text-purple-800',
};

const IS_ECONOMIA_AGUA = (nome) => nome?.toLowerCase().includes('água') || nome?.toLowerCase().includes('agua');
const IS_ECONOMIA_LUZ  = (nome) => nome?.toLowerCase().includes('luz') || nome?.toLowerCase().includes('energia');
const IS_ECONOMIA = (ind) => ind?.categoria === 'Economia' && (IS_ECONOMIA_AGUA(ind?.nome) || IS_ECONOMIA_LUZ(ind?.nome));

const IS_DROGAS = (nome) => nome?.toLowerCase().includes('entorpecente') || nome?.toLowerCase().includes('droga') || nome?.toLowerCase().includes('narcótico') || nome?.toLowerCase().includes('narcotico');

// Regra de drogas: pontos por faixa de peso (gramas)
const calcPontosDrogas = (gramas) => {
  const g = parseFloat(gramas);
  if (!g || g <= 0) return 0;
  if (g <= 10) return 3;
  if (g <= 100) return 5;
  if (g <= 1000) return 8;
  return 10;
};


export default function Lancamento() {
  const { appUser } = useOutletContext();
  const queryClient = useQueryClient();
  const { data: indicators } = useIndicators();

  const now = new Date();
  const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // ── STEP 1: Unidade (travada após confirmar)
  const [unidadeConfirmada, setUnidadeConfirmada] = useState(false);
  const [bpm, setBpm] = useState('');
  const [cia, setCia] = useState('');
  const [pel, setPel] = useState('');
  const [gpm, setGpm] = useState('');
  const [municipio, setMunicipio] = useState('');

  // Economia: sub-tipo é determinado pelo indicador selecionado (sem sub-abas)

  // ── STEP 2: Item de produção
  const [form, setForm] = useState({
    data: todayLocal,
    indicator_id: '',
    quantidade: '',
    tipoDroga: '',
    // Economia Água: três meses
    consumoDoisAtrasAgua: '',
    consumoAnteriorAgua: '',
    consumoAtualAgua: '',
    // Economia Luz: três meses
    consumoDoisAtrasLuz: '',
    consumoAnteriorLuz: '',
    consumoAtualLuz: '',
    observacao: '',
  });

  // Labels dos três meses derivados da DATA selecionada no formulário (não de hoje)
  const dataRef = form.data ? new Date(form.data + 'T12:00:00') : now;
  const mesAtualLabel      = format(dataRef, 'MM/yyyy');
  const mesAnteriorLabel   = format(subMonths(dataRef, 1), 'MM/yyyy');
  const mesDoisAtrasLabel  = format(subMonths(dataRef, 2), 'MM/yyyy');
  const mesAnteriorPrefix  = format(subMonths(dataRef, 1), 'yyyy-MM');
  const mesDoisAtrasPrefix = format(subMonths(dataRef, 2), 'yyyy-MM');

  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [successId, setSuccessId] = useState(null);
  const [sessaoItens, setSessaoItens] = useState([]);
  const [validationErrors, setValidationErrors] = useState(new Set());

  // Diálogos de edição/exclusão/solicitação para itens da sessão
  // Controla qual painel está visível: 'lancamento' | 'historico'
  const [painelAtivo, setPainelAtivo] = useState('lancamento');

  const [sessaoEditDialog, setSessaoEditDialog] = useState(null);
  const [sessaoEditQtd, setSessaoEditQtd] = useState('');
  const [sessaoDeleteDialog, setSessaoDeleteDialog] = useState(null);
  const [sessaoRequestDialog, setSessaoRequestDialog] = useState(null);
  const [sessaoRequestMotivo, setSessaoRequestMotivo] = useState('');

  // Cascata hierárquica
  const handleBpm = (v) => { setBpm(v); setCia(''); setPel(''); setGpm(''); setMunicipio(''); };
  const handleCia = (v) => { setCia(v); setPel(''); setGpm(''); setMunicipio(getMunicipioCia(bpm, v)); };
  const handlePel = (v) => { setPel(v); setGpm(''); setMunicipio(getMunicipioPel(bpm, cia, v)); };
  const handleGpm = (v) => {
    setGpm(v);
    const found = getGPMs(bpm, cia, pel).find(g => g.nome === v);
    if (found) setMunicipio(found.municipio);
  };

  const cias = getCias(bpm);
  const pelotoes = getPelotoes(bpm, cia);
  const gpms = getGPMs(bpm, cia, pel);

  const selectedIndicator = indicators.find(i => i.id === form.indicator_id);
  // O tipo Água ou Luz é determinado pelo nome do indicador — cada um é independente
  const isEconomia = IS_ECONOMIA(selectedIndicator);
  const isAgua = isEconomia && IS_ECONOMIA_AGUA(selectedIndicator?.nome);
  const isLuz  = isEconomia && IS_ECONOMIA_LUZ(selectedIndicator?.nome);
  const isDrogas = selectedIndicator && IS_DROGAS(selectedIndicator?.nome);

  const buildOrgId = () => `${bpm}|${cia}|${pel}|${gpm}`;
  // Monta nome hierárquico completo no formato institucional (sem município)
  const buildOrgName = () => {
    if (gpm && pel && cia && bpm) return `${gpm} / ${pel} / ${cia} / ${bpm}`;
    if (pel && cia && bpm) return `${pel} / ${cia} / ${bpm}`;
    if (cia && bpm) return `${cia} / ${bpm}`;
    if (bpm) return bpm;
    return '';
  };

  // Quando muda a DATA, limpa consumos para rebuscar conforme nova data de referência
  useEffect(() => {
    if (!isEconomia) return;
    setForm(f => ({
      ...f,
      consumoDoisAtrasAgua: '',
      consumoAnteriorAgua: '',
      consumoDoisAtrasLuz: '',
      consumoAnteriorLuz: '',
    }));
  }, [form.data]);

  // Busca histórico de consumo ao selecionar indicador de Economia (Água ou Luz)
  useEffect(() => {
    if (!isEconomia || !unidadeConfirmada || !form.indicator_id) return;

    const fetchHistorico = async () => {
      setLoadingHistorico(true);
      try {
        const orgId = buildOrgId();
        const registros = await base44.entities.Production.filter({
          indicator_id: form.indicator_id,
          organization_id: orgId,
        }, '-data', 12);

        const doMesAnterior  = registros.find(r => r.data?.startsWith(mesAnteriorPrefix));
        const doMesDoisAtras = registros.find(r => r.data?.startsWith(mesDoisAtrasPrefix));

        const registrosOrdenados = [...registros].sort((a, b) => (b.data || '').localeCompare(a.data || ''));
        const fallbackAnterior  = doMesAnterior  || registrosOrdenados[0];
        const fallbackDoisAtras = doMesDoisAtras || registrosOrdenados[1];

        const extrairConsumoAtual = (reg) => {
          if (!reg?.observacao) return null;
          const m = reg.observacao.match(/Atual\s*\([^)]*\):\s*([\d.,]+)\s*(?:m³|kWh)/i);
          if (m) return m[1].replace(',', '.');
          const m2 = reg.observacao.match(/Atual[^:]*:\s*([\d.,]+)/i);
          return m2 ? m2[1].replace(',', '.') : null;
        };

        const antVal       = extrairConsumoAtual(fallbackAnterior);
        const doisAtrasVal = extrairConsumoAtual(fallbackDoisAtras);

        setForm(f => ({
          ...f,
          ...(isAgua && antVal       ? { consumoAnteriorAgua:   antVal }      : {}),
          ...(isAgua && doisAtrasVal ? { consumoDoisAtrasAgua: doisAtrasVal } : {}),
          ...(isLuz  && antVal       ? { consumoAnteriorLuz:    antVal }      : {}),
          ...(isLuz  && doisAtrasVal ? { consumoDoisAtrasLuz:  doisAtrasVal } : {}),
        }));
      } finally {
        setLoadingHistorico(false);
      }
    };

    fetchHistorico();
  }, [form.indicator_id, form.data, unidadeConfirmada, bpm, cia, pel, gpm]);

  // Água/Luz: pontos calculados pelos sub-componentes
  const pontosAgua = isAgua ? calcPontosAgua(form) : null;
  const pontosLuz  = isLuz  ? calcPontosLuz(form)  : null;
  const pontosEconomia = pontosAgua ?? pontosLuz;

  // Drogas: pontos fixos por faixa de peso
  const pontosDrogas = isDrogas ? calcPontosDrogas(form.quantidade) : null;

  const quantidadeEfetiva = isEconomia
    ? (pontosEconomia !== null ? '1' : '')  // quantidade = 1 (o peso do indicador será o pontosEconomia)
    : form.quantidade;

  // Pontuação final
  let pontuacao = null;
  if (isEconomia && pontosEconomia !== null) {
    pontuacao = pontosEconomia; // 5 ou 0, fixo
  } else if (isDrogas && form.quantidade && parseFloat(form.quantidade) > 0) {
    pontuacao = pontosDrogas;
  } else if (selectedIndicator && quantidadeEfetiva && parseFloat(quantidadeEfetiva) > 0) {
    pontuacao = parseFloat(quantidadeEfetiva) * selectedIndicator.peso;
  }

  // Verifica se item da sessão ainda está dentro de 24h (sempre sim, já que acabou de ser lançado)
  // Mas mantemos a lógica para consistência com datas armazenadas
  const isWithin24h = (item) => {
    if (!item.created_date) return true; // acabou de criar
    const created = new Date(item.created_date);
    return (Date.now() - created.getTime()) < 24 * 60 * 60 * 1000;
  };

  const handleSessaoEdit = async () => {
    if (!sessaoEditDialog) return;
    const quantidade = parseFloat(sessaoEditQtd);
    const pontuacao = quantidade * (sessaoEditDialog.peso || 0);
    await base44.entities.Production.update(sessaoEditDialog.id, { quantidade, pontuacao });
    await base44.entities.AuditLog.create({
      usuario: appUser?.email || appUser?.id_funcional || 'sistema',
      acao: 'editou',
      tabela: 'Production',
      registro_id: sessaoEditDialog.id,
      detalhe: `Alterou quantidade de ${sessaoEditDialog.quantidade} para ${quantidade}`,
    });
    queryClient.invalidateQueries({ queryKey: ['productions'] });
    queryClient.invalidateQueries({ queryKey: ['all-productions'] });
    setSessaoItens(prev => prev.map(i => i.id === sessaoEditDialog.id ? { ...i, quantidade, pontuacao } : i));
    setSessaoEditDialog(null);
    toast.success('Registro atualizado!');
  };

  const handleSessaoDelete = async () => {
    if (!sessaoDeleteDialog) return;
    await base44.entities.Production.delete(sessaoDeleteDialog.id);
    await base44.entities.AuditLog.create({
      usuario: appUser?.email || appUser?.id_funcional || 'sistema',
      acao: 'excluiu',
      tabela: 'Production',
      registro_id: sessaoDeleteDialog.id,
      detalhe: `Excluiu ${sessaoDeleteDialog.indicador}`,
    });
    queryClient.invalidateQueries({ queryKey: ['productions'] });
    queryClient.invalidateQueries({ queryKey: ['all-productions'] });
    setSessaoItens(prev => prev.filter(i => i.id !== sessaoDeleteDialog.id));
    setSessaoDeleteDialog(null);
    toast.success('Registro excluído!');
  };

  const handleSessaoRequest = async () => {
    if (!sessaoRequestDialog) return;
    await base44.entities.EditRequest.create({
      production_id: sessaoRequestDialog.id,
      indicator_name: sessaoRequestDialog.indicador,
      organization_name: buildOrgName(),
      data_registro: form.data,
      solicitante_email: appUser?.email || appUser?.id_funcional || 'sistema',
      solicitante_nome: appUser?.nome_completo || '',
      solicitante_telefone: appUser?.telefone || '',
      motivo: sessaoRequestMotivo,
      status: 'pendente',
    });
    // Notifica admin via WhatsApp
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
          `Indicador: ${sessaoRequestDialog.indicador}\n` +
          `Unidade: ${buildOrgName()}\n` +
          (sessaoRequestMotivo ? `Motivo: ${sessaoRequestMotivo}\n\n` : '\n') +
          `Acesse o sistema: ${window.location.origin}/admin?tab=edicoes`
        );
        setTimeout(() => window.open(`https://wa.me/55${adminTel}?text=${msg}`, '_blank'), 300);
      }
    } catch {}
    setSessaoRequestDialog(null);
    setSessaoRequestMotivo('');
    toast.success('Solicitação enviada ao administrador!');
  };

  // Verifica se a unidade selecionada bate com o vínculo do usuário
  const userBpm = appUser?.bpm || '';
  const userCia = appUser?.companhia || '';
  const userPel = appUser?.pelotao || '';
  const userGpm = appUser?.gpm || '';
  const isAdminOrP = ['administrador', 'comandante_crpm', 'p1', 'p2', 'p3', 'p4'].includes(appUser?.perfil);

  const validarVinculoUnidade = () => {
    if (isAdminOrP) return true; // admin e P-seções podem lançar em qualquer unidade
    if (!userBpm) return true; // usuário sem vínculo definido: não bloqueia
    if (bpm !== userBpm) return false;
    if (userCia && cia !== userCia) return false;
    if (userPel && pel !== userPel) return false;
    if (userGpm && gpm !== userGpm) return false;
    return true;
  };

  const confirmarUnidade = () => {
    if (!bpm || !cia) { toast.error('Selecione pelo menos o BTL e a Cia'); return; }
    if (!validarVinculoUnidade()) {
      toast.error(
        `Você não possui vínculo com a unidade selecionada. Para lançar nesta unidade, solicite ao administrador a vinculação correspondente. Seus lançamentos estão restritos à sua unidade atual.`,
        { duration: 7000 }
      );
      return;
    }
    setUnidadeConfirmada(true);
    toast.success('Unidade confirmada! Agora lance os itens de produção.');
  };

  const resetItem = () => {
    setForm(f => ({
      ...f,
      indicator_id: '',
      quantidade: '',
      tipoDroga: '',
      consumoDoisAtrasAgua: '',
      consumoAnteriorAgua: '',
      consumoAtualAgua: '',
      consumoDoisAtrasLuz: '',
      consumoAnteriorLuz: '',
      consumoAtualLuz: '',
      observacao: '',
    }));
    setFile(null);
    setValidationErrors(new Set());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = new Set();
    
    // Validação de indicador (obrigatório)
    if (!form.indicator_id) {
      errors.add('indicator');
      toast.error('Campo obrigatório: Selecione o indicador');
      setValidationErrors(errors);
      return;
    }
    
    // Validação para Economia (Água/Luz)
    if (isEconomia) {
      if (isAgua) {
        if (!form.consumoAnteriorAgua) errors.add('consumoAnteriorAgua');
        if (!form.consumoAtualAgua) errors.add('consumoAtualAgua');
        if (errors.size > 0) {
          toast.error('Campos obrigatórios: Preencha consumo anterior e atual para Água');
          setValidationErrors(errors);
          return;
        }
      }
      if (isLuz) {
        if (!form.consumoAnteriorLuz) errors.add('consumoAnteriorLuz');
        if (!form.consumoAtualLuz) errors.add('consumoAtualLuz');
        if (errors.size > 0) {
          toast.error('Campos obrigatórios: Preencha consumo anterior e atual para Energia');
          setValidationErrors(errors);
          return;
        }
      }
      // Validação de números válidos
      if (isAgua) {
        const cAnt = parseFloat(form.consumoAnteriorAgua);
        const cAtual = parseFloat(form.consumoAtualAgua);
        if (isNaN(cAnt) || isNaN(cAtual) || cAnt < 0 || cAtual < 0) {
          errors.add('consumoAnteriorAgua');
          errors.add('consumoAtualAgua');
          toast.error('Consumos de água inválidos — insira números válidos');
          setValidationErrors(errors);
          return;
        }
      }
      if (isLuz) {
        const cAnt = parseFloat(form.consumoAnteriorLuz);
        const cAtual = parseFloat(form.consumoAtualLuz);
        if (isNaN(cAnt) || isNaN(cAtual) || cAnt < 0 || cAtual < 0) {
          errors.add('consumoAnteriorLuz');
          errors.add('consumoAtualLuz');
          toast.error('Consumos de energia inválidos — insira números válidos');
          setValidationErrors(errors);
          return;
        }
      }
    }
    // Validação para Drogas
    else if (isDrogas) {
      if (!form.tipoDroga) errors.add('tipoDroga');
      if (!form.quantidade || parseFloat(form.quantidade) <= 0) errors.add('quantidade');
      
      if (errors.size > 0) {
        toast.error('Campos obrigatórios: Selecione tipo de droga e quantidade em gramas');
        setValidationErrors(errors);
        return;
      }
      
      const qtd = parseFloat(form.quantidade);
      if (isNaN(qtd)) {
        errors.add('quantidade');
        toast.error('Quantidade inválida — insira um número válido');
        setValidationErrors(errors);
        return;
      }
    }
    // Validação para outros indicadores
    else {
      if (!form.quantidade || parseFloat(form.quantidade) <= 0) {
        errors.add('quantidade');
        toast.error('Campo obrigatório: Informe a quantidade');
        setValidationErrors(errors);
        return;
      }
      
      const qtd = parseFloat(form.quantidade);
      if (isNaN(qtd)) {
        errors.add('quantidade');
        toast.error('Quantidade inválida — insira um número válido');
        setValidationErrors(errors);
        return;
      }
    }
    
    // Tudo passou — limpa erros e continua
    setValidationErrors(new Set());

    let deltaEconomia = null;
    if (isAgua) deltaEconomia = calcDeltaAgua(form);
    else if (isLuz) deltaEconomia = calcDeltaLuz(form);

    const qtdFinal = isEconomia ? (deltaEconomia !== null ? deltaEconomia : 0) : parseFloat(form.quantidade);

    setSaving(true);
    let anexo_url = '';
    if (file) {
      const upload = await base44.integrations.Core.UploadFile({ file });
      anexo_url = upload.file_url;
    }

    const peso = selectedIndicator?.peso || 0;
    const orgName = buildOrgName();

    // Pontuação final a salvar
    let pontuacaoFinal = 0;
    let qtdSalva = qtdFinal;
    if (isEconomia) {
      pontuacaoFinal = pontosEconomia ?? 0;
      qtdSalva = deltaEconomia !== null ? parseFloat(deltaEconomia.toFixed(4)) : 0; // variação com sinal
    } else if (isDrogas) {
      pontuacaoFinal = pontosDrogas ?? 0;
      // Preserva o valor exato digitado pelo usuário, sem arredondamento
      qtdSalva = parseFloat(form.quantidade);
    } else {
      pontuacaoFinal = qtdFinal * peso;
    }

    // Monta observação com os dados de consumo + variação registrada
    const obsEconomia = [
      isAgua ? `Água — ${mesDoisAtrasLabel}: ${form.consumoDoisAtrasAgua || '-'} m³ | Ant (${mesAnteriorLabel}): ${form.consumoAnteriorAgua} m³ | Atual (${mesAtualLabel}): ${form.consumoAtualAgua} m³ | VarB-VarA: ${deltaEconomia !== null ? (deltaEconomia >= 0 ? '+' : '') + deltaEconomia.toFixed(2) + ' m³' : '-'} | Pontos: ${pontosAgua ?? 0}` : '',
      isLuz  ? `Luz — ${mesDoisAtrasLabel}: ${form.consumoDoisAtrasLuz || '-'} kWh | Ant (${mesAnteriorLabel}): ${form.consumoAnteriorLuz} kWh | Atual (${mesAtualLabel}): ${form.consumoAtualLuz} kWh | VarB-VarA: ${deltaEconomia !== null ? (deltaEconomia >= 0 ? '+' : '') + deltaEconomia.toFixed(2) + ' kWh' : '-'} | Pontos: ${pontosLuz ?? 0}` : '',
      form.observacao,
    ].filter(Boolean).join(' | ');

    const tipoDrogaStr = form.tipoDroga ? ` | Tipo: ${form.tipoDroga}` : '';
    const obsDrogas = isDrogas ? `Apreensão: ${qtdFinal}g${tipoDrogaStr} — Faixa: ${qtdFinal <= 10 ? 'até 10g' : qtdFinal <= 100 ? '10-100g' : qtdFinal <= 1000 ? '100-1000g' : 'acima de 1000g'} → ${pontosDrogas} pts${form.observacao ? ' | ' + form.observacao : ''}` : '';

    const record = await base44.entities.Production.create({
      data: form.data,
      periodo: getPeriodo(form.data),
      organization_id: buildOrgId(),
      organization_name: orgName,
      bpm, companhia: cia, pelotao: pel, gpm, municipio,
      indicator_id: form.indicator_id,
      indicator_name: selectedIndicator?.nome || '',
      categoria: selectedIndicator?.categoria || '',
      quantidade: qtdSalva,
      peso,
      pontuacao: pontuacaoFinal,
      observacao: isEconomia ? obsEconomia : isDrogas ? obsDrogas : form.observacao,
      anexo_url,
      lancado_por: appUser?.id_funcional || '',
      lancado_por_nome: appUser?.nome_completo || '',
    });

    await base44.entities.AuditLog.create({
      usuario: appUser?.email || appUser?.id_funcional || 'sistema',
      acao: 'criou',
      tabela: 'Production',
      detalhe: `${qtdFinal}x ${selectedIndicator?.nome} para ${orgName}`,
    });

    queryClient.invalidateQueries({ queryKey: ['productions'] });
    queryClient.invalidateQueries({ queryKey: ['all-productions'] });

    const consumoAtualSessao = isAgua ? parseFloat(form.consumoAtualAgua) : isLuz ? parseFloat(form.consumoAtualLuz) : null;
    const consumoAnteriorSessao = isAgua ? parseFloat(form.consumoAnteriorAgua) : isLuz ? parseFloat(form.consumoAnteriorLuz) : null;

    // Determina unidade de medida para exibição na sessão
    const getUnidadeSessao = (ind) => {
      const nome = (ind?.nome || '').toLowerCase();
      if (IS_ECONOMIA_AGUA(nome)) return 'm³';
      if (IS_ECONOMIA_LUZ(nome)) return 'kWh';
      if (IS_DROGAS(nome)) return 'gr';
      if (nome.includes('kg') || nome.includes('quilo')) return 'kg';
      if (nome.includes('veículo') || nome.includes('veiculo') || nome.includes('carro') || nome.includes('moto')) return 'un.';
      if (nome.includes('arma') || nome.includes('munição') || nome.includes('municao')) return 'un.';
      if (nome.includes('pessoa') || nome.includes('indivíduo') || nome.includes('individuo') || nome.includes('preso') || nome.includes('detido')) return 'pess.';
      return 'un.';
    };

    setSessaoItens(prev => [{
      id: record?.id || Date.now(),
      indicador: selectedIndicator?.nome,
      categoria: selectedIndicator?.categoria,
      quantidade: qtdSalva,
      pontuacao: pontuacaoFinal,
      peso: selectedIndicator?.peso || 0,
      isAgua,
      isLuz,
      isDrogas,
      unidade: getUnidadeSessao(selectedIndicator),
      pontouEconomia: pontuacaoFinal > 0,
      consumoAtual: consumoAtualSessao,
      consumoAnterior: consumoAnteriorSessao,
      created_date: new Date().toISOString(),
    }, ...prev]);

    setSuccessId(Date.now());
    toast.success('Item registrado! Pode lançar o próximo.');
    resetItem();
    setSaving(false);
    setTimeout(() => setSuccessId(null), 2000);
  };

  const groupedIndicators = indicators.reduce((acc, ind) => {
    if (ind.status === 'inativo') return acc;
    if (!acc[ind.categoria]) acc[ind.categoria] = [];
    acc[ind.categoria].push(ind);
    return acc;
  }, {});

  const [lembreteAberto, setLembreteAberto] = useState(false);

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-16">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lançamento de Produção</h1>
          <p className="text-sm text-muted-foreground mt-1">Registre os itens de produção operacional da unidade</p>
        </div>
        <button
          type="button"
          onClick={() => setLembreteAberto(v => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold text-primary underline underline-offset-2 hover:no-underline flex-shrink-0 mt-1 sm:mt-0.5"
        >
          <Info className="w-3.5 h-3.5" /> como editar/excluir registros
        </button>
      </div>

      {/* Lembrete recolhível */}
      <AnimatePresence>
        {lembreteAberto && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3 text-xs text-foreground">
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold text-sm text-primary uppercase tracking-wide">Lembrete aos Usuários — Edição e Exclusão de Registros</p>
                <button type="button" onClick={() => setLembreteAberto(false)} className="text-muted-foreground hover:text-foreground flex-shrink-0"><X className="w-4 h-4" /></button>
              </div>
              <p>Caso seja necessária a edição ou exclusão de um registro, o usuário poderá realizar a alteração diretamente no sistema durante o prazo de até <strong>48 horas</strong> após o lançamento.</p>
              <p>Após esse prazo, será necessário solicitar ao <strong>Administrador</strong> a liberação para edição ou exclusão, utilizando os botões disponíveis ao lado de cada registro.</p>
              <div className="rounded-lg bg-primary/10 border border-primary/20 px-3 py-2 space-y-1">
                <p className="font-semibold">Caminho para localizar o registro:</p>
                <p className="text-muted-foreground">Lançamentos → Identificar a Unidade → Consultar Lançamentos Anteriores → Selecionar a Data da Consulta → Localizar o Registro Desejado</p>
              </div>
              <p>Após localizar o registro, o usuário poderá:</p>
              <ul className="list-disc pl-5 space-y-0.5">
                <li>Editar o lançamento;</li>
                <li>Excluir o lançamento;</li>
                <li>Solicitar Edição/Exclusão ao Administrador, quando o prazo de 48 horas já tiver expirado.</li>
              </ul>
              <p className="text-muted-foreground italic">Mantenha os registros sempre atualizados e solicite as correções assim que identificar qualquer inconsistência.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── BLOCO 1: Identificação da Unidade ── */}
      <div className={`bg-card rounded-xl border p-5 space-y-4 transition-all ${unidadeConfirmada ? 'border-primary/40 bg-primary/5' : 'border-border'}`}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            {unidadeConfirmada ? <Lock className="w-3.5 h-3.5 text-primary" /> : <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">1</span>}
            Identificação da Unidade
          </h2>
          {unidadeConfirmada && (
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => { setUnidadeConfirmada(false); setSessaoItens([]); }}>
              <Pencil className="w-3 h-3" /> Alterar
            </Button>
          )}
        </div>

        {unidadeConfirmada ? (
          <div className="rounded-lg bg-primary/10 border border-primary/20 px-4 py-3">
            <p className="text-xs text-primary font-semibold uppercase tracking-wider mb-1">✓ Unidade confirmada</p>
            <p className="text-base font-bold">{buildOrgName()}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{CRPM} • {bpm} • Sessão ativa</p>
          </div>
        ) : (
          <>
            <div>
              <Label>CRPM</Label>
              <Input value={CRPM} readOnly className="mt-1.5 bg-muted cursor-not-allowed text-muted-foreground" />
            </div>
            <div>
              <Label>BTL (Batalhão) *</Label>
              <Select value={bpm} onValueChange={handleBpm}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione o Batalhão" /></SelectTrigger>
                <SelectContent>
                  {BPMs.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Companhia (Cia) *</Label>
              <Select value={cia} onValueChange={handleCia} disabled={!bpm}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder={bpm ? 'Selecione a Cia' : 'Selecione o BTL primeiro'} /></SelectTrigger>
                <SelectContent>
                  {cias.map(c => <SelectItem key={c} value={c}>{c} — {ORG_STRUCTURE[bpm]?.cias?.[c]?.municipio}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Pelotão <span className="text-xs text-muted-foreground font-normal">— opcional</span></Label>
              <Select value={pel} onValueChange={handlePel} disabled={!cia}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder={cia ? 'Selecione o Pelotão' : 'Selecione a Cia primeiro'} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>— Nenhum —</SelectItem>
                  {pelotoes.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {pel && (
              <div>
                <Label>GPM <span className="text-xs text-muted-foreground font-normal">— opcional</span></Label>
                <Select value={gpm} onValueChange={handleGpm}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione o GPM" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>— Nenhum —</SelectItem>
                    {gpms.map(g => <SelectItem key={g.nome} value={g.nome}>{g.nome} — {g.municipio}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Município</Label>
              <Input value={municipio} onChange={e => setMunicipio(e.target.value)} placeholder="Preenchido automaticamente" className="mt-1.5" />
            </div>
            {bpm && cia && !isAdminOrP && userBpm && !validarVinculoUnidade() && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-800 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" /> Unidade sem vínculo
                </p>
                <p>Você não possui vínculo com a unidade selecionada. Para realizar lançamentos nesta unidade, solicite previamente ao administrador a vinculação correspondente. Até a autorização, seus lançamentos estão restritos à sua unidade atual.</p>
              </div>
            )}
            <Button type="button" className="w-full" onClick={confirmarUnidade} disabled={!bpm || !cia}>
              Confirmar Unidade e Iniciar Lançamentos →
            </Button>
          </>
        )}
      </div>

      {/* ── Alternância entre Novo Lançamento e Consulta Anterior ── */}
      {unidadeConfirmada && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPainelAtivo('lancamento')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${painelAtivo === 'lancamento' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:bg-muted/40'}`}
          >
            <Plus className="w-4 h-4" /> Novo Lançamento
          </button>
          <button
            type="button"
            onClick={() => setPainelAtivo('historico')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${painelAtivo === 'historico' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:bg-muted/40'}`}
          >
            <History className="w-4 h-4" /> Consultar Lançamentos Anteriores
          </button>
        </div>
      )}

      {/* ── Painel Histórico ── */}
      <AnimatePresence mode="wait">
        {unidadeConfirmada && painelAtivo === 'historico' && (
          <motion.div key="historico" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <HistoricoLancamentos
              appUser={appUser}
              orgId={buildOrgId()}
              orgName={buildOrgName()}
              defaultOpen={true}
              hideToggle={true}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── BLOCO 2: Item de Produção ── */}
      <AnimatePresence mode="wait">
        {unidadeConfirmada && painelAtivo === 'lancamento' && (
          <motion.div key="lancamento" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <form onSubmit={handleSubmit} className="bg-card rounded-xl border border-border p-5 space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold flex-shrink-0">2</span>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Item de Produção</h2>
                {sessaoItens.length > 0 && (
                  <Badge variant="secondary" className="ml-auto text-xs">
                    <Zap className="w-3 h-3 mr-1" />{sessaoItens.length} lançado{sessaoItens.length > 1 ? 's' : ''} nesta sessão
                  </Badge>
                )}
              </div>

              {/* Data */}
              <div>
                <Label>Data *</Label>
                <Input type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} className="mt-1.5" />
              </div>

              {/* Indicador */}
              <div>
                <Label>Indicador *</Label>
                <Select
                  value={form.indicator_id}
                  onValueChange={v => {
                    setForm(f => ({
                      ...f,
                      indicator_id: v,
                      quantidade: '',
                      tipoDroga: '',
                      consumoDoisAtrasAgua: '',
                      consumoAnteriorAgua: '',
                      consumoAtualAgua: '',
                      consumoDoisAtrasLuz: '',
                      consumoAnteriorLuz: '',
                      consumoAtualLuz: '',
                    }));
                  }}
                >
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione o indicador" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {Object.entries(groupedIndicators).map(([cat, inds]) => (
                      <React.Fragment key={cat}>
                        <div className="px-2 py-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider bg-muted/40">{cat}</div>
                        {inds.map(ind => (
                          <SelectItem key={ind.id} value={ind.id}>
                            {ind.nome} <span className="text-muted-foreground text-xs">(×{ind.peso})</span>
                          </SelectItem>
                        ))}
                      </React.Fragment>
                    ))}
                  </SelectContent>
                </Select>
                {selectedIndicator && (
                  <div className="mt-2 flex items-center gap-2">
                    <Badge className={catColors[selectedIndicator.categoria] || ''} variant="secondary">{selectedIndicator.categoria}</Badge>
                    <span className="text-xs text-muted-foreground">Peso: {selectedIndicator.peso}</span>
                  </div>
                )}
              </div>

              {/* Campo especial Economia — formulário direto pelo tipo do indicador */}
              {isAgua ? (
                <EconomiaAguaForm
                  form={form}
                  setForm={setForm}
                  mesLabels={{ mesDoisAtrasLabel, mesAnteriorLabel, mesAtualLabel }}
                  validationErrors={validationErrors}
                  loadingHistorico={loadingHistorico}
                />
              ) : isLuz ? (
                <EconomiaLuzForm
                  form={form}
                  setForm={setForm}
                  mesLabels={{ mesDoisAtrasLabel, mesAnteriorLabel, mesAtualLabel }}
                  validationErrors={validationErrors}
                  loadingHistorico={loadingHistorico}
                />
              ) : isDrogas ? (
                <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-orange-800 text-sm font-semibold">
                    <Info className="w-4 h-4" /> Apreensão de Entorpecentes
                  </div>
                  <div>
                    <Label className="text-xs text-orange-700">Tipo de Droga *</Label>
                    <Select value={form.tipoDroga} onValueChange={v => setForm({ ...form, tipoDroga: v })}>
                      <SelectTrigger className={`mt-1.5 bg-white border-orange-300 ${validationErrors.has('tipoDroga') ? 'border-destructive border-2' : ''}`}>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Maconha">Maconha</SelectItem>
                        <SelectItem value="Cocaína">Cocaína</SelectItem>
                        <SelectItem value="Crack">Crack</SelectItem>
                        <SelectItem value="Haxixe">Haxixe</SelectItem>
                        <SelectItem value="Skunk">Skunk</SelectItem>
                        <SelectItem value="Ecstasy">Ecstasy</SelectItem>
                        <SelectItem value="Anfetamina">Anfetamina</SelectItem>
                        <SelectItem value="LSD">LSD</SelectItem>
                        <SelectItem value="Outros">Outros</SelectItem>
                      </SelectContent>
                    </Select>
                    {validationErrors.has('tipoDroga') && <p className="text-xs text-destructive mt-1 font-medium">Este campo é obrigatório</p>}
                  </div>
                  <div>
                    <Label className="text-xs text-orange-700">Quantidade apreendida (gramas) *</Label>
                    <Input
                      type="number" min="0" step="0.01"
                      value={form.quantidade}
                      onChange={e => setForm({ ...form, quantidade: e.target.value })}
                      placeholder="Ex: 250"
                      className={`mt-1.5 text-lg font-semibold bg-white border-orange-300 ${validationErrors.has('quantidade') ? 'border-destructive border-2' : ''}`}
                    />
                    {validationErrors.has('quantidade') && <p className="text-xs text-destructive mt-1 font-medium">Este campo é obrigatório</p>}
                  </div>
                  {form.quantidade && parseFloat(form.quantidade) > 0 && (
                    <div className="rounded-md bg-orange-100 border border-orange-300 px-3 py-2 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-orange-800">
                          Faixa: {parseFloat(form.quantidade) <= 10 ? 'Até 10g' : parseFloat(form.quantidade) <= 100 ? '10g a 100g' : parseFloat(form.quantidade) <= 1000 ? '100g a 1000g' : 'Acima de 1000g'}
                        </span>
                        <span className="text-base font-bold text-orange-900">{pontosDrogas} pts</span>
                      </div>
                      <div className="text-xs text-orange-600 grid grid-cols-4 gap-1 pt-1 border-t border-orange-200">
                        <span className={`rounded px-1 py-0.5 text-center ${parseFloat(form.quantidade) <= 10 ? 'bg-orange-300 font-bold' : 'opacity-60'}`}>≤10g: 3pts</span>
                        <span className={`rounded px-1 py-0.5 text-center ${parseFloat(form.quantidade) > 10 && parseFloat(form.quantidade) <= 100 ? 'bg-orange-300 font-bold' : 'opacity-60'}`}>10-100g: 5pts</span>
                        <span className={`rounded px-1 py-0.5 text-center ${parseFloat(form.quantidade) > 100 && parseFloat(form.quantidade) <= 1000 ? 'bg-orange-300 font-bold' : 'opacity-60'}`}>100-1000g: 8pts</span>
                        <span className={`rounded px-1 py-0.5 text-center ${parseFloat(form.quantidade) > 1000 ? 'bg-orange-300 font-bold' : 'opacity-60'}`}>&gt;1000g: 10pts</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <Label>Quantidade *</Label>
                  <Input
                    type="number" min="0" step="1"
                    value={form.quantidade}
                    onChange={e => setForm({ ...form, quantidade: e.target.value })}
                    placeholder="Ex: 5"
                    className={`mt-1.5 text-lg font-semibold ${validationErrors.has('quantidade') ? 'border-destructive border-2' : ''}`}
                  />
                  {validationErrors.has('quantidade') && <p className="text-xs text-destructive mt-1 font-medium">Este campo é obrigatório</p>}
                </div>
              )}

              {/* Pontuação calculada */}
              {pontuacao !== null && (
                <div className="rounded-lg bg-accent/10 border border-accent/30 px-4 py-3 flex items-center gap-3">
                  <Star className="w-5 h-5 text-accent-foreground flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Pontuação calculada</p>
                    <p className="text-xl font-bold text-accent-foreground">{pontuacao.toLocaleString('pt-BR')} pts</p>
                    {isEconomia && <p className="text-xs text-muted-foreground">Pontuação especial por tendência</p>}
                    {isDrogas && <p className="text-xs text-muted-foreground">Pontuação por faixa de peso</p>}
                    {!isEconomia && !isDrogas && <p className="text-xs text-muted-foreground">{quantidadeEfetiva} × {selectedIndicator.peso}</p>}
                  </div>
                </div>
              )}

              {/* Observação */}
              <div>
                <Label>Observação <span className="text-xs text-muted-foreground font-normal">— opcional</span></Label>
                <Textarea value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })} placeholder="Detalhes adicionais: Ex. BA nº ..., BO-COP nº ..., BO-TC nº, Conta de Luz mês ..., etc..." className="mt-1.5 h-16" />
              </div>

              {/* Anexo */}
              <div>
                <Label>Anexo <span className="text-xs text-muted-foreground font-normal">— PDF ou imagem</span></Label>
                <label className="mt-1.5 flex items-center gap-2 px-4 py-3 border border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                  <Upload className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm text-muted-foreground truncate">{file ? file.name : 'Toque para anexar'}</span>
                  <input type="file" className="hidden" onChange={e => setFile(e.target.files[0])} />
                </label>
              </div>

              {/* Submit */}
              <Button type="submit" className="w-full h-12 text-base font-semibold gap-2" disabled={saving}>
                {saving
                  ? <><Loader2 className="w-5 h-5 animate-spin" /> Salvando...</>
                  : successId
                  ? <><CheckCircle className="w-5 h-5" /> Registrado!</>
                  : <><Plus className="w-5 h-5" /> Lançar Item</>
                }
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Após salvar, os campos serão limpos para o próximo lançamento.
              </p>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Diálogos de ação nos itens da sessão ── */}

      {/* Editar */}
      <Dialog open={!!sessaoEditDialog} onOpenChange={() => setSessaoEditDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Registro</DialogTitle>
            <DialogDescription>{sessaoEditDialog?.indicador}</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <Label>Nova quantidade</Label>
            <Input type="number" value={sessaoEditQtd} onChange={e => setSessaoEditQtd(e.target.value)} min="0" className="mt-1" />
            {sessaoEditDialog && sessaoEditQtd && (
              <p className="text-xs text-muted-foreground">Nova pontuação: {(parseFloat(sessaoEditQtd) * (sessaoEditDialog.peso || 0)).toLocaleString('pt-BR')} pts</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSessaoEditDialog(null)}>Cancelar</Button>
            <Button onClick={handleSessaoEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excluir */}
      <Dialog open={!!sessaoDeleteDialog} onOpenChange={() => setSessaoDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir "{sessaoDeleteDialog?.indicador}"? Essa ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSessaoDeleteDialog(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleSessaoDelete}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Solicitar liberação */}
      <Dialog open={!!sessaoRequestDialog} onOpenChange={() => { setSessaoRequestDialog(null); setSessaoRequestMotivo(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar Liberação de Edição</DialogTitle>
            <DialogDescription>
              O prazo de 24h expirou. Envie uma solicitação ao administrador para liberar a edição/exclusão de: <strong>{sessaoRequestDialog?.indicador}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider">Motivo</Label>
            <Textarea
              value={sessaoRequestMotivo}
              onChange={e => setSessaoRequestMotivo(e.target.value)}
              placeholder="Descreva o motivo..."
              className="h-20"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSessaoRequestDialog(null); setSessaoRequestMotivo(''); }}>Cancelar</Button>
            <Button onClick={handleSessaoRequest}>Enviar Solicitação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── BLOCO 3: Histórico da Sessão ── */}
      <AnimatePresence>
        {sessaoItens.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-3 bg-muted/40 border-b border-border flex items-center justify-between">
                <span className="text-sm font-semibold flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" /> Lançamentos desta sessão
                </span>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="hidden sm:inline flex items-center gap-1"><Pencil className="w-3 h-3 inline" /> editar · <Trash2 className="w-3 h-3 inline" /> excluir · <Lock className="w-3 h-3 inline" /> solicitar</span>
                  <span className="font-semibold text-foreground">Total: {sessaoItens.reduce((s, i) => s + i.pontuacao, 0).toLocaleString('pt-BR')} pts</span>
                </div>
              </div>
              <div className="divide-y divide-border">
                {sessaoItens.map(item => {
                  const within24h = isWithin24h(item);
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.indicador}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <Badge className={`text-xs ${catColors[item.categoria] || ''}`} variant="secondary">{item.categoria}</Badge>
                          {(item.isAgua || item.isLuz) ? (
                            <span className={`text-xs font-semibold flex items-center gap-1 ${item.pontouEconomia ? 'text-green-700' : 'text-red-600'}`}>
                              {item.isAgua ? <Droplets className="w-3 h-3" /> : <Lightbulb className="w-3 h-3" />}
                              {(() => {
                                const sigla = item.isAgua ? 'm³' : 'kWh';
                                const valor = item.consumoAtual != null
                                  ? Number(item.consumoAtual).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
                                  : Math.abs(Number(item.quantidade)).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
                                return item.pontouEconomia ? `${valor} ${sigla} — diminuiu` : `${valor} ${sigla} — aumentou`;
                              })()}
                            </span>
                          ) : item.isDrogas ? (
                            <span className="text-xs text-muted-foreground">
                              {Number(item.quantidade).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} <span className="font-semibold">gr</span>
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Qtd: {item.quantidade} <span className="font-semibold">{item.unidade || 'un.'}</span></span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <p className="text-sm font-bold text-primary mr-1">{item.pontuacao.toLocaleString('pt-BR')} pts</p>
                        {within24h ? (
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar"
                              onClick={() => { setSessaoEditDialog(item); setSessaoEditQtd(String(item.quantidade)); }}>
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Excluir"
                              onClick={() => setSessaoDeleteDialog(item)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </>
                        ) : (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" title="Solicitar liberação"
                            onClick={() => setSessaoRequestDialog(item)}>
                            <Lock className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
