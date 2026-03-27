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

  // 1️⃣ fetch pending steps
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

  // 2️⃣ filter executable steps (dependency check)
  const executableSteps = []

  for (const step of steps) {
    const { data: blockers } = await supabase
      .from('ops_mission_steps')
      .select('id')
      .eq('mission_id', step.mission_id)
      .lt('step_order', step.step_order)
      .neq('status', 'completed')

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

  // 3️⃣ prevent parallel execution per mission
  const seenMission = new Set()
  const finalSteps = []

  for (const step of executableSteps) {
    if (!seenMission.has(step.mission_id)) {
      finalSteps.push(step)
      seenMission.add(step.mission_id)
    }
  }

  let results = []

  // 4️⃣ execute steps
  for (const step of finalSteps) {
    console.log('Processing step:', step.id)

    // 🚫 STOP if max retry reached
    if (
      step.retry_count !== null &&
      step.max_retry !== null &&
      step.retry_count >= step.max_retry
    ) {
      console.log('SKIP (max retry reached):', step.id)
      continue
    }

    // 🔒 LOCK STEP
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

    // 🔁 inject previous_result (context passing)
    let previousResult = null

    const { data: prevStep } = await supabase
      .from('ops_mission_steps')
      .select('result')
      .eq('mission_id', step.mission_id)
      .lt('step_order', step.step_order)
      .order('step_order', { ascending: false })
      .limit(1)
      .single()

    if (prevStep?.result) {
      previousResult = prevStep.result
    }

    const payloadWithContext = {
      ...step.payload,
      previous_result: previousResult
    }

    // 🔥 LOG START
    await supabase.from('ops_agent_events').insert([
      {
        mission_id: step.mission_id,
        step_id: step.id,
        event_type: 'step_started',
        message: `Started ${step.action_type}`
      }
    ])

    // 🔥 EXECUTE
    let actionResult

    try {
      actionResult = await executeAction({
        ...step,
        payload: payloadWithContext
      })
    } catch (err) {
      actionResult = {
        success: false,
        message: err.message
      }
    }

    const isSuccess = actionResult.success

    // 🔁 HANDLE RETRY
    let nextStatus = isSuccess ? 'completed' : 'pending'
    let nextRetry = (step.retry_count || 0) + (isSuccess ? 0 : 1)

    if (!isSuccess && step.max_retry && nextRetry >= step.max_retry) {
      nextStatus = 'failed'
    }

    const resultPayload = isSuccess
      ? actionResult.data
      : { error: actionResult.message }

    // 🔥 UPDATE STEP
    const { error: updateError } = await supabase
      .from('ops_mission_steps')
      .update({
        status: nextStatus,
        retry_count: nextRetry,
        result: resultPayload
      })
      .eq('id', step.id)

    if (updateError) {
      console.error('STEP UPDATE ERROR:', updateError.message)
      continue
    }

    // 🔥 LOG COMPLETE
    await supabase.from('ops_agent_events').insert([
      {
        mission_id: step.mission_id,
        step_id: step.id,
        event_type: isSuccess ? 'step_completed' : 'step_failed',
        message: JSON.stringify(resultPayload)
      }
    ])

    results.push({
      step_id: step.id,
      action: step.action_type,
      status: isSuccess ? 'done' : nextStatus,
      retry_count: nextRetry
    })
  }

  return Response.json({
    success: true,
    executed: results
  })
}