import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Home, ChevronRight, CheckCircle, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function History() {
  const [, navigate] = useLocation();
  const { data: attempts, isLoading } = trpc.quiz.getUserAttempts.useQuery({});

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      {/* Header */}
      <header className="border-b border-border/40 backdrop-blur-sm sticky top-0 z-50">
        <div className="container py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Quiz History</h1>
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
      <main className="container py-12">
        <div className="space-y-8">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold">Your Quiz Attempts</h2>
            <p className="text-muted-foreground">
              Review your past quiz attempts and progress
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
            </div>
          ) : attempts && attempts.length > 0 ? (
            <div className="space-y-4">
              {attempts.map((attempt: any) => {
                const score = attempt.score ? parseFloat(attempt.score as string) : 0;
                const isPassed = score >= 70;
                const completedAt = attempt.completedAt
                  ? new Date(attempt.completedAt)
                  : null;

                return (
                  <Card
                    key={attempt.id}
                    className="border border-border/40 hover:shadow-lg transition-all duration-300"
                  >
                    <div className="p-6 flex items-center justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                          {isPassed ? (
                            <CheckCircle className="w-5 h-5 text-accent flex-shrink-0" />
                          ) : (
                            <XCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                          )}
                          <h3 className="text-lg font-semibold">
                            {attempt.quizTitle}
                          </h3>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>
                            {attempt.correctAnswers} of {attempt.totalQuestions}{" "}
                            correct
                          </span>
                          {completedAt && (
                            <span>
                              {formatDistanceToNow(completedAt, {
                                addSuffix: true,
                              })}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-3xl font-bold text-accent">
                            {Math.round(score)}%
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {isPassed ? "Passed" : "Needs work"}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/results/${attempt.id}`)}
                          className="gap-2"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg mb-4">
                No quiz attempts yet. Start taking quizzes!
              </p>
              <Button onClick={() => navigate("/")}>Browse Quizzes</Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
