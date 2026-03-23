import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar as CalendarIcon, Plus, Trash2, Edit2, Check, X, Bell, User as UserIcon, MapPin, Sparkles, ChevronRight, Info, Upload, Image as ImageIcon, CheckCircle2, Clock } from 'lucide-react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { format, startOfWeek, endOfWeek, addDays, isSameDay, isWithinInterval, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { cn } from '../utils/cn';
import { ConfirmModal } from '../components/ConfirmModal';

interface Assignment {
  role: 'Limpieza de Baño' | 'Limpieza de Pasadizo';
  status: 'PENDING' | 'COMPLETED';
  evidenceUrl?: string;
  completedAt?: number;
}

interface Schedule {
  id: string;
  weekStart: string;
  weekEnd: string;
  assignedUserId: string;
  assignedUserName: string;
  assignments: Assignment[];
  createdAt: number;
  updatedAt?: number;
}

export const SchedulePage: React.FC = () => {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [assignedUserId, setAssignedUserId] = useState('');
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [isUploading, setIsUploading] = useState<{ scheduleId: string, role: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; id: string | null }>({
    isOpen: false,
    id: null
  });

  useEffect(() => {
    const q = query(collection(db, 'schedules'), orderBy('weekStart', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSchedules(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Schedule)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'schedules');
    });

    const qUsers = query(collection(db, 'users'));
    const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => {
      unsubscribe();
      unsubscribeUsers();
    };
  }, []);

  const currentWeekSchedules = useMemo(() => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
    return schedules.filter(s => {
      const sStart = parseISO(s.weekStart);
      return isSameDay(sStart, start);
    });
  }, [schedules, selectedDate]);

  const notifyUser = async (schedule: any, isUpdate = false) => {
    try {
      await addDoc(collection(db, 'notifications'), {
        userId: schedule.assignedUserId,
        title: isUpdate ? 'Rol Semanal Actualizado' : 'Nuevo Rol Semanal Asignado',
        message: `Se te han asignado los roles de limpieza para la semana del ${format(parseISO(schedule.weekStart), 'dd/MM/yyyy')}. Por favor, revisa tus tareas.`,
        type: 'INFO',
        read: false,
        createdAt: Date.now()
      });
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  };

  const handleSaveSchedule = async () => {
    if (!assignedUserId) return;

    const weekStart = format(startOfWeek(selectedDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekEnd = format(endOfWeek(selectedDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const selectedUser = users.find(u => u.uid === assignedUserId);

    const scheduleData = {
      weekStart,
      weekEnd,
      assignedUserId,
      assignedUserName: selectedUser?.name || 'Inquilino',
      assignments: [
        { role: 'Limpieza de Baño', status: 'PENDING' },
        { role: 'Limpieza de Pasadizo', status: 'PENDING' }
      ],
      updatedAt: Date.now()
    };

    try {
      if (editingSchedule) {
        // Keep existing evidence if updating assignments
        const mergedAssignments = scheduleData.assignments.map(newA => {
          const oldA = editingSchedule.assignments.find(a => a.role === newA.role);
          return oldA ? { ...newA, ...oldA } : newA;
        });
        await updateDoc(doc(db, 'schedules', editingSchedule.id), { ...scheduleData, assignments: mergedAssignments });
        await notifyUser({ ...scheduleData, id: editingSchedule.id }, true);
      } else {
        const docRef = await addDoc(collection(db, 'schedules'), { ...scheduleData, createdAt: Date.now() });
        await notifyUser({ ...scheduleData, id: docRef.id });
      }
      setIsModalOpen(false);
      setAssignedUserId('');
      setEditingSchedule(null);
    } catch (error) {
      handleFirestoreError(error, editingSchedule ? OperationType.UPDATE : OperationType.CREATE, 'schedules');
    }
  };

  const handleFileUpload = async (scheduleId: string, role: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading({ scheduleId, role });

    try {
      // Simulate upload and get a data URL (limited to 100KB for Firestore safety)
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        
        const schedule = schedules.find(s => s.id === scheduleId);
        if (!schedule) return;

        const updatedAssignments = schedule.assignments.map(a => {
          if (a.role === role) {
            return {
              ...a,
              status: 'COMPLETED' as const,
              evidenceUrl: base64String,
              completedAt: Date.now()
            };
          }
          return a;
        });

        await updateDoc(doc(db, 'schedules', scheduleId), {
          assignments: updatedAssignments,
          updatedAt: Date.now()
        });
        
        setIsUploading(null);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading evidence:', error);
      setIsUploading(null);
      alert('Error al subir evidencia. Intenta con una imagen más pequeña.');
    }
  };

  const handleDeleteSchedule = async () => {
    if (!confirmDelete.id) return;
    try {
      await deleteDoc(doc(db, 'schedules', confirmDelete.id));
      setConfirmDelete({ isOpen: false, id: null });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `schedules/${confirmDelete.id}`);
    }
  };

  const openEditModal = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setSelectedDate(parseISO(schedule.weekStart));
    setAssignedUserId(schedule.assignedUserId);
    setIsModalOpen(true);
  };

  return (
    <Layout role={user?.role || 'INQUILINO'} activeTab="schedules">
      <div className="mb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Roles de Limpieza</h1>
            <p className="text-slate-500 mt-1">Rotación semanal de limpieza de baño y pasadizo.</p>
          </div>
          {user?.role === 'ADMIN' && (
            <button
              onClick={() => {
                setEditingSchedule(null);
                setAssignedUserId('');
                setIsModalOpen(true);
              }}
              className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 active:scale-95 flex items-center gap-2"
            >
              <Plus size={20} />
              Asignar Semana
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Calendar Section */}
          <div className="lg:col-span-4">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200/60 shadow-sm sticky top-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <CalendarIcon size={20} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Calendario</h3>
              </div>
              <Calendar 
                onChange={(val) => setSelectedDate(val as Date)} 
                value={selectedDate}
                locale="es-ES"
                className="w-full"
              />
              <div className="mt-8 p-5 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3">
                <Info size={18} className="text-slate-400 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-500 leading-relaxed">
                  Selecciona una fecha para ver quién es el responsable de la limpieza esa semana.
                </p>
              </div>
            </div>
          </div>

          {/* Assignments Section */}
          <div className="lg:col-span-8 space-y-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-widest text-[10px]">
                Responsable de la semana
              </h2>
              <span className="text-sm font-bold text-slate-400">
                {format(startOfWeek(selectedDate, { weekStartsOn: 1 }), 'dd MMM', { locale: es })} - {format(endOfWeek(selectedDate, { weekStartsOn: 1 }), 'dd MMM', { locale: es })}
              </span>
            </div>

            <AnimatePresence mode="popLayout">
              {currentWeekSchedules.length > 0 ? (
                currentWeekSchedules.map((schedule) => (
                  <motion.div
                    key={schedule.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-200/60 shadow-xl shadow-slate-200/40 relative group"
                  >
                    <div className="flex justify-between items-start mb-8">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-slate-200">
                          <UserIcon size={28} />
                        </div>
                        <div>
                          <h4 className="text-2xl font-black text-slate-900 tracking-tight">
                            {schedule.assignedUserName}
                          </h4>
                          <p className="text-emerald-600 text-xs font-bold uppercase tracking-widest mt-0.5">
                            Inquilino Responsable
                          </p>
                        </div>
                      </div>
                      {user?.role === 'ADMIN' && (
                        <div className="flex gap-2">
                          <button 
                            onClick={() => openEditModal(schedule)}
                            className="p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all"
                            title="Cambiar Responsable"
                          >
                            <Edit2 size={20} />
                          </button>
                          <button 
                            onClick={() => setConfirmDelete({ isOpen: true, id: schedule.id })}
                            className="p-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                            title="Eliminar Asignación"
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {schedule.assignments.map((assign, idx) => (
                        <div key={idx} className="p-6 bg-slate-50/50 rounded-[2rem] border border-slate-100 hover:border-emerald-200 transition-all group/item">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                                assign.status === 'COMPLETED' ? "bg-emerald-100 text-emerald-600" : "bg-white text-slate-400 shadow-sm border border-slate-100"
                              )}>
                                {assign.status === 'COMPLETED' ? <CheckCircle2 size={20} /> : <Clock size={20} />}
                              </div>
                              <div>
                                <p className="font-bold text-slate-900 text-sm">{assign.role}</p>
                                <p className={cn(
                                  "text-[10px] font-black uppercase tracking-widest",
                                  assign.status === 'COMPLETED' ? "text-emerald-600" : "text-slate-400"
                                )}>
                                  {assign.status === 'COMPLETED' ? 'Completado' : 'Pendiente'}
                                </p>
                              </div>
                            </div>
                          </div>

                          {assign.evidenceUrl ? (
                            <div className="relative aspect-video rounded-2xl overflow-hidden border border-slate-200 mb-4">
                              <img 
                                src={assign.evidenceUrl} 
                                alt="Evidencia" 
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/item:opacity-100 transition-opacity flex items-center justify-center">
                                <button 
                                  onClick={() => window.open(assign.evidenceUrl, '_blank')}
                                  className="p-2 bg-white rounded-lg text-slate-900 font-bold text-xs"
                                >
                                  Ver Ampliado
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="aspect-video rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center mb-4 bg-white/50">
                              <ImageIcon size={24} className="text-slate-200 mb-2" />
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sin Evidencia</p>
                            </div>
                          )}

                          {(user?.uid === schedule.assignedUserId || user?.email === schedule.assignedUserId) && assign.status === 'PENDING' && (
                            <div className="relative">
                              <input 
                                type="file" 
                                accept="image/*"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                onChange={(e) => handleFileUpload(schedule.id, assign.role, e)}
                                disabled={isUploading?.scheduleId === schedule.id && isUploading?.role === assign.role}
                              />
                              <button className={cn(
                                "w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all",
                                isUploading?.scheduleId === schedule.id && isUploading?.role === assign.role
                                  ? "bg-slate-100 text-slate-400"
                                  : "bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-200"
                              )}>
                                {isUploading?.scheduleId === schedule.id && isUploading?.role === assign.role ? (
                                  <>Subiendo...</>
                                ) : (
                                  <>
                                    <Upload size={14} />
                                    Subir Evidencia
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ))
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-slate-50/50 border-2 border-dashed border-slate-200 rounded-[2.5rem] p-16 text-center"
                >
                  <div className="w-20 h-20 bg-white rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-sm border border-slate-100">
                    <CalendarIcon size={32} className="text-slate-200" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Sin asignaciones</h3>
                  <p className="text-slate-500 mt-2 max-w-xs mx-auto">
                    No se ha asignado un responsable para esta semana. {user?.role === 'ADMIN' ? '¡Elige a alguien ahora!' : 'Contacta al administrador.'}
                  </p>
                  {user?.role === 'ADMIN' && (
                    <button
                      onClick={() => setIsModalOpen(true)}
                      className="mt-8 px-6 py-3 bg-white text-slate-900 border border-slate-200 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all shadow-sm active:scale-95"
                    >
                      Asignar ahora
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Assignment Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] p-8 md:p-10 shadow-2xl border border-white/20"
            >
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                    {editingSchedule ? 'Cambiar Responsable' : 'Asignar Responsable'}
                  </h3>
                  <p className="text-slate-500 text-sm mt-1">
                    Semana del {format(startOfWeek(selectedDate, { weekStartsOn: 1 }), 'dd MMM', { locale: es })} al {format(endOfWeek(selectedDate, { weekStartsOn: 1 }), 'dd MMM', { locale: es })}
                  </p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Seleccionar Inquilino</label>
                  <select
                    value={assignedUserId}
                    onChange={(e) => setAssignedUserId(e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-900 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
                  >
                    <option value="">Seleccionar...</option>
                    {users.map((u, i) => (
                      <option key={`${u.uid}-${i}`} value={u.uid}>{u.name}</option>
                    ))}
                  </select>
                </div>

                <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-100">
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">Roles Asignados Automáticamente:</p>
                  <ul className="space-y-1">
                    <li className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                      Limpieza de Baño
                    </li>
                    <li className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                      Limpieza de Pasadizo
                    </li>
                  </ul>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveSchedule}
                    disabled={!assignedUserId}
                    className="flex-1 py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 disabled:opacity-50 active:scale-95"
                  >
                    {editingSchedule ? 'Actualizar' : 'Asignar'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        title="Eliminar Asignación"
        message="¿Estás seguro de que deseas eliminar esta asignación semanal? Esta acción no se puede deshacer."
        onConfirm={handleDeleteSchedule}
        onCancel={() => setConfirmDelete({ isOpen: false, id: null })}
        type="danger"
      />
    </Layout>
  );
};
