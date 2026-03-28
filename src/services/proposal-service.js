import { getSupabaseServer } from '@/lib/supabase'
import { checkCapGates } from '@/lib/cap-gates'
import { evaluatePolicy } from '@/lib/policy-engine'

export async function createProposal(input) {
  const supabase = getSupabaseServer()

  console.log("=== START createProposal ===")

  // 1. CAP GATES
  const capCheck = checkCapGates(input)
  if (!capCheck.ok) {
    return { success: false, stage: 'cap_gates', error: capCheck.reason }
  }

  // 2. POLICY
  const policyCheck = evaluatePolicy(input)
  if (!policyCheck.ok) {
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
    return { success: false, stage: 'mission_create', error: missionError?.message }
  }

  console.log("MISSION CREATED:", mission.id)

  // 5. CREATE STEPS (NOW 3 STEPS)
  const steps = [
    {
      mission_id: mission.id,
      step_order: 1,
      action_type: 'analyze_request',
      status: 'pending',
      payload: { text: proposal.description },
      retry_count: 0,
      max_retry: 2
    },
    {
      mission_id: mission.id,
      step_order: 2,
      action_type: 'generate_plan',
      status: 'pending',
      payload: {},
      retry_count: 0,
      max_retry: 2
    },
    {
      mission_id: mission.id,
      step_order: 3,
      action_type: 'generate_content',
      status: 'pending',
      payload: {},
      retry_count: 0,
      max_retry: 2
    }
  ]

  const { data: insertedSteps, error: stepError } = await supabase
    .from('ops_mission_steps')
    .insert(steps)
    .select()

  if (stepError) {
    return { success: false, stage: 'step_create', error: stepError.message }
  }

  console.log("STEPS CREATED:", insertedSteps.length)

  return {
    success: true,
    proposal,
    mission,
    steps: insertedSteps
  }
}