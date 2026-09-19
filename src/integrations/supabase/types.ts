export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Inventory {
  id: string;
  user_id: string | null;
  user_name: string;
  item_name: string;
  manufacturer: string;
  type: string;
  batch_code: string;
  pack_size: string;
  no_of_pack: number;
  units: string;
  mrp: number;
  expiry_month: number;
  expiry_year: number;
  created_at: string;
  updated_at: string;
}

export type Database = {
  public: {
    Tables: {
      inventory: {
        Row: Inventory;
        Insert: {
          id?: string;
          user_id?: string | null;
          user_name?: string;
          item_name: string;
          manufacturer: string;
          type: string;
          batch_code: string;
          pack_size: string;
          no_of_pack?: number;
          units: string;
          mrp?: number;
          expiry_month: number;
          expiry_year: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          user_name?: string;
          item_name?: string;
          manufacturer?: string;
          type?: string;
          batch_code?: string;
          pack_size?: string;
          no_of_pack?: number;
          units?: string;
          mrp?: number;
          expiry_month?: number;
          expiry_year?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
