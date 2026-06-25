import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, json, decimal } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const quizzes = mysqlTable("quizzes", {
  id: int("id").autoincrement().primaryKey(),
  createdById: int("createdById").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  isPublished: boolean("isPublished").default(false).notNull(),
  totalQuestions: int("totalQuestions").default(0).notNull(),
  quizType: mysqlEnum("quizType", ["personal", "test"]).default("personal").notNull(),
  durationMinutes: int("durationMinutes"), // Optional: quiz duration in minutes
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Quiz = typeof quizzes.$inferSelect;
export type InsertQuiz = typeof quizzes.$inferInsert;

export const questions = mysqlTable("questions", {
  id: int("id").autoincrement().primaryKey(),
  quizId: int("quizId").notNull(),
  questionText: text("questionText").notNull(),
  choices: json("choices").$type<string[]>().notNull(),
  correctAnswerIndex: int("correctAnswerIndex").notNull(),
  explanation: text("explanation"),
  orderIndex: int("orderIndex").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Question = typeof questions.$inferSelect;
export type InsertQuestion = typeof questions.$inferInsert;

export const quizAttempts = mysqlTable("quizAttempts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  quizId: int("quizId").notNull(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  isCompleted: boolean("isCompleted").default(false).notNull(),
  score: decimal("score", { precision: 5, scale: 2 }),
  totalQuestions: int("totalQuestions").notNull(),
  correctAnswers: int("correctAnswers").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type QuizAttempt = typeof quizAttempts.$inferSelect;
export type InsertQuizAttempt = typeof quizAttempts.$inferInsert;

export const userAnswers = mysqlTable("userAnswers", {
  id: int("id").autoincrement().primaryKey(),
  attemptId: int("attemptId").notNull(),
  questionId: int("questionId").notNull(),
  selectedAnswerIndex: int("selectedAnswerIndex"),
  isCorrect: boolean("isCorrect").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UserAnswer = typeof userAnswers.$inferSelect;
export type InsertUserAnswer = typeof userAnswers.$inferInsert;

export const pdfUploads = mysqlTable("pdfUploads", {
  id: int("id").autoincrement().primaryKey(),
  uploadedById: int("uploadedById").notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileKey: varchar("fileKey", { length: 255 }).notNull(),
  quizId: int("quizId"),
  status: mysqlEnum("status", ["pending", "parsing", "completed", "failed"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PdfUpload = typeof pdfUploads.$inferSelect;
export type InsertPdfUpload = typeof pdfUploads.$inferInsert;

export const testInvitations = mysqlTable("testInvitations", {
  id: int("id").autoincrement().primaryKey(),
  quizId: int("quizId").notNull(),
  studentEmail: varchar("studentEmail", { length: 320 }).notNull(),
  studentId: int("studentId"),
  status: mysqlEnum("status", ["pending", "accepted", "completed", "expired"]).default("pending").notNull(),
  invitedAt: timestamp("invitedAt").defaultNow().notNull(),
  acceptedAt: timestamp("acceptedAt"),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TestInvitation = typeof testInvitations.$inferSelect;
export type InsertTestInvitation = typeof testInvitations.$inferInsert;

export const testSessions = mysqlTable("testSessions", {
  id: int("id").autoincrement().primaryKey(),
  quizId: int("quizId").notNull(),
  userId: int("userId").notNull(),
  invitationId: int("invitationId"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  completedAt: timestamp("completedAt"),
  isCompleted: boolean("isCompleted").default(false).notNull(),
  score: decimal("score", { precision: 5, scale: 2 }),
  totalQuestions: int("totalQuestions").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TestSession = typeof testSessions.$inferSelect;
export type InsertTestSession = typeof testSessions.$inferInsert;

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  quizzes: many(quizzes),
  quizAttempts: many(quizAttempts),
  pdfUploads: many(pdfUploads),
  testSessions: many(testSessions),
}));

export const quizzesRelations = relations(quizzes, ({ one, many }) => ({
  createdBy: one(users, { fields: [quizzes.createdById], references: [users.id] }),
  questions: many(questions),
  attempts: many(quizAttempts),
  invitations: many(testInvitations),
  sessions: many(testSessions),
}));

export const questionsRelations = relations(questions, ({ one, many }) => ({
  quiz: one(quizzes, { fields: [questions.quizId], references: [quizzes.id] }),
  userAnswers: many(userAnswers),
}));

export const quizAttemptsRelations = relations(quizAttempts, ({ one, many }) => ({
  user: one(users, { fields: [quizAttempts.userId], references: [users.id] }),
  quiz: one(quizzes, { fields: [quizAttempts.quizId], references: [quizzes.id] }),
  answers: many(userAnswers),
}));

export const userAnswersRelations = relations(userAnswers, ({ one }) => ({
  attempt: one(quizAttempts, { fields: [userAnswers.attemptId], references: [quizAttempts.id] }),
  question: one(questions, { fields: [userAnswers.questionId], references: [questions.id] }),
}));

export const pdfUploadsRelations = relations(pdfUploads, ({ one }) => ({
  uploadedBy: one(users, { fields: [pdfUploads.uploadedById], references: [users.id] }),
  quiz: one(quizzes, { fields: [pdfUploads.quizId], references: [quizzes.id] }),
}));

export const testInvitationsRelations = relations(testInvitations, ({ one }) => ({
  quiz: one(quizzes, { fields: [testInvitations.quizId], references: [quizzes.id] }),
  student: one(users, { fields: [testInvitations.studentId], references: [users.id] }),
}));

export const testSessionsRelations = relations(testSessions, ({ one, many }) => ({
  quiz: one(quizzes, { fields: [testSessions.quizId], references: [quizzes.id] }),
  user: one(users, { fields: [testSessions.userId], references: [users.id] }),
  invitation: one(testInvitations, { fields: [testSessions.invitationId], references: [testInvitations.id] }),
  answers: many(userAnswers),
}));
