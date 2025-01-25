"use client";

import { useState, useEffect } from "react"
import { Loader2, Rocket, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { motion } from "framer-motion"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import React from "react"
import { marked } from "marked"


// PDF dependencies
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

// Import your existing Firebase function
import { saveReportEmail } from "@/app/lib/firebaseClient"

/**
 * Flatten the `searches` object from /api/generate to a list of queries
 */
function flattenSearches(
  searchData: Record<string, any[]>
): {
  category: string;
  search: string;
  importance: string;
  status: "pending" | "researching" | "done";
  content: string;     // final answer from Perplexity
  citations: string[]; // citations from Perplexity
  expanded: boolean;
}[] {
  const allQueries: any[] = [];
  for (const category in searchData) {
    const items = searchData[category];
    items.forEach((item) => {
      allQueries.push({
        category,
        search: item.search,
        importance: item.importance || "",
        status: "pending" as const,
        content: "",
        citations: [],
        expanded: false,
      });
    });
  }
  return allQueries;
}

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Global "message" to display status
  const [globalMessage, setGlobalMessage] = useState("");
  // Whether we’re in a global waiting/loading state
  const [globalLoading, setGlobalLoading] = useState(false);

  // The result from /api/generate
  const [result, setResult] = useState<any>(null);

  // The list of queries to research
  const [queries, setQueries] = useState<
    {
      category: string;
      search: string;
      importance: string;
      status: "pending" | "researching" | "done";
      content: string;
      citations: string[];
      expanded: boolean;
    }[]
  >([]);

  // Current query index for sequential research
  const [currentIndex, setCurrentIndex] = useState(0);

  // For the progress bar
  const doneCount = queries.filter((q) => q.status === "done").length;
  const totalQueries = queries.length;
  const progressPercent = totalQueries
    ? Math.floor((doneCount / totalQueries) * 100)
    : 0;

  /**
   * Called when user clicks "Generate"
   * - "Learning about {url}"
   * - After 5s => "learning complete"
   * - Then cycle messages every 3s
   */
  async function handleGenerate() {
    setError(null);
    setResult(null);
    setQueries([]);
    setCurrentIndex(0);

    // Show "Learning about {url}" immediately
    setGlobalLoading(true);
    setGlobalMessage(`Learning about ${url}`);

    // After 5 seconds, switch message
    setTimeout(() => {
      setGlobalMessage("learning complete - thinking of what to put in report");

      const phases = [
        "thinking about consumer behaviour",
        "thinking about economic impacts",
        "thinking about technological advancements",
        "thinking about regulations",
        "thinking about competitors",
      ];
      let i = 0;
      const intervalId = setInterval(() => {
        setGlobalMessage(phases[i]);
        i++;
        if (i >= phases.length) {
          clearInterval(intervalId);
        }
      }, 3000);
    }, 5000);

    // Meanwhile, call /api/generate
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || "Failed to generate analysis");
      }
      const data = await res.json();
      setResult(data);

      // Flatten queries
      if (data.searchQueries?.searches) {
        const flattened = flattenSearches(data.searchQueries.searches);
        setQueries(flattened);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      // End global loading once the /api/generate call completes
      setGlobalLoading(false);
      setGlobalMessage("");
    }
  }

  /**
   * As soon as we have queries, handle them sequentially with Perplexity
   */
  useEffect(() => {
    if (currentIndex < queries.length) {
      const q = queries[currentIndex];
      if (q.status === "pending") {
        researchQuery(currentIndex);
      }
    }
  }, [currentIndex, queries]);

  /**
   * Single Perplexity call for a query
   */
  async function researchQuery(idx: number) {
    const updated = [...queries];
    updated[idx].status = "researching";
    setQueries(updated);

    try {
      const perplexityRes = await fetch("/api/perplexity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: updated[idx].search }),
      });
      if (!perplexityRes.ok) {
        throw new Error("Failed to research query on Perplexity");
      }

      const json = await perplexityRes.json();
      const finalContent =
        json.choices?.[0]?.message?.content?.trim() || "No response.";
      const finalCitations = json.citations || [];

      // Mark query as done
      const nextQueries = [...updated];
      nextQueries[idx].status = "done";
      nextQueries[idx].content = finalContent;
      nextQueries[idx].citations = finalCitations;
      setQueries(nextQueries);

      // Move to next query
      setCurrentIndex((prev) => prev + 1);

      // If that was the last query, or there's more?
      if (idx + 1 >= nextQueries.length) {
        setGlobalMessage("All research finished!");
      } else {
        setGlobalMessage(`Research finished for "${updated[idx].search}".`);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setGlobalLoading(false);
    }
  }

  // Toggle expanded content
  function toggleExpand(idx: number) {
    const updated = [...queries];
    updated[idx].expanded = !updated[idx].expanded;
    setQueries(updated);
  }

  /**
   * 4) Real "Download PDF" function using jsPDF + autoTable
   * - Exports your queries + extractedData into a PDF
   */
   

   function handleDownloadPdf() {
    try {
      const doc = new jsPDF();
  
      // 1) Build a single HTML string from all content
      //    We'll parse each query's content from Markdown -> HTML using 'marked'.
      let htmlContent = `
        <h1>Nuggt Report</h1>
        <p style="margin-bottom: 30px;">Generated on: ${new Date().toLocaleString()}</p>
      `;
  
      // 2) Extraction Results (as-is, or styled however you like)
      if (result?.extractedData) {
        htmlContent += `
          <h2>Extraction Results</h2>
          <pre style="background: #f8f8f8; padding: 10px; white-space: pre-wrap; font-size: 12px;">
  ${JSON.stringify(result.extractedData, null, 2)}
          </pre>
          <hr style="margin: 20px 0;" />
        `;
      }
  
      // 3) Render each query with a heading, markdown (converted to HTML), and citations
      queries.forEach((q, index) => {
        const mdToHtml = marked.parse(q.content || "No content provided.");
  
        htmlContent += `
          <h3 style="margin-top: 20px;">Query ${index + 1}: ${q.search}</h3>
          ${mdToHtml}
        `;
  
        if (q.citations && q.citations.length > 0) {
          htmlContent += "<strong>Sources:</strong><ul>";
          q.citations.forEach((url) => {
            htmlContent += `<li><a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a></li>`;
          });
          htmlContent += "</ul>";
        }
  
        htmlContent += `<hr style="margin: 20px 0;" />`;
      });
  
      // 4) Use doc.html() to render the combined HTML into the PDF
      //    Note that doc.html is asynchronous; we pass a callback to finalize and save.
      doc.html(htmlContent, {
        x: 10,
        y: 10,
        width: 190,         // approx page width
        windowWidth: 1000,  // helps with layout
        callback: function (doc) {
          doc.save("Nuggt_Report.pdf");
        },
      });
    } catch (err) {
      console.error("Error generating PDF:", err);
      alert("Failed to generate PDF. Check console.");
    }
  }
  
  
  
   

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <div className="inline-block p-2 bg-black text-white rounded-full mb-6">
            <Rocket className="h-6 w-6" />
          </div>
          <h1 className="text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
            Nuggt Report Generator
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Enter your website URL below to generate a comprehensive market dynamics report for your startup. Get
            valuable insights in minutes.
          </p>
        </motion.div>

        {/* Input Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="max-w-2xl mx-auto">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <Input
                    placeholder="https://example.com"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="h-12 text-lg"
                  />
                </div>
                <Button
                  onClick={handleGenerate}
                  disabled={!url || globalLoading}
                  className="h-12 px-6 text-lg font-semibold bg-black hover:bg-gray-800 text-white transition-all duration-200"
                >
                  {globalLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Working...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Generate
                      <ArrowRight className="h-5 w-5" />
                    </span>
                  )}
                </Button>
              </div>

              {/* Messages */}
              {globalMessage && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-4 flex items-center gap-2 text-lg text-gray-600"
                >
                  {globalLoading && <Loader2 className="h-5 w-5 animate-spin" />}
                  <span>{globalMessage}</span>
                </motion.div>
              )}

              {error && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-600"
                >
                  <strong>Error:</strong> {error}
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Results Section */}
        {queries.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="mt-8">
            {/* Overall progress */}
            <div className="mb-6 max-w-2xl mx-auto">
              <div className="flex justify-between items-center mb-2">
                {doneCount < totalQueries ? (
                  <div className="font-semibold">
                    Query {currentIndex + 1} of {totalQueries}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">All queries completed!</span>
                    {/* Download PDF button calls our new function */}
                    <Button variant="destructive" size="sm" onClick={handleDownloadPdf}>
                      Download PDF
                    </Button>
                  </div>
                )}

                <div className="text-sm text-gray-500">{Math.round(progressPercent)}% Complete</div>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>

            {/* Queries list */}
            <div className="space-y-4 max-w-3xl mx-auto">
              {queries.map((q, i) => {
                let bgColor = "bg-white"; // default/pending
                if (q.status === "researching") bgColor = "bg-orange-50";
                if (q.status === "done") bgColor = "bg-green-50";

                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className={`border p-4 rounded-lg shadow-sm ${bgColor}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium flex items-center space-x-2">
                        {q.status === "researching" && (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Researching on: {q.search}</span>
                          </>
                        )}
                        {q.status === "done" && (
                          <span className="text-green-700">
                            {q.search} — Research finished!
                          </span>
                        )}
                        {q.status === "pending" && (
                          <span className="italic text-gray-400">
                            Pending — {q.search}
                          </span>
                        )}
                      </div>

                      {q.status === "done" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleExpand(i)}
                          className="ml-4"
                        >
                          {q.expanded ? "Hide" : "Show Results"}
                        </Button>
                      )}
                    </div>

                    {q.status === "done" && q.expanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="mt-4 text-sm text-gray-800"
                      >
                        <ReactMarkdown
                          className="prose prose-sm w-full max-w-none leading-normal"
                          remarkPlugins={[remarkGfm]}
                        >
                          {q.content}
                        </ReactMarkdown>

                        {q.citations.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <strong className="text-gray-700">Sources:</strong>
                            <ul className="list-none mt-2 space-y-2">
                              {q.citations.map((url, idx2) => (
                                <li key={idx2}>
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 underline transition-colors"
                                  >
                                    [{idx2 + 1}] {url}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Extracted Data */}
        {result?.extractedData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-8 max-w-3xl mx-auto"
          >
            <Card>
              <CardContent className="p-6">
                <h2 className="text-2xl font-semibold mb-4">Extraction Results</h2>
                <pre className="text-sm whitespace-pre-wrap bg-gray-50 p-4 rounded-md overflow-auto">
                  {JSON.stringify(result.extractedData, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>

      {/* ============ SHADCN DIALOG BELOW ============ */}
      <SubscribeDialog
        doneCount={doneCount}
        totalQueries={totalQueries}
      />
    </main>
  )
}

/* 
  This is your existing shadcn dialog component. 
  It opens automatically when all queries have been completed. 
  On Subscribe, we call saveReportEmail() from firebaseClient.ts 
  to store "reports/<sanitizedEmail>" = {email, createdAt}
*/
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";

function SubscribeDialog({
  doneCount,
  totalQueries,
}: {
  doneCount: number;
  totalQueries: number;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  // Auto-open when all queries done
  useEffect(() => {
    if (totalQueries > 0 && doneCount === totalQueries) {
      setDialogOpen(true);
    }
  }, [doneCount, totalQueries]);

  async function handleSubscribeEmail() {
    if (!userEmail) {
      alert("Please enter a valid email.");
      return;
    }
    try {
      await saveReportEmail(userEmail);
      alert("Subscribed successfully! Please remember to download the report PDF");
    } catch (err) {
      console.error(err);
      alert("Failed to subscribe. Please try again.");
    }
  }


  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Get Weekly Personalized Reports</DialogTitle>
          <DialogDescription>
            Do you want personalized reports like these for your startup every week?
            Enter your email below and click subscribe. 
            PS: You can download the report PDF without subscribing as well
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-2">
          <Input
            type="email"
            placeholder="you@example.com"
            value={userEmail}
            onChange={(e) => setUserEmail(e.target.value)}
          />
        </div>
        <DialogFooter className="mt-4">
          <Button onClick={handleSubscribeEmail}>
            Subscribe
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
