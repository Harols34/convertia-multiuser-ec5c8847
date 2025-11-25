export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      alarm_attachments: {
        Row: {
          alarm_id: string
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
        }
        Insert: {
          alarm_id: string
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
        }
        Update: {
          alarm_id?: string
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alarm_attachments_alarm_id_fkey"
            columns: ["alarm_id"]
            isOneToOne: false
            referencedRelation: "alarms"
            referencedColumns: ["id"]
          },
        ]
      }
      alarm_comments: {
        Row: {
          alarm_id: string
          comment: string
          created_at: string
          id: string
          user_id: string | null
        }
        Insert: {
          alarm_id: string
          comment: string
          created_at?: string
          id?: string
          user_id?: string | null
        }
        Update: {
          alarm_id?: string
          comment?: string
          created_at?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alarm_comments_alarm_id_fkey"
            columns: ["alarm_id"]
            isOneToOne: false
            referencedRelation: "alarms"
            referencedColumns: ["id"]
          },
        ]
      }
      alarms: {
        Row: {
          assigned_to: string | null
          created_at: string
          description: string
          end_user_id: string
          id: string
          priority: string | null
          resolution_time_minutes: number | null
          resolved_at: string | null
          resolved_by: string | null
          responded_at: string | null
          status: Database["public"]["Enums"]["alarm_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          description: string
          end_user_id: string
          id?: string
          priority?: string | null
          resolution_time_minutes?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["alarm_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          description?: string
          end_user_id?: string
          id?: string
          priority?: string | null
          resolution_time_minutes?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["alarm_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alarms_end_user_id_fkey"
            columns: ["end_user_id"]
            isOneToOne: false
            referencedRelation: "end_users"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          attachment_name: string | null
          attachment_type: string | null
          attachment_url: string | null
          created_at: string
          end_user_id: string
          id: string
          message: string
          read_at: string | null
          sender_id: string | null
          sender_type: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          created_at?: string
          end_user_id: string
          id?: string
          message: string
          read_at?: string | null
          sender_id?: string | null
          sender_type: string
        }
        Update: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          created_at?: string
          end_user_id?: string
          id?: string
          message?: string
          read_at?: string | null
          sender_id?: string | null
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_end_user_id_fkey"
            columns: ["end_user_id"]
            isOneToOne: false
            referencedRelation: "end_users"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_applications: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          notes: string | null
          updated_at: string
          url: string | null
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
          url?: string | null
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_applications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      end_users: {
        Row: {
          access_code: string | null
          active: boolean
          additional_data: Json | null
          company_id: string
          created_at: string
          created_by: string | null
          document_number: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          access_code?: string | null
          active?: boolean
          additional_data?: Json | null
          company_id: string
          created_at?: string
          created_by?: string | null
          document_number: string
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          access_code?: string | null
          active?: boolean
          additional_data?: Json | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          document_number?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "end_users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      global_applications: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
          updated_at: string
          url: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      user_applications: {
        Row: {
          application_id: string | null
          created_at: string
          credential_created_at: string | null
          credential_expires_at: string | null
          credential_expires_at_required: boolean | null
          credential_notes: string | null
          credential_updated_at: string | null
          end_user_id: string
          global_application_id: string | null
          id: string
          last_password_change: string | null
          notes: string | null
          password: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          application_id?: string | null
          created_at?: string
          credential_created_at?: string | null
          credential_expires_at?: string | null
          credential_expires_at_required?: boolean | null
          credential_notes?: string | null
          credential_updated_at?: string | null
          end_user_id: string
          global_application_id?: string | null
          id?: string
          last_password_change?: string | null
          notes?: string | null
          password?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          application_id?: string | null
          created_at?: string
          credential_created_at?: string | null
          credential_expires_at?: string | null
          credential_expires_at_required?: boolean | null
          credential_notes?: string | null
          credential_updated_at?: string | null
          end_user_id?: string
          global_application_id?: string | null
          id?: string
          last_password_change?: string | null
          notes?: string | null
          password?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_applications_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "company_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_applications_end_user_id_fkey"
            columns: ["end_user_id"]
            isOneToOne: false
            referencedRelation: "end_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_applications_global_application_id_fkey"
            columns: ["global_application_id"]
            isOneToOne: false
            referencedRelation: "global_applications"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      alarm_status: "abierta" | "en_proceso" | "resuelta" | "cerrada"
      app_role: "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      alarm_status: ["abierta", "en_proceso", "resuelta", "cerrada"],
      app_role: ["admin"],
    },
  },
} as const
