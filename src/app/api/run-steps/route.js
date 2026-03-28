import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function GET() {
  console.log("=== RUN STEPS START ===")

  const { data: steps } = await supabase
    .from('ops_mission_steps')
    .select('*')
    .eq('status', 'pending')
    .order('step_order', { ascending: true })
    .limit(10)

  for (const step of steps || []) {
    console.log("Processing:", step.id, step.action_type)

    // Dependency check
    if (step.step_order > 1) {
      const { data: prev } = await supabase
        .from('ops_mission_steps')
        .select('*')
        .eq('mission_id', step.mission_id)
        .eq('step_order', step.step_order - 1)
        .single()

      if (!prev || prev.status !== 'completed') {
        console.log("Skip (dependency):", step.id)
        continue
      }
    }

    await supabase
      .from('ops_mission_steps')
      .update({ status: 'running' })
      .eq('id', step.id)

    try {
      let output = null

      // STEP 1
      if (step.action_type === 'analyze_request') {
        const text = step.payload?.text || ""

        output = {
          summary: text,
          keywords: text.split(" ").slice(0, 5)
        }
      }

      // STEP 2
      if (step.action_type === 'generate_plan') {
        output = {
          plan: ["Hook", "Problem", "Solution", "CTA"]
        }
      }

      // STEP 3 (AI CONTENT)
      if (step.action_type === 'generate_content') {
        const prompt = `
        Buat konten Instagram/TikTok untuk bisnis island stay.

        Tema: ${step.payload?.text || "island escape"}

        Format:
        1. Caption menarik (max 150 kata)
        2. Script video pendek (Hook → Scene → CTA)

        Gaya: santai, relatable, Indonesia
        `

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "user", content: prompt }
          ]
        })

        const text = response.choices[0].message.content

        output = {
          raw: text
        }
      }

      await supabase
        .from('ops_mission_steps')
        .update({
          status: 'completed',
          output
        })
        .eq('id', step.id)

    } catch (err) {
      console.error("ERROR:", err)

      await supabase
        .from('ops_mission_steps')
        .update({
          status: 'failed',
          output: { error: err.message },
          retry_count: (step.retry_count || 0) + 1
        })
        .eq('id', step.id)
    }
  }

  return Response.json({ success: true })
}