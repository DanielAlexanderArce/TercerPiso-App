import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Layout } from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Users, ArrowRight, Calendar, Bell, Shield, CheckCircle2, Clock, AlertTriangle, FileText, Sparkles, Home, Upload, Loader2, X } from 'lucide-react';
import { collection, query, where, getDocs, limit, orderBy, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db } from '../firebase';
import { format, isSameWeek, parseISO, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { Payment, User } from '../types';
import { cn } from '../utils/cn';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [currentSchedule, setCurrentSchedule] = useState<any>(null);
  const [pendingPayments, setPendingPayments] = useState<Payment[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState<{ scheduleId: string, role: string } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    // Fetch current week's schedule
    const today = new Date();
    const startOfCurrentWeek = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    
    const qSchedules = query(
      collection(db, 'schedules'), 
      where('weekStart', '==', startOfCurrentWeek),
      limit(1)
    );
    
    const unsubscribeSchedules = onSnapshot(qSchedules, (snapshot) => {
      if (!snapshot.empty) {
        setCurrentSchedule({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
      } else {
        setCurrentSchedule(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'schedules');
    });

    // Fetch pending payments
    let qPayments;
    if (user.role === 'ADMIN') {
      qPayments = query(collection(db, 'payments'), where('status', '==', 'PENDING'));
    } else {
      qPayments = query(collection(db, 'payments'), where('userId', '==', user.uid), where('status', '==', 'PENDING'));
    }
    
    const unsubscribePayments = onSnapshot(qPayments, (snapshot) => {
      setPendingPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'payments');
    });

    // Fetch recent notifications
    const qNotifs = query(
      collection(db, 'notifications'), 
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(3)
    );
    const unsubscribeNotifs = onSnapshot(qNotifs, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notifications');
    });

    return () => {
      unsubscribeSchedules();
      unsubscribePayments();
      unsubscribeNotifs();
    };
  }, [user]);

  if (!user) return null;

  const isMySchedule = currentSchedule && (
    currentSchedule.assignedUserId === user.uid || 
    currentSchedule.assignedUserId === user.email ||
    (user.email && currentSchedule.assignedUserName && user.email.toLowerCase() === currentSchedule.assignedUserName.trim().toLowerCase()) ||
    (user.name && currentSchedule.assignedUserName && user.name.trim().toLowerCase() === currentSchedule.assignedUserName.trim().toLowerCase())
  );
  const myAssignments = isMySchedule ? currentSchedule?.assignments || [] : [];
  const pendingTasksCount = myAssignments.filter((a: any) => a.status === 'PENDING').length;

  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});

  const handleFileUpload = async (scheduleId: string, role: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if we already have 3 images
    const assignment = currentSchedule?.assignments.find((a: any) => a.role === role);
    if (assignment && assignment.evidenceUrls && assignment.evidenceUrls.length >= 3) {
      alert('Ya has subido el máximo de 3 fotos para este rol.');
      return;
    }

    const uploadKey = `${scheduleId}-${role}`;
    setIsUploading({ scheduleId, role });
    setUploadProgress(prev => ({ ...prev, [uploadKey]: 0 }));

    try {
      // Compress image before upload
      const compressedBlob = await new Promise<Blob>((resolve, reject) => {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800; // Reduced from 1000
          const MAX_HEIGHT = 800; // Reduced from 1000
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          URL.revokeObjectURL(img.src); // Clean up
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Error al comprimir imagen'));
          }, 'image/jpeg', 0.5); // Reduced quality from 0.6 to 0.5
        };
        img.onerror = reject;
      });

      const storage = getStorage();
      const storageRef = ref(storage, `evidence/${scheduleId}/${role}/${Date.now()}_compressed.jpg`);
      
      const { uploadBytesResumable, getDownloadURL } = await import('firebase/storage');
      const uploadTask = uploadBytesResumable(storageRef, compressedBlob);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(prev => ({ ...prev, [uploadKey]: Math.round(progress) }));
        }, 
        (error) => {
          console.error('Upload error:', error);
          setIsUploading(null);
          setUploadProgress(prev => {
            const next = { ...prev };
            delete next[uploadKey];
            return next;
          });
        }, 
        async () => {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          
          const updatedAssignments = currentSchedule.assignments.map((a: any) => {
            if (a.role === role) {
              const currentUrls = a.evidenceUrls || [];
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
          setUploadProgress(prev => {
            const next = { ...prev };
            delete next[uploadKey];
            return next;
          });
        }
      );
    } catch (error) {
      console.error('Error uploading evidence:', error);
      setIsUploading(null);
      setUploadProgress(prev => {
        const next = { ...prev };
        delete next[uploadKey];
        return next;
      });
      handleFirestoreError(error, OperationType.UPDATE, `schedules/${scheduleId}`);
    }
  };

  return (
    <Layout role={user.role} activeTab="dashboard">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-zinc-900 text-white p-6 md:p-10 rounded-3xl md:rounded-[2.5rem] relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 md:p-12 opacity-10 pointer-events-none">
            <Sparkles size={120} className="w-20 h-20 md:w-32 md:h-32" />
          </div>
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-xs font-bold text-zinc-300 mb-4 border border-white/10">
              <Home size={14} />
              <span>Tercer Piso</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-2">
              Hola, {user.name.split(' ')[0]}
            </h1>
            <p className="text-zinc-400 font-medium text-sm md:text-lg">
              {user.role === 'ADMIN' ? 'Resumen general del sistema.' : 'Aquí tienes tu resumen semanal.'}
            </p>
          </div>
          {user.role === 'ADMIN' && (
            <button 
              onClick={() => navigate('/users')} 
              className="relative z-10 w-full md:w-auto px-6 py-3.5 bg-white text-zinc-900 rounded-2xl font-bold hover:bg-zinc-100 transition-colors flex items-center justify-center gap-2 shadow-xl"
            >
              <Users size={18} /> Gestionar Inquilinos
            </button>
          )}
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Cleaning Schedule Card */}
            <div className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl">
                    <Shield size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-zinc-900">Rol de Limpieza</h3>
                    <p className="text-zinc-500 text-sm font-medium">Esta semana</p>
                  </div>
                </div>
                <button 
                  onClick={() => navigate('/schedules')}
                  className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-colors"
                >
                  <ArrowRight size={20} />
                </button>
              </div>

              {currentSchedule ? (
                (isMySchedule || user.role === 'ADMIN') ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-zinc-900 text-white rounded-2xl flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-1">
                          {isMySchedule ? 'Tu Responsabilidad' : `Responsabilidad de ${currentSchedule.assignedUserName}`}
                        </p>
                        <p className="font-semibold">
                          {isMySchedule ? 'Eres el encargado de la limpieza esta semana.' : 'Encargado de la limpieza esta semana.'}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                        <Sparkles className="text-amber-400" size={24} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {(isMySchedule ? myAssignments : currentSchedule.assignments).map((assignment: any, idx: number) => (
                        <div key={idx} className="p-5 bg-zinc-50 rounded-2xl border border-zinc-100 flex flex-col justify-between">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <p className="font-bold text-zinc-900">{assignment.role}</p>
                              {assignment.evidenceUrls && assignment.evidenceUrls.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {assignment.evidenceUrls.map((url: string, i: number) => (
                                    <div key={i} className="relative group/thumb">
                                      <img 
                                        src={url} 
                                        alt="Evidencia" 
                                        className="w-10 h-10 rounded-lg object-cover border border-zinc-200 shadow-sm" 
                                        referrerPolicy="no-referrer"
                                      />
                                      {(assignment.status !== 'COMPLETED' || user.role === 'ADMIN') && (
                                        <button 
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            const updatedAssignments = currentSchedule.assignments.map((a: any) => {
                                              if (a.role === assignment.role) {
                                                return {
                                                  ...a,
                                                  evidenceUrls: a.evidenceUrls.filter((_: any, idx: number) => idx !== i)
                                                };
                                              }
                                              return a;
                                            });
                                            await updateDoc(doc(db, 'schedules', currentSchedule.id), { assignments: updatedAssignments });
                                          }}
                                          className="absolute -top-1 -right-1 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover/thumb:opacity-100 transition-opacity shadow-sm z-20"
                                        >
                                          <X size={8} />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                  {assignment.evidenceUrls.length < 3 && (
                                    <div className="w-10 h-10 rounded-lg border border-dashed border-zinc-300 flex flex-col items-center justify-center text-zinc-400 text-[8px] font-bold bg-white">
                                      <span>{assignment.evidenceUrls.length}/3</span>
                                      <span className="text-[6px] opacity-50 uppercase">Fotos</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className={cn("p-1.5 rounded-lg", assignment.status === 'COMPLETED' ? "bg-emerald-100 text-emerald-600" : "bg-zinc-200 text-zinc-500")}>
                              {assignment.status === 'COMPLETED' ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className={cn(
                              "text-xs font-bold uppercase tracking-wider",
                              assignment.status === 'COMPLETED' ? "text-emerald-600" : "text-zinc-500"
                            )}>
                              {assignment.status === 'COMPLETED' ? 'Completado' : 'Pendiente'}
                            </span>
                            {(assignment.status !== 'COMPLETED' || user.role === 'ADMIN') && (
                              <div className="relative">
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  capture="environment"
                                  title="Subir evidencia"
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" 
                                  onChange={(e) => handleFileUpload(currentSchedule.id, assignment.role, e)} 
                                  disabled={isUploading?.scheduleId === currentSchedule.id && isUploading?.role === assignment.role} 
                                />
                                <button className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-all shadow-md active:scale-95">
                                  {isUploading?.scheduleId === currentSchedule.id && isUploading?.role === assignment.role ? (
                                    <>
                                      <Loader2 className="animate-spin" size={14} />
                                      <span className="text-[10px] font-bold">
                                        {uploadProgress[`${currentSchedule.id}-${assignment.role}`] || 0}%
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <div className="flex items-center gap-1.5">
                                        <Upload size={14} />
                                        <span className="text-[10px] font-bold">Subir Evidencia</span>
                                      </div>
                                    </>
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-6 bg-zinc-50 rounded-2xl border border-zinc-100 flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-zinc-400 font-bold text-lg border border-zinc-200">
                      {currentSchedule.assignedUserName.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-0.5">Encargado Actual</p>
                      <p className="font-bold text-zinc-900">{currentSchedule.assignedUserName}</p>
                    </div>
                  </div>
                )
              ) : (
                <div className="p-8 text-center bg-zinc-50 rounded-2xl border border-zinc-100 border-dashed">
                  <Calendar className="mx-auto text-zinc-300 mb-3" size={32} />
                  <p className="text-zinc-500 font-medium">No hay rol asignado para esta semana.</p>
                </div>
              )}
            </div>

            {/* Payments Summary */}
            <div className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="p-3.5 bg-blue-50 text-blue-600 rounded-2xl">
                    <CreditCard size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-zinc-900">Pagos Pendientes</h3>
                    <p className="text-zinc-500 text-sm font-medium">
                      {user.role === 'ADMIN' ? 'De todos los inquilinos' : 'Tus recibos por pagar'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => navigate('/payments')}
                  className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-colors"
                >
                  <ArrowRight size={20} />
                </button>
              </div>

              {pendingPayments.length > 0 ? (
                <div className="space-y-3">
                  {pendingPayments.slice(0, 3).map(payment => (
                    <div key={payment.id} className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center border border-zinc-200">
                          <FileText size={18} className="text-zinc-400" />
                        </div>
                        <div>
                          <p className="font-bold text-zinc-900">{payment.title}</p>
                          {user.role === 'ADMIN' && <p className="text-xs text-zinc-500 font-medium">{payment.userName}</p>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-zinc-900">S/ {payment.amount.toFixed(2)}</p>
                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Pendiente</p>
                      </div>
                    </div>
                  ))}
                  {pendingPayments.length > 3 && (
                    <button onClick={() => navigate('/payments')} className="w-full py-3 text-sm font-bold text-zinc-500 hover:text-zinc-900 transition-colors">
                      Ver {pendingPayments.length - 3} más...
                    </button>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center bg-zinc-50 rounded-2xl border border-zinc-100 border-dashed">
                  <CheckCircle2 className="mx-auto text-emerald-400 mb-3" size={32} />
                  <p className="text-zinc-500 font-medium">¡Todo al día! No hay pagos pendientes.</p>
                </div>
              )}
            </div>

          </div>

          {/* Sidebar Area */}
          <div className="space-y-6">
            
            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-3">
                  <CreditCard size={20} />
                </div>
                <p className="text-3xl font-black text-zinc-900">{pendingPayments.length}</p>
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mt-1">Pagos</p>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-3">
                  <CheckCircle2 size={20} />
                </div>
                <p className="text-3xl font-black text-zinc-900">{pendingTasksCount}</p>
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mt-1">Tareas</p>
              </div>
            </div>

            {/* Notifications */}
            <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <Bell size={20} className="text-zinc-400" />
                <h3 className="font-bold text-zinc-900">Notificaciones</h3>
              </div>
              
              <div className="space-y-4">
                {notifications.length > 0 ? (
                  notifications.map(notif => (
                    <div key={notif.id} className="flex gap-4">
                      <div className="w-2 h-2 mt-2 rounded-full bg-blue-500 shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-zinc-900">{notif.title}</p>
                        <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{notif.message}</p>
                        <p className="text-[10px] text-zinc-400 mt-2 font-medium">
                          {format(notif.createdAt, "d 'de' MMMM, HH:mm", { locale: es })}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-zinc-500 text-center py-4">No tienes notificaciones recientes.</p>
                )}
              </div>
            </div>

          </div>
        </div>
      </motion.div>
    </Layout>
  );
};

