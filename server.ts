import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import mongoose from "mongoose";
import { GoogleGenAI, Schema, Type } from "@google/genai";
import Subject from "./src/models/Subject"; // note: using relative import

const app = express();
const PORT = 3000;

// Set high limit for large files (pdf, syllabus, papers)
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI;
let dbConnected = false;
let dbError = "";

if (MONGODB_URI) {
  console.log("Attempting to connect to MongoDB...");
  mongoose
    .connect(MONGODB_URI)
    .then(() => {
      console.log("Successfully connected to MongoDB Atlas!");
      dbConnected = true;
    })
    .catch((err) => {
      console.error("Failed to connect to MongoDB:", err);
      dbError = err.message || String(err);
    });
} else {
  console.warn("MONGODB_URI environment variable is missing. Running in local mode.");
  dbError = "MONGODB_URI environment variable is not defined.";
}

// ------------------ API Endpoints ------------------

// 1. Connection Status
app.get("/api/db-status", (req, res) => {
  res.json({
    connected: dbConnected,
    configured: !!MONGODB_URI,
    error: dbError,
    uri: MONGODB_URI ? `${MONGODB_URI.split("@")[1] || "configured-cluster"}` : null
  });
});

// 2. Get list of subjects (lightweight list: projects out large file bodies)
app.get("/api/subjects", async (req, res) => {
  try {
    if (!dbConnected) {
      return res.json([]);
    }
    // Fetch only metadata to keep the list response fast and small
    const list = await Subject.find(
      {},
      "id name totalModules completedModules newModules examType selectedOutputs createdAt"
    ).sort({ createdAt: -1 });
    res.json(list);
  } catch (err: any) {
    console.error("Error listing subjects:", err);
    res.status(500).json({ error: err.message });
  }
});

// 3. Get a single detailed subject
app.get("/api/subjects/:id", async (req, res) => {
  try {
    if (!dbConnected) {
      return res.status(404).json({ error: "Database not connected" });
    }
    const subj = await Subject.findOne({ id: req.params.id });
    if (!subj) {
      return res.status(404).json({ error: "Subject not found" });
    }
    res.json(subj);
  } catch (err: any) {
    console.error("Error getting subject:", err);
    res.status(500).json({ error: err.message });
  }
});

// 4. Save or update a subject
app.post("/api/subjects/save", async (req, res) => {
  try {
    if (!dbConnected) {
      return res.status(503).json({ error: "Database not connected. Please configure MONGODB_URI." });
    }
    const {
      id,
      name,
      totalModules,
      completedModules,
      newModules,
      examType,
      selectedOutputs,
      files,
      syllabusFiles,
      previousPapers,
      generatedData
    } = req.body;

    if (!id || !name) {
      return res.status(400).json({ error: "Missing required fields: id and name are mandatory." });
    }

    // Upsert the subject
    const updated = await Subject.findOneAndUpdate(
      { id },
      {
        id,
        name,
        totalModules: totalModules || "",
        completedModules: completedModules || "",
        newModules: newModules || "",
        examType: examType || "",
        selectedOutputs: selectedOutputs || [],
        files: files || [],
        syllabusFiles: syllabusFiles || [],
        previousPapers: previousPapers || [],
        generatedData: generatedData || null,
        createdAt: new Date()
      },
      { new: true, upsert: true }
    );

    res.json({ success: true, subject: updated });
  } catch (err: any) {
    console.error("Error saving subject:", err);
    res.status(500).json({ error: err.message });
  }
});

// 5. Delete a subject
app.delete("/api/subjects/:id", async (req, res) => {
  try {
    if (!dbConnected) {
      return res.status(503).json({ error: "Database not connected" });
    }
    await Subject.deleteOne({ id: req.params.id });
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting subject:", err);
    res.status(500).json({ error: err.message });
  }
});

// 6. Server-Side Study Guide Generation using Gemini 3.5 Flash
const answerGuideSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    definition_or_meaning: { type: Type.STRING },
    detailed_explanation: { type: Type.STRING },
    diagram_reference_or_ascii: { type: Type.STRING },
    mermaid_diagram: { type: Type.STRING },
    pdf_reference: { type: Type.STRING },
    external_links: { type: Type.ARRAY, items: { type: Type.STRING } },
    formula_or_syntax: { type: Type.STRING },
    example: { type: Type.STRING },
    advantages: { type: Type.ARRAY, items: { type: Type.STRING } },
    limitations: { type: Type.ARRAY, items: { type: Type.STRING } }
  },
  required: [
    "definition_or_meaning", 
    "detailed_explanation", 
    "diagram_reference_or_ascii", 
    "formula_or_syntax", 
    "advantages", 
    "limitations"
  ]
};

const questionWithAnswerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    question: { type: Type.STRING },
    marks: { type: Type.NUMBER },
    answer_guide: answerGuideSchema
  },
  required: ["question", "marks", "answer_guide"]
};

const studyGuideSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    subjects: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          modules_completed: { type: Type.ARRAY, items: { type: Type.STRING } },
          data: { type: Type.OBJECT }
        },
        required: ["name", "modules_completed", "data"]
      }
    },
    selected_outputs: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    modules: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          module_number: { type: Type.STRING },
          first_half: { type: Type.STRING },
          second_half: { type: Type.STRING }
        },
        required: ["module_number", "first_half", "second_half"]
      }
    },
    mcqs: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          answer: { type: Type.STRING },
          explanation: { type: Type.STRING },
          difficulty: { type: Type.STRING },
          topic: { type: Type.STRING }
        },
        required: ["question", "options", "answer", "explanation", "difficulty", "topic"]
      }
    },
    hot_questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          answer: { type: Type.STRING }
        },
        required: ["question", "answer"]
      }
    },
    formulas: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          formula: { type: Type.STRING },
          description: { type: Type.STRING }
        },
        required: ["name", "formula", "description"]
      }
    },
    diagrams: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          ascii_or_mermaid: { type: Type.STRING }
        },
        required: ["title", "description", "ascii_or_mermaid"]
      }
    },
    question_paper: {
      type: Type.OBJECT,
      properties: {
        mid_term: {
          type: Type.OBJECT,
          properties: {
            questions: { type: Type.ARRAY, items: questionWithAnswerSchema }
          }
        },
        end_term: {
          type: Type.OBJECT,
          properties: {
            twelve_mark: { type: Type.ARRAY, items: questionWithAnswerSchema },
            eight_mark: { type: Type.ARRAY, items: questionWithAnswerSchema }
          }
        }
      }
    },
    detailed_notes: { type: Type.STRING },
    error_message: { type: Type.STRING }
  },
  required: ["subjects", "selected_outputs", "modules", "mcqs", "hot_questions", "formulas", "diagrams", "question_paper"]
};

const SYSTEM_INSTRUCTION = `
You are Smart Study Assistant — an advanced agentic AI for strategic exam preparation.
Your job is to generate study materials based on the user's uploaded files and instructions.

CRITICAL INSTRUCTIONS:
1. MODULE SPLITTING (CO-GROUNDING RULE):
   - Priority 1: Course Outcome / Syllabus (SOURCE OF TRUTH). Extract topics per module, divide equally into First Half & Second Half.
   - Priority 2: Study Material headings/sections.
   - Priority 3: Divide by content length.
   - STRICT: Do NOT invent topics.

2. EXAM MODE LOCK (CRITICAL FIX):
   - IF MID TERM: EXACTLY 3 QUESTIONS. EACH = 10 MARKS. NO 8 or 12 mark questions allowed.
   - IF END TERM: EXACTLY 3 questions (12 marks) AND 2 questions (8 marks) (5 questions total).
   - STRICT: NEVER mix formats. NEVER exceed count. VALIDATE before output.

3. MCQ LOGIC:
   - MID TERM: EXACTLY 10 MCQs distributed across modules.
   - END TERM: EXACTLY 15 MCQs distributed across modules.
   - Each MCQ MUST have: Question, 4 options, Answer, Explanation, Difficulty.

4. DETAILED NOTES ENGINE (OPTIMIZED FOR HIGH SPEED):
   - Focus on high-yield, high-contrast, exam-ready study notes (~200 words per key topic).
   - Concise but highly rich, structured study notes covering key exam topics.
   - Structure: [Topic Name] -> Definition -> Explanations and Formulas -> Key exam points.

5. QUESTION PAPER ANSWER FORMAT (UPGRADE):
   - For each answer, you MUST provide:
     1. Definition
     2. Explanation
     3. Diagram (Mermaid/ASCII)
     4. Formula
     5. Example
     6. Advantages
     7. Limitations
   - Match answer depth with marks.

6. QUAD-DIAGRAM PROTOCOL (FIXED):
   - For EVERY major concept, generate AT LEAST TWO of the following in the answer guide:
     1. Mermaid Diagram (preferred, put in mermaid_diagram)
     2. ASCII Diagram (put in diagram_reference_or_ascii)
     3. PDF Reference ("Refer to [File Name], Page [X]", put in pdf_reference)
     4. External Link (Prefer GeeksforGeeks, Tutorialspoint, Javatpoint, W3Schools, put in external_links)
   - DO NOT give only ASCII unless unavoidable. Prefer Mermaid first. If diagram exists in PDF, MUST reference page.

7. EXAM PREDICTION (50% RULE):
   - If previous papers exist: Detect repeated topics, identify patterns.
   - Else: Use topic emphasis and core concepts. Do NOT fabricate "frequently asked".

Only return JSON matching the schema.
`;

