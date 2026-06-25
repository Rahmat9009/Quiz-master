import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Upload, Trash2, Eye, EyeOff, Plus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLocation } from "wouter";

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [quizTitle, setQuizTitle] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // All hooks must be called before any conditional returns
  const { data: quizzes, isLoading, refetch } = trpc.admin.getAdminQuizzes.useQuery();
  const uploadPDFMutation = trpc.admin.uploadPDF.useMutation();
  const parsePDFMutation = trpc.admin.parsePDF.useMutation();
  const publishMutation = trpc.admin.publishQuiz.useMutation();
  const deleteMutation = trpc.admin.deleteQuiz.useMutation();

  // Redirect if not authenticated
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <div className="text-center space-y-4">
          <p className="text-lg text-muted-foreground">
            Please log in to create quizzes
          </p>
          <Button onClick={() => navigate("/")}>Back to Home</Button>
        </div>
      </div>
    );
  }

  const handleUpload = async () => {
    if (!uploadFile || !quizTitle.trim()) {
      toast.error("Please select a file and enter a quiz title");
      return;
    }

    setIsUploading(true);
    try {
      const buffer = await uploadFile.arrayBuffer();
      const result = await uploadPDFMutation.mutateAsync({
        fileName: uploadFile.name,
        fileData: arrayBufferToBase64(buffer),
        quizTitle: quizTitle.trim(),
      });

      try {
        await parsePDFMutation.mutateAsync({
          quizId: result.quizId,
          fileUrl: result.url,
          fileName: uploadFile.name,
        });
        toast.success("Quiz created successfully!");
      } catch (parseError) {
        console.warn("Document parsing skipped:", parseError);
        toast.warning(
          parseError instanceof Error
            ? parseError.message
            : "Quiz created, but document parsing is not configured."
        );
      }
      setUploadFile(null);
      setQuizTitle("");
      setIsUploadDialogOpen(false);
      refetch();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to upload quiz"
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handlePublish = async (quizId: number) => {
    try {
      await publishMutation.mutateAsync({ quizId });
      toast.success("Quiz published!");
      refetch();
    } catch (error) {
      toast.error("Failed to publish quiz");
    }
  };

  const handleDelete = async (quizId: number) => {
    if (!confirm("Are you sure you want to delete this quiz?")) return;

    try {
      await deleteMutation.mutateAsync({ quizId });
      toast.success("Quiz deleted!");
      refetch();
    } catch (error) {
      toast.error("Failed to delete quiz");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      {/* Header */}
      <header className="border-b border-border/40 backdrop-blur-sm sticky top-0 z-50">
        <div className="container py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate("/conductor")}
            >
              Conduct Test
            </Button>
            <Button
              onClick={() => setIsUploadDialogOpen(true)}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              New Quiz
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-12">
        <div className="space-y-8">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold">Your Quizzes</h2>
            <p className="text-muted-foreground">
              Manage and publish your quizzes
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
            </div>
          ) : quizzes && quizzes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {quizzes.map((quiz) => (
                <Card
                  key={quiz.id}
                  className="border border-border/40 hover:shadow-lg transition-all duration-300"
                >
                  <div className="p-6 space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-lg font-semibold flex-1">
                          {quiz.title}
                        </h3>
                        {quiz.isPublished && (
                          <span className="px-2 py-1 text-xs font-semibold bg-accent/10 text-accent rounded-full">
                            Published
                          </span>
                        )}
                      </div>
                      {quiz.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {quiz.description}
                        </p>
                      )}
                    </div>

                    <div className="text-sm text-muted-foreground">
                      {quiz.totalQuestions} questions
                    </div>

                    <div className="flex gap-2 pt-4 border-t border-border/40">
                      {!quiz.isPublished && (
                        <Button
                          size="sm"
                          onClick={() => handlePublish(quiz.id)}
                          className="flex-1 gap-2"
                        >
                          <Eye className="w-4 h-4" />
                          Publish
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(quiz.id)}
                        className="gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg mb-4">
                No quizzes yet. Create your first quiz!
              </p>
              <Button onClick={() => setIsUploadDialogOpen(true)}>
                Create Quiz
              </Button>
            </div>
          )}
        </div>
      </main>

      {/* Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Quiz from PDF</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="quiz-title">Quiz Title</Label>
              <Input
                id="quiz-title"
                placeholder="Enter quiz title"
                value={quizTitle}
                onChange={(e) => setQuizTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pdf-file">PDF File</Label>
              <div className="border-2 border-dashed border-border/40 rounded-lg p-6 text-center cursor-pointer hover:border-accent/40 transition-colors">
                <input
                  id="pdf-file"
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                />
                <label
                  htmlFor="pdf-file"
                  className="flex flex-col items-center gap-2 cursor-pointer"
                >
                  <Upload className="w-8 h-8 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {uploadFile ? uploadFile.name : "Click to upload PDF"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    or drag and drop
                  </span>
                </label>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setIsUploadDialogOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={isUploading || !uploadFile || !quizTitle.trim()}
                className="flex-1 gap-2"
              >
                {isUploading && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Quiz
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
