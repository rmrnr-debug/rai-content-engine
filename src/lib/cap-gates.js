export function checkCapGates(input) {
    // contoh basic rules (bisa kamu expand nanti)
  
    if (!input.title || input.title.length < 3) {
      return {
        ok: false,
        reason: 'Title too short'
      }
    }
  
    if (!input.description) {
      return {
        ok: false,
        reason: 'Description required'
      }
    }
  
    return { ok: true }
  }