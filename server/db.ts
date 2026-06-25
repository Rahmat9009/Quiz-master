import { eq, and, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { randomUUID } from "node:crypto";
import { InsertUser, users, quizzes, questions, quizAttempts, userAnswers } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.email && user.email === ENV.ownerEmail) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function createLocalUser(input: {
  name: string;
  email: string;
  passwordHash: string;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const email = input.email.trim().toLowerCase();
  const result = await db.insert(users).values({
    openId: `local:${randomUUID()}`,
    name: input.name.trim(),
    email,
    passwordHash: input.passwordHash,
    loginMethod: "password",
    role: ENV.ownerEmail && email === ENV.ownerEmail.toLowerCase() ? "admin" : "user",
    lastSignedIn: new Date(),
  });

  const id = result[0].insertId;
  const user = await getUserById(id);
  if (!user) {
    throw new Error("Failed to create user");
  }

  return user;
}

export async function touchUserLastSignedIn(id: number) {
  const db = await getDb();
  if (!db) return;

  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, id));
}

// Quiz query helpers
export async function getPublishedQuizzes() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(quizzes).where(eq(quizzes.isPublished, true));
}

export async function getQuizById(quizId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(quizzes).where(eq(quizzes.id, quizId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getQuestionsByQuizId(quizId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(questions).where(eq(questions.quizId, quizId)).orderBy(questions.orderIndex);
}

export async function getUserQuizAttempts(userId: number, quizId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  const baseQuery = db.select({
    id: quizAttempts.id,
    userId: quizAttempts.userId,
    quizId: quizAttempts.quizId,
    quizTitle: quizzes.title,
    startedAt: quizAttempts.startedAt,
    completedAt: quizAttempts.completedAt,
    isCompleted: quizAttempts.isCompleted,
    score: quizAttempts.score,
    totalQuestions: quizAttempts.totalQuestions,
    correctAnswers: quizAttempts.correctAnswers,
    createdAt: quizAttempts.createdAt,
  }).from(quizAttempts).innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id));
  
  if (quizId) {
    return baseQuery.where(and(eq(quizAttempts.userId, userId), eq(quizAttempts.quizId, quizId))).orderBy(desc(quizAttempts.completedAt));
  }
  
  return baseQuery.where(eq(quizAttempts.userId, userId)).orderBy(desc(quizAttempts.completedAt));
}

export async function getAttemptWithAnswers(attemptId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const attempt = await db.select().from(quizAttempts).where(eq(quizAttempts.id, attemptId)).limit(1);
  if (attempt.length === 0) return undefined;
  
  const answers = await db.select().from(userAnswers).where(eq(userAnswers.attemptId, attemptId));
  return { ...attempt[0], answers };
}

// Import new tables
import { testInvitations, testSessions } from "../drizzle/schema";

// Test invitation helpers
export async function getTestInvitationByEmail(quizId: number, email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(testInvitations).where(and(eq(testInvitations.quizId, quizId), eq(testInvitations.studentEmail, email))).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getTestInvitationsForQuiz(quizId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(testInvitations).where(eq(testInvitations.quizId, quizId)).orderBy(desc(testInvitations.invitedAt));
}

export async function getStudentTestInvitations(studentEmail: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(testInvitations).where(eq(testInvitations.studentEmail, studentEmail)).orderBy(desc(testInvitations.invitedAt));
}

// Test session helpers
export async function getTestSessionsForQuiz(quizId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(testSessions).where(eq(testSessions.quizId, quizId)).orderBy(desc(testSessions.startedAt));
}

export async function getActiveTestSession(quizId: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(testSessions).where(and(eq(testSessions.quizId, quizId), eq(testSessions.userId, userId), eq(testSessions.isCompleted, false))).limit(1);
  return result.length > 0 ? result[0] : undefined;
}
