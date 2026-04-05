// Database types matching the existing Commander_League schema

// ============================================
// CORE ENTITIES
// ============================================

export interface League {
  id: number
  name: string
  starts_at: string | null
  ends_at: string | null
  status: string
  ruleset_id: number | null
}

export interface Event {
  event_id: number
  event_name: string
  event_datetime: string | null
  event_round_number: number | null
  event_current_round: number | null
  event_registration_open: boolean | null
  event_playing: boolean | null
  league_id: number | null
}

export interface Player {
  player_id: number
  player_name: string
  player_surname: string
  is_active?: boolean
  formats_played?: string[] | null
}

export interface Ruleset {
  ruleset_id: number
  name: string | null
  rule_set_kill: number | null
  rule_set_rank1: number | null
  rule_set_rank2: number | null
  rule_set_rank3: number | null
  rule_set_rank4: number | null
  rule_set_play: number | null
  rule_set_brew: number | null
  rule_set_partecipation: number | null
  rule_set_valid_events: number | null
}

export interface Pairing {
  pairing_id: number
  event_id: number
  pairing_datetime: string | null
  pairing_round: number | null
  pairing_player1_id: number | null
  pairing_player2_id: number | null
  pairing_player3_id: number | null
  pairing_player4_id: number | null
  pairing_is_full: boolean | null
  round_results?: RoundResult[]
}

export interface Standing {
  standing_id: number
  player_id: number
  event_id: number | null
  standing_player_score: number | null
  standing_player_rank: number | null
  victories: number | null
  brew_received: number | null
  play_received: number | null
  players?: Player
}

export interface WaitroomEntry {
  wait_id: number
  event_id: number
  player_id: number
}

export interface RoundResult {
  id: number
  player_id: number
  pairing_id: number | null
  position: number | null
  number_of_kills: number | null
  brew_vote: number | null
  play_vote_1: number | null
  play_vote_2: number | null
  commander_1: string | null
  commander_2: string | null
}

export interface PlayerSorted {
  id: number
  player_id: number | null
  player_name: string
  player_surname: string
}

// ============================================
// REQUEST TYPES
// ============================================

export interface NewLeague {
  name: string
  starts_at?: string
  ends_at?: string
  status?: string
  ruleset_id?: number
}

export interface NewEvent {
  event_name: string
  event_datetime?: string
  event_round_number?: number
  event_current_round?: number
  event_registration_open?: boolean
  event_playing?: boolean
  league_id?: number
}

export interface NewPlayer {
  player_name: string
  player_surname: string
  is_active?: boolean
  formats_played?: MTGFormat[]
}

export interface NewPairing {
  event_id: number
  pairing_round?: number
  pairing_player1_id?: number
  pairing_player2_id?: number
  pairing_player3_id?: number
  pairing_player4_id?: number
  pairing_is_full?: boolean
}

export interface NewStanding {
  player_id: number
  event_id?: number
  standing_player_score?: number
  standing_player_rank?: number
  victories?: number
  brew_received?: number
  play_received?: number
}

export interface NewWaitroomEntry {
  event_id: number
  player_id: number
}

export interface RoundResult {
  id: number
  player_id: number
  pairing_id: number | null
  position: number | null
  number_of_kills: number | null
  brew_vote: number | null
  play_vote_1: number | null
  play_vote_2: number | null
  commander_1: string | null
  commander_2: string | null
}

export interface NewRoundResult {
  player_id: number
  pairing_id?: number
  position?: number
  number_of_kills?: number
  brew_vote?: number
  play_vote_1?: number
  play_vote_2?: number
  commander_1?: string
  commander_2?: string
}

// ============================================
// FORMATS ENUM
// ============================================

export type MTGFormat
  = | 'Standard'
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
