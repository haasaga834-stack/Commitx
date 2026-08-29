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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      academic_subjects: {
        Row: {
          created_at: string
          exam_date: string | null
          id: string
          name: string
          revised: boolean
          revised_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          exam_date?: string | null
          id?: string
          name: string
          revised?: boolean
          revised_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          exam_date?: string | null
          id?: string
          name?: string
          revised?: boolean
          revised_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      active_sessions: {
        Row: {
          created_at: string
          duration_minutes: number
          goal: string
          mode: string
          started_at: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          duration_minutes?: number
          goal?: string
          mode?: string
          started_at?: string
          user_id: string
          value?: number
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          goal?: string
          mode?: string
          started_at?: string
          user_id?: string
          value?: number
        }
        Relationships: []
      }
      focus_sessions: {
        Row: {
          coins_earned: number
          coins_spent: number
          created_at: string
          duration_minutes: number
          goal: string
          id: string
          mode: string
          status: string
          user_id: string
          value: number
        }
        Insert: {
          coins_earned?: number
          coins_spent?: number
          created_at?: string
          duration_minutes?: number
          goal?: string
          id?: string
          mode?: string
          status?: string
          user_id: string
          value?: number
        }
        Update: {
          coins_earned?: number
          coins_spent?: number
          created_at?: string
          duration_minutes?: number
          goal?: string
          id?: string
          mode?: string
          status?: string
          user_id?: string
          value?: number
        }
        Relationships: []
      }
      group_members: {
        Row: {
          accepted_at: string | null
          created_at: string
          display_name: string
          group_id: string
          held_amount: number
          id: string
          joined_at: string | null
          left_at: string | null
          role: string
          settled_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          display_name?: string
          group_id: string
          held_amount?: number
          id?: string
          joined_at?: string | null
          left_at?: string | null
          role?: string
          settled_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          display_name?: string
          group_id?: string
          held_amount?: number
          id?: string
          joined_at?: string | null
          left_at?: string | null
          role?: string
          settled_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          age: string
          avatar_url: string | null
          created_at: string
          device_hash: string | null
          display_name: string
          education: string
          id: string
          notifications_enabled: boolean
          onboarding_completed: boolean
          referral_code: string
          referred_by: string | null
          sex: string
          updated_at: string
        }
        Insert: {
          age?: string
          avatar_url?: string | null
          created_at?: string
          device_hash?: string | null
          display_name?: string
          education?: string
          id: string
          notifications_enabled?: boolean
          onboarding_completed?: boolean
          referral_code: string
          referred_by?: string | null
          sex?: string
          updated_at?: string
        }
        Update: {
          age?: string
          avatar_url?: string | null
          created_at?: string
          device_hash?: string | null
          display_name?: string
          education?: string
          id?: string
          notifications_enabled?: boolean
          onboarding_completed?: boolean
          referral_code?: string
          referred_by?: string | null
          sex?: string
          updated_at?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          bonus_amount: number
          created_at: string
          id: string
          referred_device_hash: string | null
          referred_id: string
          referrer_id: string
        }
        Insert: {
          bonus_amount?: number
          created_at?: string
          id?: string
          referred_device_hash?: string | null
          referred_id: string
          referrer_id: string
        }
        Update: {
          bonus_amount?: number
          created_at?: string
          id?: string
          referred_device_hash?: string | null
          referred_id?: string
          referrer_id?: string
        }
        Relationships: []
      }
      study_groups: {
        Row: {
          code: string
          commit_value: number
          created_at: string
          creator_id: string
          duration_minutes: number
          ends_at: string | null
          goal: string
          id: string
          mode: string
          started_at: string | null
          status: string
          theme: string
          updated_at: string
        }
        Insert: {
          code: string
          commit_value?: number
          created_at?: string
          creator_id: string
          duration_minutes?: number
          ends_at?: string | null
          goal?: string
          id?: string
          mode?: string
          started_at?: string | null
          status?: string
          theme?: string
          updated_at?: string
        }
        Update: {
          code?: string
          commit_value?: number
          created_at?: string
          creator_id?: string
          duration_minutes?: number
          ends_at?: string | null
          goal?: string
          id?: string
          mode?: string
          started_at?: string | null
          status?: string
          theme?: string
          updated_at?: string
        }
        Relationships: []
      }
      study_plans: {
        Row: {
          commit_value: number | null
          created_at: string
          duration_minutes: number
          id: string
          monthday: number | null
          priority: string
          repeat: string
          subject: string
          time: string
          topic: string
          updated_at: string
          user_id: string
          weekday: number | null
        }
        Insert: {
          commit_value?: number | null
          created_at?: string
          duration_minutes?: number
          id?: string
          monthday?: number | null
          priority?: string
          repeat?: string
          subject?: string
          time?: string
          topic?: string
          updated_at?: string
          user_id: string
          weekday?: number | null
        }
        Update: {
          commit_value?: number | null
          created_at?: string
          duration_minutes?: number
          id?: string
          monthday?: number | null
          priority?: string
          repeat?: string
          subject?: string
          time?: string
          topic?: string
          updated_at?: string
          user_id?: string
          weekday?: number | null
        }
        Relationships: []
      }
      todos: {
        Row: {
          created_at: string
          day: string
          done: boolean
          id: string
          text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day?: string
          done?: boolean
          id?: string
          text: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day?: string
          done?: boolean
          id?: string
          text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          created_at: string
          daily_goal_hours: number
          reminders_enabled: boolean
          theme: string
          updated_at: string
          user_id: string
          weekly_goal_hours: number
        }
        Insert: {
          created_at?: string
          daily_goal_hours?: number
          reminders_enabled?: boolean
          theme?: string
          updated_at?: string
          user_id: string
          weekly_goal_hours?: number
        }
        Update: {
          created_at?: string
          daily_goal_hours?: number
          reminders_enabled?: boolean
          theme?: string
          updated_at?: string
          user_id?: string
          weekly_goal_hours?: number
        }
        Relationships: []
      }
      wallets: {
        Row: {
          coin_balance: number
          coins_reserved: number
          updated_at: string
          user_id: string
        }
        Insert: {
          coin_balance?: number
          coins_reserved?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          coin_balance?: number
          coins_reserved?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancel_study_group: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      community_food_coins: { Args: never; Returns: number }
      create_study_group: {
        Args: {
          _duration: number
          _goal: string
          _mode: string
          _theme?: string
          _user_id: string
          _value: number
        }
        Returns: {
          code: string
          id: string
        }[]
      }
      generate_referral_code: { Args: never; Returns: string }
      group_display_name: { Args: { _user_id: string }; Returns: string }
      group_invite_preview: {
        Args: { _code: string }
        Returns: {
          commit_value: number
          creator_name: string
          duration_minutes: number
          goal: string
          id: string
          member_count: number
          mode: string
          status: string
        }[]
      }
      i_am_group_participant: { Args: { _group_id: string }; Returns: boolean }
      join_study_group: {
        Args: { _code: string; _user_id: string }
        Returns: string
      }
      leaderboard_top: {
        Args: { _limit?: number }
        Returns: {
          display_name: string
          total_minutes: number
          user_id: string
        }[]
      }
      leave_study_lobby: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      release_stale_commitments: {
        Args: { _user_id: string }
        Returns: undefined
      }
      settle_expired_study_group: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      settle_study_group_member: {
        Args: { _group_id: string; _status: string; _user_id: string }
        Returns: string
      }
      start_study_group: {
        Args: { _group_id: string; _user_id: string }
        Returns: {
          ends_at: string
          started_at: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
