import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, Users, Clock, Key, Trash2, RefreshCw, CheckCircle, XCircle, Loader2, Lock, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays, addMonths, isAfter } from 'date-fns';

const CREATOR_EMAIL = 'marekoscher@gmail.com'; // e-mail do criador

// Licença armazenada como configuração no sistema via AuditLog com tabela especial
const LICENSE_KEY = 'SYSTEM_LICENSE';

export default function Creator() {
  const { user } = useOutletContext();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [inviting, setInviting] = useState(false);
  const [licenseExpiry, setLicenseExpiry] = useState(null);
  const [licenseDialog, setLicenseDialog] = useState(false);
  const [licenseDays, setLicenseDays] = useState('30');
  const [savingLicense, setSavingLicense] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);

  useEffect(() => {
    if (user?.email === CREATOR_EMAIL) loadData();
  }, [user?.email]);

  // Verificar se é o criador
  if (user?.email !== CREATOR_EMAIL) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Lock className="w-16 h-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Acesso Restrito</h1>
        <p className="text-muted-foreground">Esta área é exclusiva do criador do sistema.</p>
      </div>
    );
  }

  const loadData = async () => {
    setLoading(true);
    const [usersData, logs] = await Promise.all([
      base44.entities.User.list(),
      base44.entities.AuditLog.filter({ tabela: 'LICENSE' }, '-created_date', 20),
    ]);
    setUsers(usersData);
    setAuditLogs(logs);

    // Buscar licença atual
    const licenseLog = await base44.entities.AuditLog.filter({ tabela: 'LICENSE', acao: 'criou' }, '-created_date', 1);
    if (licenseLog.length > 0) {
      const exp = licenseLog[0].detalhe;
      setLicenseExpiry(exp);
    }
    setLoading(false);
  };

  const isLicenseActive = licenseExpiry && isAfter(new Date(licenseExpiry), new Date());

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setInviting(true);
    await base44.users.inviteUser(inviteEmail, inviteRole);
    toast.success(`Convite enviado para ${inviteEmail}`);
    setInviteEmail('');
    setInviting(false);
    loadData();
  };

  const handleUpdateRole = async (userId, role) => {
    await base44.entities.User.update(userId, { role });
    toast.success('Função atualizada');
    loadData();
  };

  const saveLicense = async () => {
    setSavingLicense(true);
    const days = parseInt(licenseDays);
    const expiry = addDays(new Date(), days).toISOString();
    await base44.entities.AuditLog.create({
      usuario: user.email,
      acao: 'criou',
      tabela: 'LICENSE',
      detalhe: expiry,
      registro_id: LICENSE_KEY,
    });
    setLicenseExpiry(expiry);
    setLicenseDialog(false);
    setSavingLicense(false);
    toast.success(`Licença ativa por ${days} dias`);
    loadData();
  };

  const revokeLicense = async () => {
    const expiry = new Date('2000-01-01').toISOString();
    await base44.entities.AuditLog.create({
      usuario: user.email,
      acao: 'criou',
      tabela: 'LICENSE',
      detalhe: expiry,
      registro_id: LICENSE_KEY,
    });
    setLicenseExpiry(expiry);
    toast.success('Acesso ao sistema revogado');
    loadData();
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 p-6 bg-gradient-to-r from-[hsl(150,20%,12%)] to-[hsl(142,30%,18%)] text-white rounded-xl">
        <Shield className="w-8 h-8 text-yellow-400" />
        <div>
          <h1 className="text-2xl font-black">Painel do Criador</h1>
          <p className="text-white/60 text-sm">Gerenciamento total do sistema SISPROD BM</p>
        </div>
        <Badge className="ml-auto bg-yellow-400 text-yellow-900 font-bold">CREATOR</Badge>
      </div>

      {/* Licença */}
      <div className={`rounded-xl border-2 p-5 ${isLicenseActive ? 'border-green-500 bg-green-50' : 'border-red-400 bg-red-50'}`}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            {isLicenseActive
              ? <CheckCircle className="w-6 h-6 text-green-600" />
              : <XCircle className="w-6 h-6 text-red-500" />}
            <div>
              <p className={`font-bold ${isLicenseActive ? 'text-green-800' : 'text-red-700'}`}>
                {isLicenseActive ? 'Sistema ATIVO' : 'Sistema DESATIVADO'}
              </p>
              {licenseExpiry && (
                <p className="text-sm text-muted-foreground">
                  {isLicenseActive
                    ? `Expira em: ${format(new Date(licenseExpiry), 'dd/MM/yyyy HH:mm')}`
                    : 'Acesso expirado ou revogado'}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setLicenseDialog(true)} size="sm" className="gap-2">
              <Calendar className="w-4 h-4" /> {isLicenseActive ? 'Renovar/Alterar' : 'Ativar'}
            </Button>
            {isLicenseActive && (
              <Button onClick={revokeLicense} size="sm" variant="destructive" className="gap-2">
                <XCircle className="w-4 h-4" /> Revogar
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Gestão de Usuários */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-bold flex items-center gap-2"><Users className="w-4 h-4" /> Usuários do Sistema</h2>
          <Button size="sm" variant="ghost" onClick={loadData}><RefreshCw className="w-4 h-4" /></Button>
        </div>

        {/* Convidar */}
        <div className="p-5 border-b border-border bg-muted/30">
          <Label className="text-xs font-semibold uppercase tracking-wider mb-2 block">Convidar Novo Usuário</Label>
          <div className="flex gap-2 flex-wrap">
            <Input
              placeholder="email@exemplo.com"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              className="flex-1 min-w-48"
            />
            <Select value={inviteRole} onValueChange={setInviteRole}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Usuário</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="planejamento">Planejamento</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleInvite} disabled={inviting || !inviteEmail} className="gap-2">
              {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
              Convidar
            </Button>
          </div>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <div className="divide-y divide-border">
            {users.map(u => (
              <div key={u.id} className="flex items-center gap-3 px-5 py-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-primary">{(u.full_name || u.email || 'U')[0].toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{u.full_name || u.email}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
                <Select value={u.role || 'user'} onValueChange={role => handleUpdateRole(u.id, role)}>
                  <SelectTrigger className="w-32 h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Usuário</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="planejamento">Planejamento</SelectItem>
                  </SelectContent>
                </Select>
                {u.email === CREATOR_EMAIL && <Badge className="bg-yellow-400 text-yellow-900 text-[10px]">CREATOR</Badge>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Histórico de licenças */}
      {auditLogs.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-bold flex items-center gap-2"><Clock className="w-4 h-4" /> Histórico de Licenças</h2>
          </div>
          <div className="divide-y divide-border">
            {auditLogs.map(log => (
              <div key={log.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="text-muted-foreground text-xs">{log.created_date ? format(new Date(log.created_date), 'dd/MM/yyyy HH:mm') : '-'}</span>
                <span className="text-xs">
                  Expiração configurada para: <strong>{log.detalhe ? format(new Date(log.detalhe), 'dd/MM/yyyy HH:mm') : '-'}</strong>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dialog Licença */}
      <Dialog open={licenseDialog} onOpenChange={setLicenseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar Licença de Acesso</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">Defina por quantos dias o sistema ficará ativo a partir de agora:</p>
            <div className="grid grid-cols-3 gap-2">
              {['7', '15', '30', '60', '90', '180', '365'].map(d => (
                <button
                  key={d}
                  onClick={() => setLicenseDays(d)}
                  className={`rounded-lg border-2 py-2 text-sm font-bold transition-colors ${licenseDays === d ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'}`}
                >
                  {d} dias
                </button>
              ))}
            </div>
            <div>
              <Label className="text-xs">Ou digite o número de dias:</Label>
              <Input type="number" min="1" value={licenseDays} onChange={e => setLicenseDays(e.target.value)} className="mt-1" />
            </div>
            {licenseDays && (
              <div className="rounded-lg bg-muted p-3 text-sm">
                Novo prazo: <strong>{format(addDays(new Date(), parseInt(licenseDays)), 'dd/MM/yyyy')}</strong>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLicenseDialog(false)}>Cancelar</Button>
            <Button onClick={saveLicense} disabled={savingLicense} className="gap-2">
              {savingLicense ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Confirmar Licença
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
