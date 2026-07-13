// shared\types\fast-levenshtein.d.ts
declare module 'fast-levenshtein' {
  interface Levenshtein {
    get(str1: string, str2: string): number
  }
  const levenshtein: Levenshtein
  export default levenshtein
}
