import { clearSessionCookie, hashPassword, setSessionCookie, verifyPassword } from "./_core/auth";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import * as db from "./db";
import { quizzes, questions, quizAttempts, userAnswers, testInvitations, testSessions, InsertQuestion, InsertQuizAttempt, InsertUserAnswer } from "../drizzle/schema";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import { eq, and } from "drizzle-orm";

// Quiz Router - for users to browse and take quizzes
const quizRouter = router({
  list: publicProcedure.query(async () => {
    return db.getPublishedQuizzes();
  }),

  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const quiz = await db.getQuizById(input.id);
      if (!quiz) throw new Error("Quiz not found");
      return quiz;
    }),

  getQuestions: publicProcedure
    .input(z.object({ quizId: z.number() }))
    .query(async ({ input }) => {
      return db.getQuestionsByQuizId(input.quizId);
    }),

  startAttempt: protectedProcedure
    .input(z.object({ quizId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const database = await getDb();
      if (!database) throw new Error("Database not available");

      const quiz = await db.getQuizById(input.quizId);
      if (!quiz) throw new Error("Quiz not found");

      const attempt = await database.insert(quizAttempts).values({
        userId: ctx.user.id,
        quizId: input.quizId,
        totalQuestions: quiz.totalQuestions,
      });

      return { attemptId: attempt[0].insertId };
    }),

  submitAnswer: protectedProcedure
    .input(
      z.object({
        attemptId: z.number(),
        questionId: z.number(),
        selectedAnswerIndex: z.number().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const database = await getDb();
      if (!database) throw new Error("Database not available");

      // Verify attempt belongs to user
      const attempt = await database
        .select()
        .from(quizAttempts)
        .where(eq(quizAttempts.id, input.attemptId))
        .limit(1);

      if (attempt.length === 0 || attempt[0].userId !== ctx.user.id) {
        throw new Error("Unauthorized");
      }

      // Check for duplicate answer
      const existing = await database
        .select()
        .from(userAnswers)
        .where(
          and(
            eq(userAnswers.attemptId, input.attemptId),
            eq(userAnswers.questionId, input.questionId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        throw new Error("Answer already submitted for this question");
      }

      // Get the question to check if answer is correct
      const question = await database
        .select()
        .from(questions)
        .where(eq(questions.id, input.questionId))
        .limit(1);

      if (question.length === 0) {
        throw new Error("Question not found");
      }

      const isCorrect = input.selectedAnswerIndex === question[0].correctAnswerIndex;

      // Insert answer
      await database.insert(userAnswers).values({
        attemptId: input.attemptId,
        questionId: input.questionId,
        selectedAnswerIndex: input.selectedAnswerIndex,
        isCorrect: isCorrect,
      });

      return { success: true };
    }),

  completeAttempt: protectedProcedure
    .input(z.object({ attemptId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const database = await getDb();
      if (!database) throw new Error("Database not available");

      // Verify attempt belongs to user
      const attempt = await database
        .select()
        .from(quizAttempts)
        .where(eq(quizAttempts.id, input.attemptId))
        .limit(1);

      if (attempt.length === 0 || attempt[0].userId !== ctx.user.id) {
        throw new Error("Unauthorized");
      }

      const attemptData = attempt[0];

      // Get all answers for this attempt
      const answers = await database
        .select()
        .from(userAnswers)
        .where(eq(userAnswers.attemptId, input.attemptId));

      // Get all questions for this quiz
      const quizQuestions = await database
        .select()
        .from(questions)
        .where(eq(questions.quizId, attemptData.quizId));

      // Calculate score
      let correctCount = 0;
      for (const question of quizQuestions) {
        const answer = answers.find((a) => a.questionId === question.id);
        if (answer && answer.selectedAnswerIndex === question.correctAnswerIndex) {
          correctCount++;
        }
      }

      const score = attemptData.totalQuestions > 0
        ? ((correctCount / attemptData.totalQuestions) * 100).toFixed(2)
        : "0.00";

      // Update attempt with completion
      await database
        .update(quizAttempts)
        .set({
          isCompleted: true,
          completedAt: new Date(),
          score: score,
        })
        .where(eq(quizAttempts.id, input.attemptId));

      return { success: true, score, correctCount, totalQuestions: attemptData.totalQuestions };
    }),

  getAttemptResults: protectedProcedure
    .input(z.object({ attemptId: z.number() }))
    .query(async ({ ctx, input }) => {
      const database = await getDb();
      if (!database) throw new Error("Database not available");

      const attempt = await database
        .select()
        .from(quizAttempts)
        .where(eq(quizAttempts.id, input.attemptId))
        .limit(1);

      if (attempt.length === 0 || attempt[0].userId !== ctx.user.id) {
        throw new Error("Unauthorized");
      }

      const answers = await database
        .select()
        .from(userAnswers)
        .where(eq(userAnswers.attemptId, input.attemptId));

      const quizQuestions = await database
        .select()
        .from(questions)
        .where(eq(questions.quizId, attempt[0].quizId));

      return {
        attempt: attempt[0],
        answers,
        questions: quizQuestions,
      };
    }),

  getUserAttempts: protectedProcedure
    .input(z.object({ quizId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      return db.getUserQuizAttempts(ctx.user.id, input.quizId);
    }),
});

// Admin Router - for managing quizzes
const adminRouter = router({
  getAdminQuizzes: protectedProcedure.query(async ({ ctx }) => {
    const database = await getDb();
    if (!database) throw new Error("Database not available");

    // Only admins can see all quizzes; regular users see only their own
    if (ctx.user.role === "admin") {
      return database.select().from(quizzes);
    } else {
      return database
        .select()
        .from(quizzes)
        .where(eq(quizzes.createdById, ctx.user.id));
    }
  }),

  uploadPDF: protectedProcedure
    .input(
      z.object({
        fileName: z.string(),
        fileData: z.union([
          z.instanceof(Buffer),
          z.instanceof(Uint8Array),
          z.string(), // base64 encoded
        ]),
        quizTitle: z.string().optional(),
        durationMinutes: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Allow any authenticated user to upload
      const database = await getDb();
      if (!database) throw new Error("Database not available");

      // Convert fileData to Buffer if needed
      let fileBuffer: Buffer;
      if (typeof input.fileData === "string") {
        fileBuffer = Buffer.from(input.fileData, "base64");
      } else if (input.fileData instanceof Uint8Array) {
        fileBuffer = Buffer.from(input.fileData);
      } else {
        fileBuffer = input.fileData;
      }

      // Validate file
      if (fileBuffer.length === 0) {
        throw new Error("File is empty");
      }
      if (fileBuffer.length > 50 * 1024 * 1024) {
        throw new Error("File too large (max 50MB)");
      }

      // Determine MIME type based on file extension
      const isPDF = input.fileName.toLowerCase().endsWith(".pdf");
      const isDOCX = input.fileName.toLowerCase().endsWith(".docx");
      const mimeType = isPDF
        ? "application/pdf"
        : isDOCX
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : "application/octet-stream";

      if (!isPDF && !isDOCX) {
        throw new Error("Only PDF and DOCX files are supported");
      }

      // Upload file to storage
      const fileKey = `documents/${Date.now()}-${input.fileName}`;
      const { url } = await storagePut(fileKey, fileBuffer, mimeType);

      // Create quiz record
      const quizResult = await database.insert(quizzes).values({
        createdById: ctx.user.id,
        title: input.quizTitle || input.fileName.replace(/\.(pdf|docx)$/i, ""),
        description: `Imported from ${input.fileName}`,
        isPublished: false,
        durationMinutes: input.durationMinutes || 30,
      });

      const quizId = quizResult[0].insertId;

      return { quizId, fileKey, url, fileName: input.fileName };
    }),

  parsePDF: protectedProcedure
    .input(
      z.object({
        quizId: z.number(),
        fileUrl: z.string(),
        fileName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Allow any authenticated user to parse their own documents
      const database = await getDb();
      if (!database) throw new Error("Database not available");

      // Verify user owns this quiz
      const quiz = await database
        .select()
        .from(quizzes)
        .where(eq(quizzes.id, input.quizId))
        .limit(1);

      if (quiz.length === 0 || quiz[0].createdById !== ctx.user.id) {
        throw new Error("Unauthorized: You can only parse your own quizzes");
      }

      try {
        // Determine file type from URL or fileName
        const fileName = input.fileName || "document";
        const isPDF = fileName.toLowerCase().endsWith(".pdf");
        const isDOCX = fileName.toLowerCase().endsWith(".docx");
        const mimeType = isPDF
          ? "application/pdf"
          : isDOCX
            ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            : "application/pdf";

        // Use LLM to parse document content with enhanced prompting
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are an expert at extracting educational content from documents (PDF, DOCX, etc.). Your task is to extract ALL questions and their answers from the provided document.

IMPORTANT INSTRUCTIONS:
1. Extract EVERY question from the document, no matter the format
2. If questions have explicit answers, use those
3. If questions don't have answers, generate plausible multiple choice options
4. Always provide exactly 4 choices per question
5. Clearly identify which choice is correct
6. Provide brief explanations for why each answer is correct
7. Handle various question formats: multiple choice, true/false (convert to 4-choice), fill-in-the-blank, essay questions (convert to multiple choice), etc.
8. If a document has numbered questions, extract them in order
9. Preserve the original question text as much as possible

Return ONLY a valid JSON object with this exact structure:
{
  "questions": [
    {
      "questionText": "The exact question text",
      "choices": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswerIndex": 0,
      "explanation": "Concise explanation of why this is correct"
    }
  ]
}

RULES:
- correctAnswerIndex must be 0-3 (0-based indexing)
- choices array must have exactly 4 items
- All fields are required for each question
- Do not include any text outside the JSON object
- If document has no questions, return {"questions": []}
- Ensure JSON is valid and parseable`,
            },
            {
              role: "user",
              content: [
                {
                  type: "file_url" as const,
                  file_url: {
                    url: input.fileUrl,
                    mime_type: mimeType as "application/pdf" | "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                  },
                },
              ] as any,
            },
          ] as any,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "quiz_extraction",
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

        // Validate we got questions
        if (!parsed.questions || !Array.isArray(parsed.questions)) {
          throw new Error("Invalid response format from LLM");
        }

        if (parsed.questions.length === 0) {
          throw new Error("No questions found in document. Please ensure the document contains questions.");
        }

        // Insert questions into database
        const insertedQuestions: InsertQuestion[] = parsed.questions.map((q: any, index: number) => ({
          quizId: input.quizId,
          questionText: q.questionText,
          choices: q.choices,
          correctAnswerIndex: q.correctAnswerIndex,
          explanation: q.explanation,
          orderIndex: index,
        }));

        for (const q of insertedQuestions) {
          await database.insert(questions).values(q);
        }

        // Update quiz with question count
        await database
          .update(quizzes)
          .set({ totalQuestions: insertedQuestions.length })
          .where(eq(quizzes.id, input.quizId));

        return {
          success: true,
          questionCount: insertedQuestions.length,
        };
      } catch (error) {
        console.error("Document parsing error:", error);
        throw new Error(`Failed to parse document: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }),

  publishQuiz: protectedProcedure
    .input(z.object({ quizId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // Only admins can publish quizzes
      if (ctx.user.role !== "admin") {
        throw new Error("Unauthorized: Only admins can publish quizzes");
      }

      const database = await getDb();
      if (!database) throw new Error("Database not available");

      const quiz = await database
        .select()
        .from(quizzes)
        .where(eq(quizzes.id, input.quizId))
        .limit(1);

      if (quiz.length === 0) {
        throw new Error("Quiz not found");
      }

      if (quiz[0].totalQuestions === 0) {
        throw new Error("Cannot publish quiz with no questions");
      }

      await database
        .update(quizzes)
        .set({ isPublished: true })
        .where(eq(quizzes.id, input.quizId));

      return { success: true };
    }),

  deleteQuiz: protectedProcedure
    .input(z.object({ quizId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const database = await getDb();
      if (!database) throw new Error("Database not available");

      const quiz = await database
        .select()
        .from(quizzes)
        .where(eq(quizzes.id, input.quizId))
        .limit(1);

      if (quiz.length === 0) {
        throw new Error("Quiz not found");
      }

      // Only creator or admin can delete
      if (quiz[0].createdById !== ctx.user.id && ctx.user.role !== "admin") {
        throw new Error("Unauthorized");
      }

      // Delete questions
      await database.delete(questions).where(eq(questions.quizId, input.quizId));

      // Delete quiz
      await database.delete(quizzes).where(eq(quizzes.id, input.quizId));

      return { success: true };
    }),

  // Test Conductor Endpoints
  getTestInvitations: protectedProcedure
    .input(z.object({ quizId: z.number() }))
    .query(async ({ ctx, input }) => {
      const database = await getDb();
      if (!database) throw new Error("Database not available");

      // Verify user is quiz creator
      const quiz = await database
        .select()
        .from(quizzes)
        .where(eq(quizzes.id, input.quizId))
        .limit(1);

      if (quiz.length === 0 || (quiz[0].createdById !== ctx.user.id && ctx.user.role !== "admin")) {
        throw new Error("Unauthorized");
      }

      const result = await database
        .select()
        .from(testInvitations)
        .where(eq(testInvitations.quizId, input.quizId));

      return result.map((inv) => ({
        id: inv.id,
        quizId: inv.quizId,
        studentEmail: inv.studentEmail,
        status: inv.status || "pending",
      }));
    }),

  getTestSessions: protectedProcedure
    .input(z.object({ quizId: z.number() }))
    .query(async ({ ctx, input }) => {
      const database = await getDb();
      if (!database) throw new Error("Database not available");

      // Verify user is quiz creator
      const quiz = await database
        .select()
        .from(quizzes)
        .where(eq(quizzes.id, input.quizId))
        .limit(1);

      if (quiz.length === 0 || (quiz[0].createdById !== ctx.user.id && ctx.user.role !== "admin")) {
        throw new Error("Unauthorized");
      }

      const result = await database
        .select()
        .from(testSessions)
        .where(eq(testSessions.quizId, input.quizId));

      return result.map((session) => ({
        id: session.id,
        quizId: session.quizId,
        isCompleted: session.isCompleted,
        score: session.score,
      }));
    }),

  inviteStudents: protectedProcedure
    .input(
      z.object({
        quizId: z.number(),
        studentEmails: z.array(z.string().email()),
        testTitle: z.string().optional(),
        durationMinutes: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const database = await getDb();
      if (!database) throw new Error("Database not available");

      // Verify user is quiz creator or admin
      const quiz = await database
        .select()
        .from(quizzes)
        .where(eq(quizzes.id, input.quizId))
        .limit(1);

      if (quiz.length === 0 || (quiz[0].createdById !== ctx.user.id && ctx.user.role !== "admin")) {
        throw new Error("Unauthorized");
      }

      // Create invitations for each email
      const invitations = input.studentEmails.map((email) => ({
        quizId: input.quizId,
        studentEmail: email,
        invitedBy: ctx.user.id,
        status: "pending" as const,
      }));

      await database.insert(testInvitations).values(invitations);

      // TODO: Send email invitations to students
      // For now, just return success

      return {
        success: true,
        invitationCount: invitations.length,
      };
    }),

  startTest: protectedProcedure
    .input(z.object({ quizId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const database = await getDb();
      if (!database) throw new Error("Database not available");

      // Verify user is quiz creator or admin
      const quiz = await database
        .select()
        .from(quizzes)
        .where(eq(quizzes.id, input.quizId))
        .limit(1);

      if (quiz.length === 0 || (quiz[0].createdById !== ctx.user.id && ctx.user.role !== "admin")) {
        throw new Error("Unauthorized");
      }

      // Update invitations to "accepted"
      await database
        .update(testInvitations)
        .set({ status: "accepted" as const })
        .where(eq(testInvitations.quizId, input.quizId));

      return { success: true };
    }),

  deleteTest: protectedProcedure
    .input(z.object({ quizId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const database = await getDb();
      if (!database) throw new Error("Database not available");

      // Verify user is quiz creator or admin
      const quiz = await database
        .select()
        .from(quizzes)
        .where(eq(quizzes.id, input.quizId))
        .limit(1);

      if (quiz.length === 0 || (quiz[0].createdById !== ctx.user.id && ctx.user.role !== "admin")) {
        throw new Error("Unauthorized");
      }

      // Delete invitations
      await database
        .delete(testInvitations)
        .where(eq(testInvitations.quizId, input.quizId));

      // Delete sessions
      await database
        .delete(testSessions)
        .where(eq(testSessions.quizId, input.quizId));

      // Delete quiz
      await database.delete(questions).where(eq(questions.quizId, input.quizId));
      await database.delete(quizzes).where(eq(quizzes.id, input.quizId));

      return { success: true };
    }),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    register: publicProcedure
      .input(
        z.object({
          name: z.string().trim().min(1, "Name is required").max(120),
          email: z.string().trim().email("Enter a valid email address"),
          password: z.string().min(8, "Password must be at least 8 characters"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const email = input.email.toLowerCase();
        const existing = await db.getUserByEmail(email);
        if (existing) {
          throw new Error("An account with this email already exists");
        }

        const user = await db.createLocalUser({
          name: input.name,
          email,
          passwordHash: await hashPassword(input.password),
        });

        await setSessionCookie(ctx.req, ctx.res, user);
        return user;
      }),
    login: publicProcedure
      .input(
        z.object({
          email: z.string().trim().email("Enter a valid email address"),
          password: z.string().min(1, "Password is required"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserByEmail(input.email.toLowerCase());
        if (!user?.passwordHash) {
          throw new Error("Invalid email or password");
        }

        const validPassword = await verifyPassword(input.password, user.passwordHash);
        if (!validPassword) {
          throw new Error("Invalid email or password");
        }

        await db.touchUserLastSignedIn(user.id);
        await setSessionCookie(ctx.req, ctx.res, user);
        return user;
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      clearSessionCookie(ctx.req, ctx.res);
      return { success: true };
    }),
  }),
  quiz: quizRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
