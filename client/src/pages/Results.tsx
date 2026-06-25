import { useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle, Home } from "lucide-react";

export default function Results() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/results/:id");
  const attemptId = match && params?.id ? parseInt(params.id) : 0;

  const { data: results, isLoading } = trpc.quiz.getAttemptResults.useQuery(
    { attemptId },
    { enabled: attemptId > 0 }
  );

  const attempt = results?.attempt;

  const { data: quiz } = trpc.quiz.getById.useQuery(
    { id: attempt?.quizId || 0 },
    { enabled: !!attempt?.quizId }
  );

  const { data: questions } = trpc.quiz.getQuestions.useQuery(
    { quizId: attempt?.quizId || 0 },
    { enabled: !!attempt?.quizId }
  );

  const score = attempt?.score ? parseFloat(attempt.score as string) : 0;
  const percentage = Math.round(score);
  const isPassed = percentage >= 70;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <div className="text-center space-y-4">
          <p className="text-lg text-muted-foreground">Results not found</p>
          <Button onClick={() => navigate("/")}>Back to Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      {/* Header */}
      <header className="border-b border-border/40 backdrop-blur-sm sticky top-0 z-50">
        <div className="container py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Quiz Results</h1>
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="gap-2"
          >
            <Home className="w-4 h-4" />
            Home
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-12 max-w-2xl">
        <div className="space-y-8">
          {/* Score Card */}
          <Card className="border border-border/40 shadow-lg overflow-hidden">
            <div className="p-8 space-y-6">
              {/* Title */}
              <div className="space-y-2">
                <h2 className="text-3xl font-bold">{quiz?.title}</h2>
                <p className="text-muted-foreground">Quiz completed</p>
              </div>

              {/* Score Circle */}
              <div className="flex justify-center py-8">
                <div className="relative w-48 h-48 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-accent/10 to-accent/5" />
                  <div className="text-center space-y-2">
                    <div className="text-6xl font-bold text-accent">
                      {percentage}%
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {attempt.correctAnswers} of {attempt.totalQuestions}{" "}
                      correct
                    </div>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center justify-center gap-3 py-4 px-6 rounded-lg bg-accent/10 border border-accent/20">
                {isPassed ? (
                  <>
                    <CheckCircle className="w-6 h-6 text-accent" />
                    <span className="font-semibold text-accent">
                      Passed! Great job!
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-6 h-6 text-destructive" />
                    <span className="font-semibold text-destructive">
                      Keep practicing!
                    </span>
                  </>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 pt-4">
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-2xl font-bold text-accent">
                    {attempt.correctAnswers}
                  </div>
                  <div className="text-sm text-muted-foreground">Correct</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-2xl font-bold text-destructive">
                    {attempt.totalQuestions - attempt.correctAnswers}
                  </div>
                  <div className="text-sm text-muted-foreground">Incorrect</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-2xl font-bold">
                    {attempt.totalQuestions}
                  </div>
                  <div className="text-sm text-muted-foreground">Total</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Detailed Review */}
          {questions && results?.answers && (
            <div className="space-y-4">
              <h3 className="text-2xl font-semibold">Review Your Answers</h3>

              {questions.map((question, index) => {
                const userAnswer = results.answers.find(
                  (a: any) => a.questionId === question.id
                );
                const isCorrect = userAnswer?.isCorrect;

                return (
                  <Card
                    key={question.id}
                    className={`border transition-all duration-200 ${
                      isCorrect
                        ? "border-accent/40 bg-accent/5"
                        : "border-destructive/40 bg-destructive/5"
                    }`}
                  >
                    <div className="p-6 space-y-4">
                      {/* Question */}
                      <div className="flex gap-3">
                        {isCorrect ? (
                          <CheckCircle className="w-6 h-6 text-accent flex-shrink-0 mt-1" />
                        ) : (
                          <XCircle className="w-6 h-6 text-destructive flex-shrink-0 mt-1" />
                        )}
                        <div className="space-y-2 flex-1">
                          <p className="font-semibold text-base">
                            {index + 1}. {question.questionText}
                          </p>
                        </div>
                      </div>

                      {/* Choices */}
                      <div className="space-y-2 ml-9">
                        {question.choices.map((choice, choiceIndex) => {
                          const isSelected =
                            userAnswer?.selectedAnswerIndex === choiceIndex;
                          const isCorrectAnswer =
                            choiceIndex === question.correctAnswerIndex;

                          return (
                            <div
                              key={choiceIndex}
                              className={`p-3 rounded-lg border transition-all ${
                                isCorrectAnswer
                                  ? "border-accent/40 bg-accent/10"
                                  : isSelected && !isCorrect
                                    ? "border-destructive/40 bg-destructive/10"
                                    : "border-border/40 bg-muted/30"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">
                                  {String.fromCharCode(65 + choiceIndex)}.
                                </span>
                                <span className="text-sm">{choice}</span>
                                {isCorrectAnswer && (
                                  <span className="ml-auto text-xs font-semibold text-accent">
                                    ✓ Correct
                                  </span>
                                )}
                                {isSelected && !isCorrect && (
                                  <span className="ml-auto text-xs font-semibold text-destructive">
                                    ✗ Your answer
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Explanation */}
                      {question.explanation && (
                        <div className="ml-9 p-4 rounded-lg bg-muted/50 border border-border/40">
                          <p className="text-sm font-semibold mb-2">
                            Explanation:
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {question.explanation}
                          </p>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4 justify-center pt-8">
            <Button
              variant="outline"
              onClick={() => navigate("/")}
              className="gap-2"
            >
              <Home className="w-4 h-4" />
              Back to Home
            </Button>
            <Button onClick={() => navigate("/")} className="gap-2">
              Take Another Quiz
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
