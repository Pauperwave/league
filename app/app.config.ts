// app\app.config.ts
/*
  app.config.ts

  Global theme configuration for the application.
  Defines the semantic colors used throughout the app via Nuxt UI.
*/
export default defineAppConfig({
  ui: {
    button: {
      defaultVariants: {
        variant: 'outline',
      },
      // Grayscale (not just the theme's default opacity-75) so a disabled
      // button reads as muted regardless of its color/variant, instead of
      // just a slightly faded version of its normal color.
      slots: {
        base: 'disabled:grayscale aria-disabled:grayscale',
      },
    },
    // Semantic theme color mapping:
    // - primary: main color (indigo) - primary buttons, links
    // - secondary: secondary color (pink) - secondary accents
    // - neutral: neutral color (zinc) - text, neutral backgrounds
    // - success: lime green - positive/completed states
    // - info: cyan - informational
    // - warning: yellow - warnings
    // - error: pink/red - errors
    colors: {
      primary: 'indigo',
      secondary: 'pink',
      neutral: 'zinc',
      success: 'lime',
      info: 'cyan',
      warning: 'yellow',
      error: 'rose'
    }
  }
})
