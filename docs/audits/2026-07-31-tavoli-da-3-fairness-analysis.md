# Analisi equità tavoli da 3 giocatori (2026-07-31)

Riepilogo di una sessione di analisi + implementazione sul trattamento dei tavoli da 3 giocatori nel sistema di punteggio e nell'appaiamento del torneo.

## Il problema di partenza

Il sistema di voto ("miglior mazzo", "miglior giocata") premia in punti chi riceve voti dagli avversari al proprio tavolo. A un tavolo da 4 ci sono 3 avversari che possono votarti (tetto massimo di voti ricevibili = 3); a un tavolo da 3 ce ne sono solo 2 (tetto massimo = 2). Chi finisce a un tavolo da 3 ha quindi un tetto di punti strutturalmente più basso, indipendentemente da quanto abbia giocato bene.

Nella vecchia versione del regolamento questo veniva "corretto" facendo votare due volte a chi era a un tavolo da 3 — ma in pratica questo trasformava il voto in una cortesia reciproca quasi garantita tra i due avversari, invece che in un giudizio genuino.

## Analisi dati storici

**Quota teorica di giocatori a tavoli da 3** (con tornei divisi solo in tavoli da 3 e da 4): dipende dal resto di N (iscritti) mod 4 — nel caso peggiore (N ≡ 1 mod 4) tocca fino al 50%+ dei giocatori con N piccoli, scendendo con N più grandi.

**Dato reale** (9 tornei, dati da Supabase): media ponderata **~21%** dei giocatori a tavolo da 3, con punte del 33-36% nelle serate più sfortunate (es. torneo #222, 25 iscritti → 36%). Non è la situazione catastrofica del caso teorico peggiore, ma nemmeno trascurabile.

## Caso di studio: torneo #284 (lega 185)

Simulando un fattore di normalizzazione ×1.5 sui punti voto (`brewScore`/`playScore`) per chi ha giocato a un tavolo da 3, applicato al tie-break reale (`compareStandings`: punteggio → vittorie → kill → voti mazzo → voti giocata):

| Pos. attuale | Giocatore | Punti attuali | Pos. con normalizzazione | Punti normalizzati |
|---|---|---|---|---|
| 1 | Alessandro Berti | 25 | 1 | 27.00 |
| 2 | Matteo Zancanella | 25 | 2 | 27.00 |
| 3 | Cristiano Dalmaso | 25 | **4** | 25.00 |
| 4 | Lorenzo Asinari | 24 | **3** | 26.00 |
| ... | | | | (altri 5 scambi di posizione più giù in classifica) |

Il podio 1°/2° resta invariato (Berti e Zancanella hanno giocato solo a tavoli da 4), ma **il 3° posto cambia** — Dalmaso scende al 4°, Asinari sale al 3°. Un effetto reale, non solo teorico.

## Fattore di normalizzazione proposto (non ancora implementato)

`3 / (numero avversari al tavolo)` applicato a `brewScore`/`playScore` in `calculatePlayerTableScore` (`shared/utils/roundScoring.ts`):
- Tavolo da 4 (3 avversari): fattore 1.0 — invariato.
- Tavolo da 3 (2 avversari): fattore 1.5 — equipara il tetto massimo (2 voti × 1.5 = 3, come a un tavolo da 4).

**Verificato:** `standings.standing_player_score` è `bigint` (schema reale via OpenAPI PostgREST) — un fattore ×1.5 produce punteggi frazionari (es. 23.50) che non ci stanno in un intero. **Soluzione senza migrazione DB:** arrotondare ogni componente con `Math.round()` invece di sommare frazioni esatte — piccolo bias di arrotondamento (±0.5) ma nessuna modifica di schema necessaria.

**Stato:** proposta validata sui dati, **non ancora implementata** — tracciata in `docs/BACKLOG.md` #19 (priorità alta, primo passo consigliato: piccolo, autonomo, nessuna migrazione).

## Interventi implementati in questa sessione

### ADR-049 — Anteprima Tavoli: random al round 1, rimosso lo swap forzato

- **Round 1 seating bias:** l'optimizer di appaiamento, in assenza di storico (round 1), degradava a un semplice sort per rank — spostando sistematicamente i giocatori con rank più basso verso i tavoli da 3. **Fix:** randomizzazione automatica al round 1 invece dell'optimizer; l'optimizer resta per i round 2+.
- **Rimosso `attemptTableSwap`:** il vincolo che revertiva ogni drag-and-drop non valido (con un'euristica di "swap automatico" per compensarlo) è stato eliminato su richiesta esplicita — ora si può trascinare liberamente, la validità si controlla solo al momento di "Conferma" (pulsante disabilitato + hint testuale).
- Codice: `TablePreviewModal.vue`, `useTableDnd.ts`, test aggiornati/riscritti.

### ADR-050 — `table3Count` storico cross-torneo (BACKLOG #20, opzione A)

- Nuova query `useLeagueTable3CountsQuery(leagueId, excludeTournamentId)` — conta i tavoli da 3 di ogni giocatore su **tutti gli altri tornei della lega**, sommata (non sostituita) al conteggio within-tournament già esistente.
- Scelta tra portare il dato come query separata (opzione A, implementata) o come colonna denormalizzata su `players` mantenuta da trigger (opzione B, annotata come possibile escalation futura in `docs/BACKLOG.md` #20 se la query dovesse mai diventare un collo di bottiglia — non previsto, l'avvio torneo non è un'operazione ad alta frequenza).
- **Punto aperto non ancora deciso:** ADR-049 aveva scelto il random puro al round 1 perché `table3Count` era sempre 0 in quel momento. Ora che include lo storico di lega, non è più sempre 0 — potrebbe aver senso far tornare il round 1 a usare l'optimizer (ora pesato da un segnale reale) invece del random. Segnalato in `docs/BACKLOG.md` #20, non ancora deciso.

## Statistiche attuali giocatori a tavoli da 3 (tutte le leghe, dati reali)

17 tornei totali nel DB, di cui 6 con almeno un tavolo da 3 (leghe #1, #143, #185):

| Volte a tavolo da 3 | Giocatori |
|---|---|
| 5 | Emanuele Nardi, Lorenzo Mattedi, Elia Pachera, Andrea Germiniasi |
| 4 | Alessandro Dal Corso, Gabriele Divan, Davide Resenterra, Luca Atanasio |
| 3 | Marco Cazzola, Lorenzo Castelli, Matteo Zancanella, Gabriele Alberto Scagliarini |
| 2 | Michele Carloni, Francesco Labianca, Roberto Caliari, Roberto Gelmini, Enzo Baroni, Filippo Ghidoni, Manuel Sonn |
| 1 | (21 giocatori, un solo tavolo da 3 a testa) |

Il gruppo di 4 giocatori a quota 5 è il primo a beneficiare della priorità storica introdotta da ADR-050.

## Prossimi passi (non decisi/non fatti)

1. **BACKLOG #19** — implementare la normalizzazione punti ×1.5 (con `Math.round()`), priorità consigliata più alta tra i due.
2. **BACKLOG #20 (follow-up)** — decidere se il round 1 deve tornare a usare l'optimizer invece del random puro, ora che ha un segnale storico reale.
