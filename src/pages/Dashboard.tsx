import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Layout } from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Users, ArrowRight, Calendar, Bell, Shield, CheckCircle2, Clock, AlertTriangle, Sparkles } from 'lucide-react';
import { collection, query, where, getDocs, limit, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { format, startOfWeek, endOfWeek, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { cn } from '../utils/cn';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [currentSchedule, setCurrentSchedule] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCurrentSchedule = async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const q = query(
        collection(db, 'schedules'),
        where('weekStart', '<=', today),
        orderBy('weekStart', 'desc'),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setCurrentSchedule(snapshot.docs[0].data());
      }
    };
    fetchCurrentSchedule();
  }, []);

  if (!user) return null;

  const myAssignment = currentSchedule?.assignments?.find((a: any) => a.userId === user.uid);

  return (
    <Layout role={user.role} activeTab="dashboard">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto"
      >
        {/* Welcome Header */}
        <header className="mb-8 md:mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2 md:mb-3">
              <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 text-[10px] font-black uppercase tracking-widest rounded-full border border-emerald-100">
                Sistema Activo
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {format(new Date(), "MMMM yyyy", { locale: es })}
              </span>
            </div>
            <h1 className="text-2xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
              ¡Hola, <span className="text-emerald-600">{user.name.split(' ')[0]}</span>!
            </h1>
            <p className="text-slate-500 mt-1 md:mt-2 text-base md:text-lg font-medium">
              Bienvenido de nuevo a la gestión del <span className="text-slate-900 font-bold">Tercer Piso</span>.
            </p>
          </div>
          
          {user.role === 'ADMIN' && (
            <div className="flex items-center gap-3">
              <button 
                onClick={() => navigate('/users')}
                className="w-full md:w-auto px-6 py-3.5 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 active:scale-95 flex items-center justify-center gap-2"
              >
                <Users size={18} />
                Gestionar Inquilinos
              </button>
            </div>
          )}
        </header>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* Main Status Card */}
          <div className="md:col-span-8 bg-slate-900 text-white p-6 md:p-12 rounded-[2rem] md:rounded-[3rem] shadow-2xl relative overflow-hidden group min-h-[300px] md:min-h-[400px] flex flex-col justify-between">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6 md:mb-10">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-white/10 rounded-xl md:rounded-2xl flex items-center justify-center border border-white/10">
                    <Shield size={20} className="text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-lg md:text-2xl font-extrabold tracking-tight">Tu Estado Actual</h3>
                    <p className="text-slate-400 text-[10px] md:text-sm font-medium">Resumen de responsabilidades</p>
                  </div>
                </div>
                <div className="hidden sm:block">
                  <Clock className="text-white/20" size={40} />
                </div>
              </div>

              {myAssignment ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                  <div className="bg-white/5 p-5 md:p-8 rounded-2xl md:rounded-[2rem] border border-white/10 hover:bg-white/10 transition-colors">
                    <p className="text-emerald-400 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] mb-1 md:mb-3">Rol Semanal</p>
                    <p className="text-lg md:text-3xl font-bold tracking-tight mb-1 md:mb-2">{myAssignment.role}</p>
                    <div className="flex items-center gap-2 text-slate-400 text-[10px] md:text-sm">
                      <CheckCircle2 size={12} />
                      <span>Pendiente de revisión</span>
                    </div>
                  </div>
                  <div className="bg-white/5 p-5 md:p-8 rounded-2xl md:rounded-[2rem] border border-white/10 hover:bg-white/10 transition-colors">
                    <p className="text-emerald-400 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] mb-1 md:mb-3">Área Asignada</p>
                    <p className="text-lg md:text-3xl font-bold tracking-tight mb-1 md:mb-2">{myAssignment.area}</p>
                    <div className="flex items-center gap-2 text-slate-400 text-[10px] md:text-sm">
                      <AlertTriangle size={12} />
                      <span>Mantener orden</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-6 md:py-12 text-center bg-white/5 rounded-2xl md:rounded-[2rem] border border-white/10 border-dashed">
                  <Bell size={24} className="mx-auto text-white/10 mb-2 md:mb-4" />
                  <p className="text-slate-400 text-xs md:text-sm font-medium px-4">No tienes roles asignados para esta semana.</p>
                </div>
              )}
            </div>

            <div className="relative z-10 mt-6 md:mt-10 pt-4 md:pt-8 border-t border-white/10 flex items-center justify-between">
              <p className="text-slate-400 text-[10px] md:text-sm font-medium max-w-[180px] md:max-w-md">
                Recuerda que la convivencia armoniosa depende del compromiso de todos.
              </p>
              <button 
                onClick={() => navigate('/schedules')}
                className="w-10 h-10 md:w-12 md:h-12 bg-white text-slate-900 rounded-xl md:rounded-2xl flex items-center justify-center hover:bg-emerald-400 hover:text-white transition-all shadow-xl active:scale-90"
              >
                <ArrowRight size={18} />
              </button>
            </div>

            {/* Decorative Elements */}
            <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-[100px] group-hover:bg-emerald-500/20 transition-all duration-1000"></div>
            <div className="absolute -left-10 -top-10 w-40 h-40 bg-blue-500/10 rounded-full blur-[80px]"></div>
          </div>

          {/* Quick Actions Column */}
          <div className="md:col-span-4 flex flex-col gap-6">
            <button 
              onClick={() => navigate('/payments')}
              className="flex-1 bg-white p-6 md:p-8 rounded-2xl md:rounded-[2.5rem] border border-slate-200/60 shadow-xl shadow-slate-200/40 text-left group hover:border-emerald-500/50 transition-all"
            >
              <div className="w-12 h-12 md:w-14 md:h-14 bg-emerald-50 text-emerald-600 rounded-xl md:rounded-2xl flex items-center justify-center mb-4 md:mb-6 border border-emerald-100 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                <CreditCard size={24} md:size={28} />
              </div>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 md:mb-2">Pagos Internet</h3>
              <div className="flex items-center justify-between">
                <p className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">Estado Mensual</p>
                <ArrowRight className="text-slate-300 group-hover:text-slate-900 group-hover:translate-x-1 transition-all" size={18} />
              </div>
            </button>

            <div className="flex-1 bg-white p-6 md:p-8 rounded-2xl md:rounded-[2.5rem] border border-slate-200/60 shadow-xl shadow-slate-200/40 flex flex-col justify-between">
              <div>
                <h3 className="text-lg md:text-xl font-extrabold text-slate-900 tracking-tight mb-4 md:mb-6 flex items-center gap-2">
                  <Bell size={18} className="text-emerald-500" />
                  Reglas de Oro
                </h3>
                <div className="space-y-4 md:space-y-5">
                  {[
                    { id: '01', text: 'Limpieza profunda de áreas.' },
                    { id: '02', text: 'Respetar horarios de descanso.' },
                    { id: '03', text: 'Pago puntual de servicios.' }
                  ].map((rule) => (
                    <div key={rule.id} className="flex items-start gap-3 md:gap-4 group">
                      <span className="text-slate-200 font-black text-2xl md:text-3xl leading-none group-hover:text-emerald-500 transition-colors">{rule.id}</span>
                      <p className="text-slate-600 text-xs md:text-sm font-bold pt-1 leading-snug">{rule.text}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-6 md:mt-8 pt-4 md:pt-6 border-t border-slate-50">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest italic">"La armonía depende de todos"</p>
              </div>
            </div>
          </div>

        </div>
      </motion.div>
    </Layout>
  );
};
