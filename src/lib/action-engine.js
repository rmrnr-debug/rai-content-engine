export async function executeAction(step) {
  const payload = step.payload || {}

  switch (step.action_type) {
    case 'analyze_request':
      return analyzeRequest(payload)

    case 'generate_plan':
      return generatePlan(payload)

    default:
      return {
        success: false,
        message: `Unknown action: ${step.action_type}`
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
  const prev = payload?.previous_result

  // 🔥 USE CONTEXT FROM PREVIOUS STEP
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