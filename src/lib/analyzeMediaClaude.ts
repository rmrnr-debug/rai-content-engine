import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function analyzeImageClaude(imageUrl: string) {
  const response = await anthropic.messages.create({
    model: "claude-3-haiku-20240307",
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `
Return ONLY JSON:
{
  "scene": "",
  "subject": "",
  "emotion": "",
  "quality_score": 1,
  "content_score": 1,
  "tags": []
}
            `,
          },
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

  const block = response.content[0];
  if (block.type === "text") {
    return block.text;
  }

  throw new Error("Unexpected response type from Claude API");
}