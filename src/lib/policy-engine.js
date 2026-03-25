export function evaluatePolicy(input) {
    // nanti ini bisa baca dari DB (ops_policy)
  
    // untuk sekarang simple dulu
    if (input.priority > 5) {
      return {
        ok: false,
        reason: 'Priority too high'
      }
    }
  
    return { ok: true }
  }