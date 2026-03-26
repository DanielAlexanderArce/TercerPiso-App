import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar as CalendarIcon, Plus, Trash2, Edit2, CheckCircle2, Clock, Upload, Image as ImageIcon, Info, X, Loader2 } from 'lucide-react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { format, startOfWeek, endOfWeek, isSameDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { cn } from '../utils/cn';
import { ConfirmModal } from '../components/ConfirmModal';

interface Assignment {
  role: 'Limpieza de Baño' | 'Limpieza de Pasadizo y Lavandería';
  status: 'PENDING' | 'COMPLETED' | 'REJECTED';
  evidenceUrls?: string[];
  completedAt?: number;
  verified?: boolean;
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
  const { user, loading } = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [assignedUserId, setAssignedUserId] = useState('');
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [isUploading, setIsUploading] = useState<{ scheduleId: string, role: string } | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ 
    isOpen: boolean; 
    title: string; 
    message: string; 
    onConfirm: () => void;
    type: 'danger' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'info'
  });

  if (loading) return null;

  useEffect(() => {
    const q = query(collection(db, 'schedules'), orderBy('weekStart', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSchedules(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Schedule)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'schedules');
    });

    let unsubscribeUsers = () => {};
    if (user?.role === 'ADMIN') {
      const qUsers = query(collection(db, 'users'));
      unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
        setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'users');
      });
    }

    return () => {
      unsubscribe();
      unsubscribeUsers();
    };
  }, [user]);

  const currentWeekSchedules = useMemo(() => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
    return schedules.filter(s => {
      const sStart = parseISO(s.weekStart);
      return isSameDay(sStart, start);
    });
  }, [schedules, selectedDate]);

  const notifyUser = async (schedule: any, title: string, message: string, type: 'INFO' | 'SUCCESS' | 'ERROR' = 'INFO') => {
    try {
      await addDoc(collection(db, 'notifications'), {
        userId: schedule.assignedUserId,
        title,
        message,
        type,
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
        { role: 'Limpieza de Pasadizo y Lavandería', status: 'PENDING' }
      ],
      updatedAt: Date.now()
    };

    try {
      if (editingSchedule) {
        const mergedAssignments = scheduleData.assignments.map(newA => {
          const oldA = editingSchedule.assignments.find(a => a.role === newA.role);
          return oldA ? { ...newA, ...oldA } : newA;
        });
        await updateDoc(doc(db, 'schedules', editingSchedule.id), { ...scheduleData, assignments: mergedAssignments });
        await notifyUser(
          { ...scheduleData, id: editingSchedule.id }, 
          'Rol Semanal Actualizado', 
          `Se ha actualizado tu rol de limpieza para la semana del ${format(parseISO(weekStart), 'dd/MM/yyyy')}.`
        );
      } else {
        const docRef = await addDoc(collection(db, 'schedules'), { ...scheduleData, createdAt: Date.now() });
        await notifyUser(
          { ...scheduleData, id: docRef.id }, 
          'Nuevo Rol Semanal Asignado', 
          `Se te han asignado los roles de limpieza para la semana del ${format(parseISO(weekStart), 'dd/MM/yyyy')}.`
        );
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

    if (file.size > 1 * 1024 * 1024) {
      alert('La imagen es demasiado grande. El límite es 1MB.');
      return;
    }

    setIsUploading({ scheduleId, role });

    try {
      const storage = getStorage();
      const storageRef = ref(storage, `evidence/${scheduleId}/${role}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);
      
      const schedule = schedules.find(s => s.id === scheduleId);
      if (!schedule) return;

      const updatedAssignments = schedule.assignments.map(a => {
        if (a.role === role) {
          const currentUrls = a.evidenceUrls || [];
          if (currentUrls.length >= 3) {
            alert('Ya has subido el máximo de 3 fotos para este rol.');
            return a;
          }
          return {
            ...a,
            evidenceUrls: [...currentUrls, downloadUrl]
          };
        }
        return a;
      });

      await updateDoc(doc(db, 'schedules', scheduleId), {
        assignments: updatedAssignments,
        updatedAt: Date.now()
      });
      
      setIsUploading(null);
    } catch (error) {
      console.error('Error uploading evidence:', error);
      setIsUploading(null);
      handleFirestoreError(error, OperationType.UPDATE, `schedules/${scheduleId}`);
    }
  };

  const handleMarkCompleted = async (scheduleId: string, role: string) => {
    try {
      const schedule = schedules.find(s => s.id === scheduleId);
      if (!schedule) return;

      const updatedAssignments = schedule.assignments.map(a => {
        if (a.role === role) {
          return {
            ...a,
            status: 'COMPLETED' as const,
            completedAt: Date.now(),
            verified: false // Reset verification if updated
          };
        }
        return a;
      });

      await updateDoc(doc(db, 'schedules', scheduleId), {
        assignments: updatedAssignments,
        updatedAt: Date.now()
      });
    } catch (error) {
      console.error('Error marking as completed:', error);
      handleFirestoreError(error, OperationType.UPDATE, `schedules/${scheduleId}`);
    }
  };

  const handleAdminVerify = async (scheduleId: string, role: string, action: 'VERIFY' | 'REJECT') => {
    try {
      const schedule = schedules.find(s => s.id === scheduleId);
      if (!schedule) return;

      const updatedAssignments = schedule.assignments.map(a => {
        if (a.role === role) {
          return {
            ...a,
            status: action === 'VERIFY' ? 'COMPLETED' : 'REJECTED',
            verified: action === 'VERIFY'
          };
        }
        return a;
      });

      await updateDoc(doc(db, 'schedules', scheduleId), {
        assignments: updatedAssignments,
        updatedAt: Date.now()
      });

      await notifyUser(
        schedule, 
        action === 'VERIFY' ? 'Limpieza Verificada' : 'Limpieza Rechazada', 
        action === 'VERIFY' 
          ? `Tu limpieza de "${role}" ha sido verificada por el administrador.` 
          : `Tu limpieza de "${role}" ha sido rechazada. Por favor, revisa la evidencia.`,
        action === 'VERIFY' ? 'SUCCESS' : 'ERROR'
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `schedules/${scheduleId}`);
    }
  };

  const handleDeleteSchedule = async () => {
    if (!confirmAction.onConfirm) return;
    confirmAction.onConfirm();
  };

  const openEditModal = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setSelectedDate(parseISO(schedule.weekStart));
    setAssignedUserId(schedule.assignedUserId);
    setIsModalOpen(true);
  };

  return (
    <Layout role={user?.role || 'INQUILINO'} activeTab="schedules">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Roles de Limpieza</h1>
            <p className="text-zinc-500 font-medium">Rotación semanal de limpieza de áreas comunes.</p>
          </div>
          {user?.role === 'ADMIN' && (
            <button
              onClick={() => {
                setEditingSchedule(null);
                setAssignedUserId('');
                setIsModalOpen(true);
              }}
              className="w-full md:w-auto px-6 py-3 bg-zinc-900 text-white rounded-xl font-semibold hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={18} /> Asignar Semana
            </button>
          )}
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm">
              <Calendar 
                onChange={(val) => setSelectedDate(val as Date)} 
                value={selectedDate}
                locale="es-ES"
                className="w-full border-none"
              />
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <AnimatePresence mode="popLayout">
              {currentWeekSchedules.length > 0 ? (
                currentWeekSchedules.map((schedule) => (
                  <motion.div
                    key={schedule.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white p-8 rounded-3xl border border-zinc-100 shadow-sm"
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h4 className="text-xl font-bold text-zinc-900">{schedule.assignedUserName}</h4>
                        <p className="text-zinc-500 text-sm font-medium">Inquilino Responsable</p>
                      </div>
                      {user?.role === 'ADMIN' && (
                        <div className="flex gap-2">
                          <button onClick={() => openEditModal(schedule)} className="p-2 text-zinc-400 hover:text-zinc-900"><Edit2 size={18} /></button>
                          <button 
                            onClick={() => setConfirmAction({
                              isOpen: true,
                              title: 'Eliminar Asignación',
                              message: '¿Estás seguro de que deseas eliminar esta asignación semanal?',
                              type: 'danger',
                              onConfirm: async () => {
                                try {
                                  await deleteDoc(doc(db, 'schedules', schedule.id));
                                  setConfirmAction(prev => ({ ...prev, isOpen: false }));
                                } catch (error) {
                                  handleFirestoreError(error, OperationType.DELETE, `schedules/${schedule.id}`);
                                }
                              }
                            })} 
                            className="p-2 text-zinc-400 hover:text-red-600"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {schedule.assignments.map((assign, idx) => {
                        const isAssignedUser = user && (user.uid === schedule.assignedUserId || user.email === schedule.assignedUserId);
                        const hasEvidence = assign.evidenceUrls && assign.evidenceUrls.length > 0;
                        const isUploadingThis = isUploading?.scheduleId === schedule.id && isUploading?.role === assign.role;

                        return (
                          <div key={idx} className="p-6 bg-zinc-50 rounded-2xl border border-zinc-100 flex flex-col h-full">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "p-2 rounded-lg", 
                                  assign.status === 'COMPLETED' ? "bg-emerald-100 text-emerald-600" : 
                                  assign.status === 'REJECTED' ? "bg-red-100 text-red-600" :
                                  "bg-zinc-200 text-zinc-500"
                                )}>
                                  {assign.status === 'COMPLETED' ? <CheckCircle2 size={20} /> : 
                                   assign.status === 'REJECTED' ? <X size={20} /> :
                                   <Clock size={20} />}
                                </div>
                                <p className="font-bold text-zinc-900 text-sm">{assign.role}</p>
                              </div>
                              {assign.verified && (
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-wider rounded-md">Verificado</span>
                              )}
                            </div>
                            
                            <div className="flex-1">
                              {hasEvidence ? (
                                <div className="grid grid-cols-3 gap-2 mb-4">
                                  {assign.evidenceUrls!.map((url, uIdx) => (
                                    <img key={uIdx} src={url} alt="Evidencia" className="w-full aspect-square object-cover rounded-lg shadow-sm" referrerPolicy="no-referrer" />
                                  ))}
                                </div>
                              ) : (
                                <div className="aspect-video rounded-xl border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center mb-4 text-zinc-400 bg-white">
                                  <ImageIcon size={20} />
                                  <p className="text-[10px] font-bold uppercase mt-1">Sin Evidencia</p>
                                </div>
                              )}
                            </div>

                            {/* Inquilino Actions */}
                            {isAssignedUser && assign.status !== 'COMPLETED' && (
                              <div className="space-y-2 mt-auto pt-4 border-t border-zinc-200/60">
                                <div className="relative">
                                  <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                                    onChange={(e) => handleFileUpload(schedule.id, assign.role, e)} 
                                    disabled={isUploadingThis} 
                                  />
                                  <button type="button" className="w-full py-2.5 bg-white border border-zinc-200 text-zinc-700 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-zinc-50 transition-colors shadow-sm">
                                    {isUploadingThis ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />} 
                                    {hasEvidence ? 'Subir más evidencia' : 'Subir Evidencia'}
                                  </button>
                                </div>
                                
                                {hasEvidence && (
                                  <button 
                                    onClick={() => handleMarkCompleted(schedule.id, assign.role)}
                                    className="w-full py-2.5 bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-emerald-600 transition-colors shadow-sm shadow-emerald-500/20"
                                  >
                                    <CheckCircle2 size={14} /> Marcar como Completada
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Admin Actions */}
                            {user?.role === 'ADMIN' && assign.status === 'COMPLETED' && !assign.verified && (
                              <div className="flex gap-2 mt-auto pt-4 border-t border-zinc-200/60">
                                <button 
                                  onClick={() => handleAdminVerify(schedule.id, assign.role, 'VERIFY')}
                                  className="flex-1 py-2 bg-emerald-500 text-white rounded-xl font-bold text-[10px] uppercase tracking-wider hover:bg-emerald-600 transition-colors"
                                >
                                  Verificar
                                </button>
                                <button 
                                  onClick={() => handleAdminVerify(schedule.id, assign.role, 'REJECT')}
                                  className="flex-1 py-2 bg-red-500 text-white rounded-xl font-bold text-[10px] uppercase tracking-wider hover:bg-red-600 transition-colors"
                                >
                                  Rechazar
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="text-center py-16 bg-white rounded-3xl border border-zinc-100">
                  <p className="text-zinc-500">No hay asignaciones para esta semana.</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      
      {/* Assignment Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl border border-zinc-100"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-zinc-900">{editingSchedule ? 'Cambiar Responsable' : 'Asignar Responsable'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-zinc-100 rounded-full"><X size={20} /></button>
              </div>
              <div className="space-y-4">
                <select value={assignedUserId} onChange={(e) => setAssignedUserId(e.target.value)} className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold">
                  <option value="">Seleccionar inquilino...</option>
                  {users.map((u) => <option key={u.uid} value={u.uid}>{u.name}</option>)}
                </select>
                <button onClick={handleSaveSchedule} disabled={!assignedUserId} className="w-full py-3 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 disabled:opacity-50">
                  {editingSchedule ? 'Actualizar' : 'Asignar'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={confirmAction.isOpen}
        title={confirmAction.title}
        message={confirmAction.message}
        onConfirm={handleDeleteSchedule}
        onCancel={() => setConfirmAction(prev => ({ ...prev, isOpen: false }))}
        type={confirmAction.type}
      />
    </Layout>
  );
};
