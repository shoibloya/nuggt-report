"use server";

import { NextRequest, NextResponse } from "next/server";

// Store your token in .env.local as PERPLEXITY_TOKEN
// DO NOT expose this in client code
const perplexityToken = process.env.PERPLEXITY_TOKEN || "";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query } = body; // The user's search query

    if (!query) {
      return NextResponse.json({ error: "No query provided" }, { status: 400 });
    }

    // Build the request body for Perplexity
    const perplexityBody = {
      model: "sonar-pro",
      messages: [
        { role: "system", content: "Be precise and detailed. Write your answer in 3-4 detailed paragraphs. No subheadings. Highlight important parts by making the text bold." },
        { role: "user", content: query },
      ],
      temperature: 0.2,
      top_p: 0.9,
      search_domain_filter: ["perplexity.ai"],
      return_images: false,
      return_related_questions: false,
      search_recency_filter: "month",
      top_k: 0,
      stream: false,
      presence_penalty: 0,
      frequency_penalty: 1,
      response_format: null,
    };

    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${perplexityToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(perplexityBody),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch from Perplexity" },
        { status: 500 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("[Perplexity] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
