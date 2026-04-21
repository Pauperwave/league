import type { Tables, TablesInsert, Enums } from '#shared/utils/types/database'

// ─── Table Row Types ────────────────────────────────────────────────────────
export type League      = Tables<'leagues'>
export type Ruleset     = Tables<'rulesets'>
export type Event       = Tables<'events'>
export type Player      = Tables<'players'>
export type Pairing     = Tables<'pairings'>
export type Standing    = Tables<'standings'>
export type RoundResult = Tables<'round_results'>
export type WaitroomEntry = Tables<'waitroom'>

// ─── Insert Types ───────────────────────────────────────────────────────────
export type LeagueInsert      = TablesInsert<'leagues'>
export type EventInsert       = TablesInsert<'events'>
export type RoundResultInsert = TablesInsert<'round_results'>
export type PlayerInsert      = TablesInsert<'players'>

// Alias for backward compatibility
export type NewPlayer = Omit<PlayerInsert, 'player_id'>

// ─── Enum Types ─────────────────────────────────────────────────────────────
export type MtgFormat = Enums<'mtg_formats'>

// ─── Extended Types ─────────────────────────────────────────────────────────

// Partial player data as returned by standings queries
export interface StandingWithPlayerBasic extends Standing {
  players?: {
    player_id: number
    player_name: string
    player_surname: string
  }
}

// Full player data - for compatibility with existing code that expects full player
export interface StandingWithPlayer extends Standing {
  players?: Player
}

export interface PairingWithResults extends Pairing {
  round_results?: RoundResult[]
}

export interface TournamentPlayer {
  id: number
  name: string
  surname: string
  seed?: number
  avatarUrl?: string
}

export interface Seat {
  id: string
  player: TournamentPlayer | null
}

export interface TournamentTable {
  id: string
  tableNumber: number
  seats: Seat[]
}

export interface PairingForbiddenPair {
  playerA: number
  playerB: number
}

export interface PairingWeights {
  strengthBalance: number
  novelty: number
  rematch: number
  rotateTable3: number
  tableSize4: number
  tableSize3: number
}
