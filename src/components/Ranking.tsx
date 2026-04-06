import React, { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError } from '../firebase';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Medal, Award, TrendingUp, Calendar, Users } from 'lucide-react';

const Ranking: React.FC = () => {
  const [weeklyRanking, setWeeklyRanking] = useState<UserProfile[]>([]);
  const [monthlyRanking, setMonthlyRanking] = useState<UserProfile[]>([]);
  const [activeTab, setActiveTab] = useState<'weekly' | 'monthly'>('weekly');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const rankingQuery = query(
      collection(db, 'ranking'),
      orderBy(activeTab === 'weekly' ? 'weeklyEarnings' : 'monthlyEarnings', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(rankingQuery, (snapshot) => {
      console.log('Ranking snapshot size:', snapshot.size);
      const fetchedRanking = snapshot.docs.map(doc => {
        const data = doc.data();
        console.log('Ranking doc:', doc.id, data);
        return { uid: doc.id, ...data } as UserProfile;
      });
      if (activeTab === 'weekly') {
        setWeeklyRanking(fetchedRanking);
      } else {
        setMonthlyRanking(fetchedRanking);
      }
      setLoading(false);
    }, (error) => {
      console.error('Ranking snapshot error:', error);
      handleFirestoreError(error, 'list', 'ranking');
    });

    return () => unsubscribe();
  }, [activeTab]);

  const currentRanking = activeTab === 'weekly' ? weeklyRanking : monthlyRanking;
  const [isUserInRanking, setIsUserInRanking] = useState(false);

  const getWeekRange = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
    const start = monday.toLocaleDateString('pt-BR', options);
    const end = sunday.toLocaleDateString('pt-BR', options);
    
    return `${start} a ${end}`;
  };

  const getMonthName = () => {
    const now = new Date();
    const month = now.toLocaleDateString('pt-BR', { month: 'long' });
    return month.charAt(0).toUpperCase() + month.slice(1);
  };

  useEffect(() => {
    if (!auth.currentUser) return;
    setIsUserInRanking(currentRanking.some(u => u.uid === auth.currentUser?.uid));
  }, [currentRanking]);

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0: return <Trophy className="w-6 h-6 text-yellow-400" />;
      case 1: return <Medal className="w-6 h-6 text-slate-300" />;
      case 2: return <Award className="w-6 h-6 text-amber-600" />;
      default: return <span className="text-slate-500 font-bold w-6 text-center">{index + 1}</span>;
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-black text-white tracking-tighter flex items-center justify-center gap-3">
          <Trophy className="w-8 h-8 text-yellow-400" /> RANKING MOBY
        </h2>
        <p className="text-slate-400 text-sm">Veja quem está faturando mais em Jaraguá do Sul</p>
      </div>

      <div className="flex bg-slate-900/50 backdrop-blur-xl p-1 rounded-2xl border border-slate-800">
        <button
          onClick={() => setActiveTab('weekly')}
          className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'weekly' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4" /> Semanal
        </button>
        <button
          onClick={() => setActiveTab('monthly')}
          className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'monthly' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <TrendingUp className="w-4 h-4" /> Mensal
        </button>
      </div>

      <div className="text-center">
        <p className="text-indigo-400 text-xs font-bold uppercase tracking-widest bg-indigo-500/10 py-2 px-4 rounded-full inline-block border border-indigo-500/20">
          {activeTab === 'weekly' ? `Semana: ${getWeekRange()}` : `Mês: ${getMonthName()}`}
        </p>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-3 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : currentRanking.length === 0 ? (
          <div className="text-center py-20 bg-slate-900/30 border border-dashed border-slate-800 rounded-3xl space-y-4">
            <Users className="w-12 h-12 text-slate-700 mx-auto" />
            <div className="space-y-1">
              <p className="text-slate-500">Nenhum motorista no ranking ainda.</p>
              <p className="text-slate-600 text-xs px-10">Certifique-se de ter registros no Dashboard e que sua participação no ranking esteja ativa no Perfil.</p>
            </div>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {currentRanking.map((user, index) => (
              <motion.div
                layout
                key={user.uid}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.05 }}
                className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                  index === 0 ? 'bg-yellow-400/5 border-yellow-400/20' : 
                  index === 1 ? 'bg-slate-300/5 border-slate-300/20' :
                  index === 2 ? 'bg-amber-600/5 border-amber-600/20' :
                  'bg-slate-900/50 border-slate-800'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 flex justify-center">
                    {getRankIcon(index)}
                  </div>
                  <div>
                    <h4 className="text-white font-bold">{user.nickname}</h4>
                    <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">Motorista Moby</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-indigo-400 font-black text-lg leading-none">
                    R$ {(activeTab === 'weekly' ? user.weeklyEarnings : user.monthlyEarnings)?.toFixed(2) || '0.00'}
                  </p>
                  <p className="text-slate-500 text-[10px] uppercase font-bold">Saldo Líquido</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      <div className="bg-indigo-600/10 border border-indigo-500/20 p-4 rounded-2xl text-center space-y-2">
        <p className="text-indigo-300 text-xs font-medium">
          O ranking é atualizado em tempo real com base nos seus registros diários. 
          Você pode desativar sua participação nas configurações do perfil.
        </p>
        {!isUserInRanking && auth.currentUser && (
          <div className="pt-2 border-t border-indigo-500/10">
            <p className="text-indigo-400 text-[10px] font-bold uppercase tracking-wider">
              Você ainda não aparece no ranking. Visite o Dashboard para sincronizar seus dados.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Ranking;
