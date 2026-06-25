import { invokeLLM } from "./_core/llm";

/**
 * Enhanced PDF extraction service with OCR support for blurry PDFs
 * Intelligently identifies questions, answers, and explanations
 */

export interface ExtractedQuestion {
  questionText: string;
  choices: string[];
  correctAnswerIndex: number;
  explanation: string;
}

export interface ExtractionResult {
  questions: ExtractedQuestion[];
  confidence: number;
  method: "direct" | "ocr" | "hybrid";
}

/**
 * Extract questions from PDF using LLM with enhanced prompting
 * Handles blurry PDFs, various formats, and intelligent Q&A detection
 */
export async function extractQuestionsFromPDF(fileUrl: string, fileName: string): Promise<ExtractionResult> {
  try {
    const isPDF = fileName.toLowerCase().endsWith(".pdf");
    const isDOCX = fileName.toLowerCase().endsWith(".docx");
    const mimeType = isPDF
      ? "application/pdf"
      : isDOCX
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : "application/pdf";

    // Enhanced LLM prompt for powerful extraction
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are an expert document analyzer specializing in extracting educational content from PDFs and documents, including blurry, scanned, or poorly formatted ones.

YOUR TASK: Extract ALL questions and their answers from the provided document.

IMPORTANT CAPABILITIES:
1. Handle OCR-extracted text with spelling errors and formatting issues
2. Identify questions even if they're numbered, bulleted, or unnumbered
3. Distinguish between questions, answer options, and explanations
4. Convert any question format to multiple-choice (4 options):
   - Multiple choice questions → keep as is
   - True/False → convert to 4 options (True, False, Cannot Determine, Not Mentioned)
   - Fill-in-the-blank → create plausible options
   - Essay/Short answer → create 4 plausible options based on context
   - Matching → convert each match to a separate MCQ
5. Extract explanations if present in the document
6. Handle documents with mixed formats (some MCQ, some essay, etc.)

EXTRACTION STRATEGY:
- Look for question indicators: "Q.", "Question", "1.", "a)", "i)", etc.
- Identify answer sections: "Answer:", "Correct Answer:", "A)", "B)", "C)", "D)", etc.
- Extract explanations: "Explanation:", "Why:", "Because:", "Note:", etc.
- If answers aren't explicit, use document context to determine correct answers

OUTPUT FORMAT - Return ONLY valid JSON:
{
  "questions": [
    {
      "questionText": "Complete question text",
      "choices": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswerIndex": 0,
      "explanation": "Why this is correct"
    }
  ]
}

VALIDATION RULES:
- correctAnswerIndex must be 0-3
- choices array must have exactly 4 items
- All fields required
- No text outside JSON
- If no questions found, return {"questions": []}
- Preserve original question text as much as possible
- If document is blurry/unclear, make best effort interpretation`,
        },
        {
          role: "user",
          content: [
            {
              type: "file_url" as const,
              file_url: {
                url: fileUrl,
                mime_type: mimeType as "application/pdf" | "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              },
            },
            {
              type: "text" as const,
              text: `Please extract all questions from this document. Handle any OCR errors, unclear formatting, or blurry text. Convert all questions to multiple-choice format with 4 options each.`,
            },
          ] as any,
        },
      ] as any,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "question_extraction",
          strict: true,
          schema: {
            type: "object",
            properties: {
              questions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    questionText: { type: "string" },
                    choices: {
                      type: "array",
                      items: { type: "string" },
                      minItems: 4,
                      maxItems: 4,
                    },
                    correctAnswerIndex: { type: "integer", minimum: 0, maximum: 3 },
                    explanation: { type: "string" },
                  },
                  required: ["questionText", "choices", "correctAnswerIndex", "explanation"],
                  additionalProperties: false,
                },
              },
            },
            required: ["questions"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message.content;
    if (!content) throw new Error("No response from LLM");

    const contentStr = typeof content === "string" ? content : JSON.stringify(content);
    const parsed = JSON.parse(contentStr);

    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      throw new Error("Invalid response format from LLM");
    }

    if (parsed.questions.length === 0) {
      throw new Error("No questions found in document");
    }

    // Validate extracted questions
    const validQuestions = parsed.questions.filter((q: any) => {
      return (
        q.questionText &&
        Array.isArray(q.choices) &&
        q.choices.length === 4 &&
        typeof q.correctAnswerIndex === "number" &&
        q.correctAnswerIndex >= 0 &&
        q.correctAnswerIndex <= 3 &&
        q.explanation
      );
    });

    if (validQuestions.length === 0) {
      throw new Error("No valid questions extracted from document");
    }

    return {
      questions: validQuestions,
      confidence: validQuestions.length === parsed.questions.length ? 1.0 : 0.8,
      method: "direct",
    };
  } catch (error) {
    console.error("PDF extraction error:", error);
    throw new Error(`Failed to extract questions: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Validate extracted questions for quality
 */
export function validateExtractedQuestions(questions: ExtractedQuestion[]): boolean {
  if (!Array.isArray(questions) || questions.length === 0) {
    return false;
  }

  return questions.every((q) => {
    return (
      typeof q.questionText === "string" &&
      q.questionText.length > 10 &&
      Array.isArray(q.choices) &&
      q.choices.length === 4 &&
      q.choices.every((c) => typeof c === "string" && c.length > 0) &&
      typeof q.correctAnswerIndex === "number" &&
      q.correctAnswerIndex >= 0 &&
      q.correctAnswerIndex <= 3 &&
      typeof q.explanation === "string" &&
      q.explanation.length > 0
    );
  });
}
