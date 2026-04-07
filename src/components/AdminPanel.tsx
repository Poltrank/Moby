import React, { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError } from '../firebase';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, getDocs, where, writeBatch } from 'firebase/firestore';
import { UserProfile, DailyRecord } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Search, Edit2, Trash2, X, Check, Shield, Car, Zap, Phone, Wallet, Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const AdminPanel: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [userRecords, setUserRecords] = useState<DailyRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  // Edit Form State
  const [editNickname, setEditNickname] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editVehicleType, setEditVehicleType] = useState<'Combustão' | 'Elétrico'>('Combustão');
  const [editCarModel, setEditCarModel] = useState('');
  const [editIsAdmin, setEditIsAdmin] = useState(false);

  useEffect(() => {
    const usersQuery = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
      const fetchedUsers = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setUsers(fetchedUsers);
      setLoading(false);
    }, (error) => handleFirestoreError(error, 'list', 'users'));

    return () => unsubscribe();
  }, []);

  const handleEditUser = async (user: UserProfile) => {
    setSelectedUser(user);
    setEditNickname(user.nickname);
    setEditPhone(user.phone);
    setEditVehicleType(user.vehicleType || 'Combustão');
    setEditCarModel(user.carModel || '');
    setEditIsAdmin(user.isAdmin || false);
    setIsEditModalOpen(true);

    // Fetch user records
    setLoadingRecords(true);
    try {
      const recordsQuery = query(collection(db, 'daily_records'), where('userId', '==', user.uid));
      const snapshot = await getDocs(recordsQuery);
      const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyRecord));
      setUserRecords(records.sort((a, b) => b.date.localeCompare(a.date)));
    } catch (error) {
      console.error("Error fetching user records", error);
    } finally {
      setLoadingRecords(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      const userRef = doc(db, 'users', selectedUser.uid);
      const rankingRef = doc(db, 'ranking', selectedUser.uid);
      
      const batch = writeBatch(db);
      
      const updateData = {
        nickname: editNickname,
        phone: editPhone,
        vehicleType: editVehicleType,
        carModel: editCarModel,
        isAdmin: editIsAdmin
      };

      batch.update(userRef, updateData);
      
      // Also update ranking if they are in it
      try {
        batch.update(rankingRef, {
          nickname: editNickname,
          vehicleType: editVehicleType
        });
      } catch (e) {
        // batch.update doesn't check existence until commit, but we can't catch it here
      }

      await batch.commit();
      setIsEditModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, 'update', `users/${selectedUser.uid}`);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (!window.confirm('TEM CERTEZA? Isso excluirá o motorista, todos os seus registros e sua posição no ranking. Esta ação é irreversível.')) return;

    try {
      const batch = writeBatch(db);
      
      // Delete user doc
      batch.delete(doc(db, 'users', uid));
      
      // Delete ranking doc
      batch.delete(doc(db, 'ranking', uid));
      
      // Delete all daily records
      const recordsQuery = query(collection(db, 'daily_records'), where('userId', '==', uid));
      const recordsSnapshot = await getDocs(recordsQuery);
      recordsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, 'delete', `users/${uid}`);
    }
  };

  const filteredUsers = users.filter(user => 
    user.nickname.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.phone.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-black text-white tracking-tighter flex items-center justify-center gap-3">
          <Shield className="w-8 h-8 text-indigo-400" /> PAINEL ADMIN
        </h2>
        <p className="text-slate-400 text-sm">Gerenciamento de motoristas e dados do sistema</p>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
        <input 
          type="text"
          placeholder="Buscar por nome ou celular..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        />
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredUsers.map((user) => (
          <motion.div 
            layout
            key={user.uid}
            className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-5 rounded-3xl flex items-center justify-between group hover:border-slate-700 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center">
                <Users className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-white font-bold">{user.nickname}</h4>
                  {user.isAdmin && (
                    <span className="bg-indigo-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase">Admin</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {user.phone}</span>
                  <span className="flex items-center gap-1"><Car className="w-3 h-3" /> {user.carModel || 'N/A'}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => handleEditUser(user)}
                className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-indigo-400 transition-all"
              >
                <Edit2 className="w-5 h-5" />
              </button>
              <button 
                onClick={() => handleDeleteUser(user.uid)}
                className="p-3 bg-slate-800 hover:bg-rose-500/20 rounded-xl text-rose-400 transition-all"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {isEditModalOpen && selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditModalOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">Editar Motorista</h3>
                <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 max-h-[80vh] overflow-y-auto custom-scrollbar">
                <form onSubmit={handleUpdateUser} className="space-y-4">
                  <h4 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-4">Informações Básicas</h4>
                  
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold uppercase ml-1">Nickname</label>
                    <input 
                      type="text"
                      value={editNickname}
                      onChange={(e) => setEditNickname(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold uppercase ml-1">Celular</label>
                    <input 
                      type="text"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold uppercase ml-1">Tipo de Veículo</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditVehicleType('Combustão')}
                        className={`flex-1 py-3 rounded-xl border transition-all text-xs font-bold ${
                          editVehicleType === 'Combustão' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'
                        }`}
                      >
                        Combustão
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditVehicleType('Elétrico')}
                        className={`flex-1 py-3 rounded-xl border transition-all text-xs font-bold ${
                          editVehicleType === 'Elétrico' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'
                        }`}
                      >
                        Elétrico
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold uppercase ml-1">Modelo do Carro</label>
                    <input 
                      type="text"
                      value={editCarModel}
                      onChange={(e) => setEditCarModel(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-800 rounded-xl">
                    <span className="text-xs font-bold text-white">Acesso Administrador</span>
                    <button
                      type="button"
                      onClick={() => setEditIsAdmin(!editIsAdmin)}
                      className={`w-10 h-5 rounded-full relative transition-all ${editIsAdmin ? 'bg-indigo-600' : 'bg-slate-600'}`}
                    >
                      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${editIsAdmin ? 'left-6' : 'left-1'}`} />
                    </button>
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    <Check className="w-5 h-5" /> Salvar Alterações
                  </button>
                </form>

                <div className="space-y-4">
                  <h4 className="text-xs font-black text-rose-400 uppercase tracking-widest mb-4">Registros de Ganhos</h4>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {loadingRecords ? (
                      <div className="flex justify-center py-10">
                        <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                      </div>
                    ) : userRecords.length === 0 ? (
                      <p className="text-center text-slate-600 text-xs py-10 italic">Nenhum registro encontrado.</p>
                    ) : (
                      userRecords.map(record => (
                        <div key={record.id} className="bg-slate-800/50 border border-slate-700 p-3 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="text-center">
                              <p className="text-[8px] text-slate-500 font-bold uppercase">{format(parseISO(record.date), 'MMM', { locale: ptBR })}</p>
                              <p className="text-sm font-black text-white">{format(parseISO(record.date), 'dd')}</p>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-emerald-400">R$ {record.totalPositive.toFixed(2)}</p>
                              <p className="text-[10px] text-slate-500">Saldo: R$ {record.balance.toFixed(2)}</p>
                            </div>
                          </div>
                          <button 
                            onClick={async () => {
                              if(window.confirm('Excluir este registro?')) {
                                await deleteDoc(doc(db, 'daily_records', record.id!));
                                setUserRecords(userRecords.filter(r => r.id !== record.id));
                              }
                            }}
                            className="p-2 text-slate-500 hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminPanel;
