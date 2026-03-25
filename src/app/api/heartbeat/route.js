import { supabase } from '@/lib/supabase'
import { executeAction } from '@/lib/action-engine'

export async function GET() {
  // ambil step pending
  const { data: steps, error } = await supabase
    .from('ops_mission_steps')
    .select('*')
    .eq('status', 'pending')
    .order('step_order', { ascending: true })
    .limit(5)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  if (!steps || steps.length === 0) {
    return Response.json({
      success: true,
      message: 'No pending steps',
      executed: []
    })
  }

  let results = []

  for (const step of steps) {
    console.log('Processing step:', step.id)

    // 🔒 LOCK STEP (anti double execution)
    const { data: lockedStep, error: lockError } = await supabase
      .from('ops_mission_steps')
      .update({ status: 'processing' })
      .eq('id', step.id)
      .eq('status', 'pending')
      .select()
      .single()

    if (lockError || !lockedStep) {
      console.log('SKIP (already taken):', step.id)
      continue
    }

    console.log('Executing step:', step.action_type)

    // 🔥 LOG START
    const { error: logStartError } = await supabase
      .from('ops_agent_events')
      .insert([
        {
          mission_id: step.mission_id,
          step_id: step.id,
          event_type: 'step_started',
          message: `Started ${step.action_type}`
        }
      ])

    if (logStartError) {
      console.error('LOG START ERROR:', logStartError)
    }

    // 🔥 EXECUTE REAL ACTION
    const actionResult = await executeAction(step)

    let resultPayload = actionResult.success
      ? actionResult.data
      : { error: actionResult.message }

    // 🔥 UPDATE STEP → completed + result
    const { error: updateError } = await supabase
      .from('ops_mission_steps')
      .update({
        status: actionResult.success ? 'completed' : 'failed',
        result: resultPayload
      })
      .eq('id', step.id)

    if (updateError) {
      console.error('STEP UPDATE ERROR:', updateError)

      await supabase.from('ops_agent_events').insert([
        {
          mission_id: step.mission_id,
          step_id: step.id,
          event_type: 'step_failed',
          message: updateError.message
        }
      ])

      continue
    }

    // 🔥 LOG COMPLETE
    const { error: logEndError } = await supabase
      .from('ops_agent_events')
      .insert([
        {
          mission_id: step.mission_id,
          step_id: step.id,
          event_type: actionResult.success
            ? 'step_completed'
            : 'step_failed',
          message: JSON.stringify(resultPayload)
        }
      ])

    if (logEndError) {
      console.error('LOG COMPLETE ERROR:', logEndError)
    }

    results.push({
      step_id: step.id,
      action: step.action_type,
      status: actionResult.success ? 'done' : 'failed'
    })
  }

  return Response.json({
    success: true,
    executed: results
  })
}