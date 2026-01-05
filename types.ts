
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

export type AppState = 'dashboard' | 'new-reservation' | 'history' | 'scheduling' | 'global-history';
