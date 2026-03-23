import React, { useState } from 'react';
import { signInWithPopup, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc, limit } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { auth, db, googleProvider } from '../firebase';
import { motion } from 'motion/react';
import { ShieldCheck } from 'lucide-react';

export const AuthPage: React.FC<{ mode?: 'login' | 'register' }> = ({ mode: initialMode = 'login' }) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      if (!user.email) {
        throw new Error('No se pudo obtener el correo de Google.');
      }

      const emailLower = user.email.toLowerCase();
      const isAdminEmail = emailLower === 'alexanderarcedaniel@gmail.com';

      // Check if user is in the 'users' collection using email as ID
      const userDocRef = doc(db, 'users', emailLower);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        // Self-registration logic
        const emailPrefix = emailLower.split('@')[0];
        const userData = {
          uid: user.uid,
          email: emailLower,
          username: emailPrefix, // Default username from email
          name: user.displayName || name || 'Nuevo Inquilino',
          role: isAdminEmail ? 'ADMIN' : 'INQUILINO',
          createdAt: Date.now()
        };
        await setDoc(userDocRef, userData);
      } else {
        // User exists, update UID if it's missing or different
        const userData = userDoc.data();
        if (userData?.uid !== user.uid) {
          await updateDoc(userDocRef, { uid: user.uid });
        }
      }

      window.location.href = '/';
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(err.message || 'Ocurrió un error al iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        let loginEmail = email.toLowerCase();
        
        // If it's not an email, try to find the user by username
        if (!loginEmail.includes('@')) {
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('username', '==', loginEmail), limit(1));
          const querySnapshot = await getDocs(q);
          
          if (querySnapshot.empty) {
            throw new Error('Usuario no encontrado.');
          }
          
          loginEmail = querySnapshot.docs[0].data().email;
        }

        await signInWithEmailAndPassword(auth, loginEmail, password);
        
        // Ensure user doc exists
        const userDocRef = doc(db, 'users', loginEmail);
        const userDoc = await getDoc(userDocRef);
        if (!userDoc.exists()) {
          const emailPrefix = loginEmail.split('@')[0];
          await setDoc(userDocRef, {
            uid: auth.currentUser?.uid,
            email: loginEmail,
            username: emailPrefix,
            name: name || 'Inquilino',
            role: loginEmail === 'alexanderarcedaniel@gmail.com' ? 'ADMIN' : 'INQUILINO',
            createdAt: Date.now()
          });
        }
        window.location.href = '/';
      } else {
        // Registration
        const emailLower = email.toLowerCase();
        const usernameLower = username.toLowerCase();
        const isAdminEmail = emailLower === 'alexanderarcedaniel@gmail.com';

        // Check if username is taken
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('username', '==', usernameLower), limit(1));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          throw new Error('El nombre de usuario ya está en uso.');
        }

        const userCredential = await createUserWithEmailAndPassword(auth, emailLower, password);
        const user = userCredential.user;
        
        await updateProfile(user, { displayName: name });
        
        const userDocRef = doc(db, 'users', emailLower);
        await setDoc(userDocRef, {
          uid: user.uid,
          email: emailLower,
          username: usernameLower,
          name: name || 'Nuevo Inquilino',
          role: isAdminEmail ? 'ADMIN' : 'INQUILINO',
          createdAt: Date.now()
        });
        
        window.location.href = '/';
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-2 py-4 md:py-12">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white rounded-2xl md:rounded-[2.5rem] shadow-xl border border-zinc-100 p-4 md:p-10 my-auto"
      >
        <div className="text-center mb-4 md:mb-8">
          <div className="inline-flex items-center justify-center w-10 h-10 md:w-20 md:h-20 bg-zinc-900 text-white rounded-xl md:rounded-2xl mb-2 md:mb-6 shadow-lg">
            <ShieldCheck size={20} />
          </div>
          <h1 className="text-lg md:text-3xl font-bold text-zinc-900 tracking-tight">
            {mode === 'login' ? 'Bienvenido' : 'Crea tu cuenta'}
          </h1>
          <p className="text-zinc-500 mt-0.5 text-[10px] md:text-base font-medium">Gestión Residencial • Tercer Piso</p>
        </div>

        {error && (
          <div className="mb-4 p-2.5 md:p-4 bg-red-50 text-red-600 text-[10px] md:text-sm rounded-lg border border-red-100">
            {error}
          </div>
        )}

        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full mb-4 flex items-center justify-center px-4 py-2 md:py-3 bg-white border border-zinc-200 rounded-xl text-zinc-700 text-xs md:text-base font-semibold hover:bg-zinc-50 hover:border-zinc-300 transition-all shadow-sm disabled:opacity-50 active:scale-[0.98]"
        >
          <svg className="w-3.5 h-3.5 md:w-5 md:h-5 mr-2 md:mr-3" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          {mode === 'login' ? 'Entrar con Google' : 'Registrarse con Google'}
        </button>

        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-200"></div>
          </div>
          <div className="relative flex justify-center text-[9px] md:text-sm">
            <span className="px-2 bg-white text-zinc-500 uppercase tracking-widest font-bold">O usa tus credenciales</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2 md:space-y-4">
          {mode === 'register' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                <div>
                  <label className="block text-[9px] md:text-xs font-bold text-zinc-500 uppercase tracking-widest mb-0.5 ml-1">Nombre Completo</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 md:py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all text-xs md:text-sm"
                    placeholder="Juan Pérez"
                  />
                </div>
                <div>
                  <label className="block text-[9px] md:text-xs font-bold text-zinc-500 uppercase tracking-widest mb-0.5 ml-1">Usuario</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3 py-2 md:py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all text-xs md:text-sm"
                    placeholder="juanperez123"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[9px] md:text-xs font-bold text-zinc-500 uppercase tracking-widest mb-0.5 ml-1">Correo Electrónico</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 md:py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all text-xs md:text-sm"
                  placeholder="ejemplo@gmail.com"
                />
              </div>
            </>
          )}
          {mode === 'login' && (
            <div>
              <label className="block text-[9px] md:text-xs font-bold text-zinc-500 uppercase tracking-widest mb-0.5 ml-1">Usuario o Correo</label>
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 md:py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all text-xs md:text-sm"
                placeholder="usuario o correo@gmail.com"
              />
            </div>
          )}
          <div>
            <label className="block text-[9px] md:text-xs font-bold text-zinc-500 uppercase tracking-widest mb-0.5 ml-1">Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 md:py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all text-xs md:text-sm"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-zinc-900 text-white py-2.5 md:py-3.5 rounded-xl font-bold text-xs md:text-sm hover:bg-zinc-800 transition-colors flex items-center justify-center disabled:opacity-50 shadow-lg shadow-zinc-200 active:scale-[0.98]"
          >
            {loading ? (
              <span className="animate-pulse">Procesando...</span>
            ) : (
              <>{mode === 'login' ? 'Iniciar Sesión' : 'Registrarse'}</>
            )}
          </button>
        </form>

        <div className="mt-6 md:mt-8 text-center text-xs md:text-sm text-zinc-500">
          {mode === 'login' ? (
            <p>¿No tienes cuenta? <button onClick={() => setMode('register')} className="text-zinc-900 font-bold hover:underline">Regístrate aquí</button></p>
          ) : (
            <p>¿Ya tienes cuenta? <button onClick={() => setMode('login')} className="text-zinc-900 font-bold hover:underline">Inicia sesión</button></p>
          )}
        </div>
      </motion.div>
    </div>
  );
};
