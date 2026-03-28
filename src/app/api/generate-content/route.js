import { createProposal } from '@/services/proposal-services'

export async function GET() {
  try {
    console.log("=== API generate-content START ===")

    const input = {
      title: "AI Generated Content",
      description: "Auto-generated topic from system",
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