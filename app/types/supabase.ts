export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '13.0.5'
  }
  public: {
    Tables: {
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
        }
        Relationships: [
          {
            foreignKeyName: 'events_league_id_fkey'
            columns: ['league_id']
            isOneToOne: false
            referencedRelation: 'leagues'
            referencedColumns: ['id']
          }
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
            foreignKeyName: 'leagues_ruleset_id_fkey'
            columns: ['ruleset_id']
            isOneToOne: false
            referencedRelation: 'rulesets'
            referencedColumns: ['ruleset_id']
          }
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
            foreignKeyName: 'pairings_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['event_id']
          },
          {
            foreignKeyName: 'Pairings_pairing_player1_id_fkey'
            columns: ['pairing_player1_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['player_id']
          },
          {
            foreignKeyName: 'Pairings_pairing_player2_id_fkey'
            columns: ['pairing_player2_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['player_id']
          },
          {
            foreignKeyName: 'Pairings_pairing_player3_id_fkey'
            columns: ['pairing_player3_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['player_id']
          },
          {
            foreignKeyName: 'Pairings_pairing_player4_id_fkey'
            columns: ['pairing_player4_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['player_id']
          }
        ]
      }
      players: {
        Row: {
          formats_played: Database['public']['Enums']['mtg_formats'][] | null
          is_active: boolean
          player_id: number
          player_name: string
          player_surname: string
        }
        Insert: {
          formats_played?: Database['public']['Enums']['mtg_formats'][] | null
          is_active?: boolean
          player_id?: number
          player_name: string
          player_surname: string
        }
        Update: {
          formats_played?: Database['public']['Enums']['mtg_formats'][] | null
          is_active?: boolean
          player_id?: number
          player_name?: string
          player_surname?: string
        }
        Relationships: []
      }
      players_sorted: {
        Row: {
          id: number
          player_id: number | null
          player_name: string
          player_surname: string
        }
        Insert: {
          id?: never
          player_id?: number | null
          player_name: string
          player_surname: string
        }
        Update: {
          id?: never
          player_id?: number | null
          player_name?: string
          player_surname?: string
        }
        Relationships: [
          {
            foreignKeyName: 'fk_players_sorted_player_id'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['player_id']
          }
        ]
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
            foreignKeyName: 'round_results_pairing_id_fkey'
            columns: ['pairing_id']
            isOneToOne: false
            referencedRelation: 'pairings'
            referencedColumns: ['pairing_id']
          },
          {
            foreignKeyName: 'round_results_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['player_id']
          }
        ]
      }
      rulesets: {
        Row: {
          name: string | null
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
          name?: string | null
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
          name?: string | null
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
            foreignKeyName: 'standings_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['event_id']
          },
          {
            foreignKeyName: 'Standings_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['player_id']
          }
        ]
      }
      waitroom: {
        Row: {
          event_id: number
          player_id: number
          wait_id: number
        }
        Insert: {
          event_id: number
          player_id: number
          wait_id?: number
        }
        Update: {
          event_id?: number
          player_id?: number
          wait_id?: number
        }
        Relationships: [
          {
            foreignKeyName: 'waitroom_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['event_id']
          },
          {
            foreignKeyName: 'waitroom_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['player_id']
          }
        ]
      }
    }
    Views: {
      [_ in never]: never;
    }
    Functions: {
      [_ in never]: never;
    }
    Enums: {
      mtg_formats:
        | 'Standard'
        | 'Pioneer'
        | 'Modern'
        | 'Legacy'
        | 'Vintage'
        | 'Commander'
        | 'Oathbreaker'
        | 'Alchemy'
        | 'Historic'
        | 'Brawl'
        | 'Timeless'
        | 'Pauper'
        | 'Penny'
    }
    CompositeTypes: {
      [_ in never]: never;
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
  | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
      & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
      ? R
      : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
        ? R
        : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema['Tables']
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
    Insert: infer I
  }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema['Tables']
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
    Update: infer U
  }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
  | keyof DefaultSchema['Enums']
  | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
  | keyof DefaultSchema['CompositeTypes']
  | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      mtg_formats: [
        'Standard',
        'Pioneer',
        'Modern',
        'Legacy',
        'Vintage',
        'Commander',
        'Oathbreaker',
        'Alchemy',
        'Historic',
        'Brawl',
        'Timeless',
        'Pauper',
        'Penny'
      ]
    }
  }
} as const
