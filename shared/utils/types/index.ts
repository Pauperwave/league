// shared\utils\types\index.ts
// Auto-generated database types are in `database.ts` — do not modify that file.
// This file extends them with project-specific types.
import type { Database, Tables, TablesInsert } from '#shared/utils/types/database'

// ─── Table Row Types ────────────────────────────────────────────────────────
export type League      = Tables<'leagues'>
export type Ruleset     = Tables<'rulesets'>
export type Event       = Tables<'events'>
export type Player      = Tables<'players'>
export type Pairing     = Tables<'pairings'>
export type Standing    = Tables<'standings'>
export type RoundResult = Tables<'round_results'>
export type WaitroomEntry = Tables<'waitroom'>
export type MtgFormat    = Database['public']['Enums']['mtg_formats']

/** Extract non-null player IDs from a pairing row */
export function getPairingPlayerIds(pairing: Pairing): number[] {
  return [
    pairing.pairing_player1_id,
    pairing.pairing_player2_id,
    pairing.pairing_player3_id,
    pairing.pairing_player4_id,
  ].filter((id): id is number => id !== null)
}

export interface CommanderDeck {
  id: number
  uuid: string
  player_id: number
  commander_1_name: string
  commander_2_name: string | null
  companion_name: string | null
  is_borrowed: boolean
  lender_id: number | null
  bracket_level: number | null
  created_at: string
  updated_at: string
}

export interface PlayerStat {
  player_id: number
  events_played: number
  total_matches: number
  total_wins: number
  total_kills: number
  average_score: number
}

// ─── Insert Types ───────────────────────────────────────────────────────────
export type LeagueInsert      = TablesInsert<'leagues'>
export type EventInsert       = TablesInsert<'events'>
export type RoundResultInsert = TablesInsert<'round_results'>
export type PairingInsert     = TablesInsert<'pairings'>
export type PlayerInsert      = TablesInsert<'players'>

// Alias for backward compatibility
export type NewPlayer = Omit<PlayerInsert, 'player_id'>

// ─── Extended Types ─────────────────────────────────────────────────────────

// Full player data - for compatibility with existing code that expects full player
export interface StandingWithPlayer extends Standing {
  players?: Player
  kills?: number
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

export interface Kill {
  killerId: number
  victimId: number
}

// Aggregate stats per commander (from commander_stats materialized view)
export interface CommanderAggregate {
  commander_1: string
  commander_2: string | null
  player_count: number
  match_count: number
  win_count: number
  total_kills: number
  average_score: number
}

// Event status - single source of truth for event state
export type EventStatus = 'registration' | 'playing' | 'ended'
