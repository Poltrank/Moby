import React, { useState } from 'react';
import { auth, db } from '../firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  updateProfile, 
  GoogleAuthProvider, 
  signInWithPopup 
} from 'firebase/auth';
import { doc, setDoc, getDoc, writeBatch } from 'firebase/firestore';
import { motion } from 'motion/react';
import { User, Phone, Lock, LogIn, UserPlus, Chrome, Car, Zap } from 'lucide-react';

interface AuthProps {
  onAuthSuccess: () => void;
}

const Auth: React.FC<AuthProps> = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [vehicleType, setVehicleType] = useState<'Combustão' | 'Elétrico'>('Combustão');
  const [carModel, setCarModel] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if user profile exists
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        const batch = writeBatch(db);
        const userRef = doc(db, 'users', user.uid);
        const rankingRef = doc(db, 'ranking', user.uid);
        
        batch.set(userRef, {
          nickname: user.displayName || 'Motorista',
          phone: '',
          rankingOptIn: true,
          weeklyEarnings: 0,
          monthlyEarnings: 0
        });
        
        batch.set(rankingRef, {
          nickname: user.displayName || 'Motorista',
          weeklyEarnings: 0,
          monthlyEarnings: 0
        });
        
        await batch.commit();
      }
      onAuthSuccess();
    } catch (err: any) {
      console.error(err);
      setError('Erro ao entrar com Google. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Basic validation
    if (!isLogin && nickname.length < 2) {
      setError('O nome deve ter pelo menos 2 caracteres.');
      setLoading(false);
      return;
    }

    const cleanPhone = phone.trim().toLowerCase();
    const isAdm = cleanPhone === 'adm' && password === 'caralho87';
    
    if (!isAdm) {
      const numericPhone = cleanPhone.replace(/\D/g, '');
      if (numericPhone.length < 10) {
        setError('Insira um número de celular válido com DDD.');
        setLoading(false);
        return;
      }
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      setLoading(false);
      return;
    }

    // Admin check
    const isAdminLogin = isAdm;
    const email = isAdminLogin ? 'admin@moby.app' : `${phone.replace(/\D/g, '')}@moby.app`;

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        // Special case: admin registration
        const isRegisteringAdmin = isAdminLogin;

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await updateProfile(user, { displayName: isRegisteringAdmin ? 'Administrador' : nickname });

        const batch = writeBatch(db);
        const userRef = doc(db, 'users', user.uid);
        const rankingRef = doc(db, 'ranking', user.uid);
        
        batch.set(userRef, {
          nickname: isRegisteringAdmin ? 'Administrador' : nickname,
          phone: isRegisteringAdmin ? 'adm' : phone,
          vehicleType: isRegisteringAdmin ? 'Combustão' : vehicleType,
          carModel: isRegisteringAdmin ? 'Admin Mobile' : carModel,
          rankingOptIn: !isRegisteringAdmin,
          weeklyEarnings: 0,
          monthlyEarnings: 0,
          isAdmin: isRegisteringAdmin
        });
        
        if (!isRegisteringAdmin) {
          batch.set(rankingRef, {
            nickname,
            vehicleType,
            weeklyEarnings: 0,
            monthlyEarnings: 0
          });
        }
        
        await batch.commit();
      }
      onAuthSuccess();
    } catch (err: any) {
      console.error('Auth Error:', err.code, err.message);
      if (err.code === 'auth/operation-not-allowed') {
        setError('O login por celular/senha ainda não foi ativado no painel do Firebase. Por favor, use o Google Login abaixo.');
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Celular ou senha incorretos.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Este número de celular já está cadastrado.');
      } else if (err.code === 'auth/weak-password') {
        setError('A senha é muito fraca.');
      } else {
        setError(`Erro: ${err.message || 'Tente novamente.'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl shadow-2xl z-10"
      >
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-white tracking-tighter mb-2">MOBY</h1>
          <p className="text-slate-400 text-sm">Controle financeiro para motoristas de Jaraguá do Sul</p>
        </div>

        <div className="flex bg-slate-800/50 p-1 rounded-xl mb-8">
          <button
            onClick={() => setIsLogin(true)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              isLogin ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Entrar
          </button>
          <button
            onClick={() => setIsLogin(false)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              !isLogin ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Cadastrar
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 ml-1">Nome / Apelido</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="Como quer ser chamado"
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 ml-1">Tipo de Veículo</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setVehicleType('Combustão')}
                    className={`flex-1 py-3 rounded-xl border transition-all flex items-center justify-center gap-2 text-sm font-bold ${
                      vehicleType === 'Combustão' 
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20' 
                        : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Zap className="w-4 h-4" /> Combustão
                  </button>
                  <button
                    type="button"
                    onClick={() => setVehicleType('Elétrico')}
                    className={`flex-1 py-3 rounded-xl border transition-all flex items-center justify-center gap-2 text-sm font-bold ${
                      vehicleType === 'Elétrico' 
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20' 
                        : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Zap className="w-4 h-4 text-yellow-400" /> Elétrico
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 ml-1">Modelo do Carro</label>
                <div className="relative">
                  <Car className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={carModel}
                    onChange={(e) => setCarModel(e.target.value)}
                    placeholder="Ex: Toyota Corolla"
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                  />
                </div>
              </div>
            </>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400 ml-1">Celular (ou Login Admin)</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(47) 99999-9999"
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400 ml-1">Senha (mín. 6 dígitos)</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              />
            </div>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl"
            >
              <p className="text-red-400 text-xs font-medium text-center">
                {error}
              </p>
            </motion.div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 mt-6"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : isLogin ? (
              <>
                <LogIn className="w-5 h-5" /> Entrar
              </>
            ) : (
              <>
                <UserPlus className="w-5 h-5" /> Criar Conta
              </>
            )}
          </button>
        </form>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-slate-950 px-2 text-slate-500">Ou continue com</span>
          </div>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full bg-white hover:bg-slate-100 text-slate-900 font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
        >
          <Chrome className="w-5 h-5" /> Entrar com Google
        </button>

        <div className="mt-8 text-center">
          <p className="text-slate-500 text-xs">
            Suporte WhatsApp: <a href="https://wa.me/5547974008115" target="_blank" className="text-indigo-400 hover:underline">(47) 97400-8115</a>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
