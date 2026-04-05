/*
  app.config.ts

  Configurazione globale per il tema dell'applicazione.
  Definisce i colori semantic usati in tutta l'app tramite Nuxt UI.
*/
export default defineAppConfig({
  ui: {
    // Mappatura dei colori semantic del tema:
    // - primary: colore principale (viola) - bottoni principali, link
    // - secondary: colore secondario (rosa) - accenti secondari
    // - neutral: colore neutro (zinc) - testo, sfondi neutri
    // - success: verde lime - stati positivi/completati
    // - info: ciano - informazioni
    // - warning: giallo - avvisi
    // - error: rosa/rosso - errori
    colors: {
      primary: 'violet',
      secondary: 'pink',
      neutral: 'zinc',
      success: 'lime',
      info: 'cyan',
      warning: 'yellow',
      error: 'rose'
    }
  }
})
