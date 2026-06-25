import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Loader2, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { toast } from "sonner";

export default function Quiz() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/quiz/:id");
  const quizId = match && params?.id ? parseInt(params.id) : 0;

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<
    Record<number, number | null>
  >({});
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch quiz data
  const { data: quiz, isLoading: quizLoading } = trpc.quiz.getById.useQuery(
    { id: quizId },
    { enabled: quizId > 0 }
  );

  const { data: questions, isLoading: questionsLoading } =
    trpc.quiz.getQuestions.useQuery(
      { quizId },
      { enabled: quizId > 0 }
    );

  // Start attempt
  const startAttemptMutation = trpc.quiz.startAttempt.useMutation();
  const submitAnswerMutation = trpc.quiz.submitAnswer.useMutation();
  const completeAttemptMutation = trpc.quiz.completeAttempt.useMutation();

  // Initialize attempt on mount
  useEffect(() => {
    if (quiz && !attemptId) {
      startAttemptMutation.mutate(
        { quizId },
        {
          onSuccess: (data) => {
            setAttemptId(data.attemptId);
          },
          onError: () => {
            toast.error("Failed to start quiz");
            navigate("/");
          },
        }
      );
    }
  }, [quiz, attemptId, quizId, startAttemptMutation, navigate]);

  const currentQuestion = questions?.[currentQuestionIndex];
  const progress =
    questions && questions.length > 0
      ? ((currentQuestionIndex + 1) / questions.length) * 100
      : 0;

  const handleAnswerSelect = (answerIndex: number) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentQuestion?.id || 0]: answerIndex,
    }));
  };

  const handleNext = async () => {
    if (!currentQuestion || !attemptId) return;

    setIsSubmitting(true);
    try {
      const selectedAnswer = selectedAnswers[currentQuestion.id] ?? null;

      await submitAnswerMutation.mutateAsync({
        attemptId,
        questionId: currentQuestion.id,
        selectedAnswerIndex: selectedAnswer,
      });

      if (currentQuestionIndex < (questions?.length || 0) - 1) {
        setCurrentQuestionIndex((prev) => prev + 1);
      } else {
        // Quiz completed
        await completeAttemptMutation.mutateAsync({ attemptId });
        navigate(`/results/${attemptId}`);
      }
    } catch (error) {
      toast.error("Failed to submit answer");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  if (!match || quizLoading || questionsLoading || !currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      {/* Header */}
      <header className="border-b border-border/40 backdrop-blur-sm sticky top-0 z-50">
        <div className="container py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">{quiz?.title}</h1>
            <Button
              variant="ghost"
              onClick={() => navigate("/")}
              className="gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Exit
            </Button>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>
                Question {currentQuestionIndex + 1} of {questions?.length}
              </span>
              <span>
                {Object.keys(selectedAnswers).length} of {questions?.length}{" "}
                answered
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8 max-w-2xl">
        <Card className="border border-border/40 shadow-lg">
          <div className="p-8 space-y-8">
            {/* Question */}
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold leading-tight">
                {currentQuestion.questionText}
              </h2>
            </div>

            {/* Answer Options */}
            <div className="space-y-3">
              <RadioGroup
                value={
                  selectedAnswers[currentQuestion.id]?.toString() ?? ""
                }
                onValueChange={(value) =>
                  handleAnswerSelect(parseInt(value))
                }
              >
                {currentQuestion.choices.map((choice, index) => (
                  <div
                    key={index}
                    className="flex items-center space-x-3 p-4 rounded-lg border border-border/40 hover:border-accent/40 hover:bg-accent/5 transition-all duration-200 cursor-pointer group"
                  >
                    <RadioGroupItem
                      value={index.toString()}
                      id={`choice-${index}`}
                      className="w-5 h-5"
                    />
                    <Label
                      htmlFor={`choice-${index}`}
                      className="flex-1 cursor-pointer text-base"
                    >
                      {choice}
                    </Label>
                    {selectedAnswers[currentQuestion.id] === index && (
                      <Check className="w-5 h-5 text-accent" />
                    )}
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Navigation */}
            <div className="flex gap-4 justify-between pt-8 border-t border-border/40">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentQuestionIndex === 0 || isSubmitting}
                className="gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>

              <Button
                onClick={handleNext}
                disabled={isSubmitting}
                className="gap-2 px-8"
              >
                {isSubmitting && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                {currentQuestionIndex === (questions?.length || 0) - 1
                  ? "Finish"
                  : "Next"}
                {currentQuestionIndex < (questions?.length || 0) - 1 && (
                  <ChevronRight className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </Card>

        {/* Question Indicator */}
        <div className="mt-8 flex flex-wrap gap-2 justify-center">
          {questions?.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentQuestionIndex(index)}
              className={`w-10 h-10 rounded-lg font-semibold transition-all duration-200 ${
                index === currentQuestionIndex
                  ? "bg-accent text-accent-foreground shadow-md scale-110"
                  : selectedAnswers[questions[index].id] !== undefined
                    ? "bg-accent/20 text-accent border border-accent/40"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {index + 1}
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
