
import { GoogleGenAI, Schema, Type } from "@google/genai";
import { StudyGuideData } from "../types";
import { parseFileToText } from "../src/utils/fileParser";

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

export interface FileInput {
  name: string;
  mimeType: string;
  data: string; // Base64 string
}

export const generateStudyGuide = async (
  files: FileInput[], 
  userInstructions?: string,
  title?: string
): Promise<StudyGuideData> => {
  try {
    const parts: any[] = [];

    for (const file of files) {
      const parsedText = await parseFileToText(file.data, file.mimeType, file.name);
      if (parsedText) {
        parts.push({ text: parsedText });
      } else {
        parts.push({
          inlineData: {
            mimeType: file.mimeType,
            data: file.data,
          },
        });
      }
    }

    const response = await fetch("/api/generate-study-guide", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        parts,
        title,
        userInstructions
      })
    });

    const contentType = response.headers.get("content-type") || "";
    let data: any = null;

    if (contentType.includes("application/json")) {
      try {
        data = await response.json();
      } catch (jsonErr) {
        console.error("JSON parse failure on API response:", jsonErr);
        throw new Error("Received malformed data from the study guide service. Please try again.");
      }
    } else {
      // Server returned HTML (e.g. 504 Gateway Timeout, 502, or proxy error)
      const rawText = await response.text();
      console.warn("Server returned non-JSON response:", rawText.slice(0, 300));
      if (!response.ok) {
        if (response.status === 504 || response.status === 502) {
          throw new Error("The request timed out while generating your comprehensive study material. Please try generating with fewer files or a focused section.");
        }
        throw new Error(`Server returned error (${response.status}). Please try again in a few moments.`);
      }
      throw new Error("Unexpected server response format. Please refresh the page and try again.");
    }

    if (!response.ok) {
      throw new Error(data?.error || `Server returned error status ${response.status}`);
    }

    return data as StudyGuideData;
  } catch (error) {
    console.error("Error generating study guide via server proxy:", error);
    throw error;
  }
};
