import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function analyzeImage(imageUrl: string) {
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001", // use stable model
    max_tokens: 500,
    system: `
Return ONLY raw JSON.

Do NOT include:
- markdown
- backticks
- explanation

Format strictly:
{
  "scene": "",
  "subject": "",
  "emotion": "",
  "quality_score": 1,
  "content_score": 1,
  "tags": []
}
    `,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "Analyze this image" },
          {
            type: "image",
            source: {
              type: "url",
              url: imageUrl,
            },
          },
        ],
      },
    ],
  });

  // 🔍 Extract text safely
  const textBlock = response.content.find(
    (block) => block.type === "text"
  );

  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No valid text response from Claude");
  }

  let clean = textBlock.text;

  // 🔧 HARD CLEAN (critical)
  clean = clean
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  return clean;
}