import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Download, Link2, FileArchive, ExternalLink, Info, PackageCheck } from 'lucide-react';
import { format } from 'date-fns';

const CHAVES = ['atualizacao_versao', 'atualizacao_link', 'atualizacao_notas', 'atualizacao_apk_url'];

function formatDate(value) {
  try {
    if (!value) return '';
    if (value?.toDate) return format(value.toDate(), 'dd/MM/yyyy HH:mm');
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    return format(d, 'dd/MM/yyyy HH:mm');
  } catch {
    return '';
  }
}

export default function AtualizacaoSistema() {
  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['atualizacao-sistema'],
    queryFn: async () => {
      const resultados = await Promise.all(
        CHAVES.map(chave => base44.entities.SystemConfig.filter({ chave }))
      );
      return resultados.flat();
    },
    // Sem initialData: com ele, o array vazio "contava" como dado fresco por
    // 5min e a busca real nunca disparava logo após salvar uma atualização
    // (mesmo bug já visto em useIndicators/useRankingConfig).
    staleTime: 1000 * 60 * 5,
  });

  const pegarValor = (chave) => {
    const itens = configs.filter(c => c.chave === chave);
    if (itens.length === 0) return null;
    const ordenados = [...itens].sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
    return ordenados[0];
  };

  const versaoConfig = pegarValor('atualizacao_versao');
  const linkConfig = pegarValor('atualizacao_link');
  const notasConfig = pegarValor('atualizacao_notas');
  const apkConfig = pegarValor('atualizacao_apk_url');

  const versao = versaoConfig?.valor || '';
  const link = linkConfig?.valor || '';
  const notas = notasConfig?.valor || '';
  const apkUrl = apkConfig?.valor || '';
  const apkNome = apkConfig?.descricao || '';
  const atualizadoEm = formatDate(apkConfig?.updated_date || versaoConfig?.updated_date);

  const temAtualizacao = !!(apkUrl || link);

  if (isLoading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Download className="w-6 h-6 text-primary" /> Atualização do Sistema
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Baixe a versão mais recente do SISPROD BM</p>
      </div>

      {!temAtualizacao ? (
        <div className="bg-card rounded-xl border border-border p-8 flex flex-col items-center text-center gap-3">
          <PackageCheck className="w-10 h-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Nenhuma atualização disponível no momento.</p>
          <p className="text-xs text-muted-foreground/70">Você já está usando a versão mais recente publicada.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-4 bg-primary/5 border-b border-border flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Nova Atualização Disponível</p>
              {versao && <p className="text-lg font-bold mt-0.5">Versão {versao}</p>}
            </div>
            {atualizadoEm && (
              <span className="text-xs text-muted-foreground">Publicado em {atualizadoEm}</span>
            )}
          </div>

          <div className="p-5 space-y-4">
            {notas && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">O que mudou</p>
                <p className="text-sm whitespace-pre-line leading-relaxed">{notas}</p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              {apkUrl && (
                <Button asChild className="gap-2 flex-1">
                  <a href={apkUrl} download={apkNome || 'sisprod-atualizacao.apk'}>
                    <FileArchive className="w-4 h-4" /> Baixar APK
                  </a>
                </Button>
              )}
              {link && (
                <Button asChild variant="outline" className="gap-2 flex-1">
                  <a href={link} target="_blank" rel="noopener noreferrer">
                    <Link2 className="w-4 h-4" /> Abrir Link de Atualização <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 border border-border rounded-lg px-3 py-2.5">
        <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        <p>
          Para instalar o APK no Android, pode ser necessário permitir a instalação de aplicativos de
          "origens desconhecidas" nas configurações do aparelho. Se o navegador bloquear o download,
          verifique as notificações ou a pasta de downloads do dispositivo.
        </p>
      </div>
    </div>
  );
}
