import React, { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError } from '../firebase';
import { doc, getDoc, updateDoc, onSnapshot, writeBatch } from 'firebase/firestore';
import { UserProfile } from '../types';
import { motion } from 'motion/react';
import { User, Phone, Shield, Check, Save, LogOut, TrendingUp, Car, Zap } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { setDoc } from 'firebase/firestore';

const Profile: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicleType, setVehicleType] = useState<'Combustão' | 'Elétrico'>('Combustão');
  const [carModel, setCarModel] = useState('');
  const [rankingOptIn, setRankingOptIn] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;

    const unsubscribe = onSnapshot(doc(db, 'users', auth.currentUser.uid), (doc) => {
      if (doc.exists()) {
        const data = doc.data() as UserProfile;
        setProfile(data);
        setNickname(data.nickname);
        setPhone(data.phone);
        setVehicleType(data.vehicleType || 'Combustão');
        setCarModel(data.carModel || '');
        setRankingOptIn(data.rankingOptIn);
      }
      setLoading(false);
    }, (error) => handleFirestoreError(error, 'get', `users/${auth.currentUser?.uid}`));

    return () => unsubscribe();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    setSaving(true);
    setSuccess(false);

    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const rankingRef = doc(db, 'ranking', auth.currentUser.uid);
      
      const batch = writeBatch(db);
      batch.update(userRef, {
        nickname,
        phone,
        vehicleType,
        carModel,
        rankingOptIn
      });
      
      if (rankingOptIn) {
        batch.set(rankingRef, {
          nickname,
          weeklyEarnings: profile?.weeklyEarnings || 0,
          monthlyEarnings: profile?.monthlyEarnings || 0
        });
      } else {
        batch.delete(rankingRef);
      }
      
      await batch.commit();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      handleFirestoreError(error, 'update', `users/${auth.currentUser.uid}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSyncRanking = async () => {
    if (!auth.currentUser || !profile) return;
    setSyncing(true);
    try {
      const rankingRef = doc(db, 'ranking', auth.currentUser.uid);
      await setDoc(rankingRef, {
        nickname: profile.nickname,
        weeklyEarnings: profile.weeklyEarnings || 0,
        monthlyEarnings: profile.monthlyEarnings || 0
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error("Manual sync failed", error);
    } finally {
      setSyncing(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <div className="w-24 h-24 bg-indigo-600/20 border-2 border-indigo-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <User className="w-12 h-12 text-indigo-400" />
        </div>
        <h2 className="text-2xl font-bold text-white">Meu Perfil</h2>
        <p className="text-slate-400 text-sm">Gerencie suas informações e configurações do ranking</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6 bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl shadow-xl">
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <User className="w-4 h-4" /> Nome / Apelido
          </label>
          <input 
            type="text" 
            required
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Phone className="w-4 h-4" /> Celular
          </label>
          <input 
            type="tel" 
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Zap className="w-4 h-4" /> Tipo de Veículo
          </label>
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

        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Car className="w-4 h-4" /> Modelo do Carro
          </label>
          <input 
            type="text" 
            required
            value={carModel}
            onChange={(e) => setCarModel(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
        </div>

        <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-xl">
              <Shield className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Participar do Ranking</p>
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Sua pontuação fica visível</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setRankingOptIn(!rankingOptIn)}
            className={`w-12 h-6 rounded-full transition-all relative ${
              rankingOptIn ? 'bg-indigo-600' : 'bg-slate-700'
            }`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
              rankingOptIn ? 'left-7' : 'left-1'
            }`} />
          </button>
        </div>

          <div className="pt-4 space-y-3">
            <button 
              type="submit"
              disabled={saving}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
            >
              {saving ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : success ? (
                <><Check className="w-5 h-5" /> Salvo com Sucesso!</>
              ) : (
                <><Save className="w-5 h-5" /> Salvar Alterações</>
              )}
            </button>

            <button 
              type="button"
              onClick={handleSyncRanking}
              disabled={syncing || !profile}
              className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-indigo-400 font-bold rounded-xl transition-all flex items-center justify-center gap-2 border border-indigo-500/20"
            >
              {syncing ? (
                <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
              ) : (
                <><TrendingUp className="w-5 h-5" /> Sincronizar Ranking Agora</>
              )}
            </button>

            <button 
              type="button"
              onClick={handleSignOut}
              className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <LogOut className="w-5 h-5" /> Sair da Conta
            </button>
          </div>
      </form>

      <div className="text-center">
        <p className="text-slate-600 text-[10px] uppercase font-bold tracking-widest">
          Moby App - Jaraguá do Sul © 2026
        </p>
      </div>
    </div>
  );
};

export default Profile;
