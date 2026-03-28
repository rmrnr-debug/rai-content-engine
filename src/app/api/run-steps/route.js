import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET() {
  const { data: steps } = await supabase
    .from('ops_mission_steps')
    .select('*')
    .eq('status', 'pending')
    .limit(5)

  for (const step of steps || []) {
    console.log("Processing step:", step.id, step.action_type)

    await supabase
      .from('ops_mission_steps')
      .update({ status: 'running' })
      .eq('id', step.id)

    try {
      let output = null

      if (step.action_type === 'analyze_request') {
        const text = step.payload?.text || ""

        output = {
          summary: text.slice(0, 100),
          keywords: text.split(" ").slice(0, 5)
        }
      }

      if (step.action_type === 'generate_plan') {
        output = {
          plan: ["Hook", "Problem", "Solution", "CTA"]
        }
      }

      await supabase
        .from('ops_mission_steps')
        .update({
          status: 'completed',
          output
        })
        .eq('id', step.id)

    } catch (err) {
      await supabase
        .from('ops_mission_steps')
        .update({
          status: 'failed',
          retry_count: step.retry_count + 1
        })
        .eq('id', step.id)
    }
  }

  return Response.json({
    success: true,
    processed: steps?.length || 0
  })
}