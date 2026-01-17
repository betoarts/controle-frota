import React, { useState, useEffect, useCallback } from 'react';
import { Layout } from './components/Layout';
import { Reservation, AppState } from './types';
import { analyzeItinerary, generateWeeklySummary } from './services/geminiService';
import { sendWebhook } from './services/webhookService';
import { UserLogin } from './components/UserLogin';
import { SchedulePage } from './components/SchedulePage';
import { GlobalHistory } from './components/GlobalHistory';
import { AdminDashboard } from './components/AdminDashboard';
import { userService, User } from './services/userService';
import { adminService } from './services/adminService';

const VEHICLES = [
  { id: 'polo-vw', name: 'Polo Volkswagen', icon: 'fa-car-side' }
];

interface NotificationState {
  show: boolean;
  message: string;
  type: 'success' | 'error' | 'warning';
}

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<AppState>('dashboard');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Estados de Dados e Erros da IA
  const [dashboardSummary, setDashboardSummary] = useState<string>('');
  const [fleetAnalysisError, setFleetAnalysisError] = useState<string | null>(null);

  // Estados de UI
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [notification, setNotification] = useState<NotificationState>({ show: false, message: '', type: 'success' });
  
  // Estado para controlar os inputs de KM final
  const [endKmValues, setEndKmValues] = useState<Record<string, string>>({});
  // Estado para controlar qual viagem está em processo de confirmação
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  // Estado para viagens ativas GLOBAIS (de todos os usuários)
  const [globalActiveTrips, setGlobalActiveTrips] = useState<Reservation[]>([]);

  // Gestão de Sessão do Usuário
  useEffect(() => {
    const savedUser = localStorage.getItem('nbapark_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  // Atalho de teclado secreto para Admin Dashboard (Ctrl+Shift+A)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        setActiveTab('admin-dashboard');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (user) {
      localStorage.setItem('nbapark_user', JSON.stringify(user));
      // Carregar reservas do Supabase se usuário estiver logado
      userService.getUserReservations(user.id)
        .then(setReservations)
        .catch(err => console.error("Erro ao carregar reservas:", err));
    }
  }, [user]);

  // Carregar dados iniciais do Cache (Apenas Resumo IA agora)
  useEffect(() => {
    // 2. Carregar Última Análise da Frota
    const savedSummary = localStorage.getItem('nbapark_summary');
    if (savedSummary) {
      setDashboardSummary(savedSummary);
    }
  }, []);

  // Sync manual ao mudar
  useEffect(() => {
    if (activeTab === 'dashboard') {
       // Atualiza status global do veículo
       userService.getActiveReservations().then(setGlobalActiveTrips).catch(console.error);
    }
    
    if (user) {
       userService.getUserReservations(user.id).then(setReservations).catch(console.error);
    }
  }, [activeTab]);

  // Salvar Resumo da IA no Cache sempre que mudar
  useEffect(() => {
    if (dashboardSummary) {
      localStorage.setItem('nbapark_summary', dashboardSummary);
    }
  }, [dashboardSummary]);

  // Limpar notificação automaticamente
  useEffect(() => {
    if (notification.show) {
      const timer = setTimeout(() => {
        setNotification(prev => ({ ...prev, show: false }));
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [notification.show]);

  // Função isolada para rodar a análise
  const runFleetAnalysis = useCallback(async () => {
    if (reservations.length === 0) {
      setDashboardSummary('');
      setFleetAnalysisError(null);
      return;
    }
    
    setIsAnalyzing(true);
    setFleetAnalysisError(null);
    
    try {
      const summary = await generateWeeklySummary(reservations);
      if (summary) {
        setDashboardSummary(summary);
      }
    } catch (e: any) {
      console.error("Falha na análise manual", e);
      setFleetAnalysisError(e.message || "Erro desconhecido ao analisar frota.");
    } finally {
      setIsAnalyzing(false);
    }
  }, [reservations]);

  // Trigger automático
  useEffect(() => {
    if (activeTab === 'dashboard' && reservations.length > 0 && !dashboardSummary && !fleetAnalysisError) {
      runFleetAnalysis();
    }
  }, [activeTab, reservations.length, dashboardSummary, fleetAnalysisError, runFleetAnalysis]);

  const handleStartReservation = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const formData = new FormData(e.currentTarget);
    const startOdo = Number(formData.get('startOdometer'));
    const name = formData.get('employeeName') as string;
    const itin = formData.get('itinerary') as string;
    const vehicle = formData.get('vehicle') as string;

    // Check if vehicle is blocked
    try {
      const vehicleStatus = await adminService.isVehicleBlocked(vehicle);
      if (vehicleStatus.blocked) {
        setNotification({
          show: true,
          type: 'error',
          message: `Veículo bloqueado: ${vehicleStatus.reason || 'Indisponível no momento'}`
        });
        setIsSubmitting(false);
        return;
      }
    } catch (error) {
      console.error('Error checking vehicle status:', error);
      // Continue anyway if check fails
    }

    const newRes: Reservation = {
      id: `res-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      employeeName: user?.name || name, // Prioriza usuário logado
      vehicle: vehicle,
      startOdometer: startOdo,
      itinerary: itin,
      startTime: new Date().toISOString(),
      status: 'active'
    };

    try {
      if (user) {
        await userService.createReservation(newRes, user.id);
      }
      
      // Dispara Webhook de Início
      sendWebhook({
        event: 'trip_start',
        tripId: newRes.id,
        motorista: newRes.employeeName,
        vehicle: vehicle,
        km_inicial: startOdo,
        itinerary: itin
      });

      setReservations(prev => [newRes, ...prev]);
      setIsSubmitting(false);
      setActiveTab('dashboard');
    } catch (error) {
       console.error("Erro ao criar reserva:", error);
       alert("Erro ao salvar registro no banco de dados.");
       setIsSubmitting(false);
       return;
    }
    
    // Tenta analisar com contexto rico (sem geolocalização do dispositivo)
    analyzeItinerary({
      itinerary: itin,
      vehicle: vehicle,
      startOdometer: startOdo,
      employeeName: name,
      startTime: newRes.startTime
    })
      .then((summary) => {
        if (summary) setDashboardSummary(summary);
      })
      .catch((err) => {
        console.error("Erro na análise:", err);
        const msg = err.message === 'API_KEY_MISSING' 
          ? 'Chave da API Gemini não configurada! Verifique o arquivo .env.local' 
          : err.message;
          
        setNotification({
          show: true,
          type: 'warning',
          message: `Erro na IA: ${msg}`
        });
      });
  };

  const initiateEndTrip = (id: string) => {
    const val = endKmValues[id];
    const trip = reservations.find(r => r.id === id);
    
    if (!trip) return;
    
    if (!val || val.trim() === "") {
      alert("Por favor, digite o KM final antes de encerrar.");
      return;
    }

    const endKm = Number(val);
    if (isNaN(endKm)) {
      alert("Valor de KM inválido.");
      return;
    }

    if (endKm < trip.startOdometer) {
      alert(`O KM final (${endKm}) deve ser maior ou igual ao inicial (${trip.startOdometer}).`);
      return;
    }

    setConfirmingId(id);
  };

  const confirmEndTrip = (id: string) => {
    const endKm = Number(endKmValues[id]);
    const trip = reservations.find(r => r.id === id);
    
    const updatedTrip = {
       ...trip,
       endOdometer: endKm,
       endTime: new Date().toISOString(),
       status: 'completed' as const
    };

    // Atualizar no Supabase
    const userId = user?.id || 'unknown';
    userService.updateReservation(updatedTrip as Reservation, userId)
      .then(() => {
         // Dispara Webhook de Encerramento (apenas se salvou ok)
         if (trip) {
            sendWebhook({
              event: 'trip_end',
              tripId: trip.id,
              motorista: trip.employeeName,
              vehicle: trip.vehicle,
              km_inicial: trip.startOdometer,
              km_final: endKm,
              km_total: endKm - trip.startOdometer,
              duracao_minutos: Math.round((new Date().getTime() - new Date(trip.startTime).getTime()) / 60000)
            });
         }
         
         setReservations(prev => prev.map(res => {
          if (res.id === id) {
            return updatedTrip as Reservation;
          }
          return res;
        }));
        
        triggerSuccessAnimation();
      })
      .catch(err => {
        console.error("Erro ao finalizar viagem:", err);
        alert("Erro ao salvar finalização. Tente novamente.");
      });

    setConfirmingId(null);
    setEndKmValues(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    // Removido triggerSuccessAnimation daqui para executar somente no sucesso da promise

    setConfirmingId(null);
    setEndKmValues(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    // triggerSuccessAnimation agora chamado no then
    // triggerSuccessAnimation();
  };

  const triggerSuccessAnimation = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }

    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

        osc.start();
        osc.stop(ctx.currentTime + 0.6);
      }
    } catch (e) {
      console.debug("Audio feedback prevented", e);
    }

    setShowSuccessOverlay(true);
    setTimeout(() => {
      setShowSuccessOverlay(false);
      setActiveTab('history');
    }, 1800);
  };

  const updateEndKmValue = (id: string, value: string) => {
    setEndKmValues(prev => ({ ...prev, [id]: value }));
    if (confirmingId === id) setConfirmingId(null);
  };

  const activeTrips = reservations.filter(r => r.status === 'active');
  const completedTrips = reservations.filter(r => r.status === 'completed');

  if (!user) {
    return <UserLogin onLogin={setUser} />;
  }

  // Admin Dashboard - renders outside of Layout for full screen
  if (activeTab === 'admin-dashboard') {
    return <AdminDashboard onExit={() => setActiveTab('dashboard')} />;
  }

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      
      {/* Sistema de Notificação Toast */}
      {notification.show && (
        <div className={`fixed top-4 right-4 z-[110] max-w-sm w-full p-4 rounded-xl shadow-2xl border-l-4 animate-slideUp bg-white
          ${notification.type === 'error' ? 'border-nba-red' : notification.type === 'warning' ? 'border-yellow-400' : 'border-nba-blue'}`}>
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <i className={`fas ${notification.type === 'error' ? 'fa-times-circle text-nba-red' : notification.type === 'warning' ? 'fa-exclamation-triangle text-yellow-400' : 'fa-check-circle text-nba-blue'} text-xl`}></i>
            </div>
            <div className="ml-3 w-0 flex-1 pt-0.5">
              <p className="text-sm font-black text-gray-800 uppercase tracking-wide">
                {notification.type === 'error' ? 'Erro' : notification.type === 'warning' ? 'Atenção' : 'Sucesso'}
              </p>
              <p className="mt-1 text-xs font-medium text-gray-500">{notification.message}</p>
            </div>
            <div className="ml-4 flex-shrink-0 flex">
              <button onClick={() => setNotification({ ...notification, show: false })} className="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none">
                <i className="fas fa-times"></i>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay de Sucesso */}
      {showSuccessOverlay && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1D428A]/90 backdrop-blur-md animate-fadeIn p-4">
          <div className="bg-white p-10 rounded-[3rem] shadow-2xl text-center animate-scaleIn relative overflow-hidden max-w-sm w-full">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#C8102E] to-[#1D428A]"></div>
            
            <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
              <i className="fas fa-check text-[#1D428A] text-5xl animate-bounceIn"></i>
            </div>
            
            <h3 className="text-[#1D428A] text-2xl font-black uppercase italic tracking-tighter mb-2 animate-slideUp">
              Viagem Finalizada!
            </h3>
            
            <p className="text-gray-400 font-bold text-xs uppercase tracking-widest animate-slideUp">
              Dados salvos com sucesso
            </p>
          </div>
        </div>
      )}

      {activeTab === 'dashboard' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Dashboard Summary IA & Errors */}
          {(reservations.length > 0) && (
            <>
              {fleetAnalysisError ? (
                // Card de Erro
                <div className="bg-white border-l-8 border-nba-red text-gray-800 p-6 rounded-3xl shadow-xl relative overflow-hidden group">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center mb-3">
                      <div className="bg-red-50 p-3 rounded-xl mr-3">
                        <i className="fas fa-exclamation-circle text-nba-red text-xl animate-pulse"></i>
                      </div>
                      <div>
                        <h3 className="font-black text-sm uppercase tracking-widest text-nba-red">Atenção na Análise</h3>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">Falha na conexão com Gemini AI</p>
                      </div>
                    </div>
                    <button 
                      onClick={runFleetAnalysis} 
                      className="text-gray-400 hover:text-nba-red hover:bg-red-50 p-2 rounded-full transition-all"
                      title="Tentar Novamente"
                    >
                      <i className="fas fa-redo-alt"></i>
                    </button>
                  </div>
                  <p className="text-sm font-medium text-gray-600 mt-2">
                    {fleetAnalysisError}
                  </p>
                  <div className="mt-4 flex">
                     <button onClick={runFleetAnalysis} className="text-xs font-black uppercase text-white bg-nba-red px-4 py-2 rounded-lg hover:bg-red-800 transition-colors shadow-lg shadow-red-200">
                        Tentar Novamente
                     </button>
                  </div>
                </div>
              ) : (
                // Card Normal de Sucesso/Loading
                <div className="bg-white border-l-8 border-nba-blue text-gray-800 p-6 rounded-3xl shadow-xl relative overflow-hidden group">
                  <div className="absolute -right-10 -top-10 w-40 h-40 bg-blue-50 rounded-full filter blur-3xl opacity-50 animate-pulse"></div>

                  <div className="flex justify-between items-start relative z-10">
                    <div className="flex items-center mb-3">
                      <div className="bg-blue-50 p-3 rounded-xl mr-3">
                        <i className={`fas fa-brain text-nba-blue text-xl ${isAnalyzing ? 'animate-pulse' : ''}`}></i>
                      </div>
                      <div>
                        <h3 className="font-black text-sm uppercase tracking-widest text-nba-blue">Inteligência de Frota</h3>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">Powered by Gemini AI</p>
                      </div>
                    </div>
                    <button 
                      onClick={runFleetAnalysis} 
                      disabled={isAnalyzing}
                      className="text-gray-400 hover:text-nba-blue hover:bg-blue-50 p-2 rounded-full transition-all disabled:opacity-50"
                      title="Atualizar Análise"
                    >
                      <i className={`fas fa-sync-alt ${isAnalyzing ? 'animate-spin' : ''}`}></i>
                    </button>
                  </div>

                  <div className="relative z-10 min-h-[3rem]">
                    {isAnalyzing ? (
                       <div className="flex items-center space-x-2 animate-pulse text-nba-blue text-sm font-medium italic">
                         <i className="fas fa-circle-notch animate-spin text-xs"></i>
                         <span>Processando dados da frota em tempo real...</span>
                       </div>
                    ) : (
                       <p className="text-sm md:text-base italic leading-relaxed font-medium text-gray-700">
                         {dashboardSummary || "Aguardando dados suficientes para gerar insights de performance..."}
                       </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Botão de Nova Saída (Desktop) */}
          <div className="hidden md:block">
            <button 
              onClick={() => setActiveTab('new-reservation')}
              className="w-full nba-red hover:bg-red-700 text-white font-black py-5 rounded-2xl shadow-xl flex items-center justify-center gap-3 transition-transform active:scale-[0.98]"
            >
              <i className="fas fa-plus-circle text-xl"></i>
              <span>INICIAR NOVO REGISTRO DE SAÍDA</span>
            </button>
          </div>

          {/* Veículos Ativos / Status Card */}
          <div className="space-y-4">
            
            {/* NOVO: Card de Status Global do Veículo */}
            {globalActiveTrips.length > 0 ? (
               <div className="bg-red-50 border-l-8 border-nba-red p-6 rounded-3xl shadow-lg relative overflow-hidden animate-pulse">
                  <div className="flex justify-between items-start relative z-10">
                     <div>
                        <h2 className="text-2xl font-black text-nba-red uppercase italic tracking-tighter mb-1">OCUPADO</h2>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Veículo em uso no momento</p>
                        
                        <div className="flex items-center gap-3 bg-white/50 p-2 rounded-xl backdrop-blur-sm">
                           <div className="w-10 h-10 bg-nba-red text-white rounded-full flex items-center justify-center font-black text-lg">
                              {globalActiveTrips[0].employeeName.charAt(0)}
                           </div>
                           <div>
                              <p className="text-[10px] font-black text-gray-400 uppercase">Motorista Atual</p>
                              <p className="text-sm font-black text-gray-800 uppercase leading-none">{globalActiveTrips[0].employeeName}</p>
                           </div>
                        </div>
                     </div>
                     <div className="bg-white p-3 rounded-2xl shadow-sm text-center min-w-[80px]">
                        <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Saída</p>
                        <p className="text-lg font-black text-nba-red">
                           {new Date(globalActiveTrips[0].startTime).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}
                        </p>
                     </div>
                  </div>
               </div>
            ) : (
               <div className="bg-green-50 border-l-8 border-green-500 p-6 rounded-3xl shadow-lg relative overflow-hidden">
                  <div className="flex justify-between items-center relative z-10">
                     <div>
                        <h2 className="text-2xl font-black text-green-600 uppercase italic tracking-tighter mb-1">D I S P O N Í V E L</h2>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Veículo livre para uso</p>
                     </div>
                     <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm">
                        <i className="fas fa-key text-2xl text-green-500"></i>
                     </div>
                  </div>
               </div>
            )}

            <div className="flex items-center justify-between px-2 mt-8">
              <h2 className="text-lg font-black text-gray-800 flex items-center uppercase italic">
                <i className="fas fa-satellite-dish text-nba-blue mr-2 text-xs"></i>
                Suas Atividades
              </h2>
              <span className="bg-nba-blue/10 text-nba-blue text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest border border-nba-blue/20">
                {activeTrips.length} Ativas
              </span>
            </div>
            
            {activeTrips.length === 0 ? (
              <div className="bg-white p-8 rounded-3xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-center opacity-60">
                <p className="font-bold text-gray-400 uppercase text-xs tracking-[0.2em]">Você não está utilizando nenhum veículo agora</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {activeTrips.map(trip => (
                  <div key={trip.id} className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                         <div className="flex items-center gap-2 mb-1">
                            <span className="bg-nba-blue text-white text-[9px] font-black px-2 py-1 rounded uppercase flex items-center gap-1">
                                <i className="fas fa-car-side text-[10px]"></i>
                                {trip.vehicle || 'Veículo'}
                            </span>
                         </div>
                        <h4 className="font-black text-gray-800 text-xl uppercase tracking-tighter leading-none">{trip.employeeName}</h4>
                        <div className="flex gap-2 mt-2">
                          <span className="bg-gray-100 text-gray-600 text-[9px] font-black px-2 py-1 rounded uppercase border border-gray-200">
                            KM: {trip.startOdometer}
                          </span>
                          <span className="bg-blue-50 text-nba-blue text-[9px] font-black px-2 py-1 rounded uppercase border border-blue-100">
                            Saída: {new Date(trip.startTime).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-1 bg-green-50 text-green-600 px-2 py-1 rounded-full border border-green-100">
                           <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                           <span className="text-[8px] font-black uppercase tracking-wider">Em Rota</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-2xl mb-5 text-sm border-l-4 border-nba-red">
                      <p className="text-gray-400 font-black uppercase text-[8px] tracking-[0.2em] mb-1">Itinerário</p>
                      <p className="text-gray-700 font-bold italic">"{trip.itinerary}"</p>
                    </div>

                    {confirmingId === trip.id ? (
                      <div className="bg-white p-6 rounded-2xl flex flex-col gap-4 animate-fadeIn shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] border border-gray-100 relative overflow-hidden group-hover:border-nba-blue/20 transition-all">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 to-nba-red"></div>
                        
                        <div className="flex flex-col items-center justify-center mt-2">
                           <div className="w-14 h-14 bg-yellow-50 rounded-full flex items-center justify-center mb-3 shadow-sm">
                             <i className="fas fa-exclamation-triangle text-yellow-500 text-2xl animate-pulse"></i>
                           </div>
                           <h4 className="text-center font-black uppercase text-gray-800 text-sm tracking-widest">Confirmar Encerramento</h4>
                           <p className="text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">Deseja finalizar esta viagem?</p>
                        </div>
                        
                        <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100 flex flex-col items-center justify-center">
                           <p className="text-[9px] font-black text-gray-400 uppercase mb-1 tracking-widest">Odômetro Final</p>
                           <div className="flex items-baseline gap-1">
                             <p className="text-3xl font-black text-gray-800">{endKmValues[trip.id]}</p>
                             <span className="text-xs font-bold text-gray-400">KM</span>
                           </div>
                        </div>
                        
                        <div className="flex gap-3 mt-1">
                          <button 
                            onClick={() => setConfirmingId(null)}
                            className="flex-1 py-3 bg-gray-100 text-gray-500 rounded-xl font-bold text-xs uppercase hover:bg-gray-200 transition-colors"
                          >
                            Cancelar
                          </button>
                          <button 
                            onClick={() => confirmEndTrip(trip.id)}
                            className="flex-[1.5] nba-red text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[#1D428A] shadow-lg shadow-red-900/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                          >
                            <span>Confirmar</span>
                            <i className="fas fa-check"></i>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1 relative group">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <i className="fas fa-tachometer-alt text-gray-400 group-focus-within:text-nba-blue transition-colors"></i>
                          </div>
                          <input 
                            type="number" 
                            inputMode="numeric"
                            value={endKmValues[trip.id] || ''}
                            onChange={(e) => updateEndKmValue(trip.id, e.target.value)}
                            placeholder="KM Final" 
                            className="w-full pl-10 pr-4 py-4 rounded-2xl bg-gray-50 border-2 border-transparent focus:bg-white focus:border-nba-blue outline-none text-sm font-black transition-all text-gray-800 placeholder-gray-400"
                          />
                        </div>
                        <button 
                          onClick={() => initiateEndTrip(trip.id)}
                          className="nba-red hover:bg-red-700 text-white font-black px-6 py-4 rounded-2xl shadow-lg active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                        >
                          <span>Encerrar</span>
                          <i className="fas fa-flag-checkered"></i>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'new-reservation' && (
        <div className="animate-fadeIn max-w-2xl mx-auto">
          <div className="flex items-center mb-8">
            <button onClick={() => setActiveTab('dashboard')} className="mr-4 w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-nba-blue shadow-sm border border-gray-100 hover:shadow-md transition-all">
              <i className="fas fa-chevron-left"></i>
            </button>
            <h2 className="text-2xl font-black text-gray-800 uppercase italic tracking-tighter">Novo Log de Saída</h2>
          </div>

          <form onSubmit={handleStartReservation} className="bg-white p-8 rounded-[2.5rem] shadow-2xl space-y-8 border border-gray-100">
            <div className="space-y-6">
              
              {/* Seleção de Veículo */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 mb-3 uppercase tracking-[0.2em]">Selecione o Veículo</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                    <i className="fas fa-car text-gray-300 group-focus-within:text-nba-blue transition-colors"></i>
                  </div>
                  <select 
                    required
                    name="vehicle"
                    className="w-full pl-12 pr-6 py-5 rounded-2xl bg-gray-50 border-2 border-transparent focus:bg-white focus:border-nba-blue outline-none transition-all font-bold text-gray-800 text-lg shadow-inner appearance-none"
                  >
                    {VEHICLES.map(v => (
                      <option key={v.id} value={v.name}>{v.name}</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-5 flex items-center pointer-events-none">
                     <i className="fas fa-chevron-down text-gray-400"></i>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 mb-3 uppercase tracking-[0.2em]">Responsável pelo Veículo</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                    <i className="fas fa-user-tie text-gray-300 group-focus-within:text-nba-blue transition-colors"></i>
                  </div>
                    <input 
                    required
                    name="employeeName"
                    type="text" 
                    defaultValue={user?.name}
                    readOnly
                    className="w-full pl-12 pr-6 py-5 rounded-2xl bg-gray-100 border-2 border-transparent focus:bg-white focus:border-nba-blue outline-none transition-all font-bold text-gray-800 text-lg shadow-inner cursor-not-allowed opacity-75"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 mb-3 uppercase tracking-[0.2em]">Odômetro Inicial</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                       <i className="fas fa-road text-gray-300 group-focus-within:text-nba-blue transition-colors"></i>
                    </div>
                    <input 
                      required
                      name="startOdometer"
                      type="number" 
                      placeholder="KM Atual"
                      className="w-full pl-12 pr-6 py-5 rounded-2xl bg-gray-50 border-2 border-transparent focus:bg-white focus:border-nba-blue outline-none transition-all font-bold text-gray-800 text-lg shadow-inner"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 mb-3 uppercase tracking-[0.2em]">Horário de Saída</label>
                  <div className="w-full px-6 py-5 rounded-2xl bg-gray-100 text-gray-500 font-black flex items-center border-2 border-transparent">
                    <i className="fas fa-clock mr-3 text-nba-blue"></i>
                    {new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 mb-3 uppercase tracking-[0.2em]">Objetivo e Destino</label>
                <textarea 
                  required
                  name="itinerary"
                  rows={4}
                  placeholder="Ex: Reunião Filial Sul + Abastecimento"
                  className="w-full p-6 rounded-2xl bg-gray-50 border-2 border-transparent focus:bg-white focus:border-nba-blue outline-none transition-all font-bold text-gray-800 text-lg shadow-inner resize-none"
                ></textarea>
              </div>
            </div>

            <button 
              disabled={isSubmitting}
              className={`w-full py-6 rounded-2xl text-white font-black text-xl shadow-2xl transition-all flex items-center justify-center gap-4 ${isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'nba-blue hover:scale-[1.02] active:scale-[0.98] hover:shadow-blue-300'}`}
            >
              {isSubmitting ? (
                <i className="fas fa-circle-notch animate-spin text-2xl"></i>
              ) : (
                <>
                  <i className="fas fa-check-double text-2xl"></i>
                  <span>REGISTRAR SAÍDA</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="animate-fadeIn space-y-6">
          <div className="flex justify-between items-center bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
            <div>
              <h2 className="text-xl font-black text-gray-800 uppercase italic leading-tight">Registros Passados</h2>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Logs de quilometragem NBAPARK</p>
            </div>
            <div className="grid grid-cols-3 gap-2 w-full mt-4 md:mt-0 md:w-auto">
              <input 
                type="file" 
                accept=".csv"
                className="hidden"
                id="csv-upload"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  const reader = new FileReader();
                  reader.onload = (evt) => {
                    const text = evt.target?.result as string;
                    if (!text) return;

                    try {
                      const lines = text.split('\n');
                      // Remove header
                      const dataLines = lines.slice(1).filter(l => l.trim() !== '');
                      
                      const parsedReservations: Reservation[] = dataLines.map(line => {
                        // Regex simples para CSV (considerando que não há vírgulas DENTRO dos campos além do itinerário que está entre aspas)
                        // Limitação: isso falha se houver inputs complexos, mas funciona para o formato exportado
                        const cols = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
                        // Fallback split se regex falhar
                        const splitCols = line.split(','); 
                        
                        // Função helper para limpar aspas
                        const clean = (s: string) => s ? s.replace(/^"|"$/g, '') : '';
                        
                        // Parse da data PT-BR (dd/mm/yyyy hh:mm:ss ou dd/mm/yyyy, hh:mm:ss) para ISO
                        const parseDate = (d: string) => {
                          const cleanD = clean(d);
                          if (!cleanD || cleanD === '-') return undefined;
                          
                          // Tenta formato ISO direto
                          if (cleanD.includes('-') && cleanD.includes('T')) return new Date(cleanD).toISOString();

                          // Tenta parse de formatos locais PT-BR
                          if (cleanD.includes('/')) {
                             // Remove virgula extra se houver e divide por espaço
                             const parts = cleanD.replace(',', '').split(' ');
                             const datePart = parts[0]; 
                             const timePart = parts[1] || '00:00:00';
                             
                             const [day, month, year] = datePart.split('/').map(Number);
                             const [hours, minutes, seconds] = timePart.split(':').map(Number);
                             
                             if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                                return new Date(year, month - 1, day, hours || 0, minutes || 0, seconds || 0).toISOString();
                             }
                          }
                          
                          // Fallback
                          try {
                            return new Date(cleanD).toISOString();
                          } catch (e) {
                            return undefined;
                          }
                        };

                        // Mapeamento baseado na ordem do Export:
                        // ID[0], Motorista[1], Veículo[2], Saída[3], Chegada[4], KM Ini[5], KM Fim[6], KM Total[7], Itin[8]
                        const p: string[] = [];
                        let display = '';
                        let inQuote = false;
                        for (let i = 0; i < line.length; i++) {
                          const char = line[i];
                          if (char === '"') { inQuote = !inQuote; continue; }
                          if (char === ',' && !inQuote) { p.push(display); display = ''; continue; }
                          display += char;
                        }
                        p.push(display);

                        return {
                          id: p[0],
                          employeeName: p[1],
                          vehicle: p[2],
                          startOdometer: Number(p[5]),
                          endOdometer: p[6] !== '-' ? Number(p[6]) : undefined,
                          startTime: parseDate(p[3]) || new Date().toISOString(),
                          endTime: parseDate(p[4]),
                          itinerary: p[8].replace(/""/g, '"'), // Unescape double quotes
                          status: (p[6] !== '-' && p[4] !== '-') ? 'completed' : 'active'
                        };
                      });

                      // Merge evitando duplicatas
                      setReservations(prev => {
                        const newIds = new Set(parsedReservations.map(r => r.id));
                        const filteredPrev = prev.filter(r => !newIds.has(r.id));
                        return [...parsedReservations, ...filteredPrev].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
                      });
                      
                      alert(`${parsedReservations.length} registros importados com sucesso!`);
                      e.target.value = ''; // Reset input

                    } catch (err) {
                      console.error(err);
                      alert("Erro ao importar CSV. Verifique o formato do arquivo.");
                    }
                  };
                  reader.readAsText(file);
                }}
              />
              <button 
                onClick={() => document.getElementById('csv-upload')?.click()}
                className="flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 text-gray-600 p-3 rounded-2xl transition-all active:scale-95 border border-gray-100 shadow-sm"
              >
                <i className="fas fa-file-import text-xl mb-1 text-nba-blue"></i>
                <span className="text-[9px] font-black uppercase tracking-wide">Importar</span>
              </button>
              <button 
                onClick={() => {
                  const headers = ["ID", "Motorista", "Veículo", "Saída", "Chegada", "KM Inicial", "KM Final", "KM Total", "Itinerário"];
                  const csvContent = [
                    headers.join(","),
                    ...reservations.map(r => {
                      const kmTotal = r.endOdometer ? (r.endOdometer - r.startOdometer) : 0;
                      return [
                        r.id,
                        `"${r.employeeName}"`,
                        `"${r.vehicle}"`,
                        new Date(r.startTime).toISOString(), // Changed to ISO
                        r.endTime ? new Date(r.endTime).toISOString() : "-", // Changed to ISO
                        r.startOdometer,
                        r.endOdometer || "-",
                        kmTotal,
                        `"${r.itinerary.replace(/"/g, '""')}"`
                      ].join(",");
                    })
                  ].join("\n");

                  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.setAttribute("href", url);
                  link.setAttribute("download", `frota_nbapark_${new Date().toISOString().split('T')[0]}.csv`);
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="flex flex-col items-center justify-center bg-blue-50 hover:bg-blue-100 text-nba-blue p-3 rounded-2xl transition-all active:scale-95 border border-blue-100 shadow-sm"
              >
                <i className="fas fa-file-export text-xl mb-1"></i>
                <span className="text-[9px] font-black uppercase tracking-wide">Baixar</span>
              </button>
              <button 
                onClick={() => {
                  if(confirm('Deseja sair da sua conta?')) {
                    setUser(null);
                    setReservations([]);
                    localStorage.removeItem('nbapark_user');
                    localStorage.removeItem('nbapark_summary');
                  }
                }}
                className="flex flex-col items-center justify-center bg-red-50 hover:bg-red-100 text-nba-red p-3 rounded-2xl transition-all active:scale-95 border border-red-100 shadow-sm"
              >
                <i className="fas fa-trash-alt text-xl mb-1"></i>
                <span className="text-[9px] font-black uppercase tracking-wide">Limpar</span>
              </button>
            </div>
          </div>

          {completedTrips.length === 0 ? (
            <div className="bg-white p-20 rounded-[3rem] text-center shadow-inner border border-gray-100 border-dashed opacity-50">
               <i className="fas fa-history text-gray-200 text-7xl mb-6"></i>
               <p className="text-gray-400 font-black uppercase tracking-[0.3em] text-xs">Sem registros</p>
            </div>
          ) : (
            <div className="space-y-4 pb-10">
              {completedTrips.map(trip => {
                const kmDiff = (trip.endOdometer || 0) - trip.startOdometer;
                return (
                  <div key={trip.id} className="bg-white rounded-[2rem] overflow-hidden shadow-sm border border-gray-100 hover:border-nba-blue/30 transition-all group">
                    <div className="nba-blue text-white px-6 py-4 flex justify-between items-center group-hover:bg-blue-800 transition-colors">
                      <div className="flex items-center gap-3">
                        <i className="fas fa-check-circle text-green-400"></i>
                        <span className="text-sm font-black uppercase tracking-widest">{trip.employeeName}</span>
                      </div>
                      <span className="text-[10px] font-black opacity-60 bg-black/20 px-3 py-1 rounded-full uppercase">
                        {new Date(trip.startTime).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
                      <div className="md:col-span-2">
                         <div className="flex items-center gap-2 mb-2">
                             <span className="text-[9px] font-black uppercase text-nba-blue bg-blue-50 px-2 py-1 rounded">
                                <i className="fas fa-car mr-1"></i>
                                {trip.vehicle || 'Polo Volkswagen'}
                             </span>
                         </div>
                        <p className="text-[8px] text-gray-400 font-black uppercase tracking-[0.2em] mb-2">Resumo da Viagem</p>
                        <p className="text-base font-bold text-gray-700 leading-snug underline decoration-nba-red/20 underline-offset-4 decoration-2">{trip.itinerary}</p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-2xl flex flex-col justify-center items-center border border-gray-100 shadow-inner">
                        <p className="text-[8px] text-gray-400 font-black uppercase mb-1">Rodagem</p>
                        <p className="text-3xl font-black text-nba-red leading-none">{kmDiff}<span className="text-xs ml-1">KM</span></p>
                      </div>
                      <div className="text-right space-y-1">
                        <p className="text-[9px] font-black text-gray-400 uppercase">Período</p>
                        <div className="text-[11px] font-bold text-gray-600 flex flex-col">
                           <span>{new Date(trip.startTime).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})} Saída</span>
                           <i className="fas fa-long-arrow-alt-down my-1 text-center text-gray-200"></i>
                           <span>{trip.endTime ? new Date(trip.endTime).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}) : '--:--'} Volta</span>
                        </div>
                      </div>
                      <div className="md:col-span-4 border-t border-dashed pt-5 mt-2 flex flex-wrap justify-between items-center text-[10px] text-gray-400 font-black gap-4 uppercase tracking-tighter">
                        <div className="flex items-center gap-4 bg-gray-50 px-4 py-2 rounded-full border border-gray-100">
                           <span className="flex items-center gap-1"><i className="fas fa-play text-[8px] text-nba-blue"></i> INÍCIO: {trip.startOdometer} KM</span>
                           <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
                           <span className="flex items-center gap-1"><i className="fas fa-stop text-[8px] text-nba-red"></i> FIM: {trip.endOdometer} KM</span>
                        </div>
                        <div className="flex items-center gap-2 text-nba-blue opacity-50">
                          <i className="fas fa-fingerprint"></i>
                          <span>ID: {trip.id.split('-')[1]}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'scheduling' && (
        <SchedulePage user={user} />
      )}

      {activeTab === 'global-history' && (
        <GlobalHistory />
      )}
    </Layout>
  );
};

export default App;
