import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { dealNotesFreetext, dealType, structuredFields } = body;

    if (!dealNotesFreetext || dealNotesFreetext.trim().length === 0) {
      return NextResponse.json({ error: "dealNotesFreetext is required" }, { status: 400 });
    }

    const systemPrompt = `You are a music industry settlement specialist. Extract structured deal terms from informal venue booker notes.

DEAL TYPES: flat guarantee, % of gross, % of net, vs deal (max of guarantee vs % of net), door deal, walkout pot (100% above gross threshold), tier ratchet (% steps up past capacity threshold).

RULES:
1. Freetext is the truth. Structured fields may be wrong.
2. If freetext says "guarantee vs % of net" but deal_type says "percentage_of_net", flag this mismatch.
3. Percentages as decimals: 0.85 for 85%, 0.7 for 70/30 split (artist gets 70%)
4. Money as plain numbers, no $ or commas
5. Flag ambiguous terms, stale fields, phone-call amendments
6. confidence: "high" if clear, "medium" if some inference, "low" if genuinely ambiguous

RESPOND ONLY WITH VALID JSON, no markdown:
{
  "guarantee": number | null,
  "percentage": number | null,
  "expenseCap": number | null,
  "hospitalityCap": number | null,
  "walkoutPotThreshold": number | null,
  "tierRatchet": { "basePercentage": number, "ratchetPercentage": number, "capacityThreshold": number } | null,
  "bonusThreshold": number | null,
  "bonusAmount": number | null,
  "marketingRecoup": number | null,
  "confidence": "high" | "medium" | "low",
  "flags": string[]
}`;

    const userMessage = `DEAL TYPE IN SYSTEM: ${dealType}
STRUCTURED FIELDS: ${JSON.stringify(structuredFields ?? {})}
FREE-TEXT DEAL NOTES (parse this): "${dealNotesFreetext}"`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
        "anthropic-version": "2023-06-01",
        "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json({ error: "Claude API error", detail: error }, { status: 502 });
    }

    const data = await response.json();
    const rawText = data.content?.filter((b) => b.type === "text").map((b) => b.text).join("");
    const cleaned = rawText.replace(/\`\`\`json|\`\`\`/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!["high", "medium", "low"].includes(parsed.confidence)) parsed.confidence = "medium";
    return NextResponse.json(parsed);
  } catch (err) {
    return NextResponse.json({ error: "Internal error", detail: String(err) }, { status: 500 });
  }
}