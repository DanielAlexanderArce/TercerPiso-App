import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, updateDoc, doc, deleteDoc, setDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { User } from '../types';
import { Layout } from '../components/Layout';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2, Shield, Mail, Home, Plus, Edit2, Search, X, AlertCircle, Trash } from 'lucide-react';
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
          const paymentsSnap = await getDocs(collection(db, 'payments'));
          for (const d of paymentsSnap.docs) await deleteDoc(doc(db, 'payments', d.id));

          const schedulesSnap = await getDocs(collection(db, 'schedules'));
          for (const d of schedulesSnap.docs) await deleteDoc(doc(db, 'schedules', d.id));

          const notificationsSnap = await getDocs(collection(db, 'notifications'));
          for (const d of notificationsSnap.docs) await deleteDoc(doc(db, 'notifications', d.id));

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
    return <div className="p-8 text-center text-zinc-500">Acceso denegado.</div>;
  }

  return (
    <Layout role="ADMIN" activeTab="users">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Gestión de Inquilinos</h1>
            <p className="text-zinc-500 font-medium">Administra los accesos y perfiles de los residentes.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={() => {
                setEditingUser(null);
                setEditForm({ name: '', roomNumber: '', username: '', email: '' });
                setIsEditModalOpen(true);
              }}
              className="w-full sm:w-auto px-6 py-3 bg-zinc-900 text-white rounded-xl font-semibold hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={18} /> Crear Inquilino
            </button>
            <div className="bg-white px-4 py-3 rounded-xl border border-zinc-200 shadow-sm flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-bold text-zinc-700">{users.length} Inquilinos</span>
            </div>
          </div>
        </header>

        {/* Filters & Search */}
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
            <input 
              type="text"
              placeholder="Buscar inquilino..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all shadow-sm text-sm"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
            {(['ALL', 'ADMIN', 'INQUILINO'] as const).map((role) => (
              <button
                key={role}
                onClick={() => setFilterRole(role)}
                className={cn(
                  "px-6 py-3 rounded-xl text-xs font-bold transition-all border shadow-sm whitespace-nowrap",
                  filterRole === role 
                    ? "bg-zinc-900 text-white border-zinc-900" 
                    : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
                )}
              >
                {role === 'ALL' ? 'Todos' : role}
              </button>
            ))}
          </div>
        </div>

        {/* Users Table/Grid */}
        <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-100">
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Inquilino</th>
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Contacto</th>
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Habitación</th>
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Rol</th>
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                <AnimatePresence mode="popLayout">
                  {filteredUsers.map((u, i) => (
                    <motion.tr 
                      key={`${u.uid}-${i}`}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-zinc-50/50 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-500 font-bold text-sm border border-zinc-200 group-hover:bg-zinc-900 group-hover:text-white transition-colors">
                            {u.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-zinc-900">{u.name}</p>
                            <p className="text-xs text-zinc-500">@{u.username || 'sin_usuario'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-zinc-600 text-sm">
                          <Mail size={14} className="text-zinc-400" />
                          {u.email}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-100 text-zinc-700 rounded-lg text-xs font-medium border border-zinc-200">
                          <Home size={12} />
                          {u.roomNumber || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                          u.role === 'ADMIN' 
                            ? "bg-zinc-900 text-white border-zinc-900" 
                            : "bg-zinc-100 text-zinc-600 border-zinc-200"
                        )}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => openEditModal(u)}
                            className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-all"
                            title="Editar"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => toggleRole(u)}
                            className={cn(
                              "p-2 rounded-lg transition-all",
                              u.role === 'ADMIN' ? "text-amber-600 bg-amber-50" : "text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100"
                            )}
                            title="Cambiar Rol"
                          >
                            <Shield size={16} />
                          </button>
                          {u.uid !== currentUser?.uid && (
                            <button 
                              onClick={() => deleteUser(u.uid)}
                              className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              title="Eliminar"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {filteredUsers.length === 0 && (
            <div className="py-16 text-center">
              <div className="w-16 h-16 bg-zinc-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Search size={24} className="text-zinc-300" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900">No se encontraron inquilinos</h3>
              <p className="text-zinc-500 mt-1">Intenta ajustar los filtros o el término de búsqueda.</p>
            </div>
          )}
        </div>

        {/* Danger Zone */}
        <div className="mt-12 p-6 md:p-8 bg-red-50 rounded-3xl border border-red-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h3 className="text-lg font-bold text-red-900 flex items-center gap-2">
                <AlertCircle size={20} />
                Zona de Peligro
              </h3>
              <p className="text-red-700 text-sm mt-1">
                Elimina todos los registros del sistema para empezar de cero.
              </p>
            </div>
            <button
              onClick={handleClearTestData}
              className="w-full md:w-auto justify-center px-6 py-3 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-all shadow-sm flex items-center gap-2"
            >
              <Trash size={18} />
              Reiniciar Sistema
            </button>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl border border-zinc-100"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-zinc-900">
                  {editingUser ? 'Editar Perfil' : 'Nuevo Inquilino'}
                </h3>
                <button 
                  onClick={() => setIsEditModalOpen(false)}
                  className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-400"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleEditUser} className="space-y-4">
                {!editingUser && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Correo Electrónico</label>
                    <input
                      type="email"
                      required
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all text-sm"
                      placeholder="inquilino@ejemplo.com"
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Nombre Completo</label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Nombre de Usuario</label>
                  <input
                    type="text"
                    required
                    value={editForm.username}
                    onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Número de Habitación</label>
                  <input
                    type="text"
                    value={editForm.roomNumber}
                    onChange={(e) => setEditForm({ ...editForm, roomNumber: e.target.value })}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all text-sm"
                    placeholder="Ej: 301"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="flex-1 py-3 text-zinc-500 font-semibold hover:bg-zinc-50 rounded-xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-zinc-900 text-white font-semibold rounded-xl hover:bg-zinc-800 transition-all"
                  >
                    {editingUser ? 'Guardar Cambios' : 'Crear Inquilino'}
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
