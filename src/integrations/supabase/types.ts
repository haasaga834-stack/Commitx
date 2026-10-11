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
          failure_reason: string | null
          focus_shield_enabled: boolean
          focus_shield_ends_at: string | null
          focus_shield_packages: string[]
          focus_shield_started_at: string | null
          focus_shield_status: string
          goal: string
          last_heartbeat: string
          mode: string
          platform: string
          started_at: string
          status: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          duration_minutes?: number
          failure_reason?: string | null
          focus_shield_enabled?: boolean
          focus_shield_ends_at?: string | null
          focus_shield_packages?: string[]
          focus_shield_started_at?: string | null
          focus_shield_status?: string
          goal?: string
          last_heartbeat?: string
          mode?: string
          platform?: string
          started_at?: string
          status?: string
          user_id: string
          value?: number
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          failure_reason?: string | null
          focus_shield_enabled?: boolean
          focus_shield_ends_at?: string | null
          focus_shield_packages?: string[]
          focus_shield_started_at?: string | null
          focus_shield_status?: string
          goal?: string
          last_heartbeat?: string
          mode?: string
          platform?: string
          started_at?: string
          status?: string
          user_id?: string
          value?: number
        }
        Relationships: []
      }
      coin_adjustments: {
        Row: {
          amount: number
          created_at: string
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          reason: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      focus_class_presence: {
        Row: {
          completed_at: string | null
          created_at: string
          duration_minutes: number
          id: string
          last_heartbeat: string
          left_at: string | null
          presence_key: string
          sound: string
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          last_heartbeat?: string
          left_at?: string | null
          presence_key: string
          sound?: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          last_heartbeat?: string
          left_at?: string | null
          presence_key?: string
          sound?: string
          started_at?: string
          status?: string
          updated_at?: string
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
          source_key: string | null
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
          source_key?: string | null
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
          source_key?: string | null
          status?: string
          user_id?: string
          value?: number
        }
        Relationships: []
      }
      focus_sessions_duplicates_archive: {
        Row: {
          archived_at: string
          coins_earned: number
          coins_spent: number
          created_at: string
          duration_minutes: number
          goal: string
          id: string
          kept_session_id: string
          mode: string
          status: string
          user_id: string
          value: number
        }
        Insert: {
          archived_at?: string
          coins_earned: number
          coins_spent: number
          created_at: string
          duration_minutes: number
          goal: string
          id: string
          kept_session_id: string
          mode: string
          status: string
          user_id: string
          value: number
        }
        Update: {
          archived_at?: string
          coins_earned?: number
          coins_spent?: number
          created_at?: string
          duration_minutes?: number
          goal?: string
          id?: string
          kept_session_id?: string
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
      leaderboard_totals: {
        Row: {
          display_name: string
          total_minutes: number
          updated_at: string
          user_id: string
        }
        Insert: {
          display_name?: string
          total_minutes?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          display_name?: string
          total_minutes?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      session_claims_archive: {
        Row: {
          archived_at: string
          consumed_at: string | null
          consumed_session_id: string | null
          duration_minutes: number
          failure_reason: string | null
          goal: string
          id: string
          mode: string
          platform: string | null
          started_at: string
          status: string
          user_id: string
          value: number
        }
        Insert: {
          archived_at?: string
          consumed_at?: string | null
          consumed_session_id?: string | null
          duration_minutes: number
          failure_reason?: string | null
          goal?: string
          id?: string
          mode: string
          platform?: string | null
          started_at: string
          status: string
          user_id: string
          value?: number
        }
        Update: {
          archived_at?: string
          consumed_at?: string | null
          consumed_session_id?: string | null
          duration_minutes?: number
          failure_reason?: string | null
          goal?: string
          id?: string
          mode?: string
          platform?: string | null
          started_at?: string
          status?: string
          user_id?: string
          value?: number
        }
        Relationships: []
      }
      student_reviews: {
        Row: {
          course_year: string | null
          display_name: string
          id: string
          public_at: string | null
          review: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          course_year?: string | null
          display_name: string
          id?: string
          public_at?: string | null
          review: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          course_year?: string | null
          display_name?: string
          id?: string
          public_at?: string | null
          review?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string | null
          updated_at?: string
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
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
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
      cleanup_focus_class_presence: { Args: never; Returns: undefined }
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
      fail_web_session: { Args: { _reason: string }; Returns: string }
      finish_web_session: { Args: never; Returns: boolean }
      focus_class_active_count: { Args: never; Returns: number }
      focus_class_complete: { Args: { _presence_key: string }; Returns: number }
      focus_class_leave: { Args: { _presence_key: string }; Returns: number }
      focus_class_touch: {
        Args: {
          _duration_minutes?: number
          _presence_key: string
          _sound?: string
        }
        Returns: number
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      i_am_group_participant: { Args: { _group_id: string }; Returns: boolean }
      join_study_group: {
        Args: { _code: string; _user_id: string }
        Returns: string
      }
      leaderboard_top: {
        Args: { _limit?: number }
        Returns: {
          avatar_url: string
          display_name: string
          total_minutes: number
          user_id: string
        }[]
      }
      leave_study_lobby: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      ledger_coin_balance: { Args: { _user_id: string }; Returns: number }
      my_focus_totals: {
        Args: never
        Returns: {
          coins_earned: number
          completed: number
          failed: number
          total_minutes: number
        }[]
      }
      recompute_wallet: { Args: { _user_id: string }; Returns: number }
      record_focus_session_from_active: {
        Args: {
          _duration_minutes?: number
          _ended_at?: string
          _mode?: string
          _requested_status: string
          _session_id: string
          _user_id: string
          _value?: number
        }
        Returns: {
          accepted: boolean
          coin_balance: number
          session_id: string
        }[]
      }
      refresh_leaderboard_total: {
        Args: { _user_id: string }
        Returns: undefined
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
      touch_paused_web_session: { Args: never; Returns: string }
      web_session_heartbeat: { Args: never; Returns: string }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
