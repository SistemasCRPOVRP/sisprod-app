import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Download, Upload, Database, CheckCircle2, AlertTriangle, Loader2, FileSpreadsheet, RefreshCw, Info, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';

const DB_CONFIG = [
  { key: 'Production',       label: 'Produção',                  color: 'bg-green-100 text-green-800',   icon: '📊' },
  { key: 'AppUser',          label: 'Usuários do Sistema',        color: 'bg-blue-100 text-blue-800',     icon: '👤' },
  { key: 'AccessRequest',    label: 'Solicitações de Acesso',     color: 'bg-yellow-100 text-yellow-800', icon: '📋' },
  { key: 'EditRequest',      label: 'Solicitações de Edição',     color: 'bg-orange-100 text-orange-800', icon: '✏️' },
  { key: 'Indicator',        label: 'Indicadores',                color: 'bg-purple-100 text-purple-800', icon: '🎯' },
  { key: 'Organization',     label: 'Unidades/Organizações',      color: 'bg-cyan-100 text-cyan-800',     icon: '🏢' },
  { key: 'RankingComposicao',label: 'Grupos Concorrentes',        color: 'bg-pink-100 text-pink-800',     icon: '🏆' },
  { key: 'RankingConfig',    label: 'Config. Ranking',            color: 'bg-indigo-100 text-indigo-800', icon: '⚙️' },
  { key: 'SystemConfig',     label: 'Configurações do Sistema',   color: 'bg-gray-100 text-gray-800',     icon: '🔧' },
  { key: 'AuditLog',         label: 'Logs de Auditoria',          color: 'bg-red-100 text-red-800',       icon: '📝' },
];

function serializeCell(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') return JSON.stringify(val);
  return val;
}

// Ordem fixa de colunas apenas para a EXPORTAÇÃO em Excel (Backup). Não afeta
// o banco de dados, os modelos, consultas ou qualquer outra parte do sistema
// — é só a ordem em que as colunas já existentes aparecem no arquivo gerado.
// Campos que não constam nesta lista (ex.: legados ou futuros) continuam
// aparecendo normalmente, apenas deslocados para o final da planilha.
const ORDEM_COLUNAS_EXPORTACAO = {
  Production: [
    'id', 'data', 'periodo', 'bpm', 'organization_name', 'companhia', 'pelotao',
    'gpm', 'municipio', 'organization_id', 'lancado_por_nome', 'lancado_por',
    'categoria', 'indicator_name', 'quantidade', 'peso', 'pontuacao', 'anexo_url',
    'observacao', 'created_date', 'updated_date', 'indicator_id', 'created_by_id',
    'created_by', 'is_sample',
  ],
  AccessRequest: [
    'id', 'nome_completo', 'id_funcional', 'telefone', 'email', 'unidade_lotacao',
    'funcao', 'observacao_admin', 'status', 'tipo', 'created_date', 'updated_date',
    'created_by_id', 'created_by', 'is_sample',
  ],
  AppUser: [
    'id', 'nome_completo', 'id_funcional', 'telefone', 'email', 'funcao',
    'senha_hash', 'perfil', 'organization_id', 'bpm', 'companhia', 'pelotao',
    'gpm', 'municipio', 'organization_name', 'abas_permitidas', 'status',
    'created_date', 'updated_date', 'created_by_id', 'created_by', 'is_sample',
  ],
};

// Reordena os cabeçalhos de exportação conforme ORDEM_COLUNAS_EXPORTACAO,
// preservando qualquer coluna extra (não listada) ao final, na ordem em que
// já apareceria. Para bancos sem ordem definida, retorna os headers originais.
function ordenarColunasExportacao(dbKey, headersOriginais) {
  const ordemFixa = ORDEM_COLUNAS_EXPORTACAO[dbKey];
  if (!ordemFixa) return headersOriginais;
  const naOrdem = ordemFixa.filter(h => headersOriginais.includes(h));
  const extras = headersOriginais.filter(h => !ordemFixa.includes(h));
  return [...naOrdem, ...extras];
}

