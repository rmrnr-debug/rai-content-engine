import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// 🔥 SANITIZE KEY (CRITICAL FIX)
const rawKey = process.env.OPENAI_API_KEY || ""
const cleanKey = rawKey.replace(/\s+/g, "")

console.log("=== OPENAI KEY DEBUG ===")
console.log("RAW LENGTH:", rawKey.length)
console.log("CLEAN LENGTH:", cleanKey.length)
console.log("HAS SPACE RAW:", rawKey.includes(" "))
console.log("HAS SPACE CLEAN:", cleanKey.includes(" "))

const openai = new OpenAI({
  apiKey: cleanKey,
  baseURL: "https://api.openai.com/v1"
})

export async function GET() {
  console.log("=== RUN STEPS START ===")

  const { data: steps, error } = await supabase
    .from('ops_mission_steps')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(20)

  if (error) {
    console.error("FETCH ERROR:", error)
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }

  let processed = 0

  for (const step of steps || []) {
    if (step.status !== 'pending') continue

    console.log("Processing:", step.id, step.action_type)

    // ✅ dependency check
    if (step.step_order > 1) {
      const { data: prev } = await supabase
        .from('ops_mission_steps')
        .select('*')
        .eq('mission_id', step.mission_id)
        .eq('step_order', step.step_order - 1)
        .single()

      if (!prev || prev.status !== 'completed') {
        console.log("⏭ Skip dependency:", step.id)
        continue
      }
    }

    // mark running
    await supabase
      .from('ops_mission_steps')
      .update({ status: 'running' })
      .eq('id', step.id)

    try {
      let output = null

      // ===== STEP 1 =====
      if (step.action_type === 'analyze_request') {
        const text = step.payload?.text || ""

        output = {
          summary: text,
          keywords: text.split(" ").slice(0, 5)
        }
      }

      // ===== STEP 2 =====
      if (step.action_type === 'generate_plan') {
        output = {
          plan: ["Hook", "Problem", "Solution", "CTA"]
        }
      }

      // ===== STEP 3 (AI) =====
      if (step.action_type === 'generate_content') {
        console.log("🔥 OPENAI CALL:", step.id)

        const prompt = `
Buat konten Instagram/TikTok untuk bisnis island stay.

Tema: ${step.payload?.text || "island escape"}

Format:
1. Caption menarik (max 150 kata)
2. Script video pendek (Hook → Scene → CTA)

Gaya: santai, relatable, Indonesia
        `

        const response = await openai.responses.create({
          model: "gpt-4o-mini",
          input: prompt
        })

        let text = ""

        if (response.output_text) {
          text = response.output_text
        } else if (response.output?.[0]?.content?.[0]?.text) {
          text = response.output[0].content[0].text
        }

        text = text?.slice(0, 2000) || "No content generated"

        output = {
          caption: text.split("\n")[0] || text,
          content: text
        }

        console.log("✅ AI DONE")
      }

      // ✅ mark completed
      const { error: updateError } = await supabase
        .from('ops_mission_steps')
        .update({
          status: 'completed',
          output
        })
        .eq('id', step.id)

      if (updateError) throw updateError

      processed++

      console.log("✅ COMPLETED:", step.id)

    } catch (err) {
      console.error("❌ FAILED:", step.id, err.message)

      await supabase
        .from('ops_mission_steps')
        .update({
          status: 'failed',
          output: { error: err.message }
        })
        .eq('id', step.id)
    }
  }

  console.log("=== RUN STEPS END ===")

  return Response.json({
    success: true,
    processed
  })
}