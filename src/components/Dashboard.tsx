import React, { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc, orderBy, limit, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
import { DailyRecord, UserProfile, Expenses, Earnings } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Calendar, 
  ChevronRight, 
  ChevronLeft,
  Fuel,
  Utensils,
  Wrench,
  Car,
  DollarSign,
  X,
  Check
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend, PieChart, Pie } from 'recharts';

const Dashboard: React.FC = () => {
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DailyRecord | null>(null);
  const [loading, setLoading] = useState(true);

  // Form State
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [expenses, setExpenses] = useState<Expenses>({ food: 0, fuel: 0, maintenance: 0 });
  const [earnings, setEarnings] = useState<Earnings>({ uber: 0, '99': 0, indriver: 0, zoop: 0, muvi: 0, private: 0 });

  useEffect(() => {
    if (!auth.currentUser) return;

    const userDocRef = doc(db, 'users', auth.currentUser.uid);
    const unsubscribeUser = onSnapshot(userDocRef, async (snapshot) => {
      if (snapshot.exists()) {
        setUserProfile({ uid: snapshot.id, ...snapshot.data() } as UserProfile);
      } else {
        // Create missing profile for existing users
        try {
          const batch = writeBatch(db);
          const userRef = doc(db, 'users', auth.currentUser!.uid);
          const rankingRef = doc(db, 'ranking', auth.currentUser!.uid);
          
          const initialProfile = {
            nickname: auth.currentUser!.displayName || 'Motorista',
            phone: '',
            rankingOptIn: true,
            weeklyEarnings: 0,
            monthlyEarnings: 0
          };
          
          batch.set(userRef, initialProfile);
          batch.set(rankingRef, {
            nickname: initialProfile.nickname,
            weeklyEarnings: 0,
            monthlyEarnings: 0
          });
          
          await batch.commit();
          setUserProfile({ uid: auth.currentUser!.uid, ...initialProfile } as UserProfile);
        } catch (error) {
          console.error("Error creating initial profile", error);
        }
      }
    }, (error) => handleFirestoreError(error, 'get', `users/${auth.currentUser?.uid}`));

    const recordsQuery = query(
      collection(db, 'daily_records'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('date', 'desc'),
      limit(30)
    );

    const unsubscribeRecords = onSnapshot(recordsQuery, (snapshot) => {
      const fetchedRecords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyRecord));
      setRecords(fetchedRecords);
      setLoading(false);
    }, (error) => handleFirestoreError(error, 'list', 'daily_records'));

    return () => {
      unsubscribeUser();
      unsubscribeRecords();
    };
  }, []);

  const [hasInitialSync, setHasInitialSync] = useState(false);

  useEffect(() => {
    if (!loading && records.length >= 0 && userProfile && !hasInitialSync) {
      updateRankingTotals(records);
      setHasInitialSync(true);
    }
  }, [records, userProfile, loading, hasInitialSync]);

  const updateRankingTotals = async (allRecords: DailyRecord[]) => {
    if (!auth.currentUser || !userProfile) return;

    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    let weeklyTotal = 0;
    let monthlyTotal = 0;

    allRecords.forEach(record => {
      const recordDate = parseISO(record.date);
      const recordBalance = record.balance || 0;

      if (isWithinInterval(recordDate, { start: weekStart, end: weekEnd })) {
        weeklyTotal += recordBalance;
      }
      if (isWithinInterval(recordDate, { start: monthStart, end: monthEnd })) {
        monthlyTotal += recordBalance;
      }
    });

    // Check if we need to update (either totals changed or we haven't synced yet)
    const needsUpdate = weeklyTotal !== userProfile.weeklyEarnings || 
                        monthlyTotal !== userProfile.monthlyEarnings ||
                        !hasInitialSync;

    if (needsUpdate) {
      try {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const rankingRef = doc(db, 'ranking', auth.currentUser.uid);
        
        const batch = writeBatch(db);
        
        // Update user profile with totals
        batch.update(userRef, {
          weeklyEarnings: weeklyTotal,
          monthlyEarnings: monthlyTotal
        });
        
        // Default to true if the field is missing
        const isOptedIn = userProfile.rankingOptIn !== false;
        
        if (isOptedIn) {
          // Sync to ranking collection
          batch.set(rankingRef, {
            nickname: userProfile.nickname,
            weeklyEarnings: weeklyTotal,
            monthlyEarnings: monthlyTotal
          });
        } else {
          batch.delete(rankingRef);
        }
        
        await batch.commit();
        console.log("Ranking totals synced successfully:", { weeklyTotal, monthlyTotal });
      } catch (error) {
        console.error("Error updating ranking totals", error);
        handleFirestoreError(error, 'write', 'ranking');
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    const totalPositive = Object.values(earnings).reduce((a: number, b: number) => a + b, 0);
    const totalNegative = Object.values(expenses).reduce((a: number, b: number) => a + b, 0);
    const balance = (totalPositive as number) - (totalNegative as number);

    const recordData = {
      userId: auth.currentUser.uid,
      date,
      expenses,
      earnings,
      totalPositive,
      totalNegative,
      balance
    };

    try {
      if (editingRecord?.id) {
        await updateDoc(doc(db, 'daily_records', editingRecord.id), recordData);
      } else {
        await addDoc(collection(db, 'daily_records'), recordData);
      }
      resetForm();
    } catch (error) {
      handleFirestoreError(error, 'write', 'daily_records');
    }
  };

  const resetForm = () => {
    setIsFormOpen(false);
    setEditingRecord(null);
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setExpenses({ food: 0, fuel: 0, maintenance: 0 });
    setEarnings({ uber: 0, '99': 0, indriver: 0, zoop: 0, muvi: 0, private: 0 });
  };

  const handleEdit = (record: DailyRecord) => {
    setEditingRecord(record);
    setDate(record.date);
    setExpenses(record.expenses);
    setEarnings(record.earnings);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este registro?')) {
      try {
        await deleteDoc(doc(db, 'daily_records', id));
      } catch (error) {
        handleFirestoreError(error, 'delete', `daily_records/${id}`);
      }
    }
  };

  const chartData = [...records].reverse().map(r => ({
    date: format(parseISO(r.date), 'dd/MM'),
    lucro: r.totalPositive,
    gastos: r.totalNegative,
    saldo: r.balance
  }));

  const totalBalance = records.reduce((acc, r) => acc + (r.balance as number), 0);
  const totalEarnings = records.reduce((acc, r) => acc + (r.totalPositive as number), 0);
  const totalExpenses = records.reduce((acc, r) => acc + (r.totalNegative as number), 0);

  const platformTotals = records.reduce((acc, r) => {
    Object.entries(r.earnings).forEach(([platform, value]) => {
      acc[platform] = (acc[platform] || 0) + (value as number);
    });
    return acc;
  }, {} as Record<string, number>);

  const platformData = Object.entries(platformTotals)
    .filter(([_, value]) => (value as number) > 0)
    .map(([name, value]) => ({ 
      name: name === 'private' ? 'Particular' : name.charAt(0).toUpperCase() + name.slice(1), 
      value: value as number 
    }));

  const expenseTotals = records.reduce((acc, r) => {
    Object.entries(r.expenses).forEach(([category, value]) => {
      acc[category] = (acc[category] || 0) + (value as number);
    });
    return acc;
  }, {} as Record<string, number>);

  const expenseData = Object.entries(expenseTotals)
    .filter(([_, value]) => (value as number) > 0)
    .map(([name, value]) => ({ 
      name: name === 'food' ? 'Alimentação' : name === 'fuel' ? 'Combustível' : 'Manutenção', 
      value: value as number 
    }));

  const PLATFORM_COLORS = ['#2563eb', '#facc15', '#10b981', '#8b5cf6', '#ec4899', '#64748b'];
  const EXPENSE_COLORS = ['#fb923c', '#ef4444', '#0ea5e9'];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-6 rounded-3xl"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 rounded-2xl">
              <TrendingUp className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Ganhos Totais</p>
              <h3 className="text-2xl font-bold text-white">R$ {totalEarnings.toFixed(2)}</h3>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-6 rounded-3xl"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-rose-500/10 rounded-2xl">
              <TrendingDown className="w-6 h-6 text-rose-500" />
            </div>
            <div>
              <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Gastos Totais</p>
              <h3 className="text-2xl font-bold text-white">R$ {totalExpenses.toFixed(2)}</h3>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-indigo-600/10 backdrop-blur-xl border border-indigo-500/20 p-6 rounded-3xl"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-500/20 rounded-2xl">
              <Wallet className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Saldo Líquido</p>
              <h3 className={`text-2xl font-bold ${totalBalance >= 0 ? 'text-indigo-400' : 'text-rose-400'}`}>
                R$ {totalBalance.toFixed(2)}
              </h3>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Chart Section */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-6 rounded-3xl"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-400" /> Desempenho Diário
          </h2>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis 
                dataKey="date" 
                stroke="#64748b" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false} 
              />
              <YAxis 
                stroke="#64748b" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false} 
                tickFormatter={(value) => `R$${value}`}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                itemStyle={{ fontSize: '12px' }}
              />
              <Legend verticalAlign="top" height={36}/>
              <Bar dataKey="lucro" name="Ganhos" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="gastos" name="Gastos" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Distribution Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-6 rounded-3xl"
        >
          <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <Car className="w-5 h-5 text-emerald-400" /> Ganhos por Plataforma
          </h2>
          <div className="h-64 w-full">
            {platformData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 0, right: 40, left: 40, bottom: 0 }}>
                  <Pie
                    data={platformData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {platformData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PLATFORM_COLORS[index % PLATFORM_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                    formatter={(value: number) => `R$ ${value.toFixed(2)}`}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm italic">
                Sem dados de ganhos suficientes
              </div>
            )}
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-6 rounded-3xl"
        >
          <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-rose-400" /> Distribuição de Gastos
          </h2>
          <div className="h-64 w-full">
            {expenseData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 0, right: 40, left: 40, bottom: 0 }}>
                  <Pie
                    data={expenseData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {expenseData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={EXPENSE_COLORS[index % EXPENSE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                    formatter={(value: number) => `R$ ${value.toFixed(2)}`}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm italic">
                Sem dados de gastos suficientes
              </div>
            )}
          </div>
        </motion.div>
      </div>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Registros Recentes</h2>
          <button 
            onClick={() => setIsFormOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded-xl transition-all shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {records.length === 0 ? (
            <div className="text-center py-12 bg-slate-900/30 border border-dashed border-slate-800 rounded-3xl">
              <Calendar className="w-12 h-12 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500">Nenhum registro encontrado. Comece inserindo seus ganhos!</p>
            </div>
          ) : (
            records.map((record) => (
              <motion.div 
                layout
                key={record.id}
                className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-4 rounded-2xl flex items-center justify-between group hover:border-slate-700 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-800 rounded-xl flex flex-col items-center justify-center text-slate-400">
                    <span className="text-[10px] font-bold uppercase">{format(parseISO(record.date), 'MMM', { locale: ptBR })}</span>
                    <span className="text-lg font-black text-white leading-none">{format(parseISO(record.date), 'dd')}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-bold text-sm">R$ {record.totalPositive.toFixed(2)}</span>
                      <span className="text-slate-600 text-xs">/</span>
                      <span className="text-rose-400 font-bold text-sm">R$ {record.totalNegative.toFixed(2)}</span>
                    </div>
                    <p className={`text-xs font-medium ${record.balance >= 0 ? 'text-indigo-400' : 'text-rose-400'}`}>
                      Saldo: R$ {record.balance.toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => handleEdit(record)}
                    className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-indigo-400 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(record.id!)}
                    className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Modal Form */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={resetForm}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">
                  {editingRecord ? 'Editar Registro' : 'Novo Registro'}
                </h3>
                <button onClick={resetForm} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> Data do Trabalho
                  </label>
                  <input 
                    type="date" 
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-rose-400 flex items-center gap-2 uppercase tracking-widest">
                    <TrendingDown className="w-4 h-4" /> Gastos (R$)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-bold uppercase flex items-center gap-1">
                        <Utensils className="w-3 h-3" /> Alimentação
                      </label>
                      <input 
                        type="number" step="0.01"
                        value={expenses.food || ''}
                        onChange={(e) => setExpenses({...expenses, food: parseFloat(e.target.value) || 0})}
                        className="w-full bg-slate-800/50 border border-slate-700 rounded-xl py-2 px-3 text-white text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-bold uppercase flex items-center gap-1">
                        <Fuel className="w-3 h-3" /> Combustível
                      </label>
                      <input 
                        type="number" step="0.01"
                        value={expenses.fuel || ''}
                        onChange={(e) => setExpenses({...expenses, fuel: parseFloat(e.target.value) || 0})}
                        className="w-full bg-slate-800/50 border border-slate-700 rounded-xl py-2 px-3 text-white text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-bold uppercase flex items-center gap-1">
                        <Wrench className="w-3 h-3" /> Manutenção
                      </label>
                      <input 
                        type="number" step="0.01"
                        value={expenses.maintenance || ''}
                        onChange={(e) => setExpenses({...expenses, maintenance: parseFloat(e.target.value) || 0})}
                        className="w-full bg-slate-800/50 border border-slate-700 rounded-xl py-2 px-3 text-white text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-2 uppercase tracking-widest">
                    <TrendingUp className="w-4 h-4" /> Ganhos (R$)
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {Object.keys(earnings).map((key) => (
                      <div key={key} className="space-y-1">
                        <label className="text-[10px] text-slate-500 font-bold uppercase flex items-center gap-1">
                          <Car className="w-3 h-3" /> {key === 'private' ? 'Particular' : key}
                        </label>
                        <input 
                          type="number" step="0.01"
                          value={earnings[key as keyof Earnings] || ''}
                          onChange={(e) => setEarnings({...earnings, [key]: parseFloat(e.target.value) || 0})}
                          className="w-full bg-slate-800/50 border border-slate-700 rounded-xl py-2 px-3 text-white text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={resetForm}
                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
                  >
                    <Check className="w-5 h-5" /> Salvar Registro
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;
