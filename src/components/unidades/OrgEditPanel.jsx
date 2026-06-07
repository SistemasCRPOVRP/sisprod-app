import React, { useState, useCallback, useEffect } from 'react';
import {
  Plus, Pencil, Trash2, ArrowUp, ArrowDown, GitBranch,
  Save, X, ChevronDown, ChevronRight, Building2, Users,
  Shield, User, MapPin, Check, GripVertical, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

// ── Configs por tipo ─────────────────────────────────────────────────────────
const TIPO_CONFIG = {
  crpm: { bg: 'bg-yellow-100 border-yellow-400 text-yellow-900', dot: 'bg-yellow-500', icon: Shield,    label: 'CRPM' },
  btl:  { bg: 'bg-orange-100 border-orange-400 text-orange-900', dot: 'bg-orange-500', icon: Building2, label: 'BPM' },
  cia:  { bg: 'bg-green-100 border-green-400 text-green-900',    dot: 'bg-green-500',  icon: Building2, label: 'CIA' },
  pel:  { bg: 'bg-blue-100 border-blue-400 text-blue-900',       dot: 'bg-blue-500',   icon: Users,     label: 'PEL' },
  gpm:  { bg: 'bg-gray-100 border-gray-300 text-gray-800',       dot: 'bg-gray-400',   icon: User,      label: 'GPM' },
};

// Tipo filho sugerido
const TIPO_FILHO = { crpm: 'btl', btl: 'cia', cia: 'pel', pel: 'gpm', gpm: null };

const TIPO_OPTS = [
  { value: 'crpm', label: 'CRPM/Comando' },
  { value: 'btl',  label: 'Batalhão (BPM)' },
  { value: 'cia',  label: 'Companhia' },
  { value: 'pel',  label: 'Pelotão' },
  { value: 'gpm',  label: 'GPM' },
];

// ── Utilidades ───────────────────────────────────────────────────────────────
function cloneDeep(obj) { return JSON.parse(JSON.stringify(obj)); }

function getNode(tree, path) {
  let cur = tree;
  for (const idx of path) cur = cur.filhos[idx];
  return cur;
}

function applyEdit(tree, path, updates) {
  const t = cloneDeep(tree);
  const node = path.length === 0 ? t : getNode(t, path);
  Object.assign(node, updates);
  return t;
}

function removeNode(tree, path) {
  const t = cloneDeep(tree);
  if (path.length === 0) return t;
  const parent = path.length === 1 ? t : getNode(t, path.slice(0, -1));
  parent.filhos.splice(path[path.length - 1], 1);
  return t;
}

function insertChild(tree, parentPath, newNode) {
  const t = cloneDeep(tree);
  const parent = parentPath.length === 0 ? t : getNode(t, parentPath);
  if (!parent.filhos) parent.filhos = [];
  parent.filhos.push(newNode);
  return t;
}

function swapSiblings(tree, path, dir) {
  if (path.length === 0) return tree;
  const t = cloneDeep(tree);
  const parent = path.length === 1 ? t : getNode(t, path.slice(0, -1));
  const idx = path[path.length - 1];
  const swap = dir === 'up' ? idx - 1 : idx + 1;
  if (swap < 0 || swap >= parent.filhos.length) return tree;
  [parent.filhos[idx], parent.filhos[swap]] = [parent.filhos[swap], parent.filhos[idx]];
  return t;
}

// ── Formulário inline de edição ──────────────────────────────────────────────
function InlineEditForm({ node, onSave, onCancel, isRoot }) {
  const [form, setForm] = useState({ nome: node.nome, local: node.local || '', tipo: node.tipo || 'gpm' });

  const handleSave = () => {
    if (!form.nome.trim()) { toast.error('Informe o nome.'); return; }
    onSave({ nome: form.nome.trim(), local: form.local.trim(), tipo: form.tipo });
  };

  return (
    <div className="mt-2 p-3 rounded-lg border-2 border-primary/40 bg-primary/5 space-y-2" onClick={e => e.stopPropagation()}>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-bold uppercase text-muted-foreground">Nome</label>
          <Input
            value={form.nome}
            onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
            className="h-7 text-xs mt-0.5"
            placeholder="Ex: 1ª Cia"
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onCancel(); }}
          />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1"><MapPin className="w-2.5 h-2.5" />Município</label>
          <Input
            value={form.local}
            onChange={e => setForm(f => ({ ...f, local: e.target.value }))}
            className="h-7 text-xs mt-0.5"
            placeholder="Ex: Santa Cruz do Sul"
          />
        </div>
      </div>
      {!isRoot && (
        <div>
          <label className="text-[10px] font-bold uppercase text-muted-foreground">Tipo</label>
          <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
            <SelectTrigger className="h-7 text-xs mt-0.5"><SelectValue /></SelectTrigger>
            <SelectContent>{TIPO_OPTS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <Button size="sm" className="h-7 text-xs gap-1" onClick={handleSave}>
          <Check className="w-3 h-3" /> Salvar
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground" onClick={onCancel}>
          <X className="w-3 h-3" /> Cancelar
        </Button>
      </div>
    </div>
  );
}

// ── Formulário inline de nova unidade ────────────────────────────────────────
function InlineAddForm({ parentTipo, parentLocal, onConfirm, onCancel }) {
  const tipoSugerido = TIPO_FILHO[parentTipo] || 'gpm';
  const [form, setForm] = useState({ nome: '', local: parentLocal || '', tipo: tipoSugerido });

  const handleConfirm = () => {
    if (!form.nome.trim()) { toast.error('Informe o nome.'); return; }
    onConfirm({ nome: form.nome.trim(), local: form.local.trim(), tipo: form.tipo, filhos: form.tipo !== 'gpm' ? [] : undefined });
  };

  return (
    <div className="mt-2 p-3 rounded-lg border-2 border-dashed border-green-400 bg-green-50/60 space-y-2" onClick={e => e.stopPropagation()}>
      <p className="text-[10px] font-bold text-green-700 uppercase">+ Nova unidade subordinada</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-bold uppercase text-muted-foreground">Nome</label>
          <Input
            value={form.nome}
            onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
            className="h-7 text-xs mt-0.5"
            placeholder={`Ex: 1º ${TIPO_OPTS.find(t => t.value === form.tipo)?.label?.split(' ')[0] || ''}`}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); if (e.key === 'Escape') onCancel(); }}
          />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1"><MapPin className="w-2.5 h-2.5" />Município</label>
          <Input
            value={form.local}
            onChange={e => setForm(f => ({ ...f, local: e.target.value }))}
            className="h-7 text-xs mt-0.5"
            placeholder="Município"
          />
        </div>
      </div>
      <div>
        <label className="text-[10px] font-bold uppercase text-muted-foreground">Tipo</label>
        <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
          <SelectTrigger className="h-7 text-xs mt-0.5"><SelectValue /></SelectTrigger>
          <SelectContent>{TIPO_OPTS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="flex gap-2 pt-1">
        <Button size="sm" className="h-7 text-xs gap-1 bg-green-700 hover:bg-green-800" onClick={handleConfirm}>
          <Plus className="w-3 h-3" /> Adicionar
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground" onClick={onCancel}>
          <X className="w-3 h-3" /> Cancelar
        </Button>
      </div>
    </div>
  );
}

