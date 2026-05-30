// scripts/sync-commanders.ts
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import ws from 'ws'

function loadEnv() {
  const envPath = resolve('.env')
  try {
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      const value = trimmed.slice(eq + 1).trim()
      if (process.env[key] === undefined || process.env[key] === '') process.env[key] = value
    }
  } catch { /* ignore */ }
}

loadEnv()

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY!

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY env vars')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: ws as any }
})

async function main() {
  const allCards: any[] = []
  let nextPage: string | null =
    'https://api.scryfall.com/cards/search?q=legal%3Acommander+is%3Acommander&unique=cards&order=name'
  let pageCount = 0

  while (nextPage) {
    console.log(`📦 Fetching page ${++pageCount}: ${nextPage}`)

    const response = await fetch(nextPage, {
      headers: { 'User-Agent': 'MtgLeagueApp/1.0 (test@test.com)' }
    })

    if (!response.ok) {
      throw new Error(`Scryfall fetch failed: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    console.log(`✅ Page ${pageCount}: ${data.data.length} cards, has_more: ${data.has_more}`)
    allCards.push(...data.data)
    nextPage = data.has_more ? data.next_page : null
    if (nextPage) await new Promise(r => setTimeout(r, 150))
  }

  console.log(`📊 Total cards fetched: ${allCards.length}`)

  const commanders = allCards.map(card => {
    const partnerInfo = resolvePartnerInfo(card)
    const isTrueDoubleFaced = ['transform', 'modal_dfc', 'reversible_card'].includes(card.layout)

    return {
      scryfall_id: card.id,
      card_name: card.name,
      image_url: card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? null,
      large_image_url: card.image_uris?.large ?? card.card_faces?.[0]?.image_uris?.large ?? null,
      art_crop_url: card.image_uris?.art_crop ?? card.card_faces?.[0]?.image_uris?.art_crop ?? null,
      back_image_url: isTrueDoubleFaced ? (card.card_faces?.[1]?.image_uris?.normal ?? null) : null,
      back_large_image_url: isTrueDoubleFaced ? (card.card_faces?.[1]?.image_uris?.large ?? null) : null,
      back_art_crop_url: isTrueDoubleFaced ? (card.card_faces?.[1]?.image_uris?.art_crop ?? null) : null,
      mana_cost: card.mana_cost ?? card.card_faces?.[0]?.mana_cost ?? null,
      back_mana_cost: isTrueDoubleFaced ? (card.card_faces?.[1]?.mana_cost ?? null) : null,
      cmc: card.cmc ?? 0,
      color_identity: card.color_identity ?? [],
      type_line: card.type_line ?? card.card_faces?.[0]?.type_line ?? null,
      back_type_line: isTrueDoubleFaced ? (card.card_faces?.[1]?.type_line ?? null) : null,
      keywords: card.keywords ?? [],
      oracle_text: card.oracle_text ?? card.card_faces?.[0]?.oracle_text ?? null,
      back_oracle_text: isTrueDoubleFaced ? (card.card_faces?.[1]?.oracle_text ?? null) : null,
      partner_type: partnerInfo.type,
      partner_group_tag: partnerInfo.groupTag,
      partner_with_scryfall_id: partnerInfo.partnerWithId,
      scryfall_url: card.scryfall_uri ?? null,
      legalities: card.legalities ?? null,
      released_at: card.released_at ?? null,
      edhrec_rank: card.edhrec_rank ?? null,
      layout: card.layout ?? null,
      is_double_faced: isTrueDoubleFaced,
      last_synced_at: new Date().toISOString()
    }
  })

  // Pass 1: Upsert all rows WITHOUT partner_with_scryfall_id to avoid FK ordering issues
  console.log('💾 Starting upsert (pass 1 — no partner references)...')

  const batchSize = 500
  for (let i = 0; i < commanders.length; i += batchSize) {
    const batch = commanders.slice(i, i + batchSize)
    const batchWithoutPartner = batch.map(c => ({ ...c, partner_with_scryfall_id: null }))
    console.log(`💾 Upserting batch ${i / batchSize + 1} (${batch.length} records)`)

    const { error } = await supabase
      .from('mtg_commanders')
      .upsert(batchWithoutPartner as any, { onConflict: 'scryfall_id' })

    if (error) {
      console.error('❌ Supabase upsert error:', error)
      throw new Error('Supabase error: ' + error.message)
    }
  }

  // Pass 2: Update partner_with_scryfall_id for cards whose partner is also a commander
  const validScryfallIds = new Set(commanders.map(c => c.scryfall_id))
  const cardsWithPartner = commanders.filter(
    c => c.partner_with_scryfall_id !== null && c.partner_with_scryfall_id !== undefined && validScryfallIds.has(c.partner_with_scryfall_id)
  )
  if (cardsWithPartner.length > 0) {
    console.log(`💾 Starting pass 2 — updating ${cardsWithPartner.length} partner references...`)
    for (const card of cardsWithPartner) {
      const { error } = await supabase
        .from('mtg_commanders')
        .update({ partner_with_scryfall_id: card.partner_with_scryfall_id })
        .eq('scryfall_id', card.scryfall_id)

      if (error) {
        console.warn(`⚠️ Failed to update partner for ${card.card_name}:`, error.message)
      }
    }
  }

  console.log('🎉 Sync completed!')
  console.log(`Total commanders upserted: ${commanders.length}`)
}

function resolvePartnerInfo(card: any): { type: string | null; groupTag: string | null; partnerWithId: string | null } {
  const keywords = card.keywords ?? []
  const allParts = card.all_parts ?? []

  if (keywords.includes('Partner with')) {
    const partnerPart = allParts.find((p: any) => p.component === 'combo_piece' && p.id !== card.id)
    return {
      type: 'partner_with',
      groupTag: partnerPart?.name ? slugify(partnerPart.name) : null,
      partnerWithId: partnerPart?.id ?? null
    }
  }

  if (keywords.includes('Partner')) {
    return { type: 'partner', groupTag: null, partnerWithId: null }
  }

  if (card.type_line?.includes('Background')) {
    return { type: 'background', groupTag: null, partnerWithId: null }
  }

  if (keywords.includes('Friends forever')) {
    return { type: 'friends_forever', groupTag: 'friends-forever', partnerWithId: null }
  }

  if (keywords.includes("Doctor's companion")) {
    return { type: 'doctors_companion', groupTag: 'doctor-who', partnerWithId: null }
  }

  return { type: null, groupTag: null, partnerWithId: null }
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
