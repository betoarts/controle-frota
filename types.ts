
export interface Reservation {
  id: string;
  employeeName: string;
  vehicle: string;
  startOdometer: number;
  endOdometer?: number;
  itinerary: string;
  startTime: string;
  endTime?: string;
  status: 'active' | 'completed';
}

export interface NewReservation {
  employeeName: string;
  startOdometer: number;
  itinerary: string;
}

export type AppState = 'dashboard' | 'new-reservation' | 'history' | 'scheduling' | 'global-history' | 'admin-dashboard' | 'about' | 'todo';

export interface TodoTask {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  dueTime?: string;
  priority: 'baixa' | 'media' | 'alta';
  status: 'pendente' | 'em_progresso' | 'concluida';
  createdAt: string;
}
