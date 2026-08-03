/**
 * Tipos do banco.
 *
 * Escritos à mão e mantidos em sincronia com `supabase/migrations`. Depois de
 * alterar uma migration, regenere/compare com:
 *   npx supabase gen types typescript --local > lib/supabase/database.types.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type GroupRole = "owner" | "admin" | "member";
export type MatchSide = "A" | "B";
export type MatchStatus = "confirmed" | "voided";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          avatar_url?: string | null;
        };
        Update: {
          display_name?: string;
          avatar_url?: string | null;
        };
        Relationships: [];
      };
      groups: {
        Row: {
          id: string;
          name: string;
          slug: string;
          timezone: string;
          city: string | null;
          min_attendance_percent: number;
          first_place_emoji: string | null;
          last_place_emoji: string | null;
          avatar_url: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          timezone?: string;
          city?: string | null;
          min_attendance_percent?: number;
          first_place_emoji?: string | null;
          last_place_emoji?: string | null;
          avatar_url?: string | null;
          created_by: string;
        };
        Update: {
          name?: string;
          slug?: string;
          timezone?: string;
          city?: string | null;
          min_attendance_percent?: number;
          first_place_emoji?: string | null;
          last_place_emoji?: string | null;
          avatar_url?: string | null;
        };
        Relationships: [];
      };
      group_members: {
        Row: {
          group_id: string;
          user_id: string;
          role: GroupRole;
          joined_at: string;
        };
        Insert: {
          group_id: string;
          user_id: string;
          role?: GroupRole;
        };
        Update: {
          role?: GroupRole;
        };
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
        ];
      };
      players: {
        Row: {
          id: string;
          group_id: string;
          linked_user_id: string | null;
          display_name: string;
          normalized_name: string;
          nickname: string | null;
          avatar_url: string | null;
          active: boolean;
          is_guest: boolean;
          sort_order: number;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          linked_user_id?: string | null;
          display_name: string;
          normalized_name?: string;
          nickname?: string | null;
          avatar_url?: string | null;
          active?: boolean;
          is_guest?: boolean;
          sort_order?: number;
          created_by: string;
        };
        Update: {
          linked_user_id?: string | null;
          display_name?: string;
          nickname?: string | null;
          avatar_url?: string | null;
          active?: boolean;
          is_guest?: boolean;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "players_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
        ];
      };
      group_invitations: {
        Row: {
          id: string;
          group_id: string;
          code: string;
          role: GroupRole;
          expires_at: string | null;
          max_uses: number | null;
          use_count: number;
          created_by: string;
          revoked_at: string | null;
          created_at: string;
        };
        Insert: {
          group_id: string;
          code: string;
          role?: GroupRole;
          expires_at?: string | null;
          max_uses?: number | null;
          created_by: string;
        };
        Update: {
          revoked_at?: string | null;
          expires_at?: string | null;
          max_uses?: number | null;
        };
        Relationships: [];
      };
      sessions: {
        Row: {
          id: string;
          group_id: string;
          played_on: string;
          title: string | null;
          location: string | null;
          notes: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          played_on: string;
          title?: string | null;
          location?: string | null;
          notes?: string | null;
          created_by: string;
        };
        Update: {
          played_on?: string;
          title?: string | null;
          location?: string | null;
          notes?: string | null;
        };
        Relationships: [];
      };
      matches: {
        Row: {
          id: string;
          group_id: string;
          session_id: string | null;
          played_at: string;
          winning_side: MatchSide;
          team_a_score: number | null;
          team_b_score: number | null;
          status: MatchStatus;
          notes: string | null;
          external_key: string | null;
          created_by: string;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
        };
        Insert: {
          id?: string;
          group_id: string;
          session_id?: string | null;
          played_at: string;
          winning_side: MatchSide;
          team_a_score?: number | null;
          team_b_score?: number | null;
          status?: MatchStatus;
          notes?: string | null;
          external_key?: string | null;
          created_by: string;
        };
        Update: {
          session_id?: string | null;
          played_at?: string;
          winning_side?: MatchSide;
          team_a_score?: number | null;
          team_b_score?: number | null;
          status?: MatchStatus;
          notes?: string | null;
          updated_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "matches_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      match_players: {
        Row: {
          match_id: string;
          player_id: string;
          side: MatchSide;
          slot: number;
        };
        Insert: {
          match_id: string;
          player_id: string;
          side: MatchSide;
          slot: number;
        };
        Update: {
          side?: MatchSide;
          slot?: number;
        };
        Relationships: [
          {
            foreignKeyName: "match_players_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "match_players_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_log: {
        Row: {
          id: number;
          group_id: string;
          actor_user_id: string | null;
          entity_type: string;
          entity_id: string;
          action: string;
          before_data: Json | null;
          after_data: Json | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      badges: {
        Row: {
          id: string;
          key: string;
          label: string;
          description: string;
          icon: string;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      player_badges: {
        Row: {
          id: string;
          group_id: string;
          player_id: string;
          badge_id: string;
          match_id: string | null;
          awarded_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "player_badges_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_badges_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_badges_badge_id_fkey";
            columns: ["badge_id"];
            isOneToOne: false;
            referencedRelation: "badges";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      v_valid_matches: {
        Row: {
          id: string;
          group_id: string;
          session_id: string | null;
          played_at: string;
          winning_side: MatchSide;
          team_a_score: number | null;
          team_b_score: number | null;
        };
        Relationships: [];
      };
      v_match_participants: {
        Row: {
          match_id: string;
          player_id: string;
          side: MatchSide;
          slot: number;
          group_id: string;
          played_at: string;
          session_id: string | null;
          won: boolean;
        };
        Relationships: [];
      };
      v_match_sides: {
        Row: {
          match_id: string;
          side: MatchSide;
          group_id: string;
          played_at: string;
          session_id: string | null;
          won: boolean;
          player_low: string;
          player_high: string;
        };
        Relationships: [];
      };
      v_daily_kings: {
        Row: {
          group_id: string;
          player_id: string;
          display_name: string;
          avatar_url: string | null;
          times_as_king: number;
        };
        Relationships: [];
      };
      v_daily_lanterns: {
        Row: {
          group_id: string;
          player_id: string;
          display_name: string;
          avatar_url: string | null;
          times_as_lantern: number;
        };
        Relationships: [];
      };
      v_player_streaks: {
        Row: {
          group_id: string;
          player_id: string;
          display_name: string;
          avatar_url: string | null;
          longest_win_streak: number;
          longest_win_streak_start_at: string | null;
          longest_win_streak_end_at: string | null;
          longest_loss_streak: number;
          longest_loss_streak_start_at: string | null;
          longest_loss_streak_end_at: string | null;
        };
        Relationships: [];
      };
      v_pair_underdogs: {
        Row: {
          match_id: string;
          group_id: string;
          played_at: string;
          winner_pair_key: string;
          winner_player_ids: string[];
          winner_player_names: string[];
          winner_games: number;
          winner_win_rate: number;
          loser_pair_key: string;
          loser_player_ids: string[];
          loser_player_names: string[];
          loser_games: number;
          loser_win_rate: number;
          win_rate_gap: number;
        };
        Relationships: [];
      };
      v_biggest_massacres: {
        Row: {
          group_id: string;
          attacker_id: string;
          attacker_name: string;
          attacker_avatar_url: string | null;
          victim_id: string;
          victim_name: string;
          victim_avatar_url: string | null;
          games: number;
          wins: number;
          win_rate: number;
        };
        Relationships: [];
      };
      v_individual_underdogs: {
        Row: {
          match_id: string;
          group_id: string;
          played_at: string;
          underdog_id: string;
          underdog_name: string;
          underdog_avatar_url: string | null;
          favorite_id: string;
          favorite_name: string;
          favorite_avatar_url: string | null;
          underdog_prior_wins: number;
          favorite_prior_wins: number;
          prior_win_gap: number;
        };
        Relationships: [];
      };
      v_player_current_streak: {
        Row: {
          group_id: string;
          player_id: string;
          display_name: string;
          avatar_url: string | null;
          streak_type: "win" | "loss";
          streak_length: number;
          streak_end_at: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      create_group_with_owner: {
        Args: {
          p_name: string;
          p_slug?: string | null;
          p_timezone?: string;
          p_city?: string | null;
        };
        Returns: Database["public"]["Tables"]["groups"]["Row"];
      };
      redeem_group_invitation: {
        Args: { p_code: string };
        Returns: Database["public"]["Tables"]["groups"]["Row"];
      };
      create_group_invitation: {
        Args: {
          p_group_id: string;
          p_role?: GroupRole;
          p_expires_at?: string | null;
          p_max_uses?: number | null;
        };
        Returns: Database["public"]["Tables"]["group_invitations"]["Row"];
      };
      revoke_group_invitation: {
        Args: { p_invitation_id: string };
        Returns: undefined;
      };
      get_or_create_session: {
        Args: {
          p_group_id: string;
          p_played_on: string;
          p_title?: string | null;
          p_location?: string | null;
          p_notes?: string | null;
        };
        Returns: Database["public"]["Tables"]["sessions"]["Row"];
      };
      create_match: {
        Args: {
          p_group_id: string;
          p_played_at: string;
          p_team_a: string[];
          p_team_b: string[];
          p_winning_side?: MatchSide | null;
          p_team_a_score?: number | null;
          p_team_b_score?: number | null;
          p_session_id?: string | null;
          p_notes?: string | null;
          p_external_key?: string | null;
        };
        Returns: string;
      };
      import_legacy_match: {
        Args: {
          p_group_id: string;
          p_played_at: string;
          p_team_a: string[];
          p_team_b: string[];
          p_winning_side: MatchSide;
          p_created_by: string;
          p_session_id?: string | null;
          p_external_key?: string | null;
        };
        Returns: string;
      };
      update_match: {
        Args: {
          p_match_id: string;
          p_played_at: string;
          p_team_a: string[];
          p_team_b: string[];
          p_winning_side?: MatchSide | null;
          p_team_a_score?: number | null;
          p_team_b_score?: number | null;
          p_session_id?: string | null;
          p_notes?: string | null;
        };
        Returns: string;
      };
      void_match: { Args: { p_match_id: string; p_reason?: string | null }; Returns: undefined };
      delete_match: { Args: { p_match_id: string; p_reason?: string | null }; Returns: undefined };
      restore_match: { Args: { p_match_id: string }; Returns: undefined };
      set_member_role: {
        Args: { p_group_id: string; p_user_id: string; p_role: GroupRole };
        Returns: undefined;
      };
      current_group_role: { Args: { target_group_id: string }; Returns: GroupRole | null };
      is_group_member: { Args: { target_group_id: string }; Returns: boolean };
      is_group_admin: { Args: { target_group_id: string }; Returns: boolean };
      is_group_owner: { Args: { target_group_id: string }; Returns: boolean };
      stats_players: {
        Args: {
          p_group_id: string;
          p_from?: string | null;
          p_to?: string | null;
          p_session_id?: string | null;
          p_player_id?: string | null;
          p_min_attendance_percent?: number;
        };
        Returns: {
          position: number;
          player_id: string;
          display_name: string;
          avatar_url: string | null;
          sort_order: number;
          active: boolean;
          is_guest: boolean;
          games: number;
          wins: number;
          losses: number;
          win_rate: number;
          total_group_matches: number;
          attendance_percent: number;
          meets_min_attendance: boolean;
        }[];
      };
      stats_pairs: {
        Args: {
          p_group_id: string;
          p_from?: string | null;
          p_to?: string | null;
          p_session_id?: string | null;
          p_player_id?: string | null;
          p_min_games?: number;
        };
        Returns: {
          position: number;
          pair_key: string;
          player_ids: string[];
          player_names: string[];
          games: number;
          wins: number;
          losses: number;
          win_rate: number;
        }[];
      };
      stats_player_head_to_head: {
        Args: {
          p_group_id: string;
          p_from?: string | null;
          p_to?: string | null;
          p_session_id?: string | null;
          p_perspective_player_id?: string | null;
          p_min_games?: number;
        };
        Returns: {
          player_1_id: string;
          player_1_name: string;
          player_2_id: string;
          player_2_name: string;
          games: number;
          player_1_wins: number;
          player_2_wins: number;
          player_1_win_rate: number;
          player_2_win_rate: number;
        }[];
      };
      stats_pair_head_to_head: {
        Args: {
          p_group_id: string;
          p_from?: string | null;
          p_to?: string | null;
          p_session_id?: string | null;
          p_perspective_pair?: string[] | null;
          p_min_games?: number;
        };
        Returns: {
          pair_1_key: string;
          pair_1_ids: string[];
          pair_1_names: string[];
          pair_2_key: string;
          pair_2_ids: string[];
          pair_2_names: string[];
          games: number;
          pair_1_wins: number;
          pair_2_wins: number;
          pair_1_win_rate: number;
          pair_2_win_rate: number;
        }[];
      };
      group_overview: {
        Args: { p_group_id: string };
        Returns: {
          total_matches: number;
          total_sessions: number;
          active_players: number;
          total_players: number;
          last_played_at: string | null;
          last_session_id: string | null;
          last_session_played_on: string | null;
        }[];
      };
      my_ranking_positions: {
        Args: Record<string, never>;
        Returns: {
          group_id: string;
          player_id: string;
          position: number;
          meets_min_attendance: boolean;
          win_rate: number;
        }[];
      };
      get_global_user_stats: {
        Args: { p_user_id: string };
        Returns: {
          total_matches: number;
          total_wins: number;
          global_win_rate: number;
          global_saldo: number;
        }[];
      };
    };
    Enums: {
      group_role: GroupRole;
      match_side: MatchSide;
      match_status: MatchStatus;
    };
    CompositeTypes: Record<never, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type Views<T extends keyof Database["public"]["Views"]> =
  Database["public"]["Views"][T]["Row"];
export type FnReturns<T extends keyof Database["public"]["Functions"]> =
  Database["public"]["Functions"][T]["Returns"];

export type PlayerRow = Tables<"players">;
export type GroupRow = Tables<"groups">;
export type MatchRow = Tables<"matches">;
export type SessionRow = Tables<"sessions">;
export type ProfileRow = Tables<"profiles">;
export type InvitationRow = Tables<"group_invitations">;
export type AuditRow = Tables<"audit_log">;
export type BadgeRow = Tables<"badges">;
export type PlayerBadgeRow = Tables<"player_badges">;

export type PlayerStatRow = FnReturns<"stats_players">[number];
export type PairStatRow = FnReturns<"stats_pairs">[number];
export type PlayerH2HRow = FnReturns<"stats_player_head_to_head">[number];
export type PairH2HRow = FnReturns<"stats_pair_head_to_head">[number];
export type GroupOverviewRow = FnReturns<"group_overview">[number];
export type MyRankingPositionRow = FnReturns<"my_ranking_positions">[number];
export type GlobalUserStatsRow = FnReturns<"get_global_user_stats">[number];

export type DailyKingRow = Views<"v_daily_kings">;
export type DailyLanternRow = Views<"v_daily_lanterns">;
export type PlayerStreakRow = Views<"v_player_streaks">;
export type PairUnderdogRow = Views<"v_pair_underdogs">;
export type MassacreRow = Views<"v_biggest_massacres">;
export type IndividualUnderdogRow = Views<"v_individual_underdogs">;
export type PlayerCurrentStreakRow = Views<"v_player_current_streak">;
