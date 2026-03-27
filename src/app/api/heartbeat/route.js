import { createClient } from '@supabase/supabase-js'
import { executeAction } from '@/lib/action-engine'

// ✅ runtime client
function getSupabase() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase env')
  }

  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export async function GET() {
  const supabase = getSupabase()

  // 1) fetch pending steps
  const { data: steps, error } = await supabase
    .from('ops_mission_steps')
    .select('*')
    .eq('status', 'pending')
    .order('mission_id', { ascending: true })
    .order('step_order', { ascending: true })
    .limit(50)

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

  // 2) dependency filter
  const executableSteps = []

  for (const step of steps) {
    const { data: blockers, error: blockErr } = await supabase
      .from('ops_mission_steps')
      .select('id')
      .eq('mission_id', step.mission_id)
      .lt('step_order', step.step_order)
      .neq('status', 'completed')

    if (blockErr) {
      console.error('BLOCK CHECK ERROR:', blockErr.message)
      continue
    }

    if (!blockers || blockers.length === 0) {
      executableSteps.push(step)
    } else {
      console.log('BLOCKED:', step.id)
    }
  }

  if (executableSteps.length === 0) {
    return Response.json({
      success: true,
      message: 'No executable steps',
      executed: []
    })
  }

  // 3) one step per mission safeguard
  const seenMission = new Set()
  const finalSteps = []

  for (const step of executableSteps) {
    if (!seenMission.has(step.mission_id)) {
      finalSteps.push(step)
      seenMission.add(step.mission_id)
    }
  }

  let results = []

  // 4) execute
  for (const step of finalSteps) {
    console.log('Processing step:', step.id)

    // 🔒 LOCK
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
    await supabase.from('ops_agent_events').insert([
      {
        mission_id: step.mission_id,
        step_id: step.id,
        event_type: 'step_started',
        message: `Started ${step.action_type}`
      }
    ])

    // 🔥 CONTEXT PASSING (KEY CHANGE)
    const { data: prevSteps } = await supabase
      .from('ops_mission_steps')
      .select('*')
      .eq('mission_id', step.mission_id)
      .lt('step_order', step.step_order)
      .order('step_order', { ascending: false })
      .limit(1)

    const prevResult = prevSteps?.[0]?.result || null

    const enrichedStep = {
      ...step,
      payload: {
        ...step.payload,
        previous_result: prevResult
      }
    }

    // 🔥 EXECUTE WITH CONTEXT
    const actionResult = await executeAction(enrichedStep)

    const resultPayload = actionResult.success
      ? actionResult.data
      : { error: actionResult.message }

    // 🔥 UPDATE
    const { error: updateError } = await supabase
      .from('ops_mission_steps')
      .update({
        status: actionResult.success ? 'completed' : 'failed',
        result: resultPayload
      })
      .eq('id', step.id)

    if (updateError) {
      console.error('STEP UPDATE ERROR:', updateError.message)

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
    await supabase.from('ops_agent_events').insert([
      {
        mission_id: step.mission_id,
        step_id: step.id,
        event_type: actionResult.success
          ? 'step_completed'
          : 'step_failed',
        message: JSON.stringify(resultPayload)
      }
    ])

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