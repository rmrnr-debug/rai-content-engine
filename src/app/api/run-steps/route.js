import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET() {
  console.log("=== RUN STEPS START ===")

  const { data: steps, error: fetchError } = await supabase
    .from('ops_mission_steps')
    .select('*')
    .eq('status', 'pending')
    .order('step_order', { ascending: true })
    .limit(10)

  if (fetchError) {
    console.error("FETCH ERROR:", fetchError)
    return Response.json({ success: false, error: fetchError.message }, { status: 500 })
  }

  console.log("STEPS FETCHED:", steps?.length)

  for (const step of steps || []) {
    console.log("Processing step:", step.id, step.action_type)

    // ✅ DEPENDENCY CHECK
    if (step.step_order > 1) {
      const { data: prevStep, error: prevError } = await supabase
        .from('ops_mission_steps')
        .select('*')
        .eq('mission_id', step.mission_id)
        .eq('step_order', step.step_order - 1)
        .single()

      if (prevError || !prevStep || prevStep.status !== 'completed') {
        console.log("Skipping step (dependency not met):", step.id)
        continue
      }
    }

    // mark as running
    const { error: runningError } = await supabase
      .from('ops_mission_steps')
      .update({ status: 'running' })
      .eq('id', step.id)

    if (runningError) {
      console.error("FAILED TO SET RUNNING:", runningError)
      continue
    }

    try {
      let output = null

      // STEP 1: ANALYZE
      if (step.action_type === 'analyze_request') {
        const text = step.payload?.text || ""

        output = {
          summary: text.slice(0, 100),
          keywords: text.split(" ").slice(0, 5)
        }
      }

      // STEP 2: PLAN
      if (step.action_type === 'generate_plan') {
        output = {
          plan: ["Hook", "Problem", "Solution", "CTA"]
        }
      }

      // STEP 3: CONTENT
      if (step.action_type === 'generate_content') {
        output = {
          caption: "Escape dari Jakarta ke pulau sepi 🌴 Nikmati hidup tanpa distraksi.",
          script: [
            "Hook: Capek kota?",
            "Visual: laut, angin, santai",
            "Closing: booking sekarang"
          ]
        }
      }

      const { error: completeError } = await supabase
        .from('ops_mission_steps')
        .update({
          status: 'completed',
          output
        })
        .eq('id', step.id)

      if (completeError) {
        throw completeError
      }

      console.log("STEP COMPLETED:", step.id)

    } catch (err) {
      console.error("STEP FAILED:", step.id, err)

      await supabase
        .from('ops_mission_steps')
        .update({
          status: 'failed',
          retry_count: (step.retry_count || 0) + 1,
          output: { error: err.message }
        })
        .eq('id', step.id)
    }
  }

  console.log("=== RUN STEPS END ===")

  return Response.json({
    success: true,
    processed: steps?.length || 0
  })
}