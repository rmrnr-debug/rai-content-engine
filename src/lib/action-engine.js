export async function executeAction(step) {
  const payload = step.payload || {}

  try {
    switch (step.action_type) {
      case 'analyze_request':
        return await analyzeRequest(payload)

      case 'generate_plan':
        return await generatePlan(payload)

      default:
        return {
          success: false,
          message: `Unknown action: ${step.action_type}`
        }
    }
  } catch (error) {
    console.error('[ACTION ERROR]', error.message)

    return {
      success: false,
      message: error.message || 'Action failed'
    }
  }
}

// ===== ACTIONS =====

async function analyzeRequest(payload) {
  const text = payload?.text || ''

  const wordCount = text.split(' ').filter(Boolean).length

  return {
    success: true,
    data: {
      original: text,
      word_count: wordCount,
      summary: text.slice(0, 50)
    }
  }
}

async function generatePlan(payload) {
  // 🔥 TOGGLE THIS FOR TESTING RETRY
  const FORCE_FAIL = true // <-- change to false after testing

  if (FORCE_FAIL) {
    throw new Error('forced failure test')
  }

  const prev = payload?.previous_result

  const baseText = prev?.original || 'no input'
  const summary = prev?.summary || ''

  return {
    success: true,
    data: {
      based_on: baseText,
      summary_used: summary,
      plan: [
        `Analyze: ${summary}`,
        'Expand into structured idea',
        'Convert into content plan'
      ]
    }
  }
}