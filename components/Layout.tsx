
import React from 'react';
import { AppState } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: AppState;
  setActiveTab: (tab: AppState) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-200 justify-center items-center pb-20 md:pb-0">
      
      {/* Mobile Frame Container */}
      <div className="w-full max-w-md bg-gray-50 min-h-[100dvh] md:min-h-[90vh] md:max-h-[90vh] md:rounded-[3rem] shadow-2xl overflow-y-auto relative scrollbar-hide flex flex-col">
        
        {/* Header */}
        <header className="nba-blue text-white shadow-lg sticky top-0 z-50 md:rounded-t-[3rem]">
          <div className="px-6 py-5 flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="bg-white rounded-full p-2">
                 <i className="fas fa-basketball-ball text-nba-red text-2xl animate-bounce-slow"></i>
              </div>
              <div>
                <h1 className="text-xl font-extrabold tracking-tighter">NBAPARK</h1>
                <p className="text-xs opacity-80 uppercase font-semibold">Logística & Frota</p>
              </div>
            </div>
            {/* Desktop-like nav moved inside the mobile frame if needed, or hidden if using bottom nav only */}
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 w-full px-4 py-6">
          {children}
        </main>

        {/* Mobile Bottom Nav */}
        <nav className="md:absolute md:bottom-0 fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-200 flex justify-around items-center py-3 px-2 z-50 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] md:rounded-b-[3rem]">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center ${activeTab === 'dashboard' ? 'text-nba-blue' : 'text-gray-400'}`}
          >
            <i className="fas fa-chart-line text-xl"></i>
            <span className="text-[10px] font-bold mt-1">Início</span>
          </button>
          <button 
            onClick={() => setActiveTab('new-reservation')}
            className="relative -top-6 nba-red w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl border-4 border-gray-50 active:scale-95 transition-transform"
          >
            <i className="fas fa-plus text-2xl"></i>
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center ${activeTab === 'history' ? 'text-nba-blue' : 'text-gray-400'}`}
          >
            <i className="fas fa-history text-xl"></i>
            <span className="text-[10px] font-bold mt-1">Logs</span>
          </button>
        </nav>
      
      </div>
    </div>
  );
};
