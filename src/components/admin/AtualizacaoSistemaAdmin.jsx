import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44, uploadFile } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, Link2, FileArchive, Save, Trash2, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

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

export default function AtualizacaoSistemaAdmin() {
  const queryClient = useQueryClient();
  const fileRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [uploadingApk, setUploadingApk] = useState(false);
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

  const handleUploadApk = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.apk')) {
      toast.error('Selecione um arquivo .apk válido');
      return;
    }
    setUploadingApk(true);
    try {
      const { file_url } = await uploadFile(file);
      setApkUrl(file_url);
      setApkNome(file.name);
      toast.success('APK enviado! Clique em "Salvar" para publicar a atualização.');
    } catch {
      toast.error('Erro ao enviar o APK');
    } finally {
      setUploadingApk(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleRemoverApk = () => {
    setApkUrl('');
    setApkNome('');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        persistirConfig(CHAVES.versao, versao.trim(), 'Versão mais recente disponível para atualização'),
        persistirConfig(CHAVES.link, link.trim(), 'Link externo de atualização (ex: loja de apps ou site)'),
        persistirConfig(CHAVES.notas, notas.trim(), 'Notas da atualização exibidas aos usuários'),
        persistirConfig(CHAVES.apkUrl, apkUrl.trim(), apkNome || ''),
      ]);
      await queryClient.invalidateQueries({ queryKey: ['system-configs-atualizacao'] });
      await queryClient.invalidateQueries({ queryKey: ['atualizacao-sistema'] });
      toast.success('Atualização publicada com sucesso!');
    } catch (err) {
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>;

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Download className="w-5 h-5 text-primary" />
        <h2 className="text-base font-bold">Atualização do Sistema</h2>
      </div>

      <div className="bg-card rounded-xl border border-border p-5 space-y-5">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Publique aqui uma nova versão do app. Todos os usuários verão estas informações na aba
          "Atualização do Sistema" e poderão baixar o APK ou acessar o link de atualização.
        </p>

        <div>
          <Label>Versão</Label>
          <Input
            value={versao}
            onChange={e => setVersao(e.target.value)}
            placeholder="Ex: 1.2.0"
            className="mt-1.5"
          />
        </div>

        <div>
          <Label className="flex items-center gap-1.5"><Link2 className="w-3.5 h-3.5 text-muted-foreground" /> Link de Atualização</Label>
          <Input
            value={link}
            onChange={e => setLink(e.target.value)}
            placeholder="https://..."
            className="mt-1.5"
          />
          <p className="text-[11px] text-muted-foreground mt-1">Opcional. Ex: link da loja de apps ou página de download.</p>
        </div>

        <div>
          <Label>Notas da Atualização</Label>
          <textarea
            value={notas}
            onChange={e => setNotas(e.target.value)}
            placeholder="O que mudou nesta versão..."
            className="mt-1.5 w-full h-20 px-3 py-2 text-sm border border-input rounded-md bg-transparent resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div>
          <Label className="flex items-center gap-1.5"><FileArchive className="w-3.5 h-3.5 text-muted-foreground" /> Arquivo APK</Label>
          {apkUrl ? (
            <div className="mt-1.5 flex items-center gap-2 bg-muted/40 border border-border rounded-lg px-3 py-2">
              <FileArchive className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="text-xs flex-1 truncate">{apkNome || 'APK enviado'}</span>
              <Button variant="ghost" size="icon" onClick={handleRemoverApk} className="h-7 w-7 text-destructive flex-shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ) : (
            <label className={`mt-1.5 flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 border-dashed border-primary/40 cursor-pointer text-xs font-semibold text-primary hover:bg-primary/5 transition-colors ${uploadingApk ? 'opacity-60 pointer-events-none' : ''}`}>
              <Upload className="w-4 h-4" />
              {uploadingApk ? 'Enviando...' : 'Selecionar arquivo .apk'}
              <input ref={fileRef} type="file" accept=".apk" className="hidden" onChange={handleUploadApk} disabled={uploadingApk} />
            </label>
          )}
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Salvando...' : 'Salvar e Publicar Atualização'}
        </Button>
      </div>
    </div>
  );
}
