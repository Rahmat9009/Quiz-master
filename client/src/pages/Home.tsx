import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Upload, BookOpen, Users, Clock } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useState } from "react";

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

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [quizTitle, setQuizTitle] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [isUploading, setIsUploading] = useState(false);

  const uploadPDFMutation = trpc.admin.uploadPDF.useMutation();
  const parsePDFMutation = trpc.admin.parsePDF.useMutation();

  const handleUpload = async () => {
    if (!uploadFile || !quizTitle.trim()) {
      toast.error("Please select a file and enter a quiz title");
      return;
    }

    setIsUploading(true);
    try {
      // Use FormData to send file as multipart/form-data
      // This avoids base64 encoding overhead
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("quizTitle", quizTitle.trim());
      formData.append("durationMinutes", durationMinutes.toString());

      // For now, convert to base64 with size check
      const buffer = await uploadFile.arrayBuffer();
      const base64String = arrayBufferToBase64(buffer);

      // Check size before sending
      if (base64String.length > 50 * 1024 * 1024) {
        toast.error("File is too large. Maximum size is 50MB.");
        setIsUploading(false);
        return;
      }

      // Upload PDF
      const uploadResult = await uploadPDFMutation.mutateAsync({
        fileName: uploadFile.name,
        fileData: base64String,
        quizTitle: quizTitle.trim(),
        durationMinutes: durationMinutes,
      });

      toast.success("Document uploaded. Extracting questions...");

      try {
        const parseResult = await parsePDFMutation.mutateAsync({
          quizId: uploadResult.quizId,
          fileUrl: uploadResult.url,
          fileName: uploadFile.name,
        });
        toast.success(`Quiz created with ${parseResult.questionCount} questions!`);
      } catch (parseError) {
        console.warn("Document parsing skipped:", parseError);
        toast.warning(
          parseError instanceof Error
            ? parseError.message
            : "Quiz created, but document parsing is not configured."
        );
      }

      // Reset form
      setUploadFile(null);
      setQuizTitle("");
      setDurationMinutes(30);
      setIsUploadDialogOpen(false);

      // Navigate to admin dashboard
      navigate("/admin");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      {/* Header */}
      <header className="border-b border-border/40 backdrop-blur-sm sticky top-0 z-50">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-accent" />
            <h1 className="text-2xl font-bold">Quiz Master</h1>
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <>
                <span className="text-sm text-muted-foreground">Welcome, {user.name}</span>
                <Button
                  variant="outline"
                  onClick={() => navigate("/admin")}
                >
                  Admin Dashboard
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("/history")}
                >
                  History
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/")}
                >
                  ↗
                </Button>
              </>
            )}
            {!user && (
              <Button onClick={() => navigate("/login")}>
                Sign in
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-16">
        <div className="space-y-12">
          {/* Hero Section */}
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-4xl md:text-5xl font-bold">Create Your Quiz</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Upload a PDF with questions and answers to create an interactive quiz
            </p>
          </div>

          {/* Upload Card */}
          <Card className="border-2 border-dashed border-accent/30 hover:border-accent/60 transition-colors p-12 text-center cursor-pointer"
            onClick={() => user ? setIsUploadDialogOpen(true) : navigate("/login")}
          >
            <div className="space-y-4">
              <Upload className="w-16 h-16 text-accent mx-auto" />
              <div className="space-y-2">
                <h3 className="text-2xl font-bold">Upload Your PDF</h3>
                <p className="text-muted-foreground">
                  Supports PDF and DOCX files with questions and answers
                </p>
              </div>
              <Button className="mx-auto">
                Choose File & Create Quiz
              </Button>
            </div>
          </Card>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <Card className="p-6 space-y-4">
              <BookOpen className="w-8 h-8 text-accent" />
              <h3 className="text-xl font-bold">Smart Extraction</h3>
              <p className="text-muted-foreground">
                AI automatically extracts questions, answers, and explanations from your PDFs
              </p>
            </Card>

            <Card className="p-6 space-y-4">
              <Users className="w-8 h-8 text-accent" />
              <h3 className="text-xl font-bold">Invite Students</h3>
              <p className="text-muted-foreground">
                Send test invitations via email to your students
              </p>
            </Card>

            <Card className="p-6 space-y-4">
              <Clock className="w-8 h-8 text-accent" />
              <h3 className="text-xl font-bold">Timed Tests</h3>
              <p className="text-muted-foreground">
                Set custom time limits and monitor real-time progress
              </p>
            </Card>
          </div>
        </div>
      </main>

      {/* Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Quiz from PDF</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* File Input */}
            <div className="space-y-2">
              <Label htmlFor="file-input">Select PDF or DOCX File</Label>
              <Input
                id="file-input"
                type="file"
                accept=".pdf,.docx"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                disabled={isUploading}
              />
              {uploadFile && (
                <p className="text-sm text-muted-foreground">
                  Selected: {uploadFile.name} ({(uploadFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>

            {/* Quiz Title */}
            <div className="space-y-2">
              <Label htmlFor="quiz-title">Quiz Title</Label>
              <Input
                id="quiz-title"
                placeholder="e.g., Biology Midterm"
                value={quizTitle}
                onChange={(e) => setQuizTitle(e.target.value)}
                disabled={isUploading}
              />
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                min="1"
                max="180"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 30)}
                disabled={isUploading}
              />
            </div>

            {/* Upload Button */}
            <Button
              onClick={handleUpload}
              disabled={!uploadFile || !quizTitle.trim() || isUploading}
              className="w-full gap-2"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Create Quiz
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
