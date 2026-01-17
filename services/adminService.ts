import { supabase } from '../lib/supabase';
import { Reservation } from '../types';

// Lista de veículos padrão usados na aplicação
const DEFAULT_VEHICLES = [
  { id: 'polo-vw', name: 'Polo Volkswagen' }
];

export interface DashboardStats {
  totalTrips: number;
  totalKm: number;
  totalUsers: number;
  activeTripsNow: number;
}

export interface UserRanking {
  userId: string;
  userName: string;
  totalKm: number;
  tripCount: number;
  averageKmPerTrip: number;
}

export interface ActivityItem {
  id: string;
  type: 'trip_start' | 'trip_end' | 'login';
  userName: string;
  vehicle?: string;
  timestamp: string;
  details?: string;
}

export interface VehicleStatus {
  id: string;
  vehicleName: string;
  isBlocked: boolean;
  blockReason: string | null;
  blockedAt: string | null;
  blockedBy: string | null;
}

export interface ReportFilters {
  startDate?: string;
  endDate?: string;
  userId?: string;
  vehicle?: string;
  status?: 'active' | 'completed';
}

// Estado local para bloqueio de veículos (fallback quando tabela não existe)
let localVehicleBlocks: Record<string, { blocked: boolean; reason: string | null; blockedAt: string | null; blockedBy: string | null }> = {};

// Tentar carregar do localStorage
try {
  const saved = localStorage.getItem('nbapark_vehicle_blocks');
  if (saved) {
    localVehicleBlocks = JSON.parse(saved);
  }
} catch (e) {
  console.debug('Could not load vehicle blocks from localStorage');
}

const saveLocalVehicleBlocks = () => {
  try {
    localStorage.setItem('nbapark_vehicle_blocks', JSON.stringify(localVehicleBlocks));
  } catch (e) {
    console.debug('Could not save vehicle blocks to localStorage');
  }
};

