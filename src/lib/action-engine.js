export async function executeAction(step) {
    switch (step.action_type) {
      case 'analyze_request':
        return analyzeRequest(step)
  
      case 'generate_plan':
        return generatePlan(step)
  
      default:
        return {
          success: false,
          message: `Unknown action: ${step.action_type}`
        }
    }
  }
  
  // ===== ACTIONS =====
  
  async function analyzeRequest(step) {
    const text = step.payload?.text || ''
  
    // simple parsing (nanti bisa pakai AI)
    const wordCount = text.split(' ').length
  
    return {
      success: true,
      data: {
        original: text,
        word_count: wordCount,
        summary: text.slice(0, 50)
      }
    }
  }
  
  async function generatePlan(step) {
    return {
      success: true,
      data: {
        plan: [
          'Understand request',
          'Break into steps',
          'Execute tasks'
        ]
      }
    }
  }