// ── Nó editável da árvore ────────────────────────────────────────────────────
function EditableNode({ node, path, onEdit, onAdd, onDelete, onMove, siblingCount }) {
  const [open, setOpen] = useState(path.length < 2);
  const [editando, setEditando] = useState(false);
  const [adicionando, setAdicionando] = useState(false);

  const cfg = TIPO_CONFIG[node.tipo] || TIPO_CONFIG.gpm;
  const Icon = cfg.icon;
  const hasChildren = node.filhos && node.filhos.length > 0;
  const isRoot = path.length === 0;
  const idx = path.length > 0 ? path[path.length - 1] : 0;
  const canMoveUp = idx > 0;
  const canMoveDown = idx < siblingCount - 1;
  const canAdd = node.tipo !== 'gpm';

  const handleSave = (updates) => {
    onEdit(path, updates);
    setEditando(false);
  };

  const handleAdd = (newNode) => {
    onAdd(path, newNode);
    setAdicionando(false);
    setOpen(true);
  };

  const handleDelete = () => {
    const msg = hasChildren
      ? `Excluir "${node.nome}" e todas as suas ${node.filhos.length} subordinadas?`
      : `Excluir "${node.nome}"?`;
    if (!window.confirm(msg)) return;
    onDelete(path);
  };

  return (
    <div className={path.length > 0 ? 'ml-4 sm:ml-5 border-l-2 border-dashed border-border/60 pl-3' : ''}>

      {/* Bloco principal da unidade */}
      <div className={`rounded-lg border-2 px-3 py-2 mb-1.5 transition-all ${cfg.bg} ${editando ? 'ring-2 ring-primary/40' : ''}`}>

        {/* Cabeçalho */}
        <div className="flex items-center gap-2">
          {/* Expand toggle */}
          <button
            type="button"
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center opacity-60 hover:opacity-100"
            onClick={() => hasChildren && setOpen(o => !o)}
          >
            {hasChildren
              ? (open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />)
              : <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
            }
          </button>

          <Icon className="w-3.5 h-3.5 flex-shrink-0 opacity-70" />

          <div className="flex-1 min-w-0">
            <span className="font-bold text-sm">{node.nome}</span>
            {node.local && <span className="text-xs ml-2 opacity-60">{node.local}</span>}
          </div>

          {/* Badge tipo */}
          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase border opacity-70 ${cfg.bg}`}>
            {cfg.label}
          </span>

          {/* Ações inline */}
          <div className="flex items-center gap-0.5 ml-1">
            {canAdd && (
              <button
                type="button"
                title="Adicionar subordinada"
                onClick={e => { e.stopPropagation(); setAdicionando(a => !a); setEditando(false); }}
                className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${adicionando ? 'bg-green-200 text-green-800' : 'hover:bg-green-100 hover:text-green-700 text-green-600'}`}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              title="Editar"
              onClick={e => { e.stopPropagation(); setEditando(a => !a); setAdicionando(false); }}
              className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${editando ? 'bg-primary/20 text-primary' : 'hover:bg-primary/10 hover:text-primary text-muted-foreground'}`}
            >
              <Pencil className="w-3 h-3" />
            </button>
            {!isRoot && (
              <>
                {canMoveUp && (
                  <button
                    type="button"
                    title="Subir"
                    onClick={e => { e.stopPropagation(); onMove(path, 'up'); }}
                    className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                )}
                {canMoveDown && (
                  <button
                    type="button"
                    title="Descer"
                    onClick={e => { e.stopPropagation(); onMove(path, 'down'); }}
                    className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                )}
                <button
                  type="button"
                  title="Excluir"
                  onClick={e => { e.stopPropagation(); handleDelete(); }}
                  className="w-6 h-6 rounded flex items-center justify-center hover:bg-red-100 hover:text-red-700 text-muted-foreground transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Formulário inline de edição */}
        {editando && (
          <InlineEditForm
            node={node}
            isRoot={isRoot}
            onSave={handleSave}
            onCancel={() => setEditando(false)}
          />
        )}

        {/* Formulário inline de nova unidade */}
        {adicionando && (
          <InlineAddForm
            parentTipo={node.tipo}
            parentLocal={node.local}
            onConfirm={handleAdd}
            onCancel={() => setAdicionando(false)}
          />
        )}
      </div>

      {/* Filhos */}
      {hasChildren && open && (
        <div>
          {node.filhos.map((filho, i) => (
            <EditableNode
              key={`${filho.nome}-${i}`}
              node={filho}
              path={[...path, i]}
              onEdit={onEdit}
              onAdd={onAdd}
              onDelete={onDelete}
              onMove={onMove}
              siblingCount={node.filhos.length}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Componente principal exportado ───────────────────────────────────────────
export default function OrgEditPanel({ organograma, onChange, onSave }) {
  const [localOrg, setLocalOrg] = useState(organograma);
  const [hasChanges, setHasChanges] = useState(false);

  // Sincroniza se o organograma externo mudar (ex: primeiro carregamento)
  React.useEffect(() => {
    setLocalOrg(organograma);
    setHasChanges(false);
  }, [organograma]);

  const applyChange = useCallback((updater) => {
    setLocalOrg(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      return next;
    });
    setHasChanges(true);
    // Propaga para o pai sem salvar permanentemente
    onChange && onChange(updater);
  }, [onChange]);

  const handleEdit = useCallback((path, updates) => {
    applyChange(prev => applyEdit(prev, path, updates));
    toast.success('Unidade atualizada. Clique em "Salvar Organograma" para confirmar.');
  }, [applyChange]);

  const handleAdd = useCallback((parentPath, newNode) => {
    applyChange(prev => insertChild(prev, parentPath, newNode));
    toast.success(`"${newNode.nome}" adicionado.`);
  }, [applyChange]);

  const handleDelete = useCallback((path) => {
    applyChange(prev => removeNode(prev, path));
    toast.success('Unidade excluída.');
  }, [applyChange]);

  const handleMove = useCallback((path, dir) => {
    applyChange(prev => {
      const next = swapSiblings(prev, path, dir);
      if (next === prev) return prev;
      return next;
    });
  }, [applyChange]);

  const handleSave = () => {
    onSave && onSave(localOrg);
    setHasChanges(false);
    toast.success('Organograma salvo com sucesso!');
  };

  return (
    <div className="bg-card rounded-xl border-2 border-primary/20 overflow-hidden">
      <div className="px-4 py-2.5 bg-primary/5 border-b border-border flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Pencil className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-primary">Modo de Edição Ativo</span>
          <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">— edite e clique em "Salvar Organograma" para confirmar</span>
        </div>
        <Button
          size="sm"
          className={`gap-1.5 text-xs h-8 ${hasChanges ? 'bg-green-700 hover:bg-green-800 text-white' : 'bg-muted text-muted-foreground cursor-default'}`}
          onClick={handleSave}
          disabled={!hasChanges}
        >
          <Save className="w-3.5 h-3.5" />
          {hasChanges ? 'Salvar Organograma' : 'Sem alterações'}
        </Button>
      </div>
      {hasChanges && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-800 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          Há alterações não salvas. Clique em "Salvar Organograma" para confirmar as mudanças.
        </div>
      )}
      <div className="p-4 overflow-y-auto max-h-[70vh]">
        <EditableNode
          node={localOrg}
          path={[]}
          onEdit={handleEdit}
          onAdd={handleAdd}
          onDelete={handleDelete}
          onMove={handleMove}
          siblingCount={1}
        />
      </div>
    </div>
  );
}
