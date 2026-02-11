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
      access_logs: {
        Row: {
          created_at: string
          email: string | null
          failure_reason: string | null
          id: string
          ip_address: string | null
          location: string | null
          role: string | null
          status: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          location?: string | null
          role?: string | null
          status: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          location?: string | null
          role?: string | null
          status?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      activity_logs: {
        Row: {
          action_type: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          location: string | null
          module: string
          role: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          location?: string | null
          module: string
          role?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          location?: string | null
          module?: string
          role?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
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
      app_modules: {
        Row: {
          active: boolean | null
          created_at: string | null
          description: string | null
          display_name: string
          icon: string | null
          id: string
          name: string
          route: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          display_name: string
          icon?: string | null
          id?: string
          name: string
          route?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          display_name?: string
          icon?: string | null
          id?: string
          name?: string
          route?: string | null
        }
        Relationships: []
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
      browser_audit_logs: {
        Row: {
          action: string
          browser_config_id: string | null
          company_id: string
          created_at: string
          id: string
          reason: string | null
          url: string | null
          user_id: string
        }
        Insert: {
          action: string
          browser_config_id?: string | null
          company_id: string
          created_at?: string
          id?: string
          reason?: string | null
          url?: string | null
          user_id: string
        }
        Update: {
          action?: string
          browser_config_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          reason?: string | null
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "browser_audit_logs_browser_config_id_fkey"
            columns: ["browser_config_id"]
            isOneToOne: false
            referencedRelation: "browser_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "browser_audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      browser_configs: {
        Row: {
          allow_downloads: boolean
          allow_http: boolean
          allow_new_tabs: boolean
          allow_popups: boolean
          allowed_domains: string[]
          allowed_url_prefixes: string[]
          blocked_url_patterns: string[]
          company_id: string
          created_at: string
          enabled: boolean
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          allow_downloads?: boolean
          allow_http?: boolean
          allow_new_tabs?: boolean
          allow_popups?: boolean
          allowed_domains?: string[]
          allowed_url_prefixes?: string[]
          blocked_url_patterns?: string[]
          company_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          name?: string
          updated_at?: string
        }
        Update: {
          allow_downloads?: boolean
          allow_http?: boolean
          allow_new_tabs?: boolean
          allow_popups?: boolean
          allowed_domains?: string[]
          allowed_url_prefixes?: string[]
          blocked_url_patterns?: string[]
          company_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "browser_configs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      browser_permissions: {
        Row: {
          browser_config_id: string
          can_open_new_tabs: boolean
          can_use: boolean
          company_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          browser_config_id: string
          can_open_new_tabs?: boolean
          can_use?: boolean
          company_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          browser_config_id?: string
          can_open_new_tabs?: boolean
          can_use?: boolean
          company_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "browser_permissions_browser_config_id_fkey"
            columns: ["browser_config_id"]
            isOneToOne: false
            referencedRelation: "browser_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "browser_permissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
      company_module_visibility: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          module_name: string
          updated_at: string | null
          visible: boolean | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          module_name: string
          updated_at?: string | null
          visible?: boolean | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          module_name?: string
          updated_at?: string | null
          visible?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "company_module_visibility_company_id_fkey"
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
          company_id: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          role: string
          role_id: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          role: string
          role_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          role?: string
          role_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_bonuses: {
        Row: {
          alarm_generated: boolean | null
          bonus_amount: number
          condition_met_date: string | null
          created_at: string | null
          id: string
          paid_by: string | null
          paid_date: string | null
          referral_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          alarm_generated?: boolean | null
          bonus_amount: number
          condition_met_date?: string | null
          created_at?: string | null
          id?: string
          paid_by?: string | null
          paid_date?: string | null
          referral_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          alarm_generated?: boolean | null
          bonus_amount?: number
          condition_met_date?: string | null
          created_at?: string | null
          id?: string
          paid_by?: string | null
          paid_date?: string | null
          referral_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_bonuses_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: true
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_config: {
        Row: {
          config_key: string
          config_value: string
          created_at: string | null
          description: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          config_key: string
          config_value: string
          created_at?: string | null
          description?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          config_key?: string
          config_value?: string
          created_at?: string | null
          description?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      referrals: {
        Row: {
          bonus_payment_date: string | null
          campaign: string | null
          company_id: string
          created_at: string | null
          created_by: string | null
          hire_date: string | null
          id: string
          observations: string | null
          probation_end_date: string | null
          referred_document: string
          referred_name: string
          referring_user_id: string
          status: string
          termination_date: string | null
          updated_at: string | null
        }
        Insert: {
          bonus_payment_date?: string | null
          campaign?: string | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          hire_date?: string | null
          id?: string
          observations?: string | null
          probation_end_date?: string | null
          referred_document: string
          referred_name: string
          referring_user_id: string
          status?: string
          termination_date?: string | null
          updated_at?: string | null
        }
        Update: {
          bonus_payment_date?: string | null
          campaign?: string | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          hire_date?: string | null
          id?: string
          observations?: string | null
          probation_end_date?: string | null
          referred_document?: string
          referred_name?: string
          referring_user_id?: string
          status?: string
          termination_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referrals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referring_user_id_fkey"
            columns: ["referring_user_id"]
            isOneToOne: false
            referencedRelation: "end_users"
            referencedColumns: ["id"]
          },
        ]
      }
      role_module_permissions: {
        Row: {
          can_create: boolean | null
          can_delete: boolean | null
          can_edit: boolean | null
          can_view: boolean | null
          created_at: string | null
          id: string
          module_id: string
          role: string
        }
        Insert: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          id?: string
          module_id: string
          role: string
        }
        Update: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          id?: string
          module_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_role_module_permissions_role"
            columns: ["role"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["name"]
          },
          {
            foreignKeyName: "role_module_permissions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "app_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          label: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          label: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          label?: string
          name?: string
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
      user_companies: {
        Row: {
          company_id: string
          user_id: string
        }
        Insert: {
          company_id: string
          user_id: string
        }
        Update: {
          company_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_companies_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_system_user: {
        Args: {
          company_ids?: string[]
          email: string
          full_name: string
          password: string
          role_name: string
        }
        Returns: string
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      alarm_status: "abierta" | "en_proceso" | "resuelta" | "cerrada"
      app_role: "admin" | "moderator"
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
      app_role: ["admin", "moderator"],
    },
  },
} as const
