import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44, uploadFile } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, Link2, FileArchive, Save, Trash2, Loader2, Upload, Eraser } from 'lucide-react';
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
  const fileRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [uploadingApk, setUploadingApk] = useState(false);
  const [removendoApk, setRemovendoApk] = useState(false);
  const [limpandoTudo, setLimpandoTudo] = useState(false);
  const [versao, setVersao] = useState('');
  const [link, setLink] = useState('');
  const [notas, setNotas] = useState('');
  const [apkUrl, setApkUrl] = useState('');
  const [apkNome, setApkNome] = useState('');

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
    const apkConfig = pegarValor(CHAVES.apkUrl);
    setApkUrl(apkConfig?.valor || '');
    setApkNome(apkConfig?.descricao || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configs]);

  const atualizarListaApos = async () => {
    await queryClient.invalidateQueries({ queryKey: ['system-configs-atualizacao'] });
    await queryClient.invalidateQueries({ queryKey: ['atualizacao-sistema'] });
  };

  // O APK é salvo IMEDIATAMENTE após o upload (mesmo padrão do PDF do
  // organograma em Unidades.jsx) — evita depender do admin lembrar de
  // clicar em "Salvar" depois, que era a causa do APK não ficar gravado.
  const handleUploadApk = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.apk')) {
      toast.error('Selecione um arquivo .apk válido');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setUploadingApk(true);
    try {
      const { file_url } = await uploadFile(file);
      await persistirConfig(CHAVES.apkUrl, file_url, file.name);
      setApkUrl(file_url);
      setApkNome(file.name);
      await atualizarListaApos();
      toast.success('APK enviado e publicado com sucesso!');
    } catch (err) {
      toast.error('Erro ao enviar o APK: ' + (err?.message || ''));
    } finally {
      setUploadingApk(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleRemoverApk = async () => {
    if (!window.confirm('Remover o APK publicado? Os usuários não poderão mais baixá-lo.')) return;
    setRemovendoApk(true);
    try {
      await excluirConfig(CHAVES.apkUrl);
      setApkUrl('');
      setApkNome('');
      await atualizarListaApos();
      toast.success('APK removido com sucesso!');
    } catch (err) {
      toast.error('Erro ao remover o APK: ' + (err?.message || ''));
    } finally {
      setRemovendoApk(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        persistirConfig(CHAVES.versao, versao.trim(), 'Versão mais recente disponível para atualização'),
        persistirConfig(CHAVES.link, link.trim(), 'Link externo de atualização (ex: loja de apps ou site)'),
        persistirConfig(CHAVES.notas, notas.trim(), 'Notas da atualização exibidas aos usuários'),
      ]);
      await atualizarListaApos();
      toast.success('Atualização salva com sucesso!');
    } catch (err) {
      toast.error('Erro ao salvar: ' + (err?.message || ''));
    } finally {
      setSaving(false);
    }
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
      setApkNome('');
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
                onClick={async () => { await excluirConfig(CHAVES.versao); setVersao(''); await atualizarListaApos(); toast.success('Versão removida!'); }}
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
                onClick={async () => { await excluirConfig(CHAVES.link); setLink(''); await atualizarListaApos(); toast.success('Link removido!'); }}
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
                onClick={async () => { await excluirConfig(CHAVES.notas); setNotas(''); await atualizarListaApos(); toast.success('Notas removidas!'); }}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0 self-start"
                title="Remover notas salvas"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        <div>
          <Label className="flex items-center gap-1.5"><FileArchive className="w-3.5 h-3.5 text-muted-foreground" /> Arquivo APK</Label>
          {apkUrl ? (
            <div className="mt-1.5 flex items-center gap-2 bg-muted/40 border border-border rounded-lg px-3 py-2">
              <FileArchive className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="text-xs flex-1 truncate">{apkNome || 'APK enviado'}</span>
              <Button
                variant="ghost" size="icon" onClick={handleRemoverApk} disabled={removendoApk}
                className="h-7 w-7 text-destructive flex-shrink-0" title="Remover APK publicado"
              >
                {removendoApk ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              </Button>
            </div>
          ) : (
            <label className={`mt-1.5 flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 border-dashed border-primary/40 cursor-pointer text-xs font-semibold text-primary hover:bg-primary/5 transition-colors ${uploadingApk ? 'opacity-60 pointer-events-none' : ''}`}>
              <Upload className="w-4 h-4" />
              {uploadingApk ? 'Enviando...' : 'Selecionar arquivo .apk'}
              <input ref={fileRef} type="file" accept=".apk" className="hidden" onChange={handleUploadApk} disabled={uploadingApk} />
            </label>
          )}
          <p className="text-[11px] text-muted-foreground mt-1">O APK é publicado assim que o envio terminar, sem precisar clicar em "Salvar".</p>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Salvando...' : 'Salvar Versão, Link e Notas'}
        </Button>
      </div>
    </div>
  );
}
