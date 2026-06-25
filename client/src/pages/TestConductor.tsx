import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useState } from "react";
import { Mail, Users, Clock, Play, Trash2 } from "lucide-react";
import { useLocation } from "wouter";

export default function TestConductor() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [selectedQuiz, setSelectedQuiz] = useState<number | null>(null);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [studentEmails, setStudentEmails] = useState("");
  const [testTitle, setTestTitle] = useState("");
  const [testDuration, setTestDuration] = useState(30);
  const [isInviting, setIsInviting] = useState(false);

  // Fetch admin's quizzes
  const { data: quizzes = [], isLoading: quizzesLoading } = trpc.admin.getAdminQuizzes.useQuery();
  
  // Fetch test invitations for selected quiz
  const { data: invitations = [] } = trpc.admin.getTestInvitations.useQuery(
    { quizId: selectedQuiz || 0 },
    { enabled: !!selectedQuiz }
  );

  // Fetch test sessions for monitoring
  const { data: sessions = [] } = trpc.admin.getTestSessions.useQuery(
    { quizId: selectedQuiz || 0 },
    { enabled: !!selectedQuiz }
  );

  const inviteStudentsMutation = trpc.admin.inviteStudents.useMutation();
  const startTestMutation = trpc.admin.startTest.useMutation();
  const deleteTestMutation = trpc.admin.deleteTest.useMutation();

  const handleInviteStudents = async () => {
    if (!selectedQuiz || !studentEmails.trim()) {
      toast.error("Please select a quiz and enter student emails");
      return;
    }

    const emails = studentEmails
      .split(/[,\n]/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    if (emails.length === 0) {
      toast.error("Please enter at least one email address");
      return;
    }

    setIsInviting(true);
    try {
      await inviteStudentsMutation.mutateAsync({
        quizId: selectedQuiz,
        studentEmails: emails,
        testTitle: testTitle || "Test Invitation",
        durationMinutes: testDuration,
      });

      toast.success(`Invited ${emails.length} student(s) to the test!`);
      setStudentEmails("");
      setTestTitle("");
      setTestDuration(30);
      setIsInviteDialogOpen(false);
    } catch (error) {
      console.error("Invitation error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to invite students");
    } finally {
      setIsInviting(false);
    }
  };

  const handleStartTest = async (quizId: number) => {
    try {
      await startTestMutation.mutateAsync({ quizId });
      toast.success("Test started! Students can now begin.");
    } catch (error) {
      console.error("Start test error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to start test");
    }
  };

  const handleDeleteTest = async (quizId: number) => {
    if (!confirm("Are you sure you want to delete this test?")) return;

    try {
      await deleteTestMutation.mutateAsync({ quizId });
      toast.success("Test deleted");
      setSelectedQuiz(null);
    } catch (error) {
      console.error("Delete test error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete test");
    }
  };

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <Card className="p-8 text-center space-y-4">
          <h2 className="text-2xl font-bold">Access Denied</h2>
          <p className="text-muted-foreground">Only admins can conduct tests</p>
          <Button onClick={() => navigate("/")}>Go Home</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      {/* Header */}
      <header className="border-b border-border/40 backdrop-blur-sm sticky top-0 z-50">
        <div className="container py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Test Conductor</h1>
          <Button variant="outline" onClick={() => navigate("/")}>
            Back
          </Button>
        </div>
      </header>

      <main className="container py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Quiz List */}
          <div className="lg:col-span-1">
            <h2 className="text-xl font-semibold mb-4">Your Quizzes</h2>
            <div className="space-y-2">
              {quizzesLoading ? (
                <p className="text-muted-foreground">Loading quizzes...</p>
              ) : quizzes.length === 0 ? (
                <p className="text-muted-foreground">No quizzes yet. Create one first!</p>
              ) : (
                quizzes.map((quiz) => (
                  <Card
                    key={quiz.id}
                    className={`p-4 cursor-pointer transition-all ${
                      selectedQuiz === quiz.id
                        ? "ring-2 ring-accent bg-accent/10"
                        : "hover:bg-muted"
                    }`}
                    onClick={() => setSelectedQuiz(quiz.id)}
                  >
                    <h3 className="font-semibold truncate">{quiz.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {quiz.totalQuestions} questions • {quiz.durationMinutes || 30} min
                    </p>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Test Details */}
          <div className="lg:col-span-2">
            {!selectedQuiz ? (
              <Card className="p-8 text-center space-y-4">
                <h3 className="text-lg font-semibold">Select a Quiz</h3>
                <p className="text-muted-foreground">Choose a quiz from the list to conduct a test</p>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Test Info */}
                <Card className="p-6 space-y-4">
                  <h3 className="text-lg font-semibold">Test Information</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">Duration</Label>
                      <p className="text-lg font-medium">
                        {quizzes.find((q) => q.id === selectedQuiz)?.durationMinutes || 30} minutes
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Questions</Label>
                      <p className="text-lg font-medium">
                        {quizzes.find((q) => q.id === selectedQuiz)?.totalQuestions || 0}
                      </p>
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => setIsInviteDialogOpen(true)}
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Invite Students
                  </Button>
                </Card>

                {/* Invitations */}
                <Card className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Student Invitations ({invitations.length})
                    </h3>
                  </div>
                  {invitations.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      No invitations sent yet
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {invitations.map((inv) => (
                        <div key={inv.id} className="flex items-center justify-between p-3 bg-muted rounded">
                          <div>
                            <p className="font-medium text-sm">{inv.studentEmail}</p>
                            <p className="text-xs text-muted-foreground">
                              Status: {inv.status}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                {/* Active Sessions */}
                <Card className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      Active Sessions ({sessions.filter((s) => !s.isCompleted).length})
                    </h3>
                  </div>
                  {sessions.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      No active sessions
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {sessions.map((session) => (
                        <div
                          key={session.id}
                          className="flex items-center justify-between p-3 bg-muted rounded"
                        >
                          <div>
                            <p className="font-medium text-sm">
                              {session.isCompleted ? "✓ Completed" : "● In Progress"}
                            </p>
                            {session.score && (
                              <p className="text-xs text-muted-foreground">
                                Score: {session.score.toString()}%
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => handleStartTest(selectedQuiz)}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Start Test
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleDeleteTest(selectedQuiz)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Invite Dialog */}
      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Students to Test</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="test-title">Test Title (optional)</Label>
              <Input
                id="test-title"
                placeholder="e.g., Biology Midterm"
                value={testTitle}
                onChange={(e) => setTestTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                min="5"
                max="180"
                value={testDuration}
                onChange={(e) => setTestDuration(parseInt(e.target.value) || 30)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="emails">Student Emails</Label>
              <Textarea
                id="emails"
                placeholder="Enter emails separated by commas or new lines&#10;student1@example.com&#10;student2@example.com"
                value={studentEmails}
                onChange={(e) => setStudentEmails(e.target.value)}
                rows={5}
              />
            </div>

            <Button
              className="w-full"
              onClick={handleInviteStudents}
              disabled={isInviting || !studentEmails.trim()}
            >
              {isInviting ? "Sending..." : "Send Invitations"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