export const adminService = {
  async getDashboardStats(): Promise<DashboardStats> {
    try {
      // Get all reservations
      const { data: reservations, error: resError } = await supabase
        .from('reservations')
        .select('*');

      if (resError) {
        console.error('Error fetching reservations:', resError);
      }

      // Get all users
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id');

      if (usersError) {
        console.error('Error fetching users:', usersError);
      }

      // Calculate stats
      const totalTrips = reservations?.length || 0;
      const totalKm = reservations?.reduce((sum, r) => {
        if (r.end_odometer && r.start_odometer) {
          return sum + (r.end_odometer - r.start_odometer);
        }
        return sum;
      }, 0) || 0;
      const totalUsers = users?.length || 0;
      const activeTripsNow = reservations?.filter(r => r.status === 'active').length || 0;

      return {
        totalTrips,
        totalKm,
        totalUsers,
        activeTripsNow
      };
    } catch (error) {
      console.error('Error in getDashboardStats:', error);
      return {
        totalTrips: 0,
        totalKm: 0,
        totalUsers: 0,
        activeTripsNow: 0
      };
    }
  },

  async getUserRankings(): Promise<UserRanking[]> {
    try {
      // Buscar TODAS as reservas (não apenas completed) para ter dados
      const { data: reservations, error } = await supabase
        .from('reservations')
        .select('*');

      if (error) {
        console.error('Error fetching reservations for ranking:', error);
        return [];
      }

      if (!reservations || reservations.length === 0) {
        return [];
      }

      // Group by user (usando employee_name como chave)
      const userStats: Record<string, { totalKm: number; tripCount: number; userName: string }> = {};

      reservations.forEach(r => {
        const userName = r.employee_name || 'Desconhecido';
        const kmDiff = (r.end_odometer || 0) - (r.start_odometer || 0);

        if (!userStats[userName]) {
          userStats[userName] = {
            totalKm: 0,
            tripCount: 0,
            userName: userName
          };
        }

        // Só contar KM se a viagem foi finalizada
        if (r.status === 'completed' && kmDiff > 0) {
          userStats[userName].totalKm += kmDiff;
        }
        userStats[userName].tripCount += 1;
      });

      // Convert to array and sort
      const rankings: UserRanking[] = Object.entries(userStats).map(([userName, stats]) => ({
        userId: userName,
        userName: stats.userName,
        totalKm: stats.totalKm,
        tripCount: stats.tripCount,
        averageKmPerTrip: stats.tripCount > 0 ? Math.round(stats.totalKm / stats.tripCount) : 0
      }));

      // Sort by total KM descending, then by trip count
      rankings.sort((a, b) => {
        if (b.totalKm !== a.totalKm) return b.totalKm - a.totalKm;
        return b.tripCount - a.tripCount;
      });

      return rankings.slice(0, 10); // Top 10
    } catch (error) {
      console.error('Error in getUserRankings:', error);
      return [];
    }
  },

  async getActivityFeed(): Promise<ActivityItem[]> {
    try {
      const activities: ActivityItem[] = [];

      // Get recent reservations
      const { data: reservations, error: resError } = await supabase
        .from('reservations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (resError) {
        console.error('Error fetching reservations:', resError);
      }

      // Add reservation activities
      reservations?.forEach(r => {
        activities.push({
          id: r.id + '-start',
          type: 'trip_start',
          userName: r.employee_name || 'Usuário',
          vehicle: r.vehicle || 'Polo Volkswagen',
          timestamp: r.start_time || r.created_at,
          details: r.itinerary || 'Viagem iniciada'
        });

        if (r.end_time) {
          const kmRodados = (r.end_odometer || 0) - (r.start_odometer || 0);
          activities.push({
            id: r.id + '-end',
            type: 'trip_end',
            userName: r.employee_name || 'Usuário',
            vehicle: r.vehicle || 'Polo Volkswagen',
            timestamp: r.end_time,
            details: `${kmRodados} KM percorridos`
          });
        }
      });

      // Try to get user logs (may not exist)
      try {
        const { data: logs, error: logsError } = await supabase
          .from('user_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(30);

        if (!logsError && logs) {
          logs.forEach(log => {
            if (log.action === 'LOGIN') {
              activities.push({
                id: log.id,
                type: 'login',
                userName: log.details?.userName || 'Usuário',
                timestamp: log.created_at,
                details: log.details?.method === 'NEW_REGISTER' ? 'Novo cadastro' : 'Login no sistema'
              });
            }
          });
        }
      } catch (e) {
        // user_logs table may not exist, ignore
      }

      // Sort by timestamp descending
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return activities.slice(0, 50);
    } catch (error) {
      console.error('Error in getActivityFeed:', error);
      return [];
    }
  },

  async getDetailedReport(filters: ReportFilters): Promise<Reservation[]> {
    try {
      let query = supabase
        .from('reservations')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.vehicle) {
        query = query.eq('vehicle', filters.vehicle);
      }

      if (filters.startDate) {
        query = query.gte('start_time', filters.startDate);
      }

      if (filters.endDate) {
        query = query.lte('start_time', filters.endDate + 'T23:59:59');
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching report data:', error);
        return [];
      }

      return data?.map((r: any) => ({
        id: r.id,
        employeeName: r.employee_name,
        vehicle: r.vehicle || 'Polo Volkswagen',
        startOdometer: r.start_odometer,
        endOdometer: r.end_odometer,
        itinerary: r.itinerary,
        startTime: r.start_time,
        endTime: r.end_time,
        status: r.status
      })) || [];
    } catch (error) {
      console.error('Error in getDetailedReport:', error);
      return [];
    }
  },

  async getVehicleStatus(): Promise<VehicleStatus[]> {
    // Primeiro tenta buscar do Supabase
    try {
      const { data, error } = await supabase
        .from('vehicle_status')
        .select('*')
        .order('vehicle_name');

      if (!error && data && data.length > 0) {
        return data.map((v: any) => ({
          id: v.id,
          vehicleName: v.vehicle_name,
          isBlocked: v.is_blocked,
          blockReason: v.block_reason,
          blockedAt: v.blocked_at,
          blockedBy: v.blocked_by
        }));
      }
    } catch (e) {
      console.debug('vehicle_status table not available, using local fallback');
    }

    // Fallback: usar lista de veículos padrão com estado local
    return DEFAULT_VEHICLES.map(v => {
      const localState = localVehicleBlocks[v.id] || { blocked: false, reason: null, blockedAt: null, blockedBy: null };
      return {
        id: v.id,
        vehicleName: v.name,
        isBlocked: localState.blocked,
        blockReason: localState.reason,
        blockedAt: localState.blockedAt,
        blockedBy: localState.blockedBy
      };
    });
  },

  async blockVehicle(vehicleId: string, reason: string, blockedBy: string): Promise<void> {
    // Tentar atualizar no Supabase
    try {
      const { error } = await supabase
        .from('vehicle_status')
        .update({
          is_blocked: true,
          block_reason: reason,
          blocked_at: new Date().toISOString(),
          blocked_by: blockedBy,
          updated_at: new Date().toISOString()
        })
        .eq('id', vehicleId);

      if (!error) {
        return;
      }
    } catch (e) {
      console.debug('Could not update vehicle_status in database, using local fallback');
    }

    // Fallback: salvar localmente
    localVehicleBlocks[vehicleId] = {
      blocked: true,
      reason: reason,
      blockedAt: new Date().toISOString(),
      blockedBy: blockedBy
    };
    saveLocalVehicleBlocks();
  },

  async unblockVehicle(vehicleId: string): Promise<void> {
    // Tentar atualizar no Supabase
    try {
      const { error } = await supabase
        .from('vehicle_status')
        .update({
          is_blocked: false,
          block_reason: null,
          blocked_at: null,
          blocked_by: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', vehicleId);

      if (!error) {
        return;
      }
    } catch (e) {
      console.debug('Could not update vehicle_status in database, using local fallback');
    }

    // Fallback: salvar localmente
    localVehicleBlocks[vehicleId] = {
      blocked: false,
      reason: null,
      blockedAt: null,
      blockedBy: null
    };
    saveLocalVehicleBlocks();
  },

  async isVehicleBlocked(vehicleName: string): Promise<{ blocked: boolean; reason: string | null }> {
    // Tentar buscar do Supabase
    try {
      const { data, error } = await supabase
        .from('vehicle_status')
        .select('is_blocked, block_reason')
        .eq('vehicle_name', vehicleName)
        .single();

      if (!error && data) {
        return {
          blocked: data.is_blocked || false,
          reason: data.block_reason || null
        };
      }
    } catch (e) {
      console.debug('Could not check vehicle_status in database, using local fallback');
    }

    // Fallback: buscar no estado local pelo nome
    const vehicle = DEFAULT_VEHICLES.find(v => v.name === vehicleName);
    if (vehicle && localVehicleBlocks[vehicle.id]) {
      return {
        blocked: localVehicleBlocks[vehicle.id].blocked,
        reason: localVehicleBlocks[vehicle.id].reason
      };
    }

    return { blocked: false, reason: null };
  }
};
