import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, updateDoc, doc, deleteDoc, setDoc, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { User } from '../types';
import { Layout } from '../components/Layout';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2, Shield, User as UserIcon, Mail, Home, Plus, Edit2, Search, Filter, MoreVertical, X, Check, AlertCircle, Trash } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { ConfirmModal } from '../components/ConfirmModal';
import { cn } from '../utils/cn';

export const Users: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<'ALL' | 'ADMIN' | 'INQUILINO'>('ALL');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ name: '', roomNumber: '', username: '', email: '' });
  
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

  useEffect(() => {
    if (currentUser?.role !== 'ADMIN') return;

    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as User));
      setUsers(usersData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => unsubscribe();
  }, [currentUser]);

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         u.username?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'ALL' || u.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser?.role !== 'ADMIN') return;

    try {
      if (editingUser) {
        await updateDoc(doc(db, 'users', editingUser.uid), {
          name: editForm.name,
          roomNumber: editForm.roomNumber,
          username: editForm.username
        });
      } else {
        if (!editForm.email) return;
        const email = editForm.email.toLowerCase();
        await setDoc(doc(db, 'users', email), {
          uid: email,
          email: email,
          name: editForm.name,
          username: editForm.username,
          roomNumber: editForm.roomNumber,
          role: 'INQUILINO',
          createdAt: Date.now()
        });
      }
      setIsEditModalOpen(false);
      setEditingUser(null);
      setEditForm({ name: '', roomNumber: '', username: '', email: '' });
    } catch (error) {
      handleFirestoreError(error, editingUser ? OperationType.UPDATE : OperationType.CREATE, editingUser ? `users/${editingUser.uid}` : 'users');
    }
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setEditForm({
      name: user.name,
      roomNumber: user.roomNumber || '',
      username: user.username || '',
      email: user.email
    });
    setIsEditModalOpen(true);
  };

  const toggleRole = async (user: User) => {
    const newRole = user.role === 'ADMIN' ? 'INQUILINO' : 'ADMIN';
    setConfirmAction({
      isOpen: true,
      title: 'Cambiar Rol',
      message: `¿Estás seguro de cambiar el rol de ${user.name} a ${newRole}?`,
      type: 'info',
      onConfirm: async () => {
        try {
          await updateDoc(doc(db, 'users', user.uid), { role: newRole });
          setConfirmAction(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
        }
      }
    });
  };

  const deleteUser = async (uid: string) => {
    if (uid === currentUser?.uid) return;
    setConfirmAction({
      isOpen: true,
      title: 'Eliminar Inquilino',
      message: '¿Estás seguro de eliminar este inquilino? Esta acción no se puede deshacer.',
      type: 'danger',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'users', uid));
          setConfirmAction(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
        }
      }
    });
  };

  const handleClearTestData = async () => {
    setConfirmAction({
      isOpen: true,
      title: 'REINICIAR SISTEMA',
      message: 'Esta acción ELIMINARÁ TODOS los datos del sistema (pagos, horarios, notificaciones e inquilinos) para empezar de cero. ¿ESTÁS SEGURO?',
      type: 'danger',
      onConfirm: async () => {
        try {
          // Delete payments
          const paymentsSnap = await getDocs(collection(db, 'payments'));
          for (const d of paymentsSnap.docs) await deleteDoc(doc(db, 'payments', d.id));

          // Delete schedules
          const schedulesSnap = await getDocs(collection(db, 'schedules'));
          for (const d of schedulesSnap.docs) await deleteDoc(doc(db, 'schedules', d.id));

          // Delete notifications
          const notificationsSnap = await getDocs(collection(db, 'notifications'));
          for (const d of notificationsSnap.docs) await deleteDoc(doc(db, 'notifications', d.id));

          // Delete users except current
          const usersSnap = await getDocs(collection(db, 'users'));
          for (const d of usersSnap.docs) {
            if (d.id !== currentUser?.uid && d.id !== currentUser?.email) {
              await deleteDoc(doc(db, 'users', d.id));
            }
          }

          setConfirmAction(prev => ({ ...prev, isOpen: false }));
          alert('Sistema reiniciado correctamente.');
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, 'all_data');
        }
      }
    });
  };

  if (currentUser?.role !== 'ADMIN') {
    return <div className="p-8 text-center">Acceso denegado.</div>;
  }

  return (
    <Layout role="ADMIN" activeTab="users">
      <div className="mb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Gestión de Inquilinos</h1>
            <p className="text-slate-500 mt-1">Administra los accesos y perfiles de los residentes del 3er piso.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setEditingUser(null);
                setEditForm({ name: '', roomNumber: '', username: '' });
                setIsEditModalOpen(true);
              }}
              className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 active:scale-95 flex items-center gap-2"
            >
              <Plus size={18} />
              Crear Inquilino
            </button>
            <div className="bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-bold text-slate-700">{users.length} Registrados</span>
            </div>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col lg:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text"
              placeholder="Buscar por nombre, correo o usuario..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-[1.25rem] focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all shadow-sm"
            />
          </div>
          <div className="flex gap-2">
            {(['ALL', 'ADMIN', 'INQUILINO'] as const).map((role) => (
              <button
                key={role}
                onClick={() => setFilterRole(role)}
                className={cn(
                  "px-5 py-3.5 rounded-[1.25rem] text-sm font-bold transition-all border shadow-sm",
                  filterRole === role 
                    ? "bg-slate-900 text-white border-slate-900" 
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                )}
              >
                {role === 'ALL' ? 'Todos' : role}
              </button>
            ))}
          </div>
        </div>

        {/* Users Table/Grid */}
        <div className="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-xl shadow-slate-200/40 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Inquilino</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contacto</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Habitación</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rol</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                <AnimatePresence mode="popLayout">
                  {filteredUsers.map((u, i) => (
                    <motion.tr 
                      key={`${u.uid}-${i}`}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-slate-50/30 transition-colors group"
                    >
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 font-bold text-lg border border-slate-200 group-hover:bg-emerald-500 group-hover:text-white group-hover:border-emerald-400 transition-all duration-300">
                            {u.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{u.name}</p>
                            <p className="text-xs text-slate-400 font-medium">@{u.username || 'sin_usuario'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2 text-slate-500 text-sm">
                          <Mail size={14} className="text-slate-300" />
                          {u.email}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200">
                          <Home size={12} />
                          {u.roomNumber || 'N/A'}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className={cn(
                          "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border",
                          u.role === 'ADMIN' 
                            ? "bg-slate-900 text-white border-slate-900" 
                            : "bg-emerald-50 text-emerald-600 border-emerald-100"
                        )}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => openEditModal(u)}
                            className="p-2.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                            title="Editar"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={() => toggleRole(u)}
                            className={cn(
                              "p-2.5 rounded-xl transition-all",
                              u.role === 'ADMIN' ? "text-amber-600 bg-amber-50" : "text-slate-400 hover:text-slate-900 hover:bg-slate-100"
                            )}
                            title="Cambiar Rol"
                          >
                            <Shield size={18} />
                          </button>
                          {u.uid !== currentUser?.uid && (
                            <button 
                              onClick={() => deleteUser(u.uid)}
                              className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                              title="Eliminar"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
            {filteredUsers.length === 0 && (
              <div className="py-20 text-center">
                <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                  <Search size={32} className="text-slate-200" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">No se encontraron inquilinos</h3>
                <p className="text-slate-500 mt-1">Intenta ajustar los filtros o el término de búsqueda.</p>
              </div>
            )}
          </div>
        </div>

        {/* Danger Zone */}
        <div className="mt-16 p-8 bg-red-50 rounded-[2.5rem] border border-red-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h3 className="text-xl font-black text-red-900 flex items-center gap-2">
                <AlertCircle size={24} />
                Zona de Peligro
              </h3>
              <p className="text-red-700 text-sm mt-1">
                Elimina todos los registros del sistema para empezar de cero.
              </p>
            </div>
            <button
              onClick={handleClearTestData}
              className="px-8 py-4 bg-red-600 text-white rounded-2xl font-bold text-sm hover:bg-red-700 transition-all shadow-lg shadow-red-200 active:scale-95 flex items-center gap-2"
            >
              <Trash size={20} />
              Reiniciar Sistema
            </button>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {isEditModalOpen && editingUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] p-8 md:p-10 shadow-2xl border border-white/20"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  {editingUser ? 'Editar Perfil' : 'Nuevo Inquilino'}
                </h3>
                <button 
                  onClick={() => setIsEditModalOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleEditUser} className="space-y-6">
                {!editingUser && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Correo Electrónico</label>
                    <input
                      type="email"
                      required
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-medium"
                      placeholder="inquilino@ejemplo.com"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Nombre Completo</label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Nombre de Usuario</label>
                  <input
                    type="text"
                    required
                    value={editForm.username}
                    onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Número de Habitación</label>
                  <input
                    type="text"
                    value={editForm.roomNumber}
                    onChange={(e) => setEditForm({ ...editForm, roomNumber: e.target.value })}
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-medium"
                    placeholder="Ej: 301"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 active:scale-[0.98]"
                  >
                    Guardar Cambios
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={confirmAction.isOpen}
        title={confirmAction.title}
        message={confirmAction.message}
        onConfirm={confirmAction.onConfirm}
        onCancel={() => setConfirmAction(prev => ({ ...prev, isOpen: false }))}
        type={confirmAction.type}
      />
    </Layout>
  );
};
