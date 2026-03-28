import { createProposal } from '@/services/proposal-service'

export async function GET() {
  try {
    console.log("=== API generate-content START ===")

    const topics = [
      'healing di pulau tanpa sinyal',
      'escape dari jakarta ke pulau sepi',
      'kerja remote dari pulau',
      'staycation beda dari hotel biasa',
      'real island life vs kota'
    ]

    const randomTopic = topics[Math.floor(Math.random() * topics.length)]

    const input = {
      title: randomTopic,
      description: randomTopic,
      priority: 1
    }

    const result = await createProposal(input)

    console.log("RESULT:", result)

    if (!result.success) {
      return Response.json({
        success: false,
        stage: result.stage,
        error: result.error
      }, { status: 500 })
    }

    return Response.json({
      success: true,
      mission_id: result.mission.id,
      steps_created: result.steps?.length
    })

  } catch (err) {
    console.error("API ERROR:", err)

    return Response.json({
      success: false,
      error: err.message
    }, { status: 500 })
  }
}