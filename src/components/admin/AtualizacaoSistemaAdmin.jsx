import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, Link2, FileArchive, Save, Trash2, Loader2, Eraser } from 'lucide-react';
import { toast } from 'sonner';

const CHAVES = {
  versao: 'atualizacao_versao',
  link: 'atualizacao_link',
  notas: 'atualizacao_notas',
  apkUrl: 'atualizacao_apk_url',
};

// Salva uma chave do SystemConfig garantindo UM ÚNICO registro (remove
// duplicados), mesmo padrão usado no organograma em Unidades.jsx.
async function persistirConfig(chave, valor, descricao) {
  const todos = await base44.entities.SystemConfig.filter({ chave });
  const ordenados = (todos || []).sort(
    (a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0)
  );
  if (ordenados.length > 0) {
    const principal = ordenados[0];
    await base44.entities.SystemConfig.update(principal.id, { valor, descricao });
    for (let i = 1; i < ordenados.length; i++) {
      try { await base44.entities.SystemConfig.delete(ordenados[i].id); } catch {}
    }
    return principal.id;
  }
  const novo = await base44.entities.SystemConfig.create({ chave, valor, descricao });
  return novo.id;
}

// Remove TODOS os registros de uma chave (usado para "excluir" um campo).
async function excluirConfig(chave) {
  const todos = await base44.entities.SystemConfig.filter({ chave });
  await Promise.all((todos || []).map(item => base44.entities.SystemConfig.delete(item.id).catch(() => {})));
}

export default function AtualizacaoSistemaAdmin() {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [limpandoTudo, setLimpandoTudo] = useState(false);
  const [versao, setVersao] = useState('');
  const [link, setLink] = useState('');
  const [notas, setNotas] = useState('');
  const [apkUrl, setApkUrl] = useState('');

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['system-configs-atualizacao'],
    queryFn: async () => {
      const chaves = Object.values(CHAVES);
      const resultados = await Promise.all(
        chaves.map(chave => base44.entities.SystemConfig.filter({ chave }))
      );
      return resultados.flat();
    },
    // Sem initialData: evita o bug de o array vazio "contar" como dado
    // fresco e nunca buscar os valores reais já salvos (ver AtualizacaoSistema.jsx).
  });

  const pegarValor = (chave) => {
    const itens = configs.filter(c => c.chave === chave);
    if (itens.length === 0) return null;
    const ordenados = [...itens].sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
    return ordenados[0];
  };

  // Sincroniza os campos toda vez que os dados carregam do banco
  useEffect(() => {
    setVersao(pegarValor(CHAVES.versao)?.valor || '');
    setLink(pegarValor(CHAVES.link)?.valor || '');
    setNotas(pegarValor(CHAVES.notas)?.valor || '');
    setApkUrl(pegarValor(CHAVES.apkUrl)?.valor || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configs]);

  const atualizarListaApos = async () => {
    await queryClient.invalidateQueries({ queryKey: ['system-configs-atualizacao'] });
    await queryClient.invalidateQueries({ queryKey: ['atualizacao-sistema'] });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        persistirConfig(CHAVES.versao, versao.trim(), 'Versão mais recente disponível para atualização'),
        persistirConfig(CHAVES.link, link.trim(), 'Link externo de atualização (ex: loja de apps ou site)'),
        persistirConfig(CHAVES.notas, notas.trim(), 'Notas da atualização exibidas aos usuários'),
        persistirConfig(CHAVES.apkUrl, apkUrl.trim(), 'Link direto para download do APK'),
      ]);
      await atualizarListaApos();
      toast.success('Atualização salva com sucesso!');
    } catch (err) {
      toast.error('Erro ao salvar: ' + (err?.message || ''));
    } finally {
      setSaving(false);
    }
  };

  const removerCampo = async (chave, setter, label) => {
    await excluirConfig(chave);
    setter('');
    await atualizarListaApos();
    toast.success(`${label} removido(a) com sucesso!`);
  };

  const handleLimparTudo = async () => {
    if (!window.confirm('Limpar TODA a atualização publicada (versão, link, notas e APK)? Esta ação não pode ser desfeita.')) return;
    setLimpandoTudo(true);
    try {
      await Promise.all(Object.values(CHAVES).map(chave => excluirConfig(chave)));
      setVersao('');
      setLink('');
      setNotas('');
      setApkUrl('');
      await atualizarListaApos();
      toast.success('Atualização removida com sucesso!');
    } catch (err) {
      toast.error('Erro ao limpar: ' + (err?.message || ''));
    } finally {
      setLimpandoTudo(false);
    }
  };

  if (isLoading) return <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>;

  const temAlgoPublicado = !!(versao || link || notas || apkUrl);

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Download className="w-5 h-5 text-primary" />
          <h2 className="text-base font-bold">Atualização do Sistema</h2>
        </div>
        {temAlgoPublicado && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleLimparTudo}
            disabled={limpandoTudo}
            className="gap-1.5 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
          >
            {limpandoTudo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eraser className="w-3.5 h-3.5" />}
            Limpar Atualização
          </Button>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border p-5 space-y-5">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Publique aqui uma nova versão do app. Todos os usuários verão estas informações na aba
          "Atualização do Sistema" e poderão baixar o APK ou acessar o link de atualização.
        </p>

        <div>
          <Label>Versão</Label>
          <div className="flex gap-2 mt-1.5">
            <Input
              value={versao}
              onChange={e => setVersao(e.target.value)}
              placeholder="Ex: 1.2.0"
              className="flex-1"
            />
            {versao && (
              <Button
                variant="ghost" size="icon"
                onClick={() => removerCampo(CHAVES.versao, setVersao, 'Versão')}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                title="Remover versão salva"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        <div>
          <Label className="flex items-center gap-1.5"><Link2 className="w-3.5 h-3.5 text-muted-foreground" /> Link de Atualização</Label>
          <div className="flex gap-2 mt-1.5">
            <Input
              value={link}
              onChange={e => setLink(e.target.value)}
              placeholder="https://..."
              className="flex-1"
            />
            {link && (
              <Button
                variant="ghost" size="icon"
                onClick={() => removerCampo(CHAVES.link, setLink, 'Link')}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                title="Remover link salvo"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Opcional. Ex: link da loja de apps ou página de download.</p>
        </div>

        <div>
          <Label>Notas da Atualização</Label>
          <div className="flex gap-2 mt-1.5">
            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              placeholder="O que mudou nesta versão..."
              className="flex-1 h-20 px-3 py-2 text-sm border border-input rounded-md bg-transparent resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {notas && (
              <Button
                variant="ghost" size="icon"
                onClick={() => removerCampo(CHAVES.notas, setNotas, 'Notas')}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0 self-start"
                title="Remover notas salvas"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        <div>
          <Label className="flex items-center gap-1.5"><FileArchive className="w-3.5 h-3.5 text-muted-foreground" /> Link do Arquivo APK</Label>
          <div className="flex gap-2 mt-1.5">
            <Input
              value={apkUrl}
              onChange={e => setApkUrl(e.target.value)}
              placeholder="https://github.com/.../releases/download/.../SISPROD.apk"
              className="flex-1"
            />
            {apkUrl && (
              <Button
                variant="ghost" size="icon"
                onClick={() => removerCampo(CHAVES.apkUrl, setApkUrl, 'APK')}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                title="Remover link do APK salvo"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Cole o link direto de download do .apk (ex: de um GitHub Release). O upload direto pelo
            navegador não é usado porque o Cloudinary bloqueia arquivos .apk por segurança.
          </p>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Salvando...' : 'Salvar Atualização'}
        </Button>
      </div>
    </div>
  );
}
