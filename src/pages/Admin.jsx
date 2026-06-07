import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FileText, Search, ShieldCheck, Settings, PenLine, HardDrive, BellRing } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import GestaoUsuarios from '@/components/admin/GestaoUsuarios';
import ConfiguracoesSistema from '@/components/admin/ConfiguracoesSistema';
import SolicitacoesEdicao from '@/components/admin/SolicitacoesEdicao';
import BackupRestore from '@/components/admin/BackupRestore';
import GerenciarAvisos from '@/components/admin/GerenciarAvisos';

export default function Admin() {
  const { appUser } = useOutletContext();

  const { data: logs = [] } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => base44.entities.AuditLog.list('-created_date', 100),
    initialData: [],
  });

  const { data: editRequests = [] } = useQuery({
    queryKey: ['edit-requests'],
    queryFn: () => base44.entities.EditRequest.list('-created_date', 200),
    initialData: [],
  });

  const [searchLog, setSearchLog] = useState('');

  // Detecta parâmetros de URL para abertura direta da solicitação
  const urlParams = new URLSearchParams(window.location.search);
  const urlTab = urlParams.get('tab');
  const urlReqId = urlParams.get('req');
  const [activeTab, setActiveTab] = useState(urlTab === 'edicoes' ? 'edicoes' : 'gestao');

  const pendingEditRequests = editRequests.filter(r => r.status === 'pendente').length;

  const filteredLogs = logs.filter(l => {
    const term = searchLog.toLowerCase();
    return !term || (l.usuario || '').toLowerCase().includes(term) || (l.detalhe || '').toLowerCase().includes(term);
  });

  // Protege a página: apenas administradores têm acesso
  if (appUser && appUser.perfil !== 'administrador') {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-center">
        <ShieldCheck className="w-12 h-12 text-muted-foreground/30" />
        <h2 className="text-xl font-bold text-muted-foreground">Acesso Restrito</h2>
        <p className="text-sm text-muted-foreground max-w-xs">Esta área é exclusiva para administradores do sistema.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Administração</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerenciamento de usuários, logs e configurações</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="gestao"><ShieldCheck className="w-4 h-4 mr-1.5" /> Gestão de Usuários</TabsTrigger>
          <TabsTrigger value="edicoes" className="relative">
            <PenLine className="w-4 h-4 mr-1.5" /> Liberações de Edição
            {pendingEditRequests > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-amber-500 text-white rounded-full">{pendingEditRequests}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="logs"><FileText className="w-4 h-4 mr-1.5" /> Auditoria</TabsTrigger>
          <TabsTrigger value="config"><Settings className="w-4 h-4 mr-1.5" /> Configurações</TabsTrigger>
          <TabsTrigger value="backup"><HardDrive className="w-4 h-4 mr-1.5" /> Backup / Restore</TabsTrigger>
          <TabsTrigger value="avisos"><BellRing className="w-4 h-4 mr-1.5" /> Avisos</TabsTrigger>
        </TabsList>

        {/* Gestão de usuários do sistema */}
        <TabsContent value="gestao" className="mt-4">
          <GestaoUsuarios highlightRequestId={urlReqId} openRequestsTab={urlTab === 'requests'} />
        </TabsContent>

        {/* Liberações de edição */}
        <TabsContent value="edicoes" className="mt-4">
          <SolicitacoesEdicao />
        </TabsContent>

        {/* Configurações tab */}
        <TabsContent value="config" className="mt-4">
          <ConfiguracoesSistema />
        </TabsContent>

        {/* Backup / Restore tab */}
        <TabsContent value="backup" className="mt-4">
          <BackupRestore />
        </TabsContent>

        {/* Avisos tab */}
        <TabsContent value="avisos" className="mt-4">
          <GerenciarAvisos appUser={appUser} />
        </TabsContent>

        {/* Logs tab */}
        <TabsContent value="logs" className="mt-4 space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar nos logs..." value={searchLog} onChange={e => setSearchLog(e.target.value)} className="pl-9" />
          </div>
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider">Data/Hora</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider">Usuário</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider">Ação</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider">Tabela</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider">Detalhe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredLogs.map(log => (
                    <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {log.created_date ? format(new Date(log.created_date), 'dd/MM/yyyy HH:mm') : '-'}
                      </td>
                      <td className="px-4 py-3 text-xs">{log.usuario}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{log.acao}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs">{log.tabela}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">{log.detalhe}</td>
                    </tr>
                  ))}
                  {filteredLogs.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">Nenhum log encontrado</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}