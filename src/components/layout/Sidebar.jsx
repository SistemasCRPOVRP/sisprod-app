import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  ClipboardPlus,
  Trophy,
  Building2,
  History,
  Shield,
  ChevronLeft,
  ChevronRight,
  Target,
  Menu,
  X,
  Map,
  FileText,
  Home,
  Crown,
  LogOut,
  UsersRound,
  Download,
  FileSpreadsheet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppAuth } from '@/lib/AppAuthContext';

const CREATOR_EMAIL = 'marekoscher@gmail.com';

// Perfis que têm acesso a cada seção
const navItems = [
  { label: 'Início', icon: Home, path: '/' },
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Lançamento', icon: ClipboardPlus, path: '/lancamento' },
  { label: 'Ranking', icon: Trophy, path: '/ranking' },
  { label: 'Mapa', icon: Map, path: '/mapa' },
  { label: 'Histórico', icon: History, path: '/historico' },
  { label: 'Relatórios', icon: FileText, path: '/relatorios' },
  { label: 'Atualização do Sistema', icon: Download, path: '/atualizacao' },
  { label: 'Backups Trimestrais', icon: FileSpreadsheet, path: '/planilhas' },
  { label: 'Indicadores', icon: Target, path: '/indicadores', appPerfis: ['administrador', 'comandante_crpm'], roles: ['admin', 'planejamento'] },
  { label: 'Unidades', icon: Building2, path: '/unidades', appPerfis: ['administrador', 'comandante_crpm'], roles: ['admin', 'planejamento'] },
  { label: 'Grupos Concorrentes', icon: UsersRound, path: '/grupos-concorrentes', appPerfis: ['administrador'], roles: ['admin'] },
  { label: 'Administração', icon: Shield, path: '/admin', appPerfis: ['administrador'], roles: ['admin'] },
  { label: 'Creator', icon: Crown, path: '/creator', creatorOnly: true },
];

const PERFIL_LABELS = {
  administrador: 'Administrador',
  comandante_crpm: 'Cmte CRPM',
  comandante_btl: 'Cmte Batalhão',
  comandante_pel: 'Cmte Pelotão',
  comandante_gpm: 'Cmte GPM',
  operador: 'Operador',
};

export default function Sidebar({ appUser }) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { logout } = useAppAuth();
  const appPerfil = appUser?.perfil || 'operador';

  // abas_permitidas: se definido pelo admin, restringe ao conjunto escolhido
  const abasPermitidas = appUser?.abas_permitidas;
  const filteredItems = navItems.filter(item => {
    if (item.creatorOnly) return appUser?.email === CREATOR_EMAIL;
    // Se o admin definiu abas individuais para este usuário, usa essa lista
    if (abasPermitidas && abasPermitidas.length > 0) {
      return abasPermitidas.includes(item.path);
    }
    // Caso contrário, usa a lógica padrão de perfil
    if (item.appPerfis) return item.appPerfis.includes(appPerfil);
    return true;
  });

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
            <img
              src="https://media.base44.com/images/public/69ea1019a6b072f9661e6c7e/a5141bf0c_Braso_Brigada_Militar_do_Rio_Grande_do_Sul.png"
              alt="Brasão BM"
              className="w-10 h-10 object-contain drop-shadow-lg"
              onError={e => { e.target.style.display='none'; }}
            />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="font-bold text-sm text-sidebar-foreground tracking-wide">SISPROD BM</h1>
              <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-widest">Produtividade</p>
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {filteredItems.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                item.creatorOnly
                  ? isActive ? 'bg-yellow-500/20 text-yellow-400' : 'text-yellow-500/70 hover:bg-yellow-500/10 hover:text-yellow-400'
                  : isActive
                    ? 'bg-sidebar-accent text-sidebar-primary'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              )}
            >
              <item.icon className={cn('w-5 h-5 flex-shrink-0', isActive && !item.creatorOnly && 'text-sidebar-primary', item.creatorOnly && 'text-yellow-500')} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-sidebar-border">
        <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
          <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-sidebar-foreground">
              {(appUser?.nome_completo || appUser?.id_funcional || 'U')[0].toUpperCase()}
            </span>
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-sidebar-foreground truncate">
                {appUser?.nome_completo || appUser?.id_funcional || 'Usuário'}
              </p>
              <p className="text-[10px] text-sidebar-foreground/50">
                {PERFIL_LABELS[appPerfil] || appPerfil}
                {appUser?.id_funcional && <span className="ml-1 font-mono">· {appUser.id_funcional}</span>}
              </p>
            </div>
          )}
          {!collapsed && (
            <button onClick={logout} title="Sair" className="text-sidebar-foreground/40 hover:text-sidebar-foreground/80 transition-colors flex-shrink-0">
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
        {collapsed && (
          <button onClick={logout} title="Sair" className="mt-2 w-full flex justify-center text-sidebar-foreground/40 hover:text-sidebar-foreground/80 transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Collapse toggle - desktop only */}
      <div className="hidden lg:block p-2 border-t border-sidebar-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 p-2 rounded-lg bg-card shadow-lg border border-border"
        style={{ zIndex: 99998 }}
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay — z-[99999] garante que fica acima do Leaflet (z-index 400-1000) */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0" style={{ zIndex: 99999 }}>
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64 bg-sidebar shadow-2xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 p-1 text-sidebar-foreground/50 hover:text-sidebar-foreground"
            >
              <X className="w-5 h-5" />
            </button>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className={cn(
        'hidden lg:flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 h-screen sticky top-0',
        collapsed ? 'w-16' : 'w-60'
      )}>
        <SidebarContent />
      </aside>
    </>
  );
}