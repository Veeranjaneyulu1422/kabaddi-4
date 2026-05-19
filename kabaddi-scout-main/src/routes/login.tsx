import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth-context";
import { Flame, Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) navigate({ to: "/dashboard" });
  }, [session, navigate]);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast.success("Account created! Check your email if confirmation is required.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      toast.error(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message || "Google sign-in failed");
        setLoading(false);
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err.message || "Google sign-in failed");
      setLoading(false);
    }
  };

  return (
    <div className="arena-gradient min-h-dvh px-6 pb-10 pt-12">
      <Link to="/" className="font-display text-2xl text-flame">← KABADDI·ARENA</Link>

      <div className="mt-10">
        <div className="flame-gradient mb-5 flex h-14 w-14 items-center justify-center rounded-2xl">
          <Flame className="h-8 w-8 text-primary-foreground" strokeWidth={2.5} />
        </div>
        <h1 className="font-display text-4xl">
          {mode === "signup" ? "Join the Arena" : "Welcome Back"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "signup" ? "Create your player profile" : "Sign in to track your matches"}
        </p>
      </div>

      <button
        onClick={handleGoogle}
        disabled={loading}
        className="mt-8 flex w-full items-center justify-center gap-3 rounded-2xl border border-border bg-card py-3.5 font-semibold active:scale-[0.98] disabled:opacity-50"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5"><path fill="#fff" d="M21.35 11.1h-9.17v2.84h5.49c-.24 1.5-1.7 4.4-5.49 4.4-3.3 0-6-2.74-6-6.12s2.7-6.12 6-6.12c1.88 0 3.13.8 3.85 1.49l2.62-2.53C16.99 3.6 14.83 2.6 12.18 2.6c-5.27 0-9.55 4.27-9.55 9.55s4.28 9.55 9.55 9.55c5.51 0 9.16-3.87 9.16-9.32 0-.62-.07-1.1-.16-1.58z"/></svg>
        Continue with Google
      </button>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs uppercase tracking-wider text-muted-foreground">or email</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleEmail} className="space-y-3">
        {mode === "signup" && (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full rounded-2xl border border-border bg-input px-4 py-3.5 text-base outline-none focus:border-primary"
            required
          />
        )}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="email"
          className="w-full rounded-2xl border border-border bg-input px-4 py-3.5 text-base outline-none focus:border-primary"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          minLength={6}
          className="w-full rounded-2xl border border-border bg-input px-4 py-3.5 text-base outline-none focus:border-primary"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="flame-gradient flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-bold uppercase tracking-wider text-primary-foreground shadow-lg shadow-primary/30 active:scale-[0.98] disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mail className="h-5 w-5" />}
          {mode === "signup" ? "Create Account" : "Sign In"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="mt-5 w-full text-center text-sm text-muted-foreground"
      >
        {mode === "signin" ? "New player? " : "Already have an account? "}
        <span className="font-semibold text-primary">
          {mode === "signin" ? "Create one" : "Sign in"}
        </span>
      </button>
    </div>
  );
}
