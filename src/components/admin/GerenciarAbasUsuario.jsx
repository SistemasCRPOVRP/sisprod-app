import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import {
  LayoutDashboard, ClipboardPlus, Trophy, History, Target, Building2,
  Map, FileText, Home, Check, Search, LayoutGrid, X, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';

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

const PERFIS_LABEL = {
  administrador: 'Administrador',
  comandante_crpm: 'Cmte CRPM',
  comandante_btl: 'Cmte Batalhão',
  comandante_cia: 'Cmte Companhia',
  comandante_pel: 'Cmte Pelotão',
  comandante_gpm: 'Cmte GPM',
  operador: 'Operador',
  p1: 'P1', p2: 'P2', p3: 'P3', p4: 'P4',
};

function AbasEditor({ user, onClose }) {
  const queryClient = useQueryClient();
  const hasCustom = !!(user.abas_permitidas && user.abas_permitidas.length > 0);
  const [useCustom, setUseCustom] = useState(hasCustom);
  const [selected, setSelected] = useState(
    hasCustom ? user.abas_permitidas : ABAS_CONFIG.map(a => a.path)
  );
  const [saving, setSaving] = useState(false);

  const toggle = (path) => setSelected(prev =>
    prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
  );

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.AppUser.update(user.id, {
      abas_permitidas: useCustom ? selected : null,
    });
    queryClient.invalidateQueries({ queryKey: ['app-users'] });
    toast.success('Permissões de abas atualizadas!');
    setSaving(false);
    onClose();
  };

  return (
    <div className="space-y-4">
      {/* Cabeçalho do usuário */}
      <div className="rounded-lg bg-muted/50 border border-border px-4 py-3">
        <p className="font-semibold text-sm">{user.nome_completo}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-xs font-mono text-primary">{user.id_funcional}</span>
          <Badge variant="secondary" className="text-xs">{PERFIS_LABEL[user.perfil] || user.perfil}</Badge>
          {user.organization_name && <span className="text-xs text-muted-foreground">{user.organization_name}</span>}
        </div>
      </div>

      {/* Modo */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { setUseCustom(false); }}
          className={`flex-1 py-2.5 px-3 rounded-lg border text-xs font-medium transition-colors ${!useCustom ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'}`}
        >
          Padrão do perfil
          <p className="font-normal text-[10px] mt-0.5 opacity-70">Segue as regras automáticas do perfil</p>
        </button>
        <button
          type="button"
          onClick={() => { setUseCustom(true); if (!hasCustom) setSelected(ABAS_CONFIG.map(a => a.path)); }}
          className={`flex-1 py-2.5 px-3 rounded-lg border text-xs font-medium transition-colors ${useCustom ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'}`}
        >
          Personalizado
          <p className="font-normal text-[10px] mt-0.5 opacity-70">Selecione manualmente as abas</p>
        </button>
      </div>

      {/* Seleção de abas */}
      {useCustom ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Abas permitidas</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setSelected(ABAS_CONFIG.map(a => a.path))}
                className="text-xs text-primary hover:underline">Todas</button>
              <button type="button" onClick={() => setSelected([])}
                className="text-xs text-muted-foreground hover:underline">Nenhuma</button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {ABAS_CONFIG.map(aba => {
              const sel = selected.includes(aba.path);
              return (
                <button
                  key={aba.path}
                  type="button"
                  onClick={() => toggle(aba.path)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm text-left transition-colors ${sel ? 'border-primary bg-primary/5 text-foreground' : 'border-border text-muted-foreground hover:border-primary/30 hover:text-foreground'}`}
                >
                  <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${sel ? 'bg-primary border-primary' : 'border-muted-foreground/40'}`}>
                    {sel && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                  </div>
                  <aba.icon className={`w-4 h-4 flex-shrink-0 ${sel ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="font-medium">{aba.label}</span>
                </button>
              );
            })}
          </div>
          {selected.length === 0 && (
            <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
              Nenhuma aba selecionada — o usuário não verá itens no menu.
            </p>
          )}
          <p className="text-xs text-muted-foreground">{selected.length} de {ABAS_CONFIG.length} abas selecionadas</p>
        </div>
      ) : (
        <div className="rounded-lg bg-muted/30 border border-border px-4 py-3 text-xs text-muted-foreground">
          O usuário verá as abas automaticamente conforme o perfil <strong>{PERFIS_LABEL[user.perfil] || user.perfil}</strong>.
          Nenhuma restrição individual aplicada.
        </div>
      )}

      <DialogFooter>
        <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar permissões'}
        </Button>
      </DialogFooter>
    </div>
  );
}

export default function GerenciarAbasUsuario({ open, onClose }) {
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);

  const { data: appUsers = [] } = useQuery({
    queryKey: ['app-users'],
    queryFn: () => base44.entities.AppUser.list('-created_date', 200),
    enabled: open,
  });

  const filtered = appUsers.filter(u => {
    const term = search.toLowerCase();
    return !term
      || (u.nome_completo || '').toLowerCase().includes(term)
      || (u.id_funcional || '').includes(term)
      || (u.organization_name || '').toLowerCase().includes(term);
  });

  const handleClose = () => {
    setSearch('');
    setSelectedUser(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-primary" />
            Gerenciar Abas por Usuário
          </DialogTitle>
          <DialogDescription>
            {selectedUser
              ? 'Defina quais abas do menu este usuário poderá acessar.'
              : 'Pesquise e selecione um usuário para configurar suas abas.'}
          </DialogDescription>
        </DialogHeader>

        {!selectedUser ? (
          <div className="space-y-3">
            {/* Busca */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, Id. Funcional ou unidade..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>

            {/* Lista de usuários */}
            <div className="rounded-xl border border-border divide-y divide-border max-h-[50vh] overflow-y-auto">
              {filtered.length === 0 && (
                <p className="text-center py-8 text-sm text-muted-foreground">Nenhum usuário encontrado</p>
              )}
              {filtered.map(u => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelectedUser(u)}
                  className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-muted/40 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-primary">
                      {(u.nome_completo || u.id_funcional || '?')[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{u.nome_completo}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-xs font-mono text-primary">{u.id_funcional}</span>
                      {u.organization_name && <span className="text-xs text-muted-foreground truncate">{u.organization_name}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {u.abas_permitidas && u.abas_permitidas.length > 0 && (
                      <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                        {u.abas_permitidas.length} abas
                      </Badge>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setSelectedUser(null)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Voltar à lista
            </button>
            <AbasEditor user={selectedUser} onClose={handleClose} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}