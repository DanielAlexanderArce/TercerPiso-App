import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, orderBy, where, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Payment, User } from '../types';
import { Layout } from '../components/Layout';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, DollarSign, CheckCircle2, Clock, Filter, AlertCircle, Camera, Image as ImageIcon, X, Eye, Receipt, ArrowUpRight, Search, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { ConfirmModal } from '../components/ConfirmModal';
import { cn } from '../utils/cn';

export const Payments: React.FC = () => {
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL');
  
  const [confirmApprove, setConfirmApprove] = useState<{ isOpen: boolean; paymentId: string | null }>({
    isOpen: false,
    paymentId: null
  });

  // Form state
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [amount, setAmount] = useState(20); // Default amount
  const [selectedUserId, setSelectedUserId] = useState('');
  const [evidenceBase64, setEvidenceBase64] = useState<string | null>(null);
  const [viewingEvidence, setViewingEvidence] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'payments'), orderBy('month', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const paymentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
      setPayments(paymentsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'payments');
    });

    let unsubscribeUsers = () => {};
    if (user.role === 'ADMIN') {
      const qUsers = query(collection(db, 'users'));
      unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
        const usersData = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as User));
        setUsers(usersData);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'users');
      });
    }

    return () => {
      unsubscribe();
      unsubscribeUsers();
    };
  }, [user]);

  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const targetUserId = user.role === 'ADMIN' ? selectedUserId : user.uid;
    const targetUser = users.find(u => u.uid === targetUserId);

    const newPayment = {
      userId: targetUserId,
      userName: targetUser?.name || user.name,
      month,
      amount: Number(amount),
      status: user.role === 'ADMIN' ? 'COMPLETED' : 'PENDING',
      evidenceUrl: evidenceBase64,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    try {
      await addDoc(collection(db, 'payments'), newPayment);
      setIsModalOpen(false);
      setEvidenceBase64(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'payments');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, paymentId?: string) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1 * 1024 * 1024) {
        alert('La imagen es demasiado grande. El límite es 1MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        if (paymentId) {
          updateDoc(doc(db, 'payments', paymentId), { evidenceUrl: base64, updatedAt: Date.now() });
        } else {
          setEvidenceBase64(base64);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConfirmApprove = async () => {
    if (!confirmApprove.paymentId || user?.role !== 'ADMIN') return;
    try {
      const paymentRef = doc(db, 'payments', confirmApprove.paymentId);
      const paymentSnap = await getDoc(paymentRef);
      const paymentData = paymentSnap.data();

      await updateDoc(paymentRef, {
        status: 'COMPLETED',
        updatedAt: Date.now()
      });

      if (paymentData) {
        await addDoc(collection(db, 'notifications'), {
          userId: paymentData.userId,
          title: 'Pago Aprobado',
          message: `Tu pago de ${paymentData.month} ha sido aprobado.`,
          type: 'SUCCESS',
          read: false,
          createdAt: Date.now()
        });
      }

      setConfirmApprove({ isOpen: false, paymentId: null });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `payments/${confirmApprove.paymentId}`);
    }
  };

  const filteredPayments = (user?.role === 'ADMIN' ? payments : payments.filter(p => p.userId === user?.uid))
    .filter(p => {
      const matchesSearch = p.userName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'ALL' || p.status === filterStatus;
      return matchesSearch && matchesStatus;
    });

  return (
    <Layout role={user?.role || 'INQUILINO'} activeTab="payments">
      <div className="mb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Pagos de Internet</h1>
            <p className="text-slate-500 mt-1">Control mensual de cuotas y comprobantes de servicio.</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 active:scale-95 flex items-center gap-2"
          >
            <Plus size={20} />
            Registrar Nuevo Pago
          </button>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-8 md:mb-10">
          <div className="bg-white p-5 md:p-6 rounded-2xl md:rounded-[2rem] border border-slate-200/60 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Recaudado</p>
            <p className="text-2xl md:text-3xl font-black text-slate-900">${payments.filter(p => p.status === 'COMPLETED').reduce((acc, curr) => acc + curr.amount, 0)}</p>
          </div>
          <div className="bg-white p-5 md:p-6 rounded-2xl md:rounded-[2rem] border border-slate-200/60 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pendientes</p>
            <p className="text-2xl md:text-3xl font-black text-amber-500">{payments.filter(p => p.status === 'PENDING').length}</p>
          </div>
          <div className="bg-white p-5 md:p-6 rounded-2xl md:rounded-[2rem] border border-slate-200/60 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Este Mes</p>
            <p className="text-2xl md:text-3xl font-black text-emerald-500">{payments.filter(p => p.month === format(new Date(), 'yyyy-MM')).length}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col lg:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text"
              placeholder="Buscar por nombre de inquilino..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-[1.25rem] focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all shadow-sm"
            />
          </div>
          <div className="flex gap-2">
            {(['ALL', 'PENDING', 'COMPLETED'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={cn(
                  "px-5 py-3.5 rounded-[1.25rem] text-sm font-bold transition-all border shadow-sm",
                  filterStatus === status 
                    ? "bg-slate-900 text-white border-slate-900" 
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                )}
              >
                {status === 'ALL' ? 'Todos' : status === 'PENDING' ? 'Pendientes' : 'Completados'}
              </button>
            ))}
          </div>
        </div>

        {/* Payments List */}
        <div className="bg-white rounded-2xl md:rounded-[2.5rem] border border-slate-200/60 shadow-xl shadow-slate-200/40 overflow-hidden">
          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Inquilino</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Periodo</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Monto</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estado</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                <AnimatePresence mode="popLayout">
                  {filteredPayments.map((p) => (
                    <motion.tr 
                      key={p.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-slate-50/30 transition-colors group"
                    >
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 font-bold text-sm border border-slate-200">
                            {p.userName.charAt(0)}
                          </div>
                          <p className="font-bold text-slate-900">{p.userName}</p>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                          <CalendarIcon size={14} className="text-slate-300" />
                          {format(new Date(p.month + '-02'), 'MMMM yyyy', { locale: es })}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-lg font-black text-slate-900">
                          ${p.amount}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className={cn(
                          "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border flex items-center w-fit gap-1.5",
                          p.status === 'COMPLETED' 
                            ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                            : "bg-amber-50 text-amber-600 border-amber-100"
                        )}>
                          {p.status === 'COMPLETED' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                          {p.status === 'COMPLETED' ? 'Completado' : 'Pendiente'}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {p.evidenceUrl ? (
                            <button 
                              onClick={() => setViewingEvidence(p.evidenceUrl!)}
                              className="p-2.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                              title="Ver Comprobante"
                            >
                              <Receipt size={18} />
                            </button>
                          ) : (
                            (user?.uid === p.userId || user?.role === 'ADMIN') && (
                              <label className="cursor-pointer p-2.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all">
                                <Camera size={18} />
                                <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, p.id)} className="hidden" />
                              </label>
                            )
                          )}
                          {user?.role === 'ADMIN' && p.status === 'PENDING' && (
                            <button 
                              onClick={() => setConfirmApprove({ isOpen: true, paymentId: p.id })}
                              className="px-4 py-2 bg-emerald-500 text-white text-xs font-bold rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100"
                            >
                              Aprobar
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
            {filteredPayments.length === 0 && (
              <div className="py-20 text-center">
                <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                  <Receipt size={32} className="text-slate-200" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">No hay registros de pagos</h3>
                <p className="text-slate-500 mt-1">Los pagos registrados aparecerán en esta lista.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Register Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] p-8 md:p-10 shadow-2xl border border-white/20"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">Registrar Pago</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleRegisterPayment} className="space-y-6">
                {user?.role === 'ADMIN' && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Inquilino</label>
                    <select
                      required
                      value={selectedUserId || ''}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-medium"
                    >
                      <option value="">Seleccionar inquilino</option>
                      {users.map((u, i) => <option key={`${u.uid}-${i}`} value={u.uid || ''}>{u.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Mes correspondiente</label>
                  <input
                    type="month"
                    required
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Monto ($)</label>
                  <input
                    type="number"
                    required
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-medium"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Comprobante</label>
                  <div className="flex items-center gap-4">
                    <label className="flex-1 cursor-pointer bg-slate-50 hover:bg-slate-100 border border-slate-200 border-dashed p-4 rounded-2xl flex flex-col items-center justify-center transition-all group">
                      <Camera size={24} className="text-slate-300 group-hover:text-emerald-500 mb-2" />
                      <span className="text-xs font-bold text-slate-400 group-hover:text-slate-600">{evidenceBase64 ? 'Cambiar Foto' : 'Subir Foto'}</span>
                      <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                    </label>
                    {evidenceBase64 && (
                      <div className="relative w-20 h-20">
                        <img src={evidenceBase64} alt="Preview" className="w-full h-full object-cover rounded-2xl border border-slate-200 shadow-sm" />
                        <button type="button" onClick={() => setEvidenceBase64(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg"><X size={12} /></button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl transition-all">Cancelar</button>
                  <button type="submit" className="flex-1 py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-200">Registrar</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={confirmApprove.isOpen}
        title="Aprobar Pago"
        message="¿Deseas marcar este pago como completado?"
        onConfirm={handleConfirmApprove}
        onCancel={() => setConfirmApprove({ isOpen: false, paymentId: null })}
        type="info"
      />

      {/* Evidence Viewer */}
      <AnimatePresence>
        {viewingEvidence && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-xl">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative max-w-2xl w-full bg-white rounded-[2.5rem] overflow-hidden shadow-2xl">
              <button onClick={() => setViewingEvidence(null)} className="absolute top-6 right-6 p-2 bg-slate-900/10 hover:bg-slate-900/20 text-slate-900 rounded-full transition-colors z-10"><X size={24} /></button>
              <div className="p-8 md:p-12">
                <h3 className="text-2xl font-extrabold text-slate-900 mb-6">Comprobante de Pago</h3>
                <div className="rounded-3xl overflow-hidden border border-slate-100 shadow-inner">
                  <img src={viewingEvidence} alt="Evidencia" className="w-full h-auto max-h-[60vh] object-contain" referrerPolicy="no-referrer" />
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Layout>
  );
};
