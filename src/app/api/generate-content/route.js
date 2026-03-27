import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export async function GET() {
  const supabase = getSupabase()

  // 🎯 simple idea pool (can upgrade later)
  const topics = [
    'healing di pulau tanpa sinyal',
    'escape dari jakarta ke pulau sepi',
    'kerja remote dari pulau',
    'staycation beda dari hotel biasa',
    'real island life vs kota'
  ]

  const randomTopic = topics[Math.floor(Math.random() * topics.length)]

  // 1. create proposal
  const { data: proposal } = await supabase
    .from('ops_mission_proposals')
    .insert([
      {
        title: randomTopic,
        description: randomTopic,
        status: 'pending'
      }
    ])
    .select()
    .single()

  // 2. create mission
  const { data: mission } = await supabase
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

  // 3. create steps
  await supabase.from('ops_mission_steps').insert([
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
    }
  ])

  return Response.json({
    success: true,
    topic: randomTopic,
    mission_id: mission.id
  })
}