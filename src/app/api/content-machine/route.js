import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function buildPrompt(topic, mode) {
  const modeConfig = {
    business: {
      context: `Kamu adalah content strategist untuk @enjoypayung — penginapan di Pulau Payung Besar, Kepulauan Seribu.
Tone: santai, autentik, tidak oversell. Bukan resort mewah — tapi pulau tenang yang genuine.
Target: grup 4–10 orang, pasangan, remote worker yang butuh escape dari Jakarta.`,
      angle: "Fokus ke angle quiet island, slow pace, local rhythm. Jual suasana, bukan fasilitas.",
    },
    personal: {
      context: `Kamu adalah content creator personal yang berbagi cerita jujur tentang perjalanan dan hidup slow di pulau.
Tone: reflektif, personal, jujur — seperti ngobrol sama teman.`,
      angle: "Fokus ke storytelling, opini, dan momen-momen kecil yang relatable.",
    },
  };

  const cfg = modeConfig[mode] || modeConfig.business;

  return `${cfg.context}

Buat script konten TikTok/Reels tentang topik: "${topic}"

${cfg.angle}

Format output WAJIB seperti ini (tanpa tanda bintang, tanpa markdown):

HOOK (3 detik pertama):
[tulis hook-nya di sini]

VISUAL:
[deskripsikan visual/shot yang diambil]

VOICEOVER:
[tulis narasi lengkap yang diucapkan]

CTA:
[call to action di akhir]

CAPTION IG:
[caption santai untuk Instagram, pakai huruf kecil, natural]

HASHTAG:
[5–8 hashtag relevan]

Panjang voiceover: cocok untuk video 30–60 detik.`;
}

async function generateWithClaude(topic, mode) {
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: buildPrompt(topic, mode),
      },
    ],
  });
  return message.content[0].text;
}

async function generateWithOpenAI(topic, mode) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: buildPrompt(topic, mode),
      },
    ],
  });
  return completion.choices[0].message.content;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { topic, mode = "business", engine = "claude" } = body;

    if (!topic) {
      return Response.json({ error: "Topic wajib diisi" }, { status: 400 });
    }

    console.log(`[content-machine] topic: ${topic} | mode: ${mode} | engine: ${engine}`);

    let result;

    if (engine === "openai") {
      if (!process.env.OPENAI_API_KEY) {
        return Response.json({ error: "OPENAI_API_KEY belum diset" }, { status: 500 });
      }
      result = await generateWithOpenAI(topic, mode);
    } else {
      if (!process.env.ANTHROPIC_API_KEY) {
        return Response.json({ error: "ANTHROPIC_API_KEY belum diset" }, { status: 500 });
      }
      result = await generateWithClaude(topic, mode);
    }

    return Response.json({
      result,
      meta: { topic, mode, engine, timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error("[content-machine] error:", error.message);

    if (error.status === 429) {
      return Response.json(
        { error: "Quota API habis. Cek billing di dashboard." },
        { status: 429 }
      );
    }

    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function GET() {
  const claudeKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  return Response.json({
    status: "ok",
    engines: {
      claude: claudeKey ? "configured" : "missing ANTHROPIC_API_KEY",
      openai: openaiKey ? "configured" : "missing OPENAI_API_KEY",
    },
  });
}