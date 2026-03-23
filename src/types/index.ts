export type Role = 'ADMIN' | 'INQUILINO';

export interface User {
  uid: string;
  email: string;
  username?: string;
  name: string;
  role: Role;
  roomNumber?: string;
  createdAt: number;
}

export interface Payment {
  id: string;
  userId: string;
  userName: string;
  month: string; // e.g., "2024-03"
  amount: number;
  status: 'PENDING' | 'COMPLETED';
  evidenceUrl?: string;
  createdAt: number;
  updatedAt: number;
}
