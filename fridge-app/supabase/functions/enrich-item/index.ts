// @ts-nocheck — Deno runtime; not type-checked with Node/tsconfig.
// supabase/functions/enrich-item/index.ts
// Given a list of item names, returns a category + typical shelf life (days)
// for each one. Used by manual add and receipt-scan flows.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CATEGORIES = [
  "Produce",
  "Dairy",
  "Meat",
  "Bakery",
  "Pantry",
  "Frozen",
  "Beverages",
  "Other",
];

const SYSTEM_PROMPT = `You categorize grocery items for a household fridge inventory app.

Input: a JSON array of item names.
Output: a JSON object of the form:
{
  "items": [
    { "name": <input>, "category": <category>, "shelf_life_days": <integer>, "price": <number> }
  ]
}

Rules:
- "category" must be exactly one of these strings: Produce, Dairy, Meat, Bakery, Pantry, Frozen, Beverages, Other. Match the capitalization exactly. Use "Other" only as last resort.
- "shelf_life_days" is the TYPICAL number of days the item stays good in a normal
  HOME fridge or pantry, from the day it was bought. Use REAL HOUSEHOLD norms,
  not retail-shelf or food-safety-org cutoffs (those are too conservative).
  Calibrated examples:
    fresh milk: 10
    eggs: 28
    fresh chicken breast (raw): 3
    fresh ground beef (raw): 3
    sliced bread: 7
    bagels: 7
    fresh strawberries: 7
    fresh blueberries: 10
    fresh spinach (bagged): 7
    lettuce head: 10
    bananas: 5
    apples: 21
    citrus fruit: 21
    hard cheese (unopened): 60
    soft cheese: 21
    yogurt: 21
    butter: 60
    fresh fish: 2
    deli meat: 7
    leftovers / cooked food: 4
    dry pasta / rice / canned: 365
    frozen items: 180
  For anything not listed, estimate based on the closest analog above.
- "price" is the TYPICAL US grocery store price in USD for a normal single unit
  of that item. Whole numbers or one-decimal fine (e.g. 4, 3.5).
- Return one entry per input item, in the SAME ORDER.
- Respond with ONLY the raw JSON object. No markdown, no code fences.`;

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
    const names: string[] = Array.isArray(body.names) ? body.names : [];
    if (names.length === 0) {
      return json({ items: [] }, 200);
    }
    if (names.length > 60) {
      return json({ error: "Too many items in one call (max 60)" }, 400);
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const geminiBody = {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        {
          role: "user",
          parts: [{ text: JSON.stringify(names) }],
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
      return json({ error: "Empty Gemini response" }, 502);
    }

    let parsed: { items?: any[] };
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return json({ error: "Gemini returned non-JSON", raw: rawText }, 502);
    }

    // Sanitize: enforce category whitelist, integer days, sane price.
    const items = (parsed.items ?? []).map((it: any) => ({
      name: String(it?.name ?? ""),
      category: CATEGORIES.includes(it?.category) ? it.category : "Other",
      shelf_life_days:
        Number.isFinite(it?.shelf_life_days) && it.shelf_life_days > 0
          ? Math.min(Math.round(it.shelf_life_days), 730)
          : 7,
      price:
        Number.isFinite(it?.price) && it.price > 0
          ? Math.min(Number(it.price), 200)
          : null,
    }));

    return json({ items }, 200);
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
