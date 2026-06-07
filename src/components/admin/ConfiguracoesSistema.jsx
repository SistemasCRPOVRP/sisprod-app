import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, Save, Phone, Mail, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const CONFIGS = [
  {
    chave: 'admin_whatsapp',
    label: 'WhatsApp do Administrador',
    placeholder: '5551999999999 (somente números, com DDI e DDD)',
    icon: Phone,
    descricao: 'Número para receber notificações de novas solicitações via WhatsApp',
  },
  {
    chave: 'admin_email',
    label: 'E-mail do Administrador',
    placeholder: 'admin@bm.rs.gov.br',
    icon: Mail,
    descricao: 'E-mail para receber notificações de novas solicitações',
  },
];

export default function ConfiguracoesSistema() {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState({});

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['system-configs'],
    queryFn: () => base44.entities.SystemConfig.list(),
  });

  // Sincroniza valores toda vez que os dados carregam do banco
  useEffect(() => {
    const map = {};
    configs.forEach(c => { map[c.chave] = c.valor || ''; });
    setValues(map);
  }, [configs]);

  const handleSave = async () => {
    setSaving(true);
    await Promise.all(
      CONFIGS.map(cfg => {
        const val = (values[cfg.chave] || '').trim();
        const existing = configs.find(c => c.chave === cfg.chave);
        if (existing) {
          return base44.entities.SystemConfig.update(existing.id, { valor: val, descricao: cfg.descricao });
        } else if (val) {
          return base44.entities.SystemConfig.create({ chave: cfg.chave, valor: val, descricao: cfg.descricao });
        }
        return Promise.resolve();
      })
    );
    await queryClient.invalidateQueries({ queryKey: ['system-configs'] });
    setSaving(false);
    toast.success('Configurações salvas com sucesso!');
  };

  const handleDelete = async (chave) => {
    const existing = configs.find(c => c.chave === chave);
    if (!existing) {
      setValues(v => ({ ...v, [chave]: '' }));
      return;
    }
    await base44.entities.SystemConfig.delete(existing.id);
    await queryClient.invalidateQueries({ queryKey: ['system-configs'] });
    setValues(v => ({ ...v, [chave]: '' }));
    toast.success('Configuração removida.');
  };

  if (isLoading) return <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>;

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Settings className="w-5 h-5 text-primary" />
        <h2 className="text-base font-bold">Configurações do Sistema</h2>
      </div>

      <div className="bg-card rounded-xl border border-border p-5 space-y-5">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Contato para Notificações de Acesso</p>
        <p className="text-xs text-muted-foreground -mt-3 leading-relaxed">
          Quando um usuário solicitar novo acesso ou recuperação de senha, o sistema enviará automaticamente uma notificação para os contatos abaixo.
        </p>

        {CONFIGS.map(cfg => {
          const hasValue = !!(configs.find(c => c.chave === cfg.chave)?.valor);
          return (
            <div key={cfg.chave}>
              <Label className="flex items-center gap-1.5">
                <cfg.icon className="w-3.5 h-3.5 text-muted-foreground" />
                {cfg.label}
              </Label>
              <div className="flex gap-2 mt-1.5">
                <Input
                  value={values[cfg.chave] || ''}
                  onChange={e => setValues(v => ({ ...v, [cfg.chave]: e.target.value }))}
                  placeholder={cfg.placeholder}
                  className="flex-1"
                />
                {hasValue && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(cfg.chave)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                    title="Remover configuração"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">{cfg.descricao}</p>
            </div>
          );
        })}

        <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
          <Save className="w-4 h-4" />
          {saving ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
      </div>

      <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-xs text-amber-800 leading-relaxed">
        <strong>Como funciona:</strong> Ao receber uma solicitação, o sistema abrirá o WhatsApp com uma mensagem pré-preenchida e enviará um e-mail de notificação automaticamente para os contatos cadastrados acima.
      </div>
    </div>
  );
}