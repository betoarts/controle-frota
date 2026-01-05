
import { supabase } from '../lib/supabase';
import { Reservation } from '../types';

export interface User {
  id: string;
  name: string;
  phone: string;
}

export const userService = {
  async loginOrRegister(name: string, phone: string): Promise<User | null> {
    // 1. Try to find user by phone (assuming phone is unique identifier for "login")
    const { data: existingUser, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('phone', phone)
      .single();

    if (findError && findError.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('Error finding user:', findError);
      throw findError;
    }

    if (existingUser) {
      return existingUser;
    }

    // 2. If not found, create new user
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert([{ name, phone }])
      .select()
      .single();

    if (createError) {
      console.error('Error creating user:', createError);
      throw createError;
    }

    const userResult = existingUser || newUser;
    
    // Log the login action
    if (userResult) {
       await this.logUsage(userResult.id, 'LOGIN', { 
         method: existingUser ? 'EXISTING_USER' : 'NEW_REGISTER',
         timestamp: new Date().toISOString()
       });
    }

    return userResult;
  },

  async logUsage(userId: string, action: string, details?: any) {
    const { error } = await supabase
      .from('user_logs')
      .insert([
        { 
          user_id: userId, 
          action, 
          details 
        }
      ]);

    if (error) {
      console.error('Error logging usage:', error);
      // Don't throw error to avoid blocking the main flow
    }
  },

  async getUserReservations(userId: string): Promise<Reservation[]> {
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching reservations:', error);
      throw error;
    }

    return data.map((r: any) => ({
      id: r.id,
      employeeName: r.employee_name,
      vehicle: r.vehicle,
      startOdometer: r.start_odometer,
      endOdometer: r.end_odometer,
      itinerary: r.itinerary,
      startTime: r.start_time,
      endTime: r.end_time,
      status: r.status
    }));
  },

  async getAllReservations(): Promise<Reservation[]> {
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching all reservations:', error);
      throw error;
    }

    return data.map((r: any) => ({
      id: r.id,
      employeeName: r.employee_name,
      vehicle: r.vehicle,
      startOdometer: r.start_odometer,
      endOdometer: r.end_odometer,
      itinerary: r.itinerary,
      startTime: r.start_time,
      endTime: r.end_time,
      status: r.status
    }));
  },

  async getActiveReservations(): Promise<Reservation[]> {
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('status', 'active')
      .order('start_time', { ascending: false });

    if (error) {
      console.error('Error fetching active reservations:', error);
      throw error;
    }

    return data.map((r: any) => ({
      id: r.id,
      employeeName: r.employee_name,
      vehicle: r.vehicle,
      startOdometer: r.start_odometer,
      endOdometer: r.end_odometer,
      itinerary: r.itinerary,
      startTime: r.start_time,
      endTime: r.end_time,
      status: r.status
    }));
  },

  async createReservation(reservation: Reservation, userId: string): Promise<void> {
    const { error } = await supabase
      .from('reservations')
      .insert([{
        id: reservation.id,
        user_id: userId,
        employee_name: reservation.employeeName,
        vehicle: reservation.vehicle,
        start_odometer: reservation.startOdometer,
        itinerary: reservation.itinerary,
        start_time: reservation.startTime,
        status: reservation.status
      }]);

    if (error) {
      console.error('Error creating reservation:', error);
      throw error;
    }

    // Log the action
    await this.logUsage(userId, 'CREATE_RESERVATION', {
      reservationId: reservation.id,
      vehicle: reservation.vehicle,
      startTime: reservation.startTime
    });
  },

  async updateReservation(reservation: Reservation, userId: string): Promise<void> {
    const { error } = await supabase
      .from('reservations')
      .update({
        end_odometer: reservation.endOdometer,
        end_time: reservation.endTime,
        status: reservation.status
      })
      .eq('id', reservation.id);

    if (error) {
      console.error('Error updating reservation:', error);
      throw error;
    }

    // Log the action
    await this.logUsage(userId, 'UPDATE_RESERVATION', {
      reservationId: reservation.id,
      endOdometer: reservation.endOdometer,
      endTime: reservation.endTime,
      status: reservation.status
    });
  }
};

