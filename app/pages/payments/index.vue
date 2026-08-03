<!-- app\pages\payments\index.vue -->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { ColumnFiltersState, PaginationState, SortingState, Table } from '@tanstack/vue-table'
import { getFacetedUniqueValues, getPaginationRowModel } from '@tanstack/vue-table'
import { NuxtLink, UBadge, UButton } from '#components'
import PlayerNameTag from '~/components/player/PlayerNameTag.vue'
import type { PaymentRow } from '~/components/payments/types'

/** Flat registration fee per paid seat (POS/Contanti) — 'free' seats cost nothing. */
const REGISTRATION_FEE_EUR = 5
const ALL_VALUE = '__all__'
/** Query-param keys this page owns — stripped from the URL before re-adding
 * current values, so unrelated params survive untouched. */
const OWNED_QUERY_KEYS = ['league', 'tournament', 'format', 'method', 'sort', 'dir', 'page', 'q']

const { t, n } = useI18n()
const route = useRoute()
const router = useRouter()

const { data: leaguesData, isLoading: leaguesLoading } = useLeaguesQuery()
const { data: tournamentsData, isLoading: tournamentsLoading } = useAllEventsQuery()
const {
  data: registrationsData, isLoading: registrationsLoading
} = useAllTournamentRegistrationsQuery()
const { data: playersData, isLoading: playersLoading } = usePlayersQuery()

const loading = computed(() =>
  leaguesLoading.value
  || tournamentsLoading.value
  || registrationsLoading.value
  || playersLoading.value
)

const leaguesById = computed(() =>
  new Map((leaguesData.value ?? []).map(league => [league.id, league.name]))
)
const playersById = computed(() =>
  new Map((playersData.value ?? []).map(player => [player.player_id, player]))
)

/** One row per registration, across every tournament that has at least one. */
const allRows = computed<PaymentRow[]>(() => {
  const rows: PaymentRow[] = []
  for (const tournament of tournamentsData.value ?? []) {
    const registrations = registrationsData.value?.get(tournament.tournament_id)
    if (!registrations?.length) continue

    const leagueName = tournament.league_id === null
      ? t('payments.overview.unknownLeague')
      : (leaguesById.value.get(tournament.league_id) ?? t('payments.overview.unknownLeague'))

    for (const registration of registrations) {
      const player = playersById.value.get(registration.playerId)
      rows.push({
        playerId: registration.playerId,
        name: player?.player_name ?? t('league.ranking.playerFallback', { id: registration.playerId }),
        surname: player?.player_surname ?? '',
        tournamentId: tournament.tournament_id,
        tournamentName: tournament.tournament_name,
        tournamentDate: tournament.tournament_datetime,
        leagueId: tournament.league_id,
        leagueName,
        format: tournament.tournament_format,
        registeredAt: registration.registeredAt,
        paymentMethod: registration.paymentMethod,
        amount: registration.paymentMethod === 'pos' || registration.paymentMethod === 'cash' ? REGISTRATION_FEE_EUR : 0,
      })
    }
  }
  return rows
})

// — URL → initial state (bookmarkable/shareable filters, sort, page, search) —
function queryString(key: string): string | undefined {
  const value = route.query[key]
  return typeof value === 'string' ? value : undefined
}

function initialColumnFilters(): ColumnFiltersState {
  const filters: ColumnFiltersState = []
  const league = queryString('league')
  if (league !== undefined) filters.push({ id: 'leagueId', value: Number(league) })
  const tournament = queryString('tournament')
  if (tournament !== undefined) filters.push({ id: 'tournamentId', value: Number(tournament) })
  const format = queryString('format')
  if (format !== undefined) filters.push({ id: 'format', value: format })
  const method = queryString('method')
  if (method !== undefined) filters.push({ id: 'paymentMethod', value: method })
  return filters
}

function initialSorting(): SortingState {
  const sort = queryString('sort')
  return sort ? [{ id: sort, desc: queryString('dir') === 'desc' }] : []
}

function initialPageIndex(): number {
  const page = Number(queryString('page'))
  return Number.isInteger(page) && page > 1 ? page - 1 : 0
}

// — Filters — drive UTable's own columnFilters state (getFilteredRowModel,
// wired in by the component itself) instead of a hand-rolled computed.
const columnFilters = ref<ColumnFiltersState>(initialColumnFilters())

function columnFilterValue(id: string): string {
  const found = columnFilters.value.find(f => f.id === id)
  return found ? String(found.value) : ALL_VALUE
}

/** `value` is `undefined` when USelectMenu's built-in clear ("x") button
 * fires — treated the same as picking "Tutti/e". */
function setColumnFilter(id: string, value: string | undefined, castNumber = false) {
  const rest = columnFilters.value.filter(f => f.id !== id)
  const isCleared = !value || value === ALL_VALUE
  columnFilters.value = isCleared
    ? rest
    : [...rest, { id, value: castNumber ? Number(value) : value }]
}

const leagueFilter = computed({ get: () => columnFilterValue('leagueId'), set: v => setColumnFilter('leagueId', v, true) })
const tournamentFilter = computed({ get: () => columnFilterValue('tournamentId'), set: v => setColumnFilter('tournamentId', v, true) })
const formatFilter = computed({ get: () => columnFilterValue('format'), set: v => setColumnFilter('format', v) })
const paymentMethodFilter = computed({ get: () => columnFilterValue('paymentMethod'), set: v => setColumnFilter('paymentMethod', v) })

// — Sorting, pagination & search — native UTable/TanStack state, no manual slicing/filtering.
const sorting = ref<SortingState>(initialSorting())
const pagination = ref<PaginationState>({ pageIndex: initialPageIndex(), pageSize: 25 })
const globalFilter = ref(queryString('q') ?? '')

// A filter/search change can strand pageIndex past the new, smaller result set.
watch([columnFilters, globalFilter], () => { pagination.value.pageIndex = 0 }, { deep: true })

// Single router.replace per change (not one per field) — batching avoids each
// field's own watcher racing the others' stale route.query snapshot.
function syncQuery() {
  const newQuery: Record<string, string> = {}
  for (const [key, value] of Object.entries(route.query)) {
    if (typeof value === 'string' && !OWNED_QUERY_KEYS.includes(key)) newQuery[key] = value
  }

  const league = columnFilters.value.find(f => f.id === 'leagueId')?.value
  if (league !== undefined) newQuery.league = String(league)
  const tournament = columnFilters.value.find(f => f.id === 'tournamentId')?.value
  if (tournament !== undefined) newQuery.tournament = String(tournament)
  const format = columnFilters.value.find(f => f.id === 'format')?.value
  if (format !== undefined) newQuery.format = String(format)
  const method = columnFilters.value.find(f => f.id === 'paymentMethod')?.value
  if (method !== undefined) newQuery.method = String(method)

  if (sorting.value[0]) {
    newQuery.sort = sorting.value[0].id
    if (sorting.value[0].desc) newQuery.dir = 'desc'
  }

  if (pagination.value.pageIndex > 0) newQuery.page = String(pagination.value.pageIndex + 1)
  if (globalFilter.value) newQuery.q = globalFilter.value

  router.replace({ query: newQuery })
}

watch([columnFilters, sorting, pagination, globalFilter], syncQuery, { deep: true })

const unknownTimeLabel = t('tournament.registrationTable.unknownTime')
const paymentUnknownLabel = t('tournament.registrationTable.paymentUnknown')

// — Columns —
const columns = computed<TableColumn<PaymentRow>[]>(() => [
  {
    id: 'name',
    accessorFn: row => `${row.name} ${row.surname}`.trim(),
    header: sortableHeader(t('tournament.registrationTable.playerColumn'), UButton),
    meta: { class: { td: 'font-medium' } },
    cell: ({ row }) => playerNameCell(PlayerNameTag, row.original),
  },
  {
    id: 'tournamentId',
    accessorFn: row => row.tournamentId,
    header: t('payments.overview.tournamentColumn'),
    filterFn: 'equals',
    enableSorting: false,
    enableGlobalFilter: false,
    cell: ({ row }) => row.original.leagueId === null
      ? row.original.tournamentName
      : h(NuxtLink, { to: `/league/${row.original.leagueId}/tournament/${row.original.tournamentId}`, class: 'text-primary hover:underline' }, () => row.original.tournamentName),
  },
  {
    id: 'leagueId',
    accessorFn: row => row.leagueId,
    header: sortableHeader(t('payments.overview.leagueColumn'), UButton),
    filterFn: 'equals',
    enableGlobalFilter: false,
    sortingFn: (a, b) => a.original.leagueName.localeCompare(b.original.leagueName),
    cell: ({ row }) => row.original.leagueId === null
      ? row.original.leagueName
      : h(NuxtLink, { to: `/league/${row.original.leagueId}`, class: 'text-primary hover:underline' }, () => row.original.leagueName),
  },
  {
    accessorKey: 'format',
    header: sortableHeader(t('payments.overview.formatColumn'), UButton),
    filterFn: 'equals',
    enableGlobalFilter: false,
    cell: ({ row }) => h(UBadge, {
      color: 'neutral',
      variant: 'subtle',
      size: 'md',
      class: 'cursor-pointer hover:brightness-110',
      onClick: () => { formatFilter.value = row.original.format },
    }, () => row.original.format),
  },
  {
    accessorKey: 'registeredAt',
    header: sortableHeader(t('tournament.registrationTable.registeredAtColumn'), UButton),
    enableGlobalFilter: false,
    meta: { class: { th: 'text-center', td: 'text-center' } },
    cell: ({ row }) => formatRegisteredAt(row.original.registeredAt, unknownTimeLabel),
  },
  {
    accessorKey: 'paymentMethod',
    header: sortableHeader(t('tournament.registrationTable.paymentColumn'), UButton),
    filterFn: 'equals',
    enableGlobalFilter: false,
    meta: { class: { th: 'text-center', td: 'text-center' } },
    cell: ({ row }) => {
      const method = row.original.paymentMethod
      return paymentMethodCell(
        UBadge, method, paymentUnknownLabel, t,
        method ? () => { paymentMethodFilter.value = method } : undefined
      )
    },
  },
  {
    accessorKey: 'amount',
    header: sortableHeader(t('payments.overview.amountColumn'), UButton),
    enableGlobalFilter: false,
    meta: { class: { th: 'text-right', td: 'text-right font-medium' } },
    cell: ({ row }) => n(row.original.amount, 'currency'),
  },
])

// — Totals & filter options — both derived from the table's own row models (tableApi exposed via template ref).
const paymentsTable = useTemplateRef<{ tableApi: Table<PaymentRow> }>('paymentsTable')

const visibleRows = computed<PaymentRow[]>(() =>
  paymentsTable.value?.tableApi.getPrePaginationRowModel().rows.map(row => row.original) ?? []
)

interface PaymentTotals {
  count: number
  pos: number
  cash: number
  free: number
  amount: number
}

const totals = computed<PaymentTotals>(() => {
  let pos = 0
  let cash = 0
  let free = 0
  let amount = 0
  for (const row of visibleRows.value) {
    if (row.paymentMethod === 'pos') pos++
    else if (row.paymentMethod === 'cash') cash++
    else if (row.paymentMethod === 'free') free++
    amount += row.amount
  }
  return { count: visibleRows.value.length, pos, cash, free, amount }
})

/**
 * Faceted unique values (TanStack's own `getFacetedUniqueValues`) instead of
 * hand-computing option sets from `allRows` — each dropdown's options
 * reflect rows matching every OTHER active filter (not itself), the standard
 * cross-filtering UX: picking a league narrows which tournaments/formats
 * show up, and vice versa.
 */
function facetedOptions(
  columnId: string,
  allLabelKey: string,
  labelFor: (value: unknown) => string
): { label: string; value: string }[] {
  const values = [
    ...(paymentsTable.value?.tableApi.getColumn(columnId)?.getFacetedUniqueValues().keys() ?? [])
  ]
  return [
    { label: t(allLabelKey), value: ALL_VALUE },
    ...values.map(value => ({ label: labelFor(value), value: String(value) })),
  ]
}

const idToLeagueName = computed(() => new Map(
  allRows.value.filter(r => r.leagueId !== null).map(r => [r.leagueId, r.leagueName])
))
const idToTournamentName = computed(() =>
  new Map(allRows.value.map(r => [r.tournamentId, r.tournamentName]))
)

const leagueOptions = computed(() => facetedOptions('leagueId', 'payments.overview.allLeagues', v => idToLeagueName.value.get(v as number) ?? ''))
const tournamentOptions = computed(() => facetedOptions('tournamentId', 'payments.overview.allTournaments', v => idToTournamentName.value.get(v as number) ?? ''))
const formatOptions = computed(() => {
  const options = facetedOptions('format', 'payments.overview.allFormats', v => String(v))
  const [allOption, ...rest] = options
  if (!allOption) return options
  return [allOption, ...rest.sort((a, b) => a.label.localeCompare(b.label))]
})