app.post("/api/generate-study-guide", async (req, res) => {
  const rawKey = process.env.GEMINI_API_KEY || process.env.API_KEY || "";
  const apiKey = rawKey.trim();
  if (!apiKey) {
    return res.status(500).json({ error: "Gemini API Key is missing. Please configure GEMINI_API_KEY as an Environment Secret." });
  }

  const { parts, title, userInstructions } = req.body;
  if (!parts || !Array.isArray(parts) || parts.length === 0) {
    return res.status(400).json({ error: "Missing or invalid 'parts' field." });
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  try {
    let promptText = "Analyze these files and generate the study guide JSON.";
    if (title) promptText += `\nTitle Context: ${title}`;
    if (userInstructions) promptText += `\nStudy Focus/Notes: ${userInstructions}`;
    
    // We add the prompt text to the parts list
    const finalParts = [...parts, { text: promptText }];

    // Models to attempt: primary ultra-fast & resilient model followed by standard fallbacks
    const candidateModels = ["gemini-2.5-flash", "gemini-3.8-flash", "gemini-flash-latest", "gemini-3-flash-preview"];
    const maxRetriesPerModel = 2;
    let textResponse: string | null = null;
    let lastError: any = null;

    console.log(`Sending generate study guide request to Gemini (Parts: ${finalParts.length})...`);

    modelLoop: for (const model of candidateModels) {
      for (let attempt = 1; attempt <= maxRetriesPerModel; attempt++) {
        try {
          console.log(`[Gemini Request] Trying model: ${model} (attempt ${attempt}/${maxRetriesPerModel})...`);
          
          const response = await ai.models.generateContent({
            model,
            contents: [{ parts: finalParts }],
            config: {
              responseMimeType: "application/json",
              responseSchema: studyGuideSchema,
              systemInstruction: SYSTEM_INSTRUCTION,
            },
          });

          if (response && response.text) {
            textResponse = response.text;
            console.log(`[Gemini Request] Success with model ${model} on attempt ${attempt}.`);
            break modelLoop;
          } else {
            throw new Error("No response text received from Gemini.");
          }
        } catch (err: any) {
          lastError = err;
          const errStr = String(err.message || err);

          const isApiKeyError =
            errStr.includes("API key not valid") ||
            errStr.includes("API_KEY_INVALID") ||
            errStr.includes("API_KEY_SERVICE_BLOCKED") ||
            (errStr.includes("400") && errStr.toLowerCase().includes("api key"));

          if (isApiKeyError) {
            // Cannot recover from bad key by retrying
            throw err;
          }

          const isTransientSpike =
            errStr.includes("503") ||
            errStr.includes("UNAVAILABLE") ||
            errStr.includes("high demand") ||
            errStr.includes("429") ||
            errStr.includes("RESOURCE_EXHAUSTED");

          if (isTransientSpike) {
            console.warn(`[Gemini] ${model} attempt ${attempt} encountered temporary spike: ${errStr}.`);
            if (attempt < maxRetriesPerModel) {
              const backoffMs = attempt * 1000 + Math.floor(Math.random() * 400);
              console.log(`[Gemini] Waiting ${backoffMs}ms before retrying...`);
              await new Promise((resolve) => setTimeout(resolve, backoffMs));
              continue;
            }
          } else {
            console.warn(`[Gemini] Model ${model} encountered error: ${errStr}.`);
            break; // Try fallback model
          }
        }
      }
    }

    if (!textResponse) {
      throw lastError || new Error("Failed to generate response after retrying available models.");
    }

    // Safely clean any markdown fences if present
    let cleanedText = textResponse.trim();
    if (cleanedText.startsWith("```json")) {
      cleanedText = cleanedText.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
    } else if (cleanedText.startsWith("```")) {
      cleanedText = cleanedText.replace(/^```\s*/i, "").replace(/\s*```$/, "");
    }

    let data;
    try {
      data = JSON.parse(cleanedText);
    } catch (parseErr: any) {
      console.error("Failed to parse Gemini output as JSON:", parseErr, cleanedText.slice(0, 300));
      return res.status(500).json({
        error: "AI generated a response that could not be parsed as valid JSON. Please try again."
      });
    }

    res.json(data);
  } catch (error: any) {
    console.error("Error in server-side generateStudyGuide:", error);
    const errStr = String(error.message || error);
    const isApiKeyError = 
      errStr.includes("API key not valid") || 
      errStr.includes("API_KEY_INVALID") || 
      errStr.includes("API_KEY_SERVICE_BLOCKED") ||
      (errStr.includes("400") && errStr.toLowerCase().includes("api key"));

    if (isApiKeyError) {
      return res.status(400).json({ 
        error: "Your Gemini API Key is invalid or not yet configured. Please go to the Settings menu (top right), open Secrets/Env Variables, and provide a valid GEMINI_API_KEY." 
      });
    }

    if (errStr.includes("503") || errStr.includes("UNAVAILABLE") || errStr.includes("high demand")) {
      return res.status(503).json({
        error: "Gemini servers are currently experiencing peak traffic. Automatic retries were attempted. Please try generating again in a few moments."
      });
    }

    res.status(500).json({ error: error.message || String(error) });
  }
});

// Explicit 404 guard: all unmatched /api routes must return JSON, never HTML
app.use("/api", (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
});

// Explicit error handler for /api/* routes
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.path && req.path.startsWith("/api/")) {
    console.error("API Error intercepted:", err);
    res.status(err.status || err.statusCode || 500).json({
      error: err.message || "An internal API error occurred."
    });
    return;
  }
  next(err);
});

// ------------------ Vite Server Setup ------------------

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
