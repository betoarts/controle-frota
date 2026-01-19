import React, { useState, useEffect, useCallback } from 'react';
import { adminService, DashboardStats, UserRanking, ActivityItem, VehicleStatus, ReportFilters } from '../services/adminService';
import { Reservation } from '../types';

interface AdminDashboardProps {
  onExit: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onExit }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [rankings, setRankings] = useState<UserRanking[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [vehicles, setVehicles] = useState<VehicleStatus[]>([]);
  const [reportData, setReportData] = useState<Reservation[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeSection, setActiveSection] = useState<'overview' | 'ranking' | 'activity' | 'vehicles' | 'reports'>('overview');
  
  // Report filters
  const [filters, setFilters] = useState<ReportFilters>({});
  
  // Vehicle block modal
  const [blockingVehicle, setBlockingVehicle] = useState<VehicleStatus | null>(null);
  const [blockReason, setBlockReason] = useState('');
  
  // Check if desktop
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Clock
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Load data
  const loadData = useCallback(async () => {
    try {
      const [statsData, rankingsData, activitiesData, vehiclesData] = await Promise.all([
        adminService.getDashboardStats(),
        adminService.getUserRankings(),
        adminService.getActivityFeed(),
        adminService.getVehicleStatus()
      ]);
      
      setStats(statsData);
      setRankings(rankingsData);
      setActivities(activitiesData);
      setVehicles(vehiclesData);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Load report data
  const loadReportData = async () => {
    try {
      const data = await adminService.getDetailedReport(filters);
      setReportData(data);
    } catch (error) {
      console.error('Error loading report:', error);
    }
  };

  useEffect(() => {
    if (activeSection === 'reports') {
      loadReportData();
    }
  }, [activeSection, filters]);

  // Export CSV
  const exportCSV = () => {
    if (reportData.length === 0) return alert('Sem dados para exportar.');

    const headers = ['ID', 'Motorista', 'Veículo', 'Data Saída', 'Hora Saída', 'Data Volta', 'Hora Volta', 'KM Inicial', 'KM Final', 'KM Total', 'Itinerário', 'Status'];
    
    const csvContent = [
      headers.join(','),
      ...reportData.map(r => {
        const start = new Date(r.startTime);
        const end = r.endTime ? new Date(r.endTime) : null;
        const kmDiff = (r.endOdometer || 0) - r.startOdometer;
        
        return [
          r.id,
          `"${r.employeeName}"`,
          `"${r.vehicle}"`,
          start.toLocaleDateString('pt-BR'),
          start.toLocaleTimeString('pt-BR'),
          end ? end.toLocaleDateString('pt-BR') : '-',
          end ? end.toLocaleTimeString('pt-BR') : '-',
          r.startOdometer,
          r.endOdometer || '-',
          r.endOdometer ? kmDiff : '-',
          `"${r.itinerary || ''}"`,
          r.status
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_frota_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Block/Unblock vehicle
  const handleBlockVehicle = async () => {
    if (!blockingVehicle || !blockReason.trim()) return;
    
    try {
      await adminService.blockVehicle(blockingVehicle.id, blockReason, 'Admin');
      setBlockingVehicle(null);
      setBlockReason('');
      loadData();
    } catch (error) {
      console.error('Error blocking vehicle:', error);
      alert('Erro ao bloquear veículo.');
    }
  };

  const handleUnblockVehicle = async (vehicleId: string) => {
    try {
      await adminService.unblockVehicle(vehicleId);
      loadData();
    } catch (error) {
      console.error('Error unblocking vehicle:', error);
      alert('Erro ao desbloquear veículo.');
    }
  };

  // Mobile warning
  if (!isDesktop) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center p-8">
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-10 text-center max-w-md border border-white/20">
          <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="fas fa-desktop text-yellow-400 text-4xl"></i>
          </div>
          <h2 className="text-2xl font-black text-white uppercase tracking-wider mb-4">Desktop Necessário</h2>
          <p className="text-gray-300 mb-6">Esta dashboard está disponível apenas em dispositivos desktop para melhor visualização dos dados.</p>
          <button 
            onClick={onExit}
            className="bg-white/20 hover:bg-white/30 text-white font-bold px-6 py-3 rounded-xl transition-all"
          >
            <i className="fas fa-arrow-left mr-2"></i>
            Voltar ao App
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <i className="fas fa-circle-notch animate-spin text-6xl text-blue-400 mb-6"></i>
          <p className="text-white font-bold uppercase tracking-widest">Carregando Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 text-white">
      
      {/* Header */}
      <header className="bg-black/30 backdrop-blur-xl border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="NBAPARK Logo" className="h-14 w-auto drop-shadow-lg" />
            <div>
              <h1 className="text-1 font-black uppercase tracking-tighter">Admin Dashboard</h1>
              <p className="text-xs font-bold text-red-400 uppercase tracking-[0.3em]"></p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-2xl font-black tabular-nums">
                {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
              <p className="text-xs text-gray-400 font-bold uppercase">
                {currentTime.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
            
            <div className="flex items-center gap-2 bg-green-500/20 px-3 py-2 rounded-xl border border-green-500/30">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              <span className="text-xs font-bold text-green-400 uppercase">Live</span>
            </div>
            
            <button 
              onClick={onExit}
              className="bg-white/10 hover:bg-white/20 p-3 rounded-xl transition-all"
              title="Voltar ao App"
            >
              <i className="fas fa-times text-xl"></i>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        
        {/* Navigation Tabs */}
        <nav className="flex gap-2 mb-8 bg-black/20 p-2 rounded-2xl backdrop-blur-sm">
          {[
            { id: 'overview', icon: 'fa-chart-pie', label: 'Visão Geral' },
            { id: 'ranking', icon: 'fa-trophy', label: 'Ranking' },
            { id: 'activity', icon: 'fa-stream', label: 'Atividades' },
            { id: 'vehicles', icon: 'fa-car', label: 'Veículos' },
            { id: 'reports', icon: 'fa-file-export', label: 'Relatórios' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold uppercase text-sm tracking-wider transition-all ${
                activeSection === tab.id 
                  ? 'bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg' 
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <i className={`fas ${tab.icon}`}></i>
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Overview Section */}
        {activeSection === 'overview' && (
          <div className="space-y-8 animate-fadeIn">
            {/* KPI Cards */}
            <div className="grid grid-cols-4 gap-6">
              <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 backdrop-blur-xl rounded-3xl p-6 border border-blue-500/20 group hover:border-blue-400/40 transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="bg-blue-500/30 p-3 rounded-xl">
                    <i className="fas fa-road text-blue-300 text-2xl"></i>
                  </div>
                  <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Total</span>
                </div>
                <p className="text-4xl font-black mb-1">{stats?.totalTrips.toLocaleString('pt-BR')}</p>
                <p className="text-sm text-gray-400 font-bold uppercase">Viagens Realizadas</p>
              </div>

              <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 backdrop-blur-xl rounded-3xl p-6 border border-green-500/20 group hover:border-green-400/40 transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="bg-green-500/30 p-3 rounded-xl">
                    <i className="fas fa-tachometer-alt text-green-300 text-2xl"></i>
                  </div>
                  <span className="text-xs font-bold text-green-400 uppercase tracking-wider">KM</span>
                </div>
                <p className="text-4xl font-black mb-1">{stats?.totalKm.toLocaleString('pt-BR')}</p>
                <p className="text-sm text-gray-400 font-bold uppercase">Quilômetros Rodados</p>
              </div>

              <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 backdrop-blur-xl rounded-3xl p-6 border border-purple-500/20 group hover:border-purple-400/40 transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="bg-purple-500/30 p-3 rounded-xl">
                    <i className="fas fa-users text-purple-300 text-2xl"></i>
                  </div>
                  <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">Cadastros</span>
                </div>
                <p className="text-4xl font-black mb-1">{stats?.totalUsers}</p>
                <p className="text-sm text-gray-400 font-bold uppercase">Usuários Ativos</p>
              </div>

              <div className="bg-gradient-to-br from-orange-500/20 to-red-600/10 backdrop-blur-xl rounded-3xl p-6 border border-orange-500/20 group hover:border-orange-400/40 transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="bg-orange-500/30 p-3 rounded-xl">
                    <i className="fas fa-fire text-orange-300 text-2xl animate-pulse"></i>
                  </div>
                  <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">Agora</span>
                </div>
                <p className="text-4xl font-black mb-1">{stats?.activeTripsNow}</p>
                <p className="text-sm text-gray-400 font-bold uppercase">Viagens Ativas</p>
              </div>
            </div>

            {/* Quick View: Top 3 + Recent Activity */}
            <div className="grid grid-cols-2 gap-6">
              {/* Top 3 */}
              <div className="bg-black/30 backdrop-blur-xl rounded-3xl p-6 border border-white/10">
                <h3 className="text-lg font-black uppercase tracking-wider mb-4 flex items-center gap-2">
                  <i className="fas fa-trophy text-yellow-400"></i>
                  Top 3 Motoristas
                </h3>
                <div className="space-y-3">
                  {rankings.slice(0, 3).map((user, index) => (
                    <div key={user.userId} className="flex items-center gap-4 bg-white/5 p-4 rounded-xl">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-lg ${
                        index === 0 ? 'bg-yellow-500 text-black' :
                        index === 1 ? 'bg-gray-400 text-black' :
                        'bg-orange-700 text-white'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-black uppercase">{user.userName}</p>
                        <p className="text-xs text-gray-400">{user.tripCount} viagens</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-black text-blue-400">{user.totalKm.toLocaleString('pt-BR')}</p>
                        <p className="text-xs text-gray-500">KM</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-black/30 backdrop-blur-xl rounded-3xl p-6 border border-white/10">
                <h3 className="text-lg font-black uppercase tracking-wider mb-4 flex items-center gap-2">
                  <i className="fas fa-stream text-blue-400"></i>
                  Atividade Recente
                </h3>
                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2">
                  {activities.slice(0, 8).map(activity => (
                    <div key={activity.id} className="flex items-center gap-3 bg-white/5 p-3 rounded-xl text-sm">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        activity.type === 'trip_start' ? 'bg-green-500/30 text-green-400' :
                        activity.type === 'trip_end' ? 'bg-red-500/30 text-red-400' :
                        'bg-blue-500/30 text-blue-400'
                      }`}>
                        <i className={`fas ${
                          activity.type === 'trip_start' ? 'fa-play' :
                          activity.type === 'trip_end' ? 'fa-stop' :
                          'fa-sign-in-alt'
                        } text-xs`}></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold truncate">{activity.userName}</p>
                        <p className="text-xs text-gray-500 truncate">{activity.details}</p>
                      </div>
                      <p className="text-xs text-gray-500 whitespace-nowrap">
                        {new Date(activity.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Ranking Section */}
        {activeSection === 'ranking' && (
          <div className="bg-black/30 backdrop-blur-xl rounded-3xl p-8 border border-white/10 animate-fadeIn">
            <h3 className="text-xl font-black uppercase tracking-wider mb-6 flex items-center gap-3">
              <i className="fas fa-trophy text-yellow-400"></i>
              Ranking de Motoristas
              <span className="text-sm font-normal text-gray-400 ml-auto">Top 10 por KM rodados</span>
            </h3>
            
            <div className="overflow-hidden rounded-2xl">
              <table className="w-full">
                <thead className="bg-white/10">
                  <tr>
                    <th className="text-left py-4 px-6 text-xs font-black uppercase tracking-wider text-gray-400">#</th>
                    <th className="text-left py-4 px-6 text-xs font-black uppercase tracking-wider text-gray-400">Motorista</th>
                    <th className="text-right py-4 px-6 text-xs font-black uppercase tracking-wider text-gray-400">Total KM</th>
                    <th className="text-right py-4 px-6 text-xs font-black uppercase tracking-wider text-gray-400">Viagens</th>
                    <th className="text-right py-4 px-6 text-xs font-black uppercase tracking-wider text-gray-400">Média</th>
                  </tr>
                </thead>
                <tbody>
                  {rankings.map((user, index) => (
                    <tr key={user.userId} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-4 px-6">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black ${
                          index === 0 ? 'bg-yellow-500 text-black' :
                          index === 1 ? 'bg-gray-400 text-black' :
                          index === 2 ? 'bg-orange-700 text-white' :
                          'bg-white/10 text-gray-400'
                        }`}>
                          {index + 1}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <p className="font-black uppercase text-lg">{user.userName}</p>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <p className="text-2xl font-black text-blue-400">{user.totalKm.toLocaleString('pt-BR')}</p>
                        <p className="text-xs text-gray-500">quilômetros</p>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <p className="text-xl font-bold">{user.tripCount}</p>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <p className="text-lg font-bold text-gray-400">{user.averageKmPerTrip} km</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Activity Section */}
        {activeSection === 'activity' && (
          <div className="bg-black/30 backdrop-blur-xl rounded-3xl p-8 border border-white/10 animate-fadeIn">
            <h3 className="text-xl font-black uppercase tracking-wider mb-6 flex items-center gap-3">
              <i className="fas fa-stream text-blue-400"></i>
              Feed de Atividades
              <div className="flex items-center gap-2 bg-green-500/20 px-3 py-1 rounded-lg border border-green-500/30 ml-auto">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                <span className="text-xs font-bold text-green-400 uppercase">Tempo Real</span>
              </div>
            </h3>
            
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {activities.map(activity => (
                <div key={activity.id} className="flex items-center gap-4 bg-white/5 p-4 rounded-xl hover:bg-white/10 transition-all">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    activity.type === 'trip_start' ? 'bg-green-500/30 text-green-400' :
                    activity.type === 'trip_end' ? 'bg-red-500/30 text-red-400' :
                    'bg-blue-500/30 text-blue-400'
                  }`}>
                    <i className={`fas ${
                      activity.type === 'trip_start' ? 'fa-play' :
                      activity.type === 'trip_end' ? 'fa-flag-checkered' :
                      'fa-sign-in-alt'
                    } text-xl`}></i>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-black uppercase">{activity.userName}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        activity.type === 'trip_start' ? 'bg-green-500/30 text-green-400' :
                        activity.type === 'trip_end' ? 'bg-red-500/30 text-red-400' :
                        'bg-blue-500/30 text-blue-400'
                      }`}>
                        {activity.type === 'trip_start' ? 'Iniciou Viagem' :
                         activity.type === 'trip_end' ? 'Finalizou Viagem' : 'Login'}
                      </span>
                    </div>
                    {activity.vehicle && (
                      <p className="text-sm text-gray-400"><i className="fas fa-car mr-1"></i>{activity.vehicle}</p>
                    )}
                    {activity.details && (
                      <p className="text-sm text-gray-500 mt-1">{activity.details}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">
                      {new Date(activity.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(activity.timestamp).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Vehicles Section */}
        {activeSection === 'vehicles' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-black/30 backdrop-blur-xl rounded-3xl p-8 border border-white/10">
              <h3 className="text-xl font-black uppercase tracking-wider mb-6 flex items-center gap-3">
                <i className="fas fa-car text-blue-400"></i>
                Controle de Veículos
              </h3>
              
              <div className="grid gap-4">
                {vehicles.map(vehicle => (
                  <div key={vehicle.id} className={`p-6 rounded-2xl border transition-all ${
                    vehicle.isBlocked 
                      ? 'bg-red-500/10 border-red-500/30' 
                      : 'bg-green-500/10 border-green-500/30'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                          vehicle.isBlocked ? 'bg-red-500/30' : 'bg-green-500/30'
                        }`}>
                          <i className={`fas ${vehicle.isBlocked ? 'fa-lock' : 'fa-car'} text-3xl ${
                            vehicle.isBlocked ? 'text-red-400' : 'text-green-400'
                          }`}></i>
                        </div>
                        <div>
                          <h4 className="text-xl font-black uppercase">{vehicle.vehicleName}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${
                              vehicle.isBlocked 
                                ? 'bg-red-500/30 text-red-400' 
                                : 'bg-green-500/30 text-green-400'
                            }`}>
                              {vehicle.isBlocked ? 'Bloqueado' : 'Disponível'}
                            </span>
                            {vehicle.isBlocked && vehicle.blockReason && (
                              <span className="text-sm text-gray-400">
                                <i className="fas fa-info-circle mr-1"></i>
                                {vehicle.blockReason}
                              </span>
                            )}
                          </div>
                          {vehicle.isBlocked && vehicle.blockedAt && (
                            <p className="text-xs text-gray-500 mt-2">
                              Bloqueado em: {new Date(vehicle.blockedAt).toLocaleString('pt-BR')}
                              {vehicle.blockedBy && ` por ${vehicle.blockedBy}`}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div>
                        {vehicle.isBlocked ? (
                          <button
                            onClick={() => handleUnblockVehicle(vehicle.id)}
                            className="bg-green-500 hover:bg-green-600 text-white font-bold px-6 py-3 rounded-xl transition-all flex items-center gap-2"
                          >
                            <i className="fas fa-unlock"></i>
                            Desbloquear
                          </button>
                        ) : (
                          <button
                            onClick={() => setBlockingVehicle(vehicle)}
                            className="bg-red-500 hover:bg-red-600 text-white font-bold px-6 py-3 rounded-xl transition-all flex items-center gap-2"
                          >
                            <i className="fas fa-lock"></i>
                            Bloquear
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {vehicles.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <i className="fas fa-car text-4xl mb-4 opacity-30"></i>
                    <p>Nenhum veículo cadastrado.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Reports Section */}
        {activeSection === 'reports' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Filters */}
            <div className="bg-black/30 backdrop-blur-xl rounded-3xl p-6 border border-white/10">
              <h3 className="text-lg font-black uppercase tracking-wider mb-4">
                <i className="fas fa-filter mr-2 text-blue-400"></i>
                Filtros
              </h3>
              
              <div className="grid grid-cols-5 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-2 uppercase">Data Início</label>
                  <input
                    type="date"
                    value={filters.startDate || ''}
                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white font-bold focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-2 uppercase">Data Fim</label>
                  <input
                    type="date"
                    value={filters.endDate || ''}
                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white font-bold focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-2 uppercase">Veículo</label>
                  <select
                    value={filters.vehicle || ''}
                    onChange={(e) => setFilters({ ...filters, vehicle: e.target.value || undefined })}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white font-bold focus:border-blue-500 outline-none transition-all"
                  >
                    <option value="" className="bg-gray-800 text-white">Todos</option>
                    <option value="Polo Volkswagen" className="bg-gray-800 text-white">Polo Volkswagen</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-2 uppercase">Status</label>
                  <select
                    value={filters.status || ''}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value as any || undefined })}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white font-bold focus:border-blue-500 outline-none transition-all"
                  >
                    <option value="" className="bg-gray-800 text-white">Todos</option>
                    <option value="completed" className="bg-gray-800 text-white">Finalizadas</option>
                    <option value="active" className="bg-gray-800 text-white">Ativas</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={exportCSV}
                    className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold px-6 py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    <i className="fas fa-download"></i>
                    Exportar CSV
                  </button>
                </div>
              </div>
            </div>

            {/* Report Data */}
            <div className="bg-black/30 backdrop-blur-xl rounded-3xl p-6 border border-white/10">
              <h3 className="text-lg font-black uppercase tracking-wider mb-4 flex items-center justify-between">
                <span>
                  <i className="fas fa-file-alt mr-2 text-blue-400"></i>
                  Dados do Relatório
                </span>
                <span className="text-sm font-normal text-gray-400">{reportData.length} registros</span>
              </h3>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/10">
                    <tr>
                      <th className="text-left py-3 px-4 text-xs font-black uppercase text-gray-400">Motorista</th>
                      <th className="text-left py-3 px-4 text-xs font-black uppercase text-gray-400">Veículo</th>
                      <th className="text-left py-3 px-4 text-xs font-black uppercase text-gray-400">Data/Hora</th>
                      <th className="text-right py-3 px-4 text-xs font-black uppercase text-gray-400">KM Inicial</th>
                      <th className="text-right py-3 px-4 text-xs font-black uppercase text-gray-400">KM Final</th>
                      <th className="text-right py-3 px-4 text-xs font-black uppercase text-gray-400">Total</th>
                      <th className="text-center py-3 px-4 text-xs font-black uppercase text-gray-400">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.slice(0, 20).map(trip => (
                      <tr key={trip.id} className="border-t border-white/5 hover:bg-white/5">
                        <td className="py-3 px-4 font-bold">{trip.employeeName}</td>
                        <td className="py-3 px-4 text-gray-400">{trip.vehicle}</td>
                        <td className="py-3 px-4 text-gray-400">
                          {new Date(trip.startTime).toLocaleDateString('pt-BR')} {new Date(trip.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-3 px-4 text-right">{trip.startOdometer}</td>
                        <td className="py-3 px-4 text-right">{trip.endOdometer || '-'}</td>
                        <td className="py-3 px-4 text-right font-bold text-blue-400">
                          {trip.endOdometer ? (trip.endOdometer - trip.startOdometer) : '-'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${
                            trip.status === 'completed' ? 'bg-green-500/30 text-green-400' : 'bg-blue-500/30 text-blue-400'
                          }`}>
                            {trip.status === 'completed' ? 'Finalizada' : 'Ativa'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {reportData.length > 20 && (
                  <p className="text-center text-gray-500 text-sm py-4">
                    Exibindo 20 de {reportData.length} registros. Exporte o CSV para ver todos.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Block Vehicle Modal */}
      {blockingVehicle && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-3xl p-8 max-w-md w-full mx-4 border border-white/20">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-red-500/30 rounded-2xl flex items-center justify-center">
                <i className="fas fa-lock text-red-400 text-2xl"></i>
              </div>
              <div>
                <h3 className="text-xl font-black uppercase">Bloquear Veículo</h3>
                <p className="text-gray-400">{blockingVehicle.vehicleName}</p>
              </div>
            </div>
            
            <div className="mb-6">
              <label className="block text-xs font-bold text-gray-400 mb-2 uppercase">Motivo do Bloqueio</label>
              <select
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white font-bold focus:border-red-500 outline-none transition-all mb-3"
              >
                <option value="" className="bg-gray-800 text-white">Selecione um motivo...</option>
                <option value="Manutenção preventiva" className="bg-gray-800 text-white">Manutenção preventiva</option>
                <option value="Manutenção corretiva" className="bg-gray-800 text-white">Manutenção corretiva</option>
                <option value="Abastecimento" className="bg-gray-800 text-white">Abastecimento</option>
                <option value="Reservado para evento" className="bg-gray-800 text-white">Reservado para evento</option>
                <option value="Documentação pendente" className="bg-gray-800 text-white">Documentação pendente</option>
                <option value="Sinistro/Acidente" className="bg-gray-800 text-white">Sinistro/Acidente</option>
                <option value="Outro" className="bg-gray-800 text-white">Outro</option>
              </select>
              {blockReason === 'Outro' && (
                <input
                  type="text"
                  placeholder="Especifique o motivo..."
                  onChange={(e) => setBlockReason(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white font-bold focus:border-red-500 outline-none transition-all"
                />
              )}
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => { setBlockingVehicle(null); setBlockReason(''); }}
                className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleBlockVehicle}
                disabled={!blockReason.trim()}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <i className="fas fa-lock"></i>
                Confirmar Bloqueio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
