import React, { useState, useRef, useEffect } from 'react';

import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Download, Upload, Database, CheckCircle2, AlertTriangle, Loader2, FileSpreadsheet, RefreshCw, Info } from 'lucide-react';
import * as XLSX from 'xlsx';

// Todos os bancos de dados disponíveis no sistema
const DB_CONFIG = [
  { key: 'Production',     label: 'Produção',            color: 'bg-green-100 text-green-800',   icon: '📊' },
  { key: 'AppUser',        label: 'Usuários do Sistema',  color: 'bg-blue-100 text-blue-800',    icon: '👤' },
  { key: 'AccessRequest',  label: 'Solicitações de Acesso', color: 'bg-yellow-100 text-yellow-800', icon: '📋' },
  { key: 'EditRequest',    label: 'Solicitações de Edição', color: 'bg-orange-100 text-orange-800', icon: '✏️' },
  { key: 'Indicator',      label: 'Indicadores',          color: 'bg-purple-100 text-purple-800', icon: '🎯' },
  { key: 'Organization',   label: 'Unidades/Organizações', color: 'bg-cyan-100 text-cyan-800',   icon: '🏢' },
  { key: 'RankingComposicao', label: 'Grupos Concorrentes', color: 'bg-pink-100 text-pink-800',  icon: '🏆' },
  { key: 'RankingConfig',  label: 'Config. Ranking',      color: 'bg-indigo-100 text-indigo-800', icon: '⚙️' },
  { key: 'SystemConfig',   label: 'Configurações do Sistema', color: 'bg-gray-100 text-gray-800', icon: '🔧' },
  { key: 'AuditLog',       label: 'Logs de Auditoria',    color: 'bg-red-100 text-red-800',      icon: '📝' },
];

// Serializa valor para Excel (arrays e objetos viram JSON string)
function serializeCell(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') return JSON.stringify(val);
  return val;
}

