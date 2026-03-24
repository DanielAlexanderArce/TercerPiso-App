import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, FileText, DollarSign, Users } from 'lucide-react';
import { Payment, User } from '../types';

interface ReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
  payments: Payment[];
  users: User[];
}

export const ReportsModal: React.FC<ReportsModalProps> = ({ isOpen, onClose, payments, users }) => {
  const totalCollected = payments.filter(p => p.status === 'COMPLETED').reduce((acc, curr) => acc + curr.amount, 0);
  const pendingPayments = payments.filter(p => p.status === 'PENDING').length;
  const totalUsers = users.length;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 md:p-10 shadow-2xl border border-white/20"
          >
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                <FileText className="text-emerald-500" />
                Reportes del Sistema
              </h3>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400"
              >
                <X size={24} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                  <DollarSign size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Recaudado</p>
                  <p className="text-xl font-black text-slate-900">${totalCollected}</p>
                </div>
              </div>
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
                  <DollarSign size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pagos Pendientes</p>
                  <p className="text-xl font-black text-slate-900">{pendingPayments}</p>
                </div>
              </div>
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-200 text-slate-600 rounded-xl flex items-center justify-center">
                  <Users size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Inquilinos</p>
                  <p className="text-xl font-black text-slate-900">{totalUsers}</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
