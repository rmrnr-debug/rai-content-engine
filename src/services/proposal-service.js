import { getSupabaseServer } from '@/lib/supabase'
import { checkCapGates } from '@/lib/cap-gates'
import { evaluatePolicy } from '@/lib/policy-engine'

export async function createProposal(input) {
  const supabase = getSupabaseServer()

  console.log("=== START createProposal ===")

  // 1. CAP GATES
  const capCheck = checkCapGates(input)
  if (!capCheck.ok) {
    console.log("CAP GATE FAILED:", capCheck.reason)
    return { success: false, stage: 'cap_gates', error: capCheck.reason }
  }

  // 2. POLICY
  const policyCheck = evaluatePolicy(input)
  if (!policyCheck.ok) {
    console.log("POLICY FAILED:", policyCheck.reason)
    return { success: false, stage: 'policy', error: policyCheck.reason }
  }

  // 3. INSERT PROPOSAL
  const { data: proposal, error: proposalError } = await supabase
    .from('ops_mission_proposals')
    .insert([
      {
        title: input.title,
        description: input.description,
        priority: input.priority || 1,
        status: 'pending'
      }
    ])
    .select()
    .single()

  if (proposalError || !proposal) {
    console.error("PROPOSAL INSERT FAILED:", proposalError)
    return { success: false, stage: 'proposal_insert', error: proposalError?.message }
  }

  console.log("PROPOSAL CREATED:", proposal.id)

  // 4. CREATE MISSION
  const { data: mission, error: missionError } = await supabase
    .from('ops_missions')
    .insert([
      {
        proposal_id: proposal.id,
        title: proposal.title,
        status: 'created'
      }
    ])
    .select()
    .single()

  if (missionError || !mission) {
    console.error("MISSION INSERT FAILED:", missionError)
    return {
      success: false,
      stage: 'mission_create',
      error: missionError?.message
    }
  }

  console.log("MISSION CREATED:", mission.id)

  // 5. PREPARE STEPS (explicit, visible)
  const steps = [
    {
      mission_id: mission.id,
      step_order: 1,
      action_type: 'analyze_request',
      payload: { text: proposal.description }
    },
    {
      mission_id: mission.id,
      step_order: 2,
      action_type: 'generate_plan',
      payload: {}
    }
  ]

  console.log("STEPS TO INSERT:", steps)

  // 6. INSERT STEPS
  const { data: insertedSteps, error: stepError } = await supabase
    .from('ops_mission_steps')
    .insert(steps)
    .select()

  if (stepError) {
    console.error("STEP INSERT FAILED:", stepError)
    return {
      success: false,
      stage: 'step_create',
      error: stepError.message
    }
  }

  console.log("STEPS INSERTED:", insertedSteps?.length)

  if (!insertedSteps || insertedSteps.length === 0) {
    console.error("NO STEPS INSERTED (CRITICAL)")
    return {
      success: false,
      stage: 'step_create',
      error: 'No steps inserted'
    }
  }

  console.log("=== END SUCCESS ===")

  return {
    success: true,
    proposal,
    mission,
    steps: insertedSteps
  }
}