const paymentMethodOptions = computed(() => [
  { label: t('payments.overview.allPaymentMethods'), value: ALL_VALUE },
  { label: t(PAYMENT_METHOD_DISPLAY.pos.labelKey), value: 'pos' },
  { label: t(PAYMENT_METHOD_DISPLAY.cash.labelKey), value: 'cash' },
  { label: t(PAYMENT_METHOD_DISPLAY.free.labelKey), value: 'free' },
])

const breadcrumbItems = useBreadcrumb(() => [
  { label: t('payments.overview.breadcrumb') }
])
</script>

<template>
  <div class="container mx-auto p-6 space-y-6">
    <UBreadcrumb :items="breadcrumbItems" />

    <PageHeaderRow :title="t('payments.overview.breadcrumb')" />

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <UIcon :name="ICONS.loading" class="animate-spin text-3xl text-muted" />
    </div>

    <!-- Empty state -->
    <div v-else-if="allRows.length === 0" class="text-center py-12 text-muted">
      <UIcon :name="ICONS.registration" class="text-4xl mb-2 opacity-30" />
      <p>{{ t('payments.overview.empty') }}</p>
    </div>

    <div v-else class="space-y-4">
      <div class="flex flex-wrap items-center gap-2">
        <SearchInput
          v-model="globalFilter"
          :placeholder="t('payments.overview.searchPlaceholder')"
          class="w-56"
        />
        <USelectMenu
          v-model="leagueFilter"
          :items="leagueOptions"
          value-key="value"
          label-key="label"
          clear
          class="w-56"
        />
        <USelectMenu
          v-model="tournamentFilter"
          :items="tournamentOptions"
          value-key="value"
          label-key="label"
          clear
          class="w-56"
        />
        <USelectMenu
          v-model="formatFilter"
          :items="formatOptions"
          clear
          value-key="value"
          label-key="label"
          class="w-48"
        />
        <USelectMenu
          v-model="paymentMethodFilter"
          :items="paymentMethodOptions"
          value-key="value"
          label-key="label"
          clear
          class="w-48"
        />
      </div>

      <div class="flex flex-wrap items-center gap-4 rounded-lg bg-default border border-default p-3 text-sm">
        <span class="font-semibold">{{ t('payments.overview.totalCount', { count: totals.count }) }}</span>
        <span v-if="totals.pos" class="flex items-center gap-1">
          <UIcon :name="PAYMENT_METHOD_DISPLAY.pos.icon" class="size-4" />{{ totals.pos }}
        </span>
        <span v-if="totals.cash" class="flex items-center gap-1">
          <UIcon :name="PAYMENT_METHOD_DISPLAY.cash.icon" class="size-4" />{{ totals.cash }}
        </span>
        <span v-if="totals.free" class="flex items-center gap-1">
          <UIcon :name="PAYMENT_METHOD_DISPLAY.free.icon" class="size-4" />{{ totals.free }}
        </span>
        <span class="ml-auto font-bold text-primary">
          {{ t('payments.overview.totalAmount', { amount: n(totals.amount, 'currency') }) }}
        </span>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <RegistrationTrendChart :rows="visibleRows" />
        <AmountByMethodChart :rows="visibleRows" />
        <PaymentMethodMixChart :rows="visibleRows" />
      </div>

      <div class="w-full overflow-x-auto">
        <UTable
          ref="paymentsTable"
          v-model:sorting="sorting"
          v-model:column-filters="columnFilters"
          v-model:pagination="pagination"
          v-model:global-filter="globalFilter"
          :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
          :faceted-options="{ getFacetedUniqueValues: getFacetedUniqueValues() }"
          :data="allRows"
          :columns="columns"
          :ui="{
            root: 'border border-default',
            base: 'overflow-clip',
            th: 'border-b border-default py-2',
            td: 'border-b border-default py-1',
          }"
        >
          <template #empty>
            <UEmpty :title="t('payments.overview.emptyFiltered')" :icon="ICONS.players" />
          </template>
        </UTable>
      </div>

      <div v-if="totals.count > pagination.pageSize" class="flex justify-center">
        <UPagination
          :page="pagination.pageIndex + 1"
          :items-per-page="pagination.pageSize"
          :total="totals.count"
          @update:page="(p) => pagination.pageIndex = p - 1"
        />
      </div>
    </div>
  </div>
</template>
