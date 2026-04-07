import React from 'react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { motion } from 'motion/react';
import { 
  LayoutDashboard, 
  Trophy, 
  User, 
  LogOut, 
  MessageCircle,
  Menu,
  X,
  Shield
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: 'dashboard' | 'ranking' | 'profile' | 'admin';
  setActiveTab: (tab: 'dashboard' | 'ranking' | 'profile' | 'admin') => void;
  isAdmin?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, isAdmin }) => {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  const handleSignOut = async () => {
    if (window.confirm('Deseja sair da sua conta?')) {
      await signOut(auth);
      window.location.reload();
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'ranking', label: 'Ranking', icon: Trophy },
    { id: 'profile', label: 'Perfil', icon: User },
  ];

  if (isAdmin) {
    navItems.push({ id: 'admin', label: 'Admin', icon: Shield });
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-indigo-500/30">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-slate-900 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
              <span className="text-xl font-black italic tracking-tighter">M</span>
            </div>
            <h1 className="text-2xl font-black tracking-tighter">MOBY</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <a 
              href="https://wa.me/5547974008115" 
              target="_blank" 
              className="hidden sm:flex items-center gap-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 px-4 py-2 rounded-xl text-sm font-bold transition-all border border-emerald-500/20"
            >
              <MessageCircle className="w-4 h-4" /> Suporte
            </a>
            <button 
              onClick={handleSignOut}
              className="p-2 hover:bg-slate-900 rounded-xl text-slate-400 hover:text-rose-400 transition-all"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {children}
      </main>

      {/* Mobile Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/80 backdrop-blur-2xl border-t border-slate-900 px-6 py-3 pb-8 sm:pb-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`flex flex-col items-center gap-1 transition-all ${
                activeTab === item.id ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <div className={`p-2 rounded-2xl transition-all ${
                activeTab === item.id ? 'bg-indigo-500/10' : ''
              }`}>
                <item.icon className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* WhatsApp Floating Button (Mobile) */}
      <a 
        href="https://wa.me/5547974008115" 
        target="_blank" 
        className="sm:hidden fixed bottom-24 right-6 z-50 bg-emerald-500 hover:bg-emerald-400 text-white p-4 rounded-full shadow-2xl shadow-emerald-500/20 transition-all active:scale-90"
      >
        <MessageCircle className="w-6 h-6" />
      </a>
    </div>
  );
};

export default Layout;
