import React, { useState } from 'react';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { auth } from '../firebase';
import { motion } from 'motion/react';
import { Settings as SettingsIcon, Lock, ShieldCheck, AlertCircle, CheckCircle2, KeyRound, User as UserIcon } from 'lucide-react';
import { Layout } from '../components/Layout';
import { useAuth } from '../context/AuthContext';

export const Settings: React.FC = () => {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas nuevas no coinciden.');
      return;
    }

    if (newPassword.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.email) throw new Error('Usuario no autenticado.');

      // Re-authenticate user
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);

      // Update password
      await updatePassword(currentUser, newPassword);

      setSuccess('Contraseña actualizada correctamente.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error('Error updating password:', err);
      if (err.code === 'auth/wrong-password') {
        setError('La contraseña actual es incorrecta.');
      } else {
        setError(err.message || 'Ocurrió un error al actualizar la contraseña.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Layout role={user.role} activeTab="settings">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8 md:mb-10">
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Configuración</h1>
          <p className="text-slate-500 mt-1 text-sm">Gestiona tu seguridad y preferencias de cuenta.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          {/* Profile Summary Card */}
          <div className="lg:col-span-1">
            <div className="bg-white p-6 md:p-8 rounded-2xl md:rounded-[2.5rem] border border-slate-200/60 shadow-sm text-center">
              <div className="w-20 h-20 md:w-24 md:h-24 bg-slate-100 rounded-2xl md:rounded-[2rem] flex items-center justify-center mx-auto mb-4 md:mb-6 border border-slate-200">
                <UserIcon size={32} md:size={40} className="text-slate-400" />
              </div>
              <h2 className="text-lg md:text-xl font-bold text-slate-900">{user.name}</h2>
              <p className="text-slate-500 text-xs md:text-sm mt-1">{user.email}</p>
              <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t border-slate-100">
                <span className="px-4 py-2 bg-slate-900 text-white text-[9px] md:text-[10px] font-black uppercase tracking-widest rounded-xl">
                  {user.role}
                </span>
              </div>
            </div>
          </div>

          {/* Settings Form */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl md:rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-200/60 overflow-hidden"
            >
              <div className="p-6 md:p-10 border-b border-slate-100 bg-slate-50/30">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-slate-900 text-white rounded-lg">
                    <KeyRound size={18} />
                  </div>
                  <h2 className="text-lg md:text-xl font-bold text-slate-900">Seguridad de la Cuenta</h2>
                </div>
                <p className="text-xs md:text-sm text-slate-500">
                  Actualiza tu contraseña periódicamente para mantener tu cuenta protegida.
                </p>
              </div>

              <div className="p-6 md:p-10">
                {error && (
                  <div className="mb-6 md:mb-8 p-4 md:p-5 bg-red-50 text-red-600 text-xs md:text-sm rounded-xl md:rounded-2xl border border-red-100 flex items-center gap-3">
                    <AlertCircle size={18} md:size={20} />
                    <span className="font-bold">{error}</span>
                  </div>
                )}

                {success && (
                  <div className="mb-6 md:mb-8 p-4 md:p-5 bg-emerald-50 text-emerald-600 text-xs md:text-sm rounded-xl md:rounded-2xl border border-emerald-100 flex items-center gap-3">
                    <CheckCircle2 size={18} md:size={20} />
                    <span className="font-bold">{success}</span>
                  </div>
                )}

                <form onSubmit={handleUpdatePassword} className="space-y-6 md:space-y-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Contraseña Actual</label>
                    <div className="relative">
                      <input
                        type="password"
                        required
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full pl-11 md:pl-12 pr-4 py-3.5 md:py-4 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 transition-all font-medium text-sm md:text-base"
                        placeholder="••••••••"
                      />
                      <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} md:size={20} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nueva Contraseña</label>
                      <div className="relative">
                        <input
                          type="password"
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full pl-11 md:pl-12 pr-4 py-3.5 md:py-4 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 transition-all font-medium text-sm md:text-base"
                          placeholder="••••••••"
                        />
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} md:size={20} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Confirmar Nueva</label>
                      <div className="relative">
                        <input
                          type="password"
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full pl-11 md:pl-12 pr-4 py-3.5 md:py-4 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 transition-all font-medium text-sm md:text-base"
                          placeholder="••••••••"
                        />
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} md:size={20} />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 md:pt-6">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full md:w-auto px-8 md:px-10 py-3.5 md:py-4 bg-slate-900 text-white rounded-xl md:rounded-2xl font-bold text-sm hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2"
                    >
                      {loading ? 'Actualizando...' : 'Actualizar Contraseña'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </Layout>
  );
};
