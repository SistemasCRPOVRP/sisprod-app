import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useIndicators } from '@/hooks/useProduction';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const DEFAULT_CATEGORIAS = ['Preventiva', 'Repressiva', 'Apreensão', 'Atendimento', 'Economia'];

export default function Indicadores() {
  const queryClient = useQueryClient();
  const { data: indicators } = useIndicators();
  const [dialog, setDialog] = useState(null); // null | 'new' | indicator object
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [form, setForm] = useState({ nome: '', categoria: 'Preventiva', peso: '' });
  const [novaCategoria, setNovaCategoria] = useState('');
  const [categoriasExtras, setCategoriasExtras] = useState([]);
  const [showNovaCat, setShowNovaCat] = useState(false);

  // All categories = defaults + extras from existing indicators + user-added
  const allCategorias = [...new Set([
    ...DEFAULT_CATEGORIAS,
    ...indicators.map(i => i.categoria).filter(Boolean),
    ...categoriasExtras,
  ])];

  const adicionarCategoria = () => {
    const cat = novaCategoria.trim();
    if (!cat) return;
    if (!allCategorias.includes(cat)) setCategoriasExtras(c => [...c, cat]);
    setForm(f => ({ ...f, categoria: cat }));
    setNovaCategoria('');
    setShowNovaCat(false);
  };

  const openNew = () => {
    setForm({ nome: '', categoria: 'Preventiva', peso: '' });
    setDialog('new');
  };

  const openEdit = (ind) => {
    setForm({ nome: ind.nome, categoria: ind.categoria, peso: String(ind.peso) });
    setDialog(ind);
  };

  const handleSave = async () => {
    if (!form.nome || !form.peso) {
      toast.error('Preencha todos os campos');
      return;
    }
    const data = { nome: form.nome, categoria: form.categoria, peso: parseFloat(form.peso), status: 'ativo' };

    if (dialog === 'new') {
      await base44.entities.Indicator.create(data);
      toast.success('Indicador criado');
    } else {
      await base44.entities.Indicator.update(dialog.id, data);
      toast.success('Indicador atualizado');
    }
    queryClient.invalidateQueries({ queryKey: ['indicators'] });
    setDialog(null);
  };

  const handleDelete = async () => {
    await base44.entities.Indicator.update(deleteDialog.id, { status: 'inativo' });
    queryClient.invalidateQueries({ queryKey: ['indicators'] });
    setDeleteDialog(null);
    toast.success('Indicador desativado');
  };

  const grouped = allCategorias.map(cat => ({
    cat,
    items: indicators.filter(i => i.categoria === cat),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Indicadores</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie os indicadores e pesos de pontuação</p>
        </div>
        <div className="flex gap-2">
        <Button variant="outline" onClick={() => setShowNovaCat(v => !v)} className="gap-1.5 text-xs"><Plus className="w-3.5 h-3.5" /> Nova Categoria</Button>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" /> Novo Indicador</Button>
      </div>
      </div>

      {/* Nova Categoria inline */}
      {showNovaCat && (
        <div className="bg-card border border-dashed border-primary/40 rounded-xl p-4 flex items-end gap-3">
          <div className="flex-1">
            <Label className="text-xs mb-1.5 block">Nome da nova categoria</Label>
            <Input
              value={novaCategoria}
              onChange={e => setNovaCategoria(e.target.value)}
              placeholder="Ex: Operações Especiais"
              onKeyDown={e => e.key === 'Enter' && adicionarCategoria()}
              autoFocus
            />
          </div>
          <Button onClick={adicionarCategoria} disabled={!novaCategoria.trim()}>Adicionar</Button>
          <Button variant="ghost" onClick={() => setShowNovaCat(false)}>Cancelar</Button>
        </div>
      )}

      {grouped.map(({ cat, items }) => (
        <div key={cat}>
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">{cat}</h3>
          <div className="bg-card rounded-xl border border-border overflow-hidden mb-4">
            {items.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground text-center">Nenhum indicador nesta categoria</p>
            ) : (
              <div className="divide-y divide-border">
                {items.map(ind => (
                  <div key={ind.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">{ind.nome}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary">{ind.peso} pts</Badge>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(ind)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteDialog(ind)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Create/Edit Dialog */}
      <Dialog open={!!dialog} onOpenChange={() => setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog === 'new' ? 'Novo Indicador' : 'Editar Indicador'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome</Label>
              <Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} className="mt-1.5" />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={form.categoria} onValueChange={v => setForm({ ...form, categoria: v })}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {allCategorias.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Peso (pontos)</Label>
              <Input type="number" min="0" value={form.peso} onChange={e => setForm({ ...form, peso: e.target.value })} className="mt-1.5" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desativar Indicador</DialogTitle>
            <DialogDescription>Deseja desativar o indicador "{deleteDialog?.nome}"?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Desativar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
