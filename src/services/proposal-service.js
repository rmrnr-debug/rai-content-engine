import { getSupabaseServer } from '@/lib/supabase'
import { checkCapGates } from '@/lib/cap-gates'
import { evaluatePolicy } from '@/lib/policy-engine'

export async function createProposal(input) {
  const supabase = getSupabaseServer() // ✅ moved inside function

  const capCheck = checkCapGates(input)
  if (!capCheck.ok) {
    return { success: false, stage: 'cap_gates', error: capCheck.reason }
  }

  const policyCheck = evaluatePolicy(input)
  if (!policyCheck.ok) {
    return { success: false, stage: 'policy', error: policyCheck.reason }
  }

  // INSERT PROPOSAL
  const { data: proposal, error } = await supabase
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

  if (error) {
    return { success: false, stage: 'db', error: error.message }
  }

  // CREATE MISSION
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

  if (missionError) {
    return {
      success: false,
      stage: 'mission_create',
      error: missionError.message
    }
  }

  // CREATE STEPS
  const { error: stepError } = await supabase
    .from('ops_mission_steps')
    .insert([
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
    ])

  if (stepError) {
    return {
      success: false,
      stage: 'step_create',
      error: stepError.message
    }
  }

  return {
    success: true,
    proposal,
    mission
  }
}