import type { Tables, Enums } from '#shared/utils/types/database'

export type League   = Tables<'leagues'>
export type Ruleset  = Tables<'rulesets'>
export type Event    = Tables<'events'>
export type Player   = Tables<'players'>
export type Pairing  = Tables<'pairings'>
export type Standing = Tables<'standings'>

export type MtgFormat = Enums<'mtg_formats'>
