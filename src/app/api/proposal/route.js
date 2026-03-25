import { createProposal } from '@/services/proposal-service'

export async function POST(req) {
  const body = await req.json()

  const result = await createProposal(body)

  if (!result.success) {
    return Response.json(result, { status: 400 })
  }

  return Response.json(result)
}