import { describe, it, expect, beforeEach, vi } from "vitest";
import { getDb } from "./db";
import { quizzes, questions, quizAttempts, userAnswers, users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Quiz System", () => {
  let db: Awaited<ReturnType<typeof getDb>>;

  beforeEach(async () => {
    db = await getDb();
  });

  describe("Quiz Creation and Retrieval", () => {
    it("should create a quiz with correct metadata", async () => {
      if (!db) return;

      const result = await db.insert(quizzes).values({
        createdById: 1,
        title: "Test Quiz",
        description: "A test quiz",
        isPublished: false,
        totalQuestions: 0,
      });

      expect(result[0].insertId).toBeGreaterThan(0);
    });

    it("should retrieve published quizzes only", async () => {
      if (!db) return;

      // Insert test quizzes
      await db.insert(quizzes).values([
        {
          createdById: 1,
          title: "Published Quiz",
          isPublished: true,
          totalQuestions: 2,
        },
        {
          createdById: 1,
          title: "Draft Quiz",
          isPublished: false,
          totalQuestions: 1,
        },
      ]);

      const published = await db
        .select()
        .from(quizzes)
        .where(eq(quizzes.isPublished, true));

      expect(published.length).toBeGreaterThan(0);
      expect(published.every((q) => q.isPublished)).toBe(true);
    });
  });

  describe("Question Management", () => {
    it("should store questions with correct answer index", async () => {
      if (!db) return;

      const quizResult = await db.insert(quizzes).values({
        createdById: 1,
        title: "Question Test",
        totalQuestions: 1,
      });

      const quizId = quizResult[0].insertId;

      const questionResult = await db.insert(questions).values({
        quizId,
        questionText: "What is 2+2?",
        choices: ["3", "4", "5", "6"],
        correctAnswerIndex: 1,
        explanation: "2+2 equals 4",
        orderIndex: 0,
      });

      expect(questionResult[0].insertId).toBeGreaterThan(0);

      const retrieved = await db
        .select()
        .from(questions)
        .where(eq(questions.id, questionResult[0].insertId))
        .limit(1);

      expect(retrieved[0]).toMatchObject({
        questionText: "What is 2+2?",
        correctAnswerIndex: 1,
        choices: ["3", "4", "5", "6"],
      });
    });

    it("should maintain question order within quiz", async () => {
      if (!db) return;

      const quizResult = await db.insert(quizzes).values({
        createdById: 1,
        title: "Order Test",
        totalQuestions: 3,
      });

      const quizId = quizResult[0].insertId;

      await db.insert(questions).values([
        {
          quizId,
          questionText: "Q1",
          choices: ["A", "B", "C", "D"],
          correctAnswerIndex: 0,
          orderIndex: 0,
        },
        {
          quizId,
          questionText: "Q2",
          choices: ["A", "B", "C", "D"],
          correctAnswerIndex: 1,
          orderIndex: 1,
        },
        {
          quizId,
          questionText: "Q3",
          choices: ["A", "B", "C", "D"],
          correctAnswerIndex: 2,
          orderIndex: 2,
        },
      ]);

      const ordered = await db
        .select()
        .from(questions)
        .where(eq(questions.quizId, quizId))
        .orderBy(questions.orderIndex);

      expect(ordered.map((q) => q.orderIndex)).toEqual([0, 1, 2]);
    });
  });

  describe("Quiz Attempts and Grading", () => {
    it("should create a quiz attempt with initial state", async () => {
      if (!db) return;

      const attemptResult = await db.insert(quizAttempts).values({
        userId: 1,
        quizId: 1,
        totalQuestions: 5,
        isCompleted: false,
      });

      expect(attemptResult[0].insertId).toBeGreaterThan(0);

      const retrieved = await db
        .select()
        .from(quizAttempts)
        .where(eq(quizAttempts.id, attemptResult[0].insertId))
        .limit(1);

      expect(retrieved[0]).toMatchObject({
        isCompleted: false,
        correctAnswers: 0,
        totalQuestions: 5,
      });
    });

    it("should calculate score correctly", async () => {
      if (!db) return;

      // Create quiz and questions
      const quizResult = await db.insert(quizzes).values({
        createdById: 1,
        title: "Scoring Test",
        totalQuestions: 4,
      });

      const quizId = quizResult[0].insertId;

      const q1 = await db.insert(questions).values({
        quizId,
        questionText: "Q1",
        choices: ["A", "B", "C", "D"],
        correctAnswerIndex: 0,
        orderIndex: 0,
      });

      const q2 = await db.insert(questions).values({
        quizId,
        questionText: "Q2",
        choices: ["A", "B", "C", "D"],
        correctAnswerIndex: 1,
        orderIndex: 1,
      });

      // Create attempt
      const attemptResult = await db.insert(quizAttempts).values({
        userId: 1,
        quizId,
        totalQuestions: 2,
        isCompleted: false,
      });

      const attemptId = attemptResult[0].insertId;

      // Submit answers
      await db.insert(userAnswers).values([
        {
          attemptId,
          questionId: q1[0].insertId,
          selectedAnswerIndex: 0,
          isCorrect: true,
        },
        {
          attemptId,
          questionId: q2[0].insertId,
          selectedAnswerIndex: 1,
          isCorrect: true,
        },
      ]);

      // Calculate score
      const answers = await db
        .select()
        .from(userAnswers)
        .where(eq(userAnswers.attemptId, attemptId));

      const correctCount = answers.filter((a) => a.isCorrect).length;
      const score = (correctCount / 2) * 100;

      expect(score).toBe(100);
    });

    it("should handle partial scores correctly", async () => {
      if (!db) return;

      const quizResult = await db.insert(quizzes).values({
        createdById: 1,
        title: "Partial Score Test",
        totalQuestions: 4,
      });

      const quizId = quizResult[0].insertId;

      const q1 = await db.insert(questions).values({
        quizId,
        questionText: "Q1",
        choices: ["A", "B", "C", "D"],
        correctAnswerIndex: 0,
        orderIndex: 0,
      });

      const q2 = await db.insert(questions).values({
        quizId,
        questionText: "Q2",
        choices: ["A", "B", "C", "D"],
        correctAnswerIndex: 1,
        orderIndex: 1,
      });

      const q3 = await db.insert(questions).values({
        quizId,
        questionText: "Q3",
        choices: ["A", "B", "C", "D"],
        correctAnswerIndex: 2,
        orderIndex: 2,
      });

      const q4 = await db.insert(questions).values({
        quizId,
        questionText: "Q4",
        choices: ["A", "B", "C", "D"],
        correctAnswerIndex: 3,
        orderIndex: 3,
      });

      const attemptResult = await db.insert(quizAttempts).values({
        userId: 1,
        quizId,
        totalQuestions: 4,
        isCompleted: false,
      });

      const attemptId = attemptResult[0].insertId;

      // 3 correct, 1 incorrect = 75%
      await db.insert(userAnswers).values([
        {
          attemptId,
          questionId: q1[0].insertId,
          selectedAnswerIndex: 0,
          isCorrect: true,
        },
        {
          attemptId,
          questionId: q2[0].insertId,
          selectedAnswerIndex: 1,
          isCorrect: true,
        },
        {
          attemptId,
          questionId: q3[0].insertId,
          selectedAnswerIndex: 1,
          isCorrect: false,
        },
        {
          attemptId,
          questionId: q4[0].insertId,
          selectedAnswerIndex: 3,
          isCorrect: true,
        },
      ]);

      const answers = await db
        .select()
        .from(userAnswers)
        .where(eq(userAnswers.attemptId, attemptId));

      const correctCount = answers.filter((a) => a.isCorrect).length;
      const score = (correctCount / 4) * 100;

      expect(score).toBe(75);
    });

    it("should track skipped questions", async () => {
      if (!db) return;

      const quizResult = await db.insert(quizzes).values({
        createdById: 1,
        title: "Skip Test",
        totalQuestions: 2,
      });

      const quizId = quizResult[0].insertId;

      const q1 = await db.insert(questions).values({
        quizId,
        questionText: "Q1",
        choices: ["A", "B", "C", "D"],
        correctAnswerIndex: 0,
        orderIndex: 0,
      });

      const attemptResult = await db.insert(quizAttempts).values({
        userId: 1,
        quizId,
        totalQuestions: 2,
        isCompleted: false,
      });

      const attemptId = attemptResult[0].insertId;

      // Skip question (selectedAnswerIndex is null)
      await db.insert(userAnswers).values({
        attemptId,
        questionId: q1[0].insertId,
        selectedAnswerIndex: null,
        isCorrect: false,
      });

      const answer = await db
        .select()
        .from(userAnswers)
        .where(eq(userAnswers.attemptId, attemptId))
        .limit(1);

      expect(answer[0].selectedAnswerIndex).toBeNull();
      expect(answer[0].isCorrect).toBe(false);
    });
  });

  describe("User Progress Tracking", () => {
    it("should retrieve all attempts for a user", async () => {
      if (!db) return;

      const userId = 1;

      // Create multiple attempts
      await db.insert(quizAttempts).values([
        {
          userId,
          quizId: 1,
          totalQuestions: 5,
          isCompleted: true,
          score: "80",
          correctAnswers: 4,
        },
        {
          userId,
          quizId: 2,
          totalQuestions: 5,
          isCompleted: true,
          score: "60",
          correctAnswers: 3,
        },
      ]);

      const attempts = await db
        .select()
        .from(quizAttempts)
        .where(eq(quizAttempts.userId, userId));

      expect(attempts.length).toBeGreaterThanOrEqual(2);
      expect(attempts.every((a) => a.userId === userId)).toBe(true);
    });

    it("should track attempt completion status", async () => {
      if (!db) return;

      const attemptResult = await db.insert(quizAttempts).values({
        userId: 1,
        quizId: 1,
        totalQuestions: 5,
        isCompleted: false,
      });

      const attemptId = attemptResult[0].insertId;

      // Update to completed
      await db
        .update(quizAttempts)
        .set({
          isCompleted: true,
          completedAt: new Date(),
          score: "85",
          correctAnswers: 4,
        })
        .where(eq(quizAttempts.id, attemptId));

      const updated = await db
        .select()
        .from(quizAttempts)
        .where(eq(quizAttempts.id, attemptId))
        .limit(1);

      expect(updated[0].isCompleted).toBe(true);
      expect(updated[0].completedAt).toBeDefined();
      // Score is stored as DECIMAL(5,2) so it includes decimal places
      expect(parseFloat(updated[0].score as string)).toBeCloseTo(85, 1);
    });
  });
});
