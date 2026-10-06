// @ts-nocheck — Deno runtime; not type-checked with Node/tsconfig.
// supabase/functions/parse-receipt/index.ts
// Receives a base64-encoded receipt image, asks Gemini to extract grocery items,
// returns a JSON list { items: [{ name, quantity, unit }] }.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `You are a receipt parser for a household fridge inventory app.
You are given a photo of a grocery store receipt.
Your job: return ONLY a JSON object of the form:

{ "items": [{ "name": string, "quantity": number, "unit": string | null }] }

Rules:
- Include ONLY food, drink, or household consumables that would go in a fridge or pantry.
- EXCLUDE non-food items (paper goods, cleaning supplies, batteries, etc).
- EXCLUDE prices, taxes, totals, discounts, store name, addresses, dates, phone numbers, loyalty info, payment info.
- Expand obvious abbreviations: "MLK 2% GAL" -> name "Milk 2%", unit "gal"; "BNNS" -> "Bananas"; "CHKN BRST" -> "Chicken breast".
- If quantity is not clearly shown, use 1.
- If unit is not clearly shown, use null.
- Use sentence case for names (e.g. "Milk 2%" not "MILK 2%").
- Return at most 50 items.
- Respond with ONLY the raw JSON object. No markdown, no code fences, no explanation.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return json({ error: "Server missing GEMINI_API_KEY" }, 500);
    }

    const body = await req.json();
    const imageBase64: string | undefined = body.imageBase64;
    const mimeType: string = body.mimeType ?? "image/jpeg";
    if (!imageBase64) {
      return json({ error: "Missing imageBase64" }, 400);
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const geminiBody = {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        {
          role: "user",
          parts: [
            { text: "Parse this receipt." },
            { inlineData: { mimeType, data: imageBase64 } },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    };

    const geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
    });

    if (!geminiRes.ok) {
      const text = await geminiRes.text();
      return json({ error: "Gemini request failed", detail: text }, 502);
    }

    const geminiJson = await geminiRes.json();
    const rawText: string | undefined =
      geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return json({ error: "Empty Gemini response", raw: geminiJson }, 502);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return json({ error: "Gemini returned non-JSON", raw: rawText }, 502);
    }

    return json(parsed, 200);
  } catch (e) {
    return json({ error: "Unhandled error", detail: String(e) }, 500);
  }
});

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
