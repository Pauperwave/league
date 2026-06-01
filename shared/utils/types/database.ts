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
      commander_decks: {
        Row: {
          commander_1_name: string
          commander_2_name: string | null
          companion_name: string | null
          created_at: string
          id: number
          is_borrowed: boolean
          lender_id: number | null
          player_id: number
          updated_at: string
          uuid: string
        }
        Insert: {
          commander_1_name: string
          commander_2_name?: string | null
          companion_name?: string | null
          created_at?: string
          id?: number
          is_borrowed?: boolean
          lender_id?: number | null
          player_id: number
          updated_at?: string
          uuid?: string
        }
        Update: {
          commander_1_name?: string
          commander_2_name?: string | null
          companion_name?: string | null
          created_at?: string
          id?: number
          is_borrowed?: boolean
          lender_id?: number | null
          player_id?: number
          updated_at?: string
          uuid?: string
        }
        Relationships: [
          {
            foreignKeyName: "commander_decks_lender_id_fkey"
            columns: ["lender_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "fk_commander_decks_player"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["player_id"]
          },
        ]
      }
      deck_stats: {
        Row: {
          average_score: number
          commander_1: string
          commander_2: string | null
          events_played: number
          id: number
          player_id: number
          total_kills: number
          total_matches: number
          total_wins: number
          updated_at: string
        }
        Insert: {
          average_score?: number
          commander_1: string
          commander_2?: string | null
          events_played?: number
          id?: number
          player_id: number
          total_kills?: number
          total_matches?: number
          total_wins?: number
          updated_at?: string
        }
        Update: {
          average_score?: number
          commander_1?: string
          commander_2?: string | null
          events_played?: number
          id?: number
          player_id?: number
          total_kills?: number
          total_matches?: number
          total_wins?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deck_stats_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["player_id"]
          },
        ]
      }
      events: {
        Row: {
          event_current_round: number | null
          event_datetime: string | null
          event_id: number
          event_name: string
          event_playing: boolean | null
          event_registration_open: boolean | null
          event_round_number: number | null
          league_id: number | null
          status: string | null
        }
        Insert: {
          event_current_round?: number | null
          event_datetime?: string | null
          event_id?: number
          event_name: string
          event_playing?: boolean | null
          event_registration_open?: boolean | null
          event_round_number?: number | null
          league_id?: number | null
          status?: string | null
        }
        Update: {
          event_current_round?: number | null
          event_datetime?: string | null
          event_id?: number
          event_name?: string
          event_playing?: boolean | null
          event_registration_open?: boolean | null
          event_round_number?: number | null
          league_id?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      leagues: {
        Row: {
          ends_at: string | null
          id: number
          name: string
          ruleset_id: number | null
          starts_at: string | null
          status: string
        }
        Insert: {
          ends_at?: string | null
          id?: number
          name: string
          ruleset_id?: number | null
          starts_at?: string | null
          status: string
        }
        Update: {
          ends_at?: string | null
          id?: number
          name?: string
          ruleset_id?: number | null
          starts_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "leagues_ruleset_id_fkey"
            columns: ["ruleset_id"]
            isOneToOne: false
            referencedRelation: "rulesets"
            referencedColumns: ["ruleset_id"]
          },
        ]
      }
      mtg_commanders: {
        Row: {
          art_crop_url: string | null
          back_art_crop_url: string | null
          back_image_url: string | null
          back_large_image_url: string | null
          back_mana_cost: string | null
          back_oracle_text: string | null
          back_type_line: string | null
          card_name: string
          cmc: number | null
          color_identity: string[] | null
          edhrec_rank: number | null
          id: number
          image_url: string | null
          is_double_faced: boolean | null
          keywords: string[] | null
          large_image_url: string | null
          last_synced_at: string
          layout: string | null
          mana_cost: string | null
          oracle_text: string | null
          partner_group_tag: string | null
          partner_type: string | null
          partner_with_scryfall_id: string | null
          scryfall_id: string
          scryfall_url: string | null
          type_line: string | null
          uuid: string
        }
        Insert: {
          art_crop_url?: string | null
          back_art_crop_url?: string | null
          back_image_url?: string | null
          back_large_image_url?: string | null
          back_mana_cost?: string | null
          back_oracle_text?: string | null
          back_type_line?: string | null
          card_name: string
          cmc?: number | null
          color_identity?: string[] | null
          edhrec_rank?: number | null
          id?: number
          image_url?: string | null
          is_double_faced?: boolean | null
          keywords?: string[] | null
          large_image_url?: string | null
          last_synced_at?: string
          layout?: string | null
          mana_cost?: string | null
          oracle_text?: string | null
          partner_group_tag?: string | null
          partner_type?: string | null
          partner_with_scryfall_id?: string | null
          scryfall_id: string
          scryfall_url?: string | null
          type_line?: string | null
          uuid?: string
        }
        Update: {
          art_crop_url?: string | null
          back_art_crop_url?: string | null
          back_image_url?: string | null
          back_large_image_url?: string | null
          back_mana_cost?: string | null
          back_oracle_text?: string | null
          back_type_line?: string | null
          card_name?: string
          cmc?: number | null
          color_identity?: string[] | null
          edhrec_rank?: number | null
          id?: number
          image_url?: string | null
          is_double_faced?: boolean | null
          keywords?: string[] | null
          large_image_url?: string | null
          last_synced_at?: string
          layout?: string | null
          mana_cost?: string | null
          oracle_text?: string | null
          partner_group_tag?: string | null
          partner_type?: string | null
          partner_with_scryfall_id?: string | null
          scryfall_id?: string
          scryfall_url?: string | null
          type_line?: string | null
          uuid?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_mtg_commanders_partner_with"
            columns: ["partner_with_scryfall_id"]
            isOneToOne: false
            referencedRelation: "mtg_commanders"
            referencedColumns: ["scryfall_id"]
          },
        ]
      }
      pairings: {
        Row: {
          event_id: number
          pairing_datetime: string | null
          pairing_id: number
          pairing_is_full: boolean | null
          pairing_player1_id: number | null
          pairing_player2_id: number | null
          pairing_player3_id: number | null
          pairing_player4_id: number | null
          pairing_round: number | null
        }
        Insert: {
          event_id: number
          pairing_datetime?: string | null
          pairing_id?: number
          pairing_is_full?: boolean | null
          pairing_player1_id?: number | null
          pairing_player2_id?: number | null
          pairing_player3_id?: number | null
          pairing_player4_id?: number | null
          pairing_round?: number | null
        }
        Update: {
          event_id?: number
          pairing_datetime?: string | null
          pairing_id?: number
          pairing_is_full?: boolean | null
          pairing_player1_id?: number | null
          pairing_player2_id?: number | null
          pairing_player3_id?: number | null
          pairing_player4_id?: number | null
          pairing_round?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pairings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "Pairings_pairing_player1_id_fkey"
            columns: ["pairing_player1_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "Pairings_pairing_player2_id_fkey"
            columns: ["pairing_player2_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "Pairings_pairing_player3_id_fkey"
            columns: ["pairing_player3_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "Pairings_pairing_player4_id_fkey"
            columns: ["pairing_player4_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["player_id"]
          },
        ]
      }
      player_stats: {
        Row: {
          average_score: number
          events_played: number
          player_id: number
          total_kills: number
          total_matches: number
          total_wins: number
          updated_at: string
        }
        Insert: {
          average_score?: number
          events_played?: number
          player_id: number
          total_kills?: number
          total_matches?: number
          total_wins?: number
          updated_at?: string
        }
        Update: {
          average_score?: number
          events_played?: number
          player_id?: number
          total_kills?: number
          total_matches?: number
          total_wins?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_stats_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "players"
            referencedColumns: ["player_id"]
          },
        ]
      }
      players: {
        Row: {
          formats_played: Database["public"]["Enums"]["mtg_formats"][] | null
          is_active: boolean
          player_id: number
          player_name: string
          player_surname: string
        }
        Insert: {
          formats_played?: Database["public"]["Enums"]["mtg_formats"][] | null
          is_active?: boolean
          player_id?: number
          player_name: string
          player_surname: string
        }
        Update: {
          formats_played?: Database["public"]["Enums"]["mtg_formats"][] | null
          is_active?: boolean
          player_id?: number
          player_name?: string
          player_surname?: string
        }
        Relationships: []
      }
      round_results: {
        Row: {
          brew_vote: number | null
          commander_1: string | null
          commander_2: string | null
          id: number
          number_of_kills: number | null
          pairing_id: number | null
          play_vote_1: number | null
          play_vote_2: number | null
          player_id: number
          position: number | null
        }
        Insert: {
          brew_vote?: number | null
          commander_1?: string | null
          commander_2?: string | null
          id?: number
          number_of_kills?: number | null
          pairing_id?: number | null
          play_vote_1?: number | null
          play_vote_2?: number | null
          player_id: number
          position?: number | null
        }
        Update: {
          brew_vote?: number | null
          commander_1?: string | null
          commander_2?: string | null
          id?: number
          number_of_kills?: number | null
          pairing_id?: number | null
          play_vote_1?: number | null
          play_vote_2?: number | null
          player_id?: number
          position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "round_results_pairing_id_fkey"
            columns: ["pairing_id"]
            isOneToOne: false
            referencedRelation: "pairings"
            referencedColumns: ["pairing_id"]
          },
          {
            foreignKeyName: "round_results_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["player_id"]
          },
        ]
      }
      rulesets: {
        Row: {
          name: string
          rule_set_brew: number | null
          rule_set_kill: number | null
          rule_set_partecipation: number | null
          rule_set_play: number | null
          rule_set_rank1: number | null
          rule_set_rank2: number | null
          rule_set_rank3: number | null
          rule_set_rank4: number | null
          rule_set_valid_events: number | null
          ruleset_id: number
        }
        Insert: {
          name: string
          rule_set_brew?: number | null
          rule_set_kill?: number | null
          rule_set_partecipation?: number | null
          rule_set_play?: number | null
          rule_set_rank1?: number | null
          rule_set_rank2?: number | null
          rule_set_rank3?: number | null
          rule_set_rank4?: number | null
          rule_set_valid_events?: number | null
          ruleset_id?: number
        }
        Update: {
          name?: string
          rule_set_brew?: number | null
          rule_set_kill?: number | null
          rule_set_partecipation?: number | null
          rule_set_play?: number | null
          rule_set_rank1?: number | null
          rule_set_rank2?: number | null
          rule_set_rank3?: number | null
          rule_set_rank4?: number | null
          rule_set_valid_events?: number | null
          ruleset_id?: number
        }
        Relationships: []
      }
      standings: {
        Row: {
          brew_received: number | null
          event_id: number | null
          play_received: number | null
          player_id: number
          standing_id: number
          standing_player_rank: number | null
          standing_player_score: number | null
          victories: number | null
        }
        Insert: {
          brew_received?: number | null
          event_id?: number | null
          play_received?: number | null
          player_id: number
          standing_id?: number
          standing_player_rank?: number | null
          standing_player_score?: number | null
          victories?: number | null
        }
        Update: {
          brew_received?: number | null
          event_id?: number | null
          play_received?: number | null
          player_id?: number
          standing_id?: number
          standing_player_rank?: number | null
          standing_player_score?: number | null
          victories?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "standings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "Standings_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["player_id"]
          },
        ]
      }
      waitroom: {
        Row: {
          event_id: number
          inserted_at: string | null
          player_id: number
          wait_id: number
        }
        Insert: {
          event_id: number
          inserted_at?: string | null
          player_id: number
          wait_id?: number
        }
        Update: {
          event_id?: number
          inserted_at?: string | null
          player_id?: number
          wait_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "waitroom_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "waitroom_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["player_id"]
          },
        ]
      }
    }
    Views: {
      commander_stats: {
        Row: {
          average_score: number | null
          commander_1: string | null
          commander_2: string | null
          match_count: number | null
          player_count: number | null
          total_kills: number | null
          win_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      recalc_deck_stats: {
        Args: {
          p_commander_1: string
          p_commander_2: string
          p_player_id: number
        }
        Returns: undefined
      }
      recalc_player_stats: { Args: { p_player_id: number }; Returns: undefined }
      refresh_commander_stats: { Args: never; Returns: undefined }
    }
    Enums: {
      mtg_formats:
        | "Standard"
        | "Pioneer"
        | "Modern"
        | "Legacy"
        | "Vintage"
        | "Commander"
        | "Oathbreaker"
        | "Alchemy"
        | "Historic"
        | "Brawl"
        | "Timeless"
        | "Pauper"
        | "Penny"
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
      mtg_formats: [
        "Standard",
        "Pioneer",
        "Modern",
        "Legacy",
        "Vintage",
        "Commander",
        "Oathbreaker",
        "Alchemy",
        "Historic",
        "Brawl",
        "Timeless",
        "Pauper",
        "Penny",
      ],
    },
  },
} as const
