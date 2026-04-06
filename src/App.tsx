import React, { useState, useEffect } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Ranking from './components/Ranking';
import Profile from './components/Profile';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import { motion, AnimatePresence } from 'motion/react';

type Tab = 'dashboard' | 'ranking' | 'profile';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-black text-white italic">M</span>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <ErrorBoundary>
        <Auth onAuthSuccess={() => {}} />
      </ErrorBoundary>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'ranking':
        return <Ranking />;
      case 'profile':
        return <Profile />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <ErrorBoundary>
      <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </Layout>
    </ErrorBoundary>
  );
}
