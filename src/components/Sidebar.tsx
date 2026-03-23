import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Brush, CreditCard, Users, LogOut, Menu, X, Calendar as CalendarIcon, Settings } from 'lucide-react';
import { cn } from '../utils/cn';

interface SidebarProps {
  role: 'ADMIN' | 'INQUILINO';
  activeTab: string;
  onTabChange: (tab: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ role, activeTab, onTabChange, isOpen, onClose }) => {
  const navigate = useNavigate();

  const menuItems = [
    { id: 'dashboard', label: 'Inicio', icon: LayoutDashboard, roles: ['ADMIN', 'INQUILINO'] },
    { id: 'schedules', label: 'Roles Semanales', icon: CalendarIcon, roles: ['ADMIN', 'INQUILINO'] },
    { id: 'payments', label: 'Pagos Internet', icon: CreditCard, roles: ['ADMIN', 'INQUILINO'] },
    { id: 'users', label: 'Inquilinos', icon: Users, roles: ['ADMIN'] },
    { id: 'settings', label: 'Configuración', icon: Settings, roles: ['ADMIN', 'INQUILINO'] },
  ];

  const filteredItems = menuItems.filter(item => item.roles.includes(role));

  return (
    <>
      {/* Sidebar Container */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-72 bg-slate-950 text-slate-400 transition-transform duration-300 ease-in-out lg:translate-x-0 border-r border-slate-800/50",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo Section */}
          <div className="p-8">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <LayoutDashboard className="text-white" size={22} />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-white leading-tight">Gestión 3P</h1>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Residencial</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto">
            <div className="px-4 mb-4">
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em]">Menú Principal</p>
            </div>
            {filteredItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onTabChange(item.id);
                  onClose();
                }}
                className={cn(
                  "flex items-center w-full px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 group",
                  activeTab === item.id 
                    ? "bg-emerald-500/10 text-emerald-400" 
                    : "hover:bg-slate-900 hover:text-slate-200"
                )}
              >
                <item.icon className={cn(
                  "mr-3 transition-colors",
                  activeTab === item.id ? "text-emerald-400" : "text-slate-500 group-hover:text-slate-300"
                )} size={20} />
                {item.label}
                {activeTab === item.id && (
                  <div className="ml-auto w-1.5 h-1.5 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                )}
              </button>
            ))}
          </nav>

          {/* Footer Section */}
          <div className="p-4 mt-auto">
            <div className="bg-slate-900/50 rounded-2xl p-4 mb-4 border border-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-xs font-bold text-slate-300 border border-slate-700">
                  {role.charAt(0)}
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-bold text-slate-200 truncate">{role === 'ADMIN' ? 'Administrador' : 'Inquilino'}</p>
                  <p className="text-[10px] text-slate-500 truncate">Sesión activa</p>
                </div>
              </div>
            </div>
            <button 
              onClick={() => navigate('/login')}
              className="flex items-center w-full px-4 py-3 text-sm font-bold text-slate-500 rounded-xl hover:bg-red-500/10 hover:text-red-400 transition-all duration-200"
            >
              <LogOut className="mr-3" size={18} />
              Cerrar Sesión
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}
    </>
  );
};
