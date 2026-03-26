import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Role } from '../types';
import { useNavigate } from 'react-router-dom';
import { NotificationCenter } from './NotificationCenter';
import { useAuth } from '../context/AuthContext';
import { motion } from 'motion/react';
import { Menu, X } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  role: Role;
  activeTab: string;
  onTabChange?: (tab: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, role, activeTab, onTabChange }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleTabChange = (tab: string) => {
    if (onTabChange) onTabChange(tab);
    if (tab === 'dashboard') {
      navigate('/');
    } else {
      navigate(`/${tab}`);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex font-sans">
      <Sidebar 
        role={role} 
        activeTab={activeTab} 
        onTabChange={handleTabChange} 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      
      <main className="flex-1 lg:ml-72 flex flex-col min-h-screen min-w-0">
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-zinc-200 px-4 md:px-10 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 md:gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden p-2 -ml-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
            >
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <h1 className="text-xs md:text-sm font-semibold text-zinc-900 tracking-tight uppercase tracking-widest truncate">
              {activeTab === 'dashboard' ? 'Panel de Control' : 
               activeTab === 'schedules' ? 'Roles Semanales' :
               activeTab === 'payments' ? 'Pagos Internet' :
               activeTab === 'users' ? 'Gestión Inquilinos' : 'Configuración'}
            </h1>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
            <NotificationCenter />
            <div className="w-px h-6 bg-zinc-200 hidden md:block" />
            <button onClick={() => navigate('/settings')} className="flex items-center gap-3 group">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-semibold text-zinc-900 group-hover:text-zinc-600 transition-colors">{user?.name}</p>
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{user?.role}</p>
              </div>
              <div className="w-8 h-8 md:w-9 md:h-9 bg-zinc-900 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0">
                {user?.name?.charAt(0)}
              </div>
            </button>
          </div>
        </header>

        <div className="p-4 md:p-6 lg:p-10 max-w-7xl w-full mx-auto flex-1 min-w-0">
          {children}
        </div>
      </main>
    </div>
  );
};
