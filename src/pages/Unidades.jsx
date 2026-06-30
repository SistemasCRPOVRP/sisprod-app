import React, { useState, useEffect } from 'react';
import { Building2, ChevronDown, ChevronRight, Upload, FileText, RefreshCw, Lock, Unlock, ShieldAlert, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import AtualizarOrganogramaDialog from '@/components/unidades/AtualizarOrganogramaDialog';
import OrgEditPanel from '@/components/unidades/OrgEditPanel';
import { useOutletContext } from 'react-router-dom';

const INITIAL_ORGANOGRAMA = {
  nome: 'CRPM/VRP — Comando',
  local: 'Santa Cruz do Sul',
  tipo: 'crpm',
  filhos: [
    {
      nome: '2º BPM', local: 'Rio Pardo', tipo: 'btl',
      filhos: [
        { nome: '1ª Cia', local: 'Rio Pardo', tipo: 'cia', filhos: [
          { nome: '1º Pel', local: 'Rio Pardo', tipo: 'pel', filhos: [{ nome: '1º GPM', local: 'Rio Pardo', tipo: 'gpm' }, { nome: '2º GPM', local: 'Rio Pardo', tipo: 'gpm' }]},
          { nome: '2º Pel', local: 'Rio Pardo', tipo: 'pel', filhos: [{ nome: '1º GPM', local: 'Rio Pardo', tipo: 'gpm' }, { nome: '2º GPM', local: 'Rio Pardo', tipo: 'gpm' }]},
          { nome: '3º Pel (FT)', local: 'Rio Pardo', tipo: 'pel', filhos: [{ nome: '1º GPM', local: 'Rio Pardo', tipo: 'gpm' }, { nome: '2º GPM', local: 'Rio Pardo', tipo: 'gpm' }, { nome: '3º GPM', local: 'Rio Pardo', tipo: 'gpm' }]},
          { nome: '4º Pel', local: 'Pantano Grande', tipo: 'pel', filhos: [{ nome: '1º GPM', local: 'Pantano Grande', tipo: 'gpm' }, { nome: '2º GPM', local: 'Pantano Grande', tipo: 'gpm' }, { nome: '3º GPM', local: 'Pantano Grande', tipo: 'gpm' }]},
        ]},
        { nome: '2ª Cia', local: 'Encruzilhada do Sul', tipo: 'cia', filhos: [
          { nome: '1º Pel', local: 'Encruzilhada do Sul', tipo: 'pel', filhos: [{ nome: '1º GPM', local: 'Encruzilhada do Sul', tipo: 'gpm' }, { nome: '2º GPM', local: 'Encruzilhada do Sul', tipo: 'gpm' }]},
          { nome: '2º Pel', local: 'Encruzilhada do Sul', tipo: 'pel', filhos: [{ nome: '1º GPM', local: 'Encruzilhada do Sul', tipo: 'gpm' }, { nome: '2º GPM', local: 'Encruzilhada do Sul', tipo: 'gpm' }]},
        ]},
      ]
    },
    {
      nome: '23º BPM', local: 'Santa Cruz do Sul', tipo: 'btl',
      filhos: [
        { nome: '1ª Cia', local: 'Santa Cruz do Sul', tipo: 'cia', filhos: [
          { nome: '1º Pel', local: 'Santa Cruz do Sul', tipo: 'pel', filhos: [{ nome: '1º GPM', local: 'Santa Cruz do Sul', tipo: 'gpm' }, { nome: '2º GPM', local: 'Santa Cruz do Sul', tipo: 'gpm' }, { nome: '3º GPM', local: 'Santa Cruz do Sul', tipo: 'gpm' }, { nome: '4º GPM', local: 'Santa Cruz do Sul', tipo: 'gpm' }, { nome: '5º GPM', local: 'Santa Cruz do Sul', tipo: 'gpm' }]},
          { nome: '2º Pel', local: 'Santa Cruz do Sul', tipo: 'pel', filhos: [{ nome: '1º GPM', local: 'Santa Cruz do Sul', tipo: 'gpm' }, { nome: '2º GPM', local: 'Santa Cruz do Sul', tipo: 'gpm' }, { nome: '3º GPM', local: 'Santa Cruz do Sul', tipo: 'gpm' }, { nome: '4º GPM', local: 'Santa Cruz do Sul', tipo: 'gpm' }]},
          { nome: '3º Pel', local: 'Santa Cruz do Sul', tipo: 'pel', filhos: [{ nome: '1º GPM', local: 'Santa Cruz do Sul', tipo: 'gpm' }, { nome: '2º GPM', local: 'Santa Cruz do Sul', tipo: 'gpm' }, { nome: '3º GPM', local: 'Santa Cruz do Sul', tipo: 'gpm' }, { nome: '4º GPM', local: 'Santa Cruz do Sul', tipo: 'gpm' }]},
          { nome: '4º Pel (FT)', local: 'Santa Cruz do Sul', tipo: 'pel', filhos: [{ nome: '1º GPM', local: 'Santa Cruz do Sul', tipo: 'gpm' }, { nome: '2º GPM', local: 'Santa Cruz do Sul', tipo: 'gpm' }, { nome: '3º GPM', local: 'Santa Cruz do Sul', tipo: 'gpm' }, { nome: '4º GPM', local: 'Santa Cruz do Sul', tipo: 'gpm' }]},
        ]},
        { nome: '2ª Cia', local: 'Sobradinho', tipo: 'cia', filhos: [
          { nome: '1º Pel', local: 'Sobradinho', tipo: 'pel', filhos: [{ nome: '1º GPM', local: 'Sobradinho', tipo: 'gpm' }, { nome: '2º GPM', local: 'Sobradinho', tipo: 'gpm' }, { nome: '3º GPM', local: 'Sobradinho', tipo: 'gpm' }, { nome: '4º GPM', local: 'Ibarama', tipo: 'gpm' }, { nome: '5º GPM', local: 'Lagoa Bonita do Sul', tipo: 'gpm' }, { nome: '6º GPM', local: 'Passa Sete', tipo: 'gpm' }, { nome: '7º GPM', local: 'Lagoão', tipo: 'gpm' }]},
          { nome: '2º Pel', local: 'Arroio do Tigre', tipo: 'pel', filhos: [{ nome: '1º GPM', local: 'Arroio do Tigre', tipo: 'gpm' }, { nome: '2º GPM', local: 'Arroio do Tigre', tipo: 'gpm' }, { nome: '3º GPM', local: 'Tunas', tipo: 'gpm' }, { nome: '4º GPM', local: 'Estrela Velha', tipo: 'gpm' }, { nome: '5º GPM', local: 'Segredo', tipo: 'gpm' }]},
        ]},
        { nome: '3ª Cia', local: 'Venâncio Aires', tipo: 'cia', filhos: [
          { nome: '1º Pel', local: 'Venâncio Aires', tipo: 'pel', filhos: [{ nome: '1º GPM', local: 'Venâncio Aires', tipo: 'gpm' }, { nome: '2º GPM', local: 'Venâncio Aires', tipo: 'gpm' }, { nome: '3º GPM', local: 'Venâncio Aires', tipo: 'gpm' }, { nome: '4º GPM', local: 'Venâncio Aires', tipo: 'gpm' }, { nome: '5º GPM', local: 'Mato Leitão', tipo: 'gpm' }, { nome: '6º GPM', local: 'Gramado Xavier', tipo: 'gpm' }, { nome: '7º GPM', local: 'Boqueirão do Leão', tipo: 'gpm' }]},
          { nome: '2º Pel', local: 'Venâncio Aires', tipo: 'pel', filhos: [{ nome: '1º GPM', local: 'Venâncio Aires', tipo: 'gpm' }, { nome: '2º GPM', local: 'Venâncio Aires', tipo: 'gpm' }, { nome: '3º GPM', local: 'Venâncio Aires', tipo: 'gpm' }, { nome: '4º GPM', local: 'Venâncio Aires', tipo: 'gpm' }, { nome: '5º GPM', local: 'Vale Verde', tipo: 'gpm' }, { nome: '6º GPM', local: 'Passo do Sobrado', tipo: 'gpm' }]},
          { nome: '5º Pel', local: 'Vera Cruz', tipo: 'pel', filhos: [{ nome: '1º GPM', local: 'Vera Cruz', tipo: 'gpm' }, { nome: '2º GPM', local: 'Vera Cruz', tipo: 'gpm' }, { nome: '3º GPM', local: 'Vera Cruz', tipo: 'gpm' }]},
          { nome: '6º Pel', local: 'Sinimbu', tipo: 'pel', filhos: [{ nome: '1º GPM', local: 'Sinimbu', tipo: 'gpm' }, { nome: '2º GPM', local: 'Sinimbu', tipo: 'gpm' }]},
        ]},
        { nome: '4ª Cia', local: 'Candelária', tipo: 'cia', filhos: [
          { nome: '1º Pel', local: 'Candelária', tipo: 'pel', filhos: [{ nome: '1º GPM', local: 'Candelária', tipo: 'gpm' }, { nome: '2º GPM', local: 'Candelária', tipo: 'gpm' }, { nome: '3º GPM', local: 'Candelária', tipo: 'gpm' }, { nome: '4º GPM', local: 'Candelária', tipo: 'gpm' }]},
          { nome: '2º Pel', local: 'Candelária', tipo: 'pel', filhos: [{ nome: '1º GPM', local: 'Candelária', tipo: 'gpm' }, { nome: '2º GPM', local: 'Candelária', tipo: 'gpm' }, { nome: '3º GPM', local: 'Candelária', tipo: 'gpm' }, { nome: '2º GPM', local: 'Herveiras', tipo: 'gpm' }, { nome: '1º GPM', local: 'Vale do Sol', tipo: 'gpm' }]},
          { nome: '3º Pel', local: 'Vale do Sol', tipo: 'pel', filhos: [{ nome: '1º GPM', local: 'Arroio do Tigre', tipo: 'gpm' }, { nome: '2º GPM', local: 'Arroio do Tigre', tipo: 'gpm' }, { nome: '3º GPM', local: 'Tunas', tipo: 'gpm' }, { nome: '4º GPM', local: 'Estrela Velha', tipo: 'gpm' }, { nome: '5º GPM', local: 'Segredo', tipo: 'gpm' }]},
        ]},
      ]
    }
  ]
};

const tipoCores = {
  crpm: { bg: 'bg-yellow-100 border-yellow-400 text-yellow-900', dot: 'bg-yellow-500' },
  btl:  { bg: 'bg-orange-100 border-orange-400 text-orange-900', dot: 'bg-orange-500' },
  cia:  { bg: 'bg-green-100 border-green-400 text-green-900', dot: 'bg-green-500' },
  pel:  { bg: 'bg-blue-100 border-blue-400 text-blue-900', dot: 'bg-blue-500' },
  gpm:  { bg: 'bg-gray-100 border-gray-300 text-gray-800', dot: 'bg-gray-400' },
};

const TIPO_LABELS = { crpm: 'CRPM/Comando', btl: 'Batalhão', cia: 'Companhia', pel: 'Pelotão', gpm: 'GPM' };

function OrgNode({ node, path }) {
  const [open, setOpen] = useState(path.length < 2);
  const hasChildren = node.filhos && node.filhos.length > 0;
  const cor = tipoCores[node.tipo] || tipoCores.gpm;

  return (
    <div className={`${path.length > 0 ? 'ml-4 sm:ml-6 border-l-2 border-dashed border-border pl-3 sm:pl-4' : ''}`}>
      <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 mb-1 transition-all hover:shadow-sm ${cor.bg}`}>
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cor.dot} ${hasChildren ? 'cursor-pointer' : ''}`}
          onClick={() => hasChildren && setOpen(o => !o)} />
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => hasChildren && setOpen(o => !o)}>
          <span className="font-bold text-sm">{node.nome}</span>
          {node.local && <span className="text-xs ml-2 opacity-70">{node.local}</span>}
        </div>
        {hasChildren && (
          <span className="flex-shrink-0 cursor-pointer" onClick={() => setOpen(o => !o)}>
            {open ? <ChevronDown className="w-4 h-4 opacity-60" /> : <ChevronRight className="w-4 h-4 opacity-60" />}
          </span>
        )}
      </div>
      {hasChildren && open && (
        <div className="mt-0.5">
          {node.filhos.map((filho, i) => (
            <OrgNode key={`${filho.nome}-${i}`} node={filho} path={[...path, i]} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Unidades() {
  const outletCtx = useOutletContext() || {};
  const appUser = outletCtx.appUser;
  const isAdmin = appUser?.perfil === 'administrador' || appUser?.role === 'admin';

  const [view, setView] = useState('organograma');
  const [organograma, setOrganograma] = useState(INITIAL_ORGANOGRAMA);
  const [backup, setBackup] = useState(null);
  const [travado, setTravado] = useState(true);
  const [pdfUrl, setPdfUrl] = useState('');
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [showAtualizarDialog, setShowAtualizarDialog] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [temAlteracoes, setTemAlteracoes] = useState(false);
  const [configId, setConfigId] = useState(null);
  const [pdfConfigId, setPdfConfigId] = useState(null);

  // Carrega organograma e PDF salvos do Firebase ao montar
  useEffect(() => {
    const carregar = async () => {
      try {
        const orgConfigAll = await base44.entities.SystemConfig.filter({ chave: 'organograma' });
        const orgConfig = (orgConfigAll || []).sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
        if (orgConfig?.[0]?.valor) {
          const parsed = typeof orgConfig[0].valor === 'string' ? JSON.parse(orgConfig[0].valor) : orgConfig[0].valor;
          if (parsed?.nome) setOrganograma(parsed);
          setConfigId(orgConfig[0].id);
        }
        const pdfConfigAll = await base44.entities.SystemConfig.filter({ chave: 'organograma_pdf' });
        const pdfConfig = (pdfConfigAll || []).sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
        if (pdfConfig?.[0]?.valor) {
          setPdfUrl(pdfConfig[0].valor);
          setPdfConfigId(pdfConfig[0].id);
        }
      } catch (err) {
        console.error('Erro ao carregar organograma:', err);
      }
    };
    carregar();
  }, []);

  // Salva o organograma no Firebase
  // Salva o organograma garantindo UM ÚNICO registro (remove duplicados).
  const persistirOrganograma = async (orgParaSalvar) => {
    const valor = JSON.stringify(orgParaSalvar);
    // Busca todos os registros 'organograma' e ordena pelo mais recente
    const todos = await base44.entities.SystemConfig.filter({ chave: 'organograma' });
    const ordenados = (todos || []).sort(
      (a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0)
    );
    let idFinal;
    if (ordenados.length > 0) {
      idFinal = ordenados[0].id;
      await base44.entities.SystemConfig.update(idFinal, { valor });
      // Remove duplicados extras, deixando só um registro
      for (let i = 1; i < ordenados.length; i++) {
        try { await base44.entities.SystemConfig.delete(ordenados[i].id); } catch {}
      }
    } else {
      const novo = await base44.entities.SystemConfig.create({ chave: 'organograma', valor });
      idFinal = novo.id;
    }
    setConfigId(idFinal);
    return idFinal;
  };

  const handleSalvarOrganograma = async () => {
    setSalvando(true);
    try {
      await persistirOrganograma(organograma);
      await base44.entities.AuditLog.create({
        usuario: appUser?.email || appUser?.id_funcional || 'sistema',
        acao: 'editou',
        tabela: 'Organograma',
        detalhe: 'Organograma salvo no banco de dados',
      });
      setTemAlteracoes(false);
      toast.success('Organograma salvo com sucesso no banco de dados!');
    } catch (err) {
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setSalvando(false);
    }
  };

  // Salva a URL do PDF no Firebase
  const salvarPdfUrl = async (url) => {
    try {
      if (pdfConfigId) {
        await base44.entities.SystemConfig.update(pdfConfigId, { valor: url });
      } else {
        const novo = await base44.entities.SystemConfig.create({ chave: 'organograma_pdf', valor: url });
        setPdfConfigId(novo.id);
      }
    } catch (err) {
      console.error('Erro ao salvar PDF URL:', err);
    }
  };

  const handleUploadPDF = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingPdf(true);
    try {
      const { uploadFile } = await import('@/api/base44Client');
      const { file_url } = await uploadFile(file);
      setPdfUrl(file_url);
      await salvarPdfUrl(file_url);
      toast.success('PDF atualizado e salvo com sucesso!');
    } catch {
      toast.error('Erro ao enviar o PDF');
    } finally {
      setUploadingPdf(false);
    }
  };

  const handleAtualizarOrganograma = () => {
    if (travado) {
      toast.error('Organograma protegido contra alterações. Desbloqueie primeiro.');
      return;
    }
    setShowAtualizarDialog(true);
  };

 const handleSaveManual = async (novoOrg) => {
  setBackup(organograma);
  setOrganograma(novoOrg);
  setSalvando(true);
  try {
    await persistirOrganograma(novoOrg);
    await base44.entities.AuditLog.create({
      usuario: appUser?.email || appUser?.id_funcional || 'sistema',
      acao: 'editou',
      tabela: 'Organograma',
      detalhe: 'Organograma editado e salvo no banco de dados',
    });
    setTemAlteracoes(false);
    toast.success('Organograma salvo permanentemente no banco de dados!');
  } catch (err) {
    toast.error('Erro ao salvar: ' + err.message);
  } finally {
    setSalvando(false);
  }
};

  const handleRestoreBackup = () => {
    if (!backup) { toast.error('Nenhum backup disponível.'); return; }
    if (!window.confirm('Restaurar o backup anterior do organograma?')) return;
    setOrganograma(backup);
    setBackup(null);
    setTemAlteracoes(true);
    toast.success('Backup restaurado! Clique em "Salvar" para gravar.');
  };

  const handleConfirmarNovoOrganograma = (novoOrg) => {
    setBackup(organograma);
    setOrganograma(novoOrg);
    setTemAlteracoes(true);
    toast.success('Organograma atualizado! Clique em "Salvar Organograma" para gravar no banco.');
    setShowAtualizarDialog(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" /> Unidades Organizacionais
          </h1>
          <p className="text-sm text-muted-foreground mt-1">CRPM/VRP — Estrutura Organizacional</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <button onClick={() => setView('organograma')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${view === 'organograma' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:bg-muted'}`}>
            Organograma
          </button>
          <button onClick={() => setView('pdf')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${view === 'pdf' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:bg-muted'}`}>
            Ver PDF
          </button>

          {isAdmin && (
            <Button variant={travado ? 'outline' : 'destructive'} size="sm"
              className={`gap-2 ${travado ? 'border-amber-400 text-amber-700 hover:bg-amber-50' : 'border-red-400'}`}
              onClick={() => {
                if (travado) {
                  setTravado(false);
                  toast.success('Modo de edição ativado.');
                } else {
                  setTravado(true);
                  toast.success('Organograma travado.');
                }
              }}>
              {travado ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              {travado ? 'Destravar para Editar' : 'Travar Organograma'}
            </Button>
          )}

          <Button onClick={handleAtualizarOrganograma} variant="outline"
            className={`gap-2 ${travado ? 'opacity-50 cursor-not-allowed border-border text-muted-foreground' : 'border-primary/40 text-primary hover:bg-primary/5'}`}>
            <RefreshCw className="w-4 h-4" />
            Atualizar via PDF
          </Button>

          {/* BOTÃO SALVAR — aparece para admin */}
          {isAdmin && (
            <Button onClick={handleSalvarOrganograma} disabled={salvando}
              className={`gap-2 ${temAlteracoes ? 'bg-green-700 hover:bg-green-800 animate-pulse' : 'bg-green-700 hover:bg-green-800'}`}>
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {salvando ? 'Salvando...' : 'Salvar Organograma'}
            </Button>
          )}
        </div>
      </div>

      {/* Aviso de alterações não salvas */}
      {temAlteracoes && (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-300 rounded-lg text-xs text-green-800">
          <Save className="w-4 h-4 flex-shrink-0" />
          <span className="font-semibold">Há alterações não salvas.</span>
          <span>Clique em "Salvar Organograma" para gravar permanentemente no banco de dados.</span>
        </div>
      )}

      {/* Legenda */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(TIPO_LABELS).map(([tipo, label]) => (
          <div key={tipo} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${tipoCores[tipo].bg}`}>
            <span className={`w-2 h-2 rounded-full ${tipoCores[tipo].dot}`} />
            {label}
          </div>
        ))}
      </div>

      {/* Aviso de estado */}
      {travado ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          <Lock className="w-4 h-4 flex-shrink-0" />
          <span className="font-semibold">Organograma protegido contra alterações.</span>
          <span>{isAdmin ? 'Clique em "Destravar para Editar" para habilitar edições.' : 'Somente administradores podem alterar o organograma.'}</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          <span className="font-semibold">⚠ Modo de edição ativo.</span>
          <span>O organograma pode ser alterado. Salve e trave novamente após concluir.</span>
        </div>
      )}

      {view === 'pdf' ? (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 bg-muted/40 border-b border-border flex items-center justify-between flex-wrap gap-2">
            <span className="text-sm font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" /> Organograma CRPM/VRP
            </span>
            <label className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dashed border-primary/50 cursor-pointer text-xs font-semibold text-primary hover:bg-primary/5 transition-colors ${(uploadingPdf || travado) ? 'opacity-60 pointer-events-none' : ''}`}>
              <Upload className="w-4 h-4" />
              {uploadingPdf ? 'Enviando...' : 'Substituir PDF'}
              <input type="file" accept="application/pdf" className="hidden" onChange={handleUploadPDF} disabled={uploadingPdf || travado} />
            </label>
          </div>
          <div className="p-4">
            {pdfUrl ? (
              <iframe src={pdfUrl} className="w-full rounded-lg border border-border" style={{ height: '70vh' }} title="Organograma CRPM/VRP" />
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-3">
                <FileText className="w-10 h-10 opacity-30" />
                <p className="text-sm">Nenhum PDF carregado. Clique em "Substituir PDF" para enviar.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border p-4">
          {isAdmin && !travado ? (
            <OrgEditPanel
              organograma={organograma}
              onChange={(updater) => {
                const next = typeof updater === 'function' ? updater(organograma) : updater;
                setOrganograma(next);
                setTemAlteracoes(true);
              }}
              onSave={(org) => handleSaveManual(org)}
            />
          ) : (
            <OrgNode node={organograma} path={[]} />
          )}
        </div>
      )}

      <AtualizarOrganogramaDialog
        open={showAtualizarDialog}
        onClose={() => setShowAtualizarDialog(false)}
        pdfUrl={pdfUrl}
        organogramaAtual={organograma}
        onConfirmar={handleConfirmarNovoOrganograma}
      />
    </div>
  );
}
