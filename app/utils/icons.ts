// app\utils\icons.ts

/**
 * Single source of truth for every icon used in the app. Check here before
 * picking an icon for a new usage — reuse an existing constant if the
 * concept already exists, rather than introducing a second icon for the
 * same idea (see docs/TODO.md history: circle-check/check-circle,
 * loader-2/loader-circle, and shield/shield-check were all accidental
 * duplicates found and consolidated when this file was created).
 */
export const ICONS = {
  // Actions
  add: 'i-lucide-plus',
  subtract: 'i-lucide-minus',
  delete: 'i-lucide-trash-2',
  edit: 'i-lucide-pencil',
  confirm: 'i-lucide-check',
  close: 'i-lucide-x',
  clear: 'i-lucide-circle-x',
  reset: 'i-lucide-rotate-ccw',
  undo: 'i-lucide-undo-2',
  refresh: 'i-lucide-refresh-cw',
  search: 'i-lucide-search',
  noResults: 'i-lucide-search-x',
  shuffle: 'i-lucide-shuffle',
  generate: 'i-lucide-wand-2',
  settings: 'i-lucide-settings-2',
  filters: 'i-lucide-sliders-horizontal',
  logout: 'i-lucide-log-out',
  lock: 'i-lucide-lock',
  unlock: 'i-lucide-lock-open',
  quickAction: 'i-lucide-bolt',

  // Status / feedback
  success: 'i-lucide-circle-check',
  warning: 'i-lucide-alert-triangle',
  help: 'i-lucide-circle-help',
  loading: 'i-lucide-loader-2',
  empty: 'i-lucide-inbox',
  noDecks: 'i-lucide-layers',
  imageMissing: 'i-lucide-image-off',

  // Players / people
  players: 'i-lucide-users',
  player: 'i-lucide-user',
  addPlayer: 'i-lucide-user-plus',
  removePlayer: 'i-lucide-user-x',
  playerConfirmed: 'i-lucide-user-check',
  assist: 'i-lucide-hand-helping',

  // Visibility
  show: 'i-lucide-eye',
  hide: 'i-lucide-eye-off',

  // Navigation
  back: 'i-lucide-arrow-left',
  forward: 'i-lucide-arrow-right',
  up: 'i-lucide-arrow-up',
  down: 'i-lucide-arrow-down',
  home: 'i-lucide-home',
  externalLink: 'i-lucide-external-link',
  chevronDown: 'i-lucide-chevron-down',
  dragHandle: 'i-lucide-grip-vertical',
  gridView: 'i-lucide-layout-grid',
  tableView: 'i-lucide-grid-2x2',
  expand: 'i-lucide-expand',
  collapse: 'i-lucide-shrink',
  fitView: 'i-lucide-maximize',

  // Sorting
  sortAsc: 'i-lucide-arrow-up',
  sortDesc: 'i-lucide-arrow-down',
  sortAlpha: 'i-lucide-arrow-up-a-z',
  sortAscNumeric: 'i-lucide-arrow-up-narrow-wide',
  sortDescNumeric: 'i-lucide-arrow-down-wide-narrow',
  sortBoth: 'i-lucide-arrow-up-down',

  // Calendar / time
  calendar: 'i-lucide-calendar',
  calendarDays: 'i-lucide-calendar-days',
  calendarConfirmed: 'i-lucide-calendar-check',
  calendarAdd: 'i-lucide-calendar-plus',
  calendarCancel: 'i-lucide-calendar-x',
  clock: 'i-lucide-clock',
  timer: 'i-lucide-timer',
  timerOff: 'i-lucide-timer-off',
  play: 'i-lucide-play',
  pause: 'i-lucide-pause',

  // Theme
  lightMode: 'i-lucide-sun',
  darkMode: 'i-lucide-moon',
  palette: 'i-lucide-palette',

  // Commander / deck (MTG domain)
  commander: 'i-lucide-shield',
  commanderSet: 'i-lucide-shield-check',
  commanderNotSet: 'i-lucide-shield-plus',
  noCommander: 'i-lucide-shield-off',
  favorite: 'i-lucide-heart',
  manaCost: 'i-lucide-hash',

  // League / event / scoring (MTG domain)
  standings: 'i-lucide-trophy',
  battle: 'i-lucide-swords',
  kills: 'i-lucide-sword',
  deaths: 'i-lucide-skull',
  draw: 'i-lucide-handshake',
  vote: 'i-lucide-star',
  victories: 'i-lucide-medal',
  ruleBrew: 'i-lucide-beer',
  brewVotes: 'i-lucide-flask-conical',
  playVotes: 'i-lucide-zap',
  rules: 'i-lucide-scale',
  flag: 'i-lucide-flag',
  registration: 'i-lucide-clipboard-list',
  paid: 'i-lucide-dollar-sign',
  gameplay: 'i-lucide-gamepad-2',
  total: 'i-lucide-calculator',
  statsLink: 'i-lucide-bar-chart-3',
  statsEmpty: 'i-lucide-bar-chart',
  terminal: 'i-lucide-terminal',
  booster: 'i-lucide-gift',
} as const

export type IconName = (typeof ICONS)[keyof typeof ICONS]
