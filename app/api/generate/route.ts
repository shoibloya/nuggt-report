import { NextRequest, NextResponse } from "next/server";
import { scrapeWithRetries } from "@/app/lib/firecrawlClient";
import { askGpt4o } from "@/app/lib/gpt4oClient";

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "No URL provided" }, { status: 400 });
    }

    // 1) Scrape the content using Firecrawl
    const scrapeResult = await scrapeWithRetries(url, { formats: ["markdown"] });
    if (!scrapeResult) {
      return NextResponse.json(
        { error: "Unable to scrape the provided URL" },
        { status: 500 }
      );
    }

    //console.log("printing text:" + scrapeResult.markdown)
    if (!scrapeResult.markdown) {
      return NextResponse.json(
        { error: "No text found for the provided URL" },
        { status: 500 }
      );
    }

    // 2) EXTRACT REQUIRED FIELDS (companyName, detailedDescription, etc.) USING GPT-4o
    const extractionPrompt = `
      You are a helpful assistant. Analyze the following text and extract the following fields in JSON:
      {
        "companyName": "",
        "detailedDescription": "",
        "service": "",
        "customerBase": "" (e.g., B2B or B2C)
      }

      Strictly return valid JSON with the keys: companyName, detailedDescription, service, Customer Base.

      ---
      TEXT:
      ${scrapeResult.markdown}
    `;

    let extractionData = await askGpt4o(extractionPrompt);
    console.log(extractionData)
    // In case the response isn’t valid JSON or missing fields, fallback:
    if (
      !extractionData ||
      typeof extractionData !== "object" ||
      !("companyName" in extractionData)
    ) {
      extractionData = {
        companyName: "",
        detailedDescription: "",
        service: "",
        possibleStakeholders: "",
      };
    }

    const { companyName, detailedDescription, service, customerBase } = extractionData;

    // 3) GENERATE SEARCH QUERIES
    const searchQueryPrompt = `
    You are a corporate innovation expert. 
    
    You identify innovation opportunities based on the Market Analysis Framework
    which includes the following:
    
    1. Consumer Behavior
    2. Economic Conditions
    3. Technological Advances
    4. Competitive Landscape
    5. Regulatory Environment

      Given the following extracted info:
      - Company: ${companyName}
      - Description: ${detailedDescription}
      - Service: ${service}
      - Customer Base: ${customerBase}


      Come up with google searches for the target market of the given company in the following JSON format:

      {{
        "searches": {{
          "Consumer Behavior": [
            {{
              "search": "Google search 1",
              "importance": "Rationale behind this search"
            }},
            {{
              "search": "Google search 2",
              "importance": "Rationale behind this search"
            }},
            {{
              "search": "Google search 3",
              "importance": "Rationale behind this search"
            }},
          ],
          "Economic Conditions": [
            {{
              "search": "Google search 1",
              "importance": "Rationale behind this search"
            }},
            {{
              "search": "Google search 2",
              "importance": "Rationale behind this search"
            }},
            {{
              "search": "Google search 3",
              "importance": "Rationale behind this search"
            }},
          ],
          "Technological Advances": [
            {{
              "search": "Google search 1",
              "importance": "Rationale behind this search"
            }},
            {{
              "search": "Google search 2",
              "importance": "Rationale behind this search"
            }},
            {{
              "search": "Google search 3",
              "importance": "Rationale behind this search"
            }},
          ],
          "Competitive Landscape": [
            {{
              "search": "Google search 1",
              "importance": "Rationale behind this search"
            }},
            {{
              "search": "Google search 2",
              "importance": "Rationale behind this search"
            }},
            {{
              "search": "Google search 3",
              "importance": "Rationale behind this search"
            }},
          ],
          "Regulatory Environment": [
            {{
              "search": "Google search 1",
              "importance": "Rationale behind this search"
            }},
            {{
              "search": "Google search 2",
              "importance": "Rationale behind this search"
            }},
            {{
              "search": "Google search 3",
              "importance": "Rationale behind this search"
            }},
          ]
        }}
      }}

Ensure that the search queries within the same category do not overlap. Queries within
the same category must be different from each other in order to properly cover all major
topics under that category.
    `;
    console.log("prompt:\n\n" + searchQueryPrompt)
    let searchData = await askGpt4o(searchQueryPrompt);
    if (!searchData || typeof searchData !== "object" || !("searches" in searchData)) {
      searchData = { searches: {} };
    }

    // 4) RETURN THE RESULT AS JSON
    return NextResponse.json({
      extractionData,
      searchQueries: searchData,
    });
  } catch (error: any) {
    console.error("[Generate/Route] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process request" },
      { status: 500 }
    );
  }
}
