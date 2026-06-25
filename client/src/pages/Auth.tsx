import { FormEvent, useState } from "react";
import { BookOpen, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "login" | "register";

export default function Auth() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const loginMutation = trpc.auth.login.useMutation();
  const registerMutation = trpc.auth.register.useMutation();
  const isSubmitting = loginMutation.isPending || registerMutation.isPending;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      if (mode === "register") {
        await registerMutation.mutateAsync({ name, email, password });
        toast.success("Account created");
      } else {
        await loginMutation.mutateAsync({ email, password });
        toast.success("Signed in");
      }

      await utils.auth.me.invalidate();
      navigate("/");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed");
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center px-4">
      <Card className="w-full max-w-md p-8">
        <div className="flex flex-col items-center gap-3 text-center mb-8">
          <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center">
            <BookOpen className="h-6 w-6 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Quiz Master</h1>
            <p className="text-sm text-muted-foreground">
              {mode === "login" ? "Sign in to continue" : "Create a local account"}
            </p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {mode === "register" ? (
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isSubmitting}
              minLength={mode === "register" ? 8 : undefined}
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {mode === "login" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <Button
          type="button"
          variant="ghost"
          className="w-full mt-4"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
          disabled={isSubmitting}
        >
          {mode === "login" ? "Create an account" : "Use an existing account"}
        </Button>
      </Card>
    </main>
  );
}