// Compara dois registros ignorando id, created_date, updated_date
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
  const [duplicates, setDuplicates] = useState([]);
  const [dupDialogOpen, setDupDialogOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState(null);
  const [dbCounts, setDbCounts] = useState({});
  const [loadingCounts, setLoadingCounts] = useState(true);
  const fileInputRef = useRef(null);

  // Carrega contagem de registros de cada banco ao montar
  useEffect(() => {
    const loadCounts = async () => {
      setLoadingCounts(true);
      const counts = {};
      await Promise.all(DB_CONFIG.map(async (db) => {
        try {
          const records = await base44.entities[db.key].list('-created_date', 99999);
          counts[db.key] = records?.length || 0;
        } catch {
          counts[db.key] = '?';
        }
      }));
      setDbCounts(counts);
      setLoadingCounts(false);
    };
    loadCounts();
  }, []);

  // ─── EXPORTAÇÃO ───────────────────────────────────────────────
  const handleExport = async () => {
    setExporting(true);
    setExportProgress([]);
    const wb = XLSX.utils.book_new();

    for (const db of DB_CONFIG) {
      setExportProgress(prev => [...prev, { key: db.key, label: db.label, status: 'loading' }]);
      try {
        const records = await base44.entities[db.key].list('-created_date', 99999);

        if (!records || records.length === 0) {
          setExportProgress(prev => prev.map(p => p.key === db.key ? { ...p, status: 'empty', count: 0 } : p));
          // Mesmo sem dados, cria a aba para manter estrutura
          const ws = XLSX.utils.aoa_to_sheet([['(sem registros)']]);
          XLSX.utils.book_append_sheet(wb, ws, db.key.substring(0, 31));
          continue;
        }

        const headers = Object.keys(records[0]);
        const rows = records.map(r => headers.map(h => serializeCell(r[h])));
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

        // Estiliza cabeçalho
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cellRef = XLSX.utils.encode_cell({ r: 0, c });
          if (ws[cellRef]) {
            ws[cellRef].s = { font: { bold: true }, fill: { fgColor: { rgb: '1e5631' } } };
          }
        }

        XLSX.utils.book_append_sheet(wb, ws, db.key.substring(0, 31));
        setExportProgress(prev => prev.map(p => p.key === db.key ? { ...p, status: 'done', count: records.length } : p));
      } catch (err) {
        setExportProgress(prev => prev.map(p => p.key === db.key ? { ...p, status: 'error', error: err.message } : p));
      }
    }

    // Adiciona aba de metadados
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

  // ─── IMPORTAÇÃO ───────────────────────────────────────────────
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

      // Monta dados de todas as abas reconhecidas
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
        toast.error('Nenhuma aba reconhecida no arquivo. Verifique se é um backup válido do SISPROD.');
        setImporting(false);
        return;
      }

      // Verifica duplicatas em todos os bancos simultaneamente
      const dupList = [];
      const existingByDb = {};

      await Promise.all(Object.keys(allData).map(async (dbKey) => {
        try {
          const existing = await base44.entities[dbKey].list('-created_date', 99999);
          existingByDb[dbKey] = existing || [];

          const incoming = allData[dbKey];
          for (const rec of incoming) {
            const dup = existing.find(ex => recordsEqual(ex, rec));
            if (dup) {
              dupList.push({ dbKey, existing: dup, incoming: rec });
            }
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

      // Sem duplicatas — importa direto
      await executeImport(allData, existingByDb, []);
    } catch (err) {
      toast.error('Erro ao ler arquivo: ' + err.message);
      setImporting(false);
    }
  };

  const executeImport = async (allData, existingByDb, dupChoices) => {
    // dupChoices = array de { dbKey, incomingId, action: 'manter' | 'substituir' }
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
          // Remove campos de sistema
          const { id, created_date, updated_date, created_by_id, ...payload } = rec;

          // Converte JSON strings de volta para objetos
          for (const k of Object.keys(payload)) {
            const v = payload[k];
            if (typeof v === 'string' && (v.startsWith('{') || v.startsWith('['))) {
              try { payload[k] = JSON.parse(v); } catch {}
            }
            if (v === '') payload[k] = null;
          }

          // Verifica se é duplicata
          const dup = existing.find(ex => recordsEqual(ex, rec));
          if (dup) {
            const choice = dupChoices.find(c => c.dbKey === dbKey && c.existingId === dup.id);
            if (!choice || choice.action === 'manter') {
              skipped++;
              continue;
            }
            // substituir = atualiza o existente
            await base44.entities[dbKey].update(dup.id, payload);
            replaced++;
            continue;
          }

          await base44.entities[dbKey].create(payload);
          inserted++;
        }

        setImportProgress(prev => prev.map(p => p.key === dbKey
          ? { ...p, status: 'done', inserted, skipped, replaced }
          : p));
      } catch (err) {
        setImportProgress(prev => prev.map(p => p.key === dbKey
          ? { ...p, status: 'error', error: err.message }
          : p));
      }
    }));

    setImporting(false);
    toast.success('Importação concluída!');
  };

  // Usuário decide o que fazer com cada duplicata
  const [dupActions, setDupActions] = useState({});

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
      {/* Header informativo */}
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

      {/* Grid de bancos de dados com contagem */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {DB_CONFIG.map(db => (
          <div key={db.key} className="rounded-lg border border-border bg-card p-3 text-center space-y-1">
            <div className="text-2xl">{db.icon}</div>
            <p className="text-xs font-semibold leading-tight">{db.label}</p>
            <Badge variant="secondary" className={`text-[10px] ${db.color}`}>{db.key}</Badge>
            <p className="text-xs font-mono font-bold text-primary">
              {loadingCounts ? <span className="text-muted-foreground">...</span> : `${dbCounts[db.key] ?? 0} reg.`}
            </p>
          </div>
        ))}
      </div>

      {/* Botões principais */}
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
          <Button
            onClick={handleExport}
            disabled={exporting}
            className="w-full gap-2 bg-green-700 hover:bg-green-800"
          >
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
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            variant="outline"
            className="w-full gap-2 border-primary text-primary hover:bg-primary/10"
          >
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
                    {p.status === 'done' && (
                      <span className="text-xs text-muted-foreground">
                        +{p.inserted || 0}ins / {p.skipped || 0}skip / {p.replaced || 0}sub
                      </span>
                    )}
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

      {/* Dialog de duplicatas */}
      <Dialog open={dupDialogOpen} onOpenChange={setDupDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              {duplicates.length} Registro(s) Idêntico(s) Encontrado(s)
            </DialogTitle>
            <DialogDescription>
              Os registros abaixo já existem no sistema com dados idênticos. Escolha para cada um se deseja <strong>manter</strong> o existente (ignorar) ou <strong>substituir</strong> pelo arquivo importado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="flex gap-2 mb-3 flex-wrap">
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => {
                const map = {};
                duplicates.forEach(d => { map[`${d.dbKey}__${d.existing.id}`] = 'manter'; });
                setDupActions(map);
              }}>
                Manter todos
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-destructive border-destructive/30" onClick={() => {
                const map = {};
                duplicates.forEach(d => { map[`${d.dbKey}__${d.existing.id}`] = 'substituir'; });
                setDupActions(map);
              }}>
                Substituir todos
              </Button>
            </div>

            {duplicates.map((d, i) => {
              const dbConfig = DB_CONFIG.find(c => c.key === d.dbKey);
              const key = `${d.dbKey}__${d.existing.id}`;
              const action = dupActions[key] || 'manter';
              // Mostra os campos mais relevantes
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
                    <button
                      onClick={() => setDupActions(prev => ({ ...prev, [key]: 'manter' }))}
                      className={`flex-1 text-xs py-1.5 px-3 rounded-md border transition-colors ${action === 'manter' ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border text-muted-foreground hover:border-primary/40'}`}
                    >
                      ✓ Manter existente
                    </button>
                    <button
                      onClick={() => setDupActions(prev => ({ ...prev, [key]: 'substituir' }))}
                      className={`flex-1 text-xs py-1.5 px-3 rounded-md border transition-colors ${action === 'substituir' ? 'border-destructive bg-destructive/10 text-destructive font-semibold' : 'border-border text-muted-foreground hover:border-destructive/40'}`}
                    >
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
              <RefreshCw className="w-4 h-4" />
              Confirmar e Importar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}