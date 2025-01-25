/* app/lib/gpt4oClient.ts
 *
 * Actual code for calling GPT-4o using the openai npm package.
 * Make sure you've installed `openai` and have OPENAI_API_KEY in your .env.
 */
"use server"
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, 
  
});

/**
 * askGpt4o
 * @param {string} prompt - The prompt to feed GPT-4o
 * @returns {Promise<any>} - Returns parsed JSON or raw text
 */
export async function askGpt4o(prompt: string): Promise<any> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o", // or your desired model
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    });

    const responseText = completion.choices[0]?.message?.content?.trim() || "";
    // Attempt to parse as JSON if you expect JSON
    try {
      const data = JSON.parse(responseText.replace(/```json|```/g, ""));
      return data;
    } catch (parseErr) {
      // If not valid JSON, just return raw text
      return responseText;
    }
  } catch (error) {
    console.error("[GPT-4o] Error calling OpenAI API:", error);
    throw new Error("Failed to call GPT-4o");
  }
}

/**
 * askGpt4oForSearchQueries
 * @param {string} nodeContent - The content from a webpage/node
 * @param {string} highlightedText - The portion user is interested in
 * @returns {Promise<{ searchQueries: string[] }>}
 */
export async function askGpt4oForSearchQueries(nodeContent: string, highlightedText: string) {
  const prompt = `
You are a researcher. Given the full node content below and a highlighted portion the user is interested in, generate exactly 3 Google search queries that would help find more details about the highlighted part.

Node Content:
"${nodeContent}"

Highlighted Text:
"${highlightedText}"

Output as JSON:
{
  "searchQueries": [
    "query_1",
    "query_2",
    "query_3"
  ]
}
  `;

  // Here we call the same function above
  const data = await askGpt4o(prompt);
  // We expect data to have { searchQueries: [] }
  if (!data?.searchQueries) {
    console.warn("[GPT-4o] No searchQueries found in GPT-4o response, returning empty array.");
    return { searchQueries: [] };
  }
  return data;
}