function recordsEqual(a, b) {
  const ignore = new Set(['id', 'created_date', 'updated_date', 'created_by_id']);
  const keysA = Object.keys(a).filter(k => !ignore.has(k));
  const keysB = Object.keys(b).filter(k => !ignore.has(k));
  const allKeys = new Set([...keysA, ...keysB]);
  for (const k of allKeys) {
    const va = typeof a[k] === 'object' ? JSON.stringify(a[k]) : String(a[k] ?? '');
    const vb = typeof b[k] === 'object' ? JSON.stringify(b[k]) : String(b[k] ?? '');
    if (va !== vb) return false;
  }
  return true;
}

export default function BackupRestore() {
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState([]);
  const [importProgress, setImportProgress] = useState([]);
  const [importing, setImporting] = useState(false);
  const [corrigindo, setCorrigindo] = useState(false);
  const [duplicates, setDuplicates] = useState([]);
  const [dupDialogOpen, setDupDialogOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState(null);
  const [dbCounts, setDbCounts] = useState({});
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [dupActions, setDupActions] = useState({});
  const [limpando, setLimpando] = useState(false);
  const [limparDialogOpen, setLimparDialogOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [limparProgresso, setLimparProgresso] = useState(0);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const loadCounts = async () => {
      setLoadingCounts(true);
      const counts = {};
      await Promise.all(DB_CONFIG.map(async (db) => {
        try {
          counts[db.key] = '?';
        } catch {
          counts[db.key] = '?';
        }
      }));
      setDbCounts(counts);
      setLoadingCounts(false);
    };
    loadCounts();
  }, []);

  const handleExport = async () => {
    setExporting(true);
    setExportProgress([]);
    const wb = XLSX.utils.book_new();

    for (const db of DB_CONFIG) {
      setExportProgress(prev => [...prev, { key: db.key, label: db.label, status: 'loading' }]);
      try {
        const records = await base44.entities[db.key].listAll('-created_date');
        if (!records || records.length === 0) {
          setExportProgress(prev => prev.map(p => p.key === db.key ? { ...p, status: 'empty', count: 0 } : p));
          const ws = XLSX.utils.aoa_to_sheet([['(sem registros)']]);
          XLSX.utils.book_append_sheet(wb, ws, db.key.substring(0, 31));
          continue;
        }
        const headers = ordenarColunasExportacao(db.key, Object.keys(records[0]));
        const rows = records.map(r => headers.map(h => serializeCell(r[h])));
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        XLSX.utils.book_append_sheet(wb, ws, db.key.substring(0, 31));
        setExportProgress(prev => prev.map(p => p.key === db.key ? { ...p, status: 'done', count: records.length } : p));
      } catch (err) {
        setExportProgress(prev => prev.map(p => p.key === db.key ? { ...p, status: 'error', error: err.message } : p));
      }
    }

    const metaWs = XLSX.utils.aoa_to_sheet([
      ['SISPROD BM — Backup Completo'],
      ['Gerado em:', format(new Date(), 'dd/MM/yyyy HH:mm')],
      ['Bancos de dados:', DB_CONFIG.map(d => d.label).join(', ')],
      [],
      ['IMPORTANTE: Não altere os nomes das abas. Use este arquivo para restaurar os dados.'],
    ]);
    XLSX.utils.book_append_sheet(wb, metaWs, '_Metadados');

    const filename = `SISPROD_Backup_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
    XLSX.writeFile(wb, filename);
    setExporting(false);
    toast.success(`Backup exportado: ${filename}`);
  };

  const handleCorrigirIndicadores = async () => {
    setCorrigindo(true);
    toast.info('Iniciando correção de vínculos...');
    try {
      const [prods, inds] = await Promise.all([
        base44.entities.Production.list(),
        base44.entities.Indicator.list(),
      ]);
      const indMap = {};
      inds.forEach(i => { indMap[i.nome?.toLowerCase().trim()] = i; });
      let corrigidos = 0;
      for (const p of prods) {
        const indAtual = inds.find(i => i.id === p.indicator_id);
        if (!indAtual && p.indicator_name) {
          const match = indMap[p.indicator_name?.toLowerCase().trim()];
          if (match) {
            await base44.entities.Production.update(p.id, {
              indicator_id: match.id,
              categoria: match.categoria,
              peso: match.peso,
            });
            corrigidos++;
          }
        }
      }
      toast.success(`Correção concluída! ${corrigidos} registros atualizados.`);
    } catch (err) {
      toast.error('Erro na correção: ' + err.message);
    } finally {
      setCorrigindo(false);
    }
  };

  // Apaga TODOS os registros das coleções Production e AuditLog. Operação
  // destrutiva e irreversível — exige digitar "LIMPAR" para confirmar. Use
  // antes de reimportar uma planilha completa do Base44 na virada do sistema,
  // ou periodicamente para esvaziar o banco — esses dados ficam preservados
  // nas planilhas trimestrais (backup) antes de serem apagados.
  const handleLimparProducao = async () => {
    setLimpando(true);
    setLimparProgresso(0);
    try {
      const [producaoRegs, auditoriaRegs] = await Promise.all([
        base44.entities.Production.listAll('-created_date'),
        base44.entities.AuditLog.listAll('-created_date'),
      ]);
      const registros = [
        ...producaoRegs.map(r => ({ entidade: 'Production', id: r.id })),
        ...auditoriaRegs.map(r => ({ entidade: 'AuditLog', id: r.id })),
      ];
      const total = registros.length;
      if (total === 0) {
        toast.info('Não há registros de Produção ou Auditoria para apagar.');
        setLimpando(false);
        setLimparDialogOpen(false);
        return;
      }
      let apagados = 0;
      for (const r of registros) {
        try {
          await base44.entities[r.entidade].delete(r.id);
          apagados++;
          if (apagados % 50 === 0 || apagados === total) {
            setLimparProgresso(Math.round((apagados / total) * 100));
          }
        } catch (e) {
          // continua mesmo se um registro falhar
        }
      }
      toast.success(`Produção e Auditoria limpos! ${apagados} de ${total} registros apagados.`);
      setLimparDialogOpen(false);
      setConfirmText('');
    } catch (err) {
      toast.error('Erro ao limpar: ' + err.message);
    } finally {
      setLimpando(false);
      setLimparProgresso(0);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    setImportProgress([]);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const sheetNames = wb.SheetNames.filter(s => !s.startsWith('_'));

      const allData = {};
      for (const sheetName of sheetNames) {
        const dbConfig = DB_CONFIG.find(d => d.key === sheetName || d.key.toLowerCase() === sheetName.toLowerCase());
        if (!dbConfig) continue;
        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (rows.length > 0 && rows[0]['(sem registros)'] !== undefined) continue;
        allData[dbConfig.key] = rows;
      }

      if (Object.keys(allData).length === 0) {
        toast.error('Nenhuma aba reconhecida no arquivo.');
        setImporting(false);
        return;
      }

      const dupList = [];
      const existingByDb = {};

      await Promise.all(Object.keys(allData).map(async (dbKey) => {
        try {
          const existing = await base44.entities[dbKey].list('-created_date');
          existingByDb[dbKey] = existing || [];
          const incoming = allData[dbKey];
          for (const rec of incoming) {
            const dup = existing.find(ex => recordsEqual(ex, rec));
            if (dup) dupList.push({ dbKey, existing: dup, incoming: rec });
          }
        } catch {}
      }));

      if (dupList.length > 0) {
        setDuplicates(dupList);
        setPendingImport({ allData, existingByDb });
        setDupDialogOpen(true);
        setImporting(false);
        return;
      }

      await executeImport(allData, existingByDb, []);
    } catch (err) {
      toast.error('Erro ao ler arquivo: ' + err.message);
      setImporting(false);
    }
  };

  const executeImport = async (allData, existingByDb, dupChoices) => {
    setImporting(true);
    setImportProgress([]);

    await Promise.all(Object.keys(allData).map(async (dbKey) => {
      const dbConfig = DB_CONFIG.find(d => d.key === dbKey);
      const label = dbConfig?.label || dbKey;
      setImportProgress(prev => [...prev, { key: dbKey, label, status: 'loading' }]);
      try {
        const incoming = allData[dbKey];
        const existing = existingByDb[dbKey] || [];
        let inserted = 0, skipped = 0, replaced = 0;

        for (const rec of incoming) {
          const { id, created_date, updated_date, created_by_id, ...payload } = rec;
          for (const k of Object.keys(payload)) {
            const v = payload[k];
            if (typeof v === 'string' && (v.startsWith('{') || v.startsWith('['))) {
              try { payload[k] = JSON.parse(v); } catch {}
            }
            if (v === '') payload[k] = null;
          }

          // Corrige periodo ausente em Production
          if (dbKey === 'Production' && !payload.periodo && payload.data) {
            const d = new Date(payload.data);
            const trimestre = Math.ceil((d.getMonth() + 1) / 3);
            payload.periodo = `${d.getFullYear()}-T${trimestre}`;
          }

          const dup = existing.find(ex => recordsEqual(ex, rec));
          if (dup) {
            const choice = dupChoices.find(c => c.dbKey === dbKey && c.existingId === dup.id);
            if (!choice || choice.action === 'manter') { skipped++; continue; }
            await base44.entities[dbKey].update(dup.id, payload);
            replaced++;
            continue;
          }

          await base44.entities[dbKey].create(payload);
          inserted++;
        }

        setImportProgress(prev => prev.map(p => p.key === dbKey
          ? { ...p, status: 'done', inserted, skipped, replaced } : p));
      } catch (err) {
        setImportProgress(prev => prev.map(p => p.key === dbKey
          ? { ...p, status: 'error', error: err.message } : p));
      }
    }));

    setImporting(false);
    toast.success('Importação concluída!');
  };

  const handleConfirmImport = () => {
    if (!pendingImport) return;
    const choices = duplicates.map(d => ({
      dbKey: d.dbKey,
      existingId: d.existing.id,
      action: dupActions[`${d.dbKey}__${d.existing.id}`] || 'manter',
    }));
    setDupDialogOpen(false);
    setDuplicates([]);
    executeImport(pendingImport.allData, pendingImport.existingByDb, choices);
    setPendingImport(null);
    setDupActions({});
  };

  const totalInserted = importProgress.reduce((s, p) => s + (p.inserted || 0), 0);
  const totalSkipped  = importProgress.reduce((s, p) => s + (p.skipped  || 0), 0);
  const totalReplaced = importProgress.reduce((s, p) => s + (p.replaced || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex gap-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900">
          <p className="font-semibold">Backup & Restauração dos Bancos de Dados</p>
          <p className="text-xs mt-1 text-blue-700">
            Exporte todos os dados do sistema em formato Excel (.xlsx). O arquivo contém uma aba para cada banco de dados.
            Para restaurar, importe o mesmo arquivo — registros novos são adicionados; registros idênticos podem ser mantidos ou substituídos a sua escolha.
          </p>
        </div>
      </div>

      {/* Grid de contagem */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {DB_CONFIG.map(db => (
          <div key={db.key} className="rounded-lg border border-border bg-card p-3 text-center space-y-1">
            <div className="text-2xl">{db.icon}</div>
            <p className="text-xs font-semibold leading-tight">{db.label}</p>
            <Badge variant="secondary" className={`text-[10px] ${db.color}`}>{db.key}</Badge>
            <p className="text-[10px] font-medium text-muted-foreground" title="A contagem real é feita ao exportar o backup">
  contar ao exportar
</p>
          </div>
        ))}
      </div>

      {/* Exportar e Importar */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* EXPORTAR */}
        <div className="flex-1 rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
              <Download className="w-5 h-5 text-green-700" />
            </div>
            <div>
              <p className="font-semibold text-sm">Exportar Backup</p>
              <p className="text-xs text-muted-foreground">Gera planilha Excel com todos os dados</p>
            </div>
          </div>
          <Button onClick={handleExport} disabled={exporting} className="w-full gap-2 bg-green-700 hover:bg-green-800">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            {exporting ? 'Gerando backup...' : 'Exportar Excel (.xlsx)'}
          </Button>
          {exportProgress.length > 0 && (
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {exportProgress.map(p => (
                <div key={p.key} className="flex items-center gap-2 text-xs">
                  {p.status === 'loading' && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground flex-shrink-0" />}
                  {p.status === 'done'    && <CheckCircle2 className="w-3 h-3 text-green-600 flex-shrink-0" />}
                  {p.status === 'empty'   && <Database className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                  {p.status === 'error'   && <AlertTriangle className="w-3 h-3 text-destructive flex-shrink-0" />}
                  <span className="flex-1">{p.label}</span>
                  {p.status === 'done'  && <span className="text-green-700 font-semibold">{p.count} reg.</span>}
                  {p.status === 'empty' && <span className="text-muted-foreground">vazio</span>}
                  {p.status === 'error' && <span className="text-destructive truncate max-w-[100px]">{p.error}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* IMPORTAR */}
        <div className="flex-1 rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Upload className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">Importar / Restaurar</p>
              <p className="text-xs text-muted-foreground">Carrega arquivo Excel de backup</p>
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
          <Button onClick={() => fileInputRef.current?.click()} disabled={importing} variant="outline" className="w-full gap-2 border-primary text-primary hover:bg-primary/10">
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {importing ? 'Importando...' : 'Selecionar Arquivo Excel'}
          </Button>
          {importProgress.length > 0 && !importing && (
            <div className="rounded-lg bg-muted/40 p-3 space-y-2">
              <div className="flex gap-4 text-xs font-semibold">
                <span className="text-green-700">+{totalInserted} inseridos</span>
                <span className="text-blue-600">↺ {totalReplaced} substituídos</span>
                <span className="text-muted-foreground">— {totalSkipped} ignorados</span>
              </div>
              <div className="space-y-1 max-h-56 overflow-y-auto">
                {importProgress.map(p => (
                  <div key={p.key} className="flex items-center gap-2 text-xs">
                    {p.status === 'loading' && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground flex-shrink-0" />}
                    {p.status === 'done'    && <CheckCircle2 className="w-3 h-3 text-green-600 flex-shrink-0" />}
                    {p.status === 'error'   && <AlertTriangle className="w-3 h-3 text-destructive flex-shrink-0" />}
                    <span className="flex-1">{p.label}</span>
                    {p.status === 'done' && <span className="text-xs text-muted-foreground">+{p.inserted || 0}ins / {p.skipped || 0}skip / {p.replaced || 0}sub</span>}
                    {p.status === 'error' && <span className="text-destructive text-[10px] truncate max-w-[120px]">{p.error}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {importing && importProgress.length > 0 && (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {importProgress.map(p => (
                <div key={p.key} className="flex items-center gap-2 text-xs">
                  {p.status === 'loading' && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground flex-shrink-0" />}
                  {p.status === 'done'    && <CheckCircle2 className="w-3 h-3 text-green-600 flex-shrink-0" />}
                  {p.status === 'error'   && <AlertTriangle className="w-3 h-3 text-destructive flex-shrink-0" />}
                  <span className="flex-1">{p.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CORRIGIR VÍNCULOS DE INDICADORES */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
            <RefreshCw className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <p className="font-semibold text-sm">Corrigir Vínculos de Indicadores</p>
            <p className="text-xs text-muted-foreground">
              Use após importar um backup — atualiza o indicator_id nos registros de produção para corresponder aos indicadores atuais do sistema. Necessário para que o Ranking e Dashboard mostrem os dados corretamente.
            </p>
          </div>
        </div>
        <Button
          onClick={handleCorrigirIndicadores}
          disabled={corrigindo}
          variant="outline"
          className="w-full gap-2 border-amber-400 text-amber-700 hover:bg-amber-100"
        >
          {corrigindo ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {corrigindo ? 'Corrigindo...' : 'Corrigir Vínculos de Indicadores'}
        </Button>
      </div>

      {/* LIMPAR BANCO DE PRODUÇÃO E AUDITORIA */}
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-red-700" />
          </div>
          <div>
            <p className="font-semibold text-sm text-red-800">Limpar Produção e Auditoria</p>
            <p className="text-xs text-red-600">
              Apaga TODOS os registros de Produção e de Auditoria (AuditLog). Os logs de auditoria acumulam
              rápido e em grande volume — use para esvaziar o banco periodicamente, já que esses dados ficam
              preservados nas planilhas trimestrais salvas no backup. Ação irreversível — exporte um backup antes.
            </p>
          </div>
        </div>
        <Button
          onClick={() => { setConfirmText(''); setLimparDialogOpen(true); }}
          variant="outline"
          className="w-full gap-2 border-red-400 text-red-700 hover:bg-red-100"
        >
          <Trash2 className="w-4 h-4" />
          Limpar Produção e Auditoria
        </Button>
      </div>

      {/* Dialog de confirmação de limpeza */}
      <Dialog open={limparDialogOpen} onOpenChange={(o) => { if (!limpando) { setLimparDialogOpen(o); if (!o) setConfirmText(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5" />
              Apagar TODOS os registros de Produção e Auditoria?
            </DialogTitle>
            <DialogDescription>
              Esta ação é <strong>irreversível</strong>. Todos os lançamentos de produção e todos os logs de
              auditoria serão apagados permanentemente do banco de dados. Certifique-se de ter exportado um
              backup antes de continuar.
              <br /><br />
              Para confirmar, digite <strong>LIMPAR</strong> no campo abaixo:
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Digite LIMPAR"
              disabled={limpando}
              className="w-full px-3 py-2 text-sm border border-red-300 rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            {limpando && (
              <div className="mt-3">
                <div className="flex items-center gap-2 text-xs text-red-700 mb-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Apagando registros... {limparProgresso}%
                </div>
                <div className="w-full h-2 bg-red-100 rounded-full overflow-hidden">
                  <div className="h-full bg-red-500 transition-all" style={{ width: `${limparProgresso}%` }} />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setLimparDialogOpen(false); setConfirmText(''); }} disabled={limpando}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleLimparProducao}
              disabled={limpando || confirmText !== 'LIMPAR'}
              className="gap-2"
            >
              {limpando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {limpando ? 'Apagando...' : 'Apagar Tudo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de duplicatas */}
      <Dialog open={dupDialogOpen} onOpenChange={setDupDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              {duplicates.length} Registro(s) Idêntico(s) Encontrado(s)
            </DialogTitle>
            <DialogDescription>
              Os registros abaixo já existem no sistema. Escolha manter o existente ou substituir pelo importado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex gap-2 mb-3 flex-wrap">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
                const map = {};
                duplicates.forEach(d => { map[`${d.dbKey}__${d.existing.id}`] = 'manter'; });
                setDupActions(map);
              }}>Manter todos</Button>
              <Button size="sm" variant="outline" className="h-7 text-xs text-destructive border-destructive/30" onClick={() => {
                const map = {};
                duplicates.forEach(d => { map[`${d.dbKey}__${d.existing.id}`] = 'substituir'; });
                setDupActions(map);
              }}>Substituir todos</Button>
            </div>
            {duplicates.map((d, i) => {
              const dbConfig = DB_CONFIG.find(c => c.key === d.dbKey);
              const key = `${d.dbKey}__${d.existing.id}`;
              const action = dupActions[key] || 'manter';
              const preview = Object.entries(d.existing)
                .filter(([k]) => !['id','created_date','updated_date','created_by_id'].includes(k))
                .slice(0, 4)
                .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v).slice(0, 30) : String(v).slice(0, 40)}`)
                .join(' | ');
              return (
                <div key={i} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-lg">{dbConfig?.icon}</span>
                    <Badge variant="secondary" className={`text-xs ${dbConfig?.color}`}>{dbConfig?.label}</Badge>
                    <span className="text-xs text-muted-foreground font-mono truncate flex-1">{preview}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setDupActions(prev => ({ ...prev, [key]: 'manter' }))}
                      className={`flex-1 text-xs py-1.5 px-3 rounded-md border transition-colors ${action === 'manter' ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border text-muted-foreground hover:border-primary/40'}`}>
                      ✓ Manter existente
                    </button>
                    <button onClick={() => setDupActions(prev => ({ ...prev, [key]: 'substituir' }))}
                      className={`flex-1 text-xs py-1.5 px-3 rounded-md border transition-colors ${action === 'substituir' ? 'border-destructive bg-destructive/10 text-destructive font-semibold' : 'border-border text-muted-foreground hover:border-destructive/40'}`}>
                      ↺ Substituir pelo importado
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDupDialogOpen(false); setPendingImport(null); setDupActions({}); }}>
              Cancelar Importação
            </Button>
            <Button onClick={handleConfirmImport} className="gap-2">
              <RefreshCw className="w-4 h-4" /> Confirmar e Importar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
