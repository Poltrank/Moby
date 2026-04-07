export interface UserProfile {
  uid: string;
  nickname: string;
  phone: string;
  vehicleType?: 'Combustão' | 'Elétrico';
  carModel?: string;
  rankingOptIn: boolean;
  weeklyEarnings?: number;
  monthlyEarnings?: number;
  isAdmin?: boolean;
}

export interface RankingEntry {
  uid: string;
  nickname: string;
  vehicleType?: 'Combustão' | 'Elétrico';
  weeklyEarnings: number;
  monthlyEarnings: number;
}

export interface Expenses {
  food: number;
  fuel: number;
  maintenance: number;
}

export interface Earnings {
  uber: number;
  '99': number;
  indriver: number;
  zoop: number;
  muvi: number;
  private: number;
}

export interface DailyRecord {
  id?: string;
  userId: string;
  date: string; // YYYY-MM-DD
  expenses: Expenses;
  earnings: Earnings;
  totalPositive: number;
  totalNegative: number;
  balance: number;
}
