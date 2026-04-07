import type { Tables, TablesInsert, Enums } from '#shared/utils/types/database'

// ─── Table Row Types ────────────────────────────────────────────────────────
export type League   = Tables<'leagues'>
export type Ruleset  = Tables<'rulesets'>
export type Event    = Tables<'events'>
export type Player   = Tables<'players'>
export type Pairing  = Tables<'pairings'>
export type Standing = Tables<'standings'>

// ─── Insert Types ───────────────────────────────────────────────────────────
export type LeagueInsert      = TablesInsert<'leagues'>
export type EventInsert       = TablesInsert<'events'>
export type RoundResultInsert = TablesInsert<'round_results'>

// ─── Enum Types ─────────────────────────────────────────────────────────────
export type MtgFormat = Enums<'mtg_formats'>

// ─── Extended Types ─────────────────────────────────────────────────────────
export interface StandingWithPlayer extends Standing {
  players?: Player
}

