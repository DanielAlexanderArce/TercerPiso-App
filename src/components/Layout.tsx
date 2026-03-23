import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Role } from '../types';
import { useNavigate } from 'react-router-dom';
import { NotificationCenter } from './NotificationCenter';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
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
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar 
        role={role} 
        activeTab={activeTab} 
        onTabChange={handleTabChange} 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      
      <main className="flex-1 lg:ml-72 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-white/70 backdrop-blur-xl border-b border-slate-200/60 px-6 md:px-10 py-5 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Mobile Toggle Button */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden p-2.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
            >
              <motion.div
                animate={{ rotate: isSidebarOpen ? 90 : 0 }}
                transition={{ duration: 0.2 }}
              >
                {isSidebarOpen ? <X size={22} /> : <Menu size={22} />}
              </motion.div>
            </button>
            
            <div className="lg:hidden">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Gestión 3P</h1>
            </div>

            <div className="hidden lg:block">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                {activeTab === 'dashboard' ? 'Panel de Control' : 
                 activeTab === 'schedules' ? 'Roles Semanales' :
                 activeTab === 'payments' ? 'Pagos Internet' :
                 activeTab === 'users' ? 'Gestión Inquilinos' : 'Configuración'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 md:space-x-5">
            <NotificationCenter />
            <div className="h-6 w-[1px] bg-slate-200 mx-1 hidden md:block"></div>
            <div className="flex items-center space-x-3 group cursor-pointer" onClick={() => navigate('/settings')}>
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">{user?.name}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">{user?.role}</p>
              </div>
              <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-slate-200 group-hover:bg-emerald-600 transition-all">
                {user?.name?.charAt(0)}
              </div>
            </div>
          </div>
        </header>

        <div className="p-6 md:p-10 max-w-7xl w-full mx-auto flex-1">
          {children}
        </div>
      </main>
    </div>
  );
};
