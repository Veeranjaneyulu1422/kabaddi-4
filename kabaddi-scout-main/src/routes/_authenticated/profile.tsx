import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { ArrowLeft, LogOut, User as UserIcon, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user, signOut } = useAuth();
  const [form, setForm] = useState({ name: "", team_name: "", position: "", district: "", photo_url: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      if (data) {
        setForm({
          name: data.name ?? "",
          team_name: data.team_name ?? "",
          position: data.position ?? "",
          district: data.district ?? "",
          photo_url: data.photo_url ?? "",
        });
      }
      setLoading(false);
    })();
  }, [user]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: user!.id, ...form, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Profile saved");
  };

  return (
    <div className="px-5 pb-6 pt-12">
      <Link to="/dashboard" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="flex items-center gap-4">
        <div className="flame-gradient flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl">
          {form.photo_url ? (
            <img src={form.photo_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <UserIcon className="h-10 w-10 text-primary-foreground" strokeWidth={2.5} />
          )}
        </div>
        <div>
          <h1 className="font-display text-3xl">{form.name || "Player"}</h1>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      {loading ? (
        <div className="mt-8 h-72 animate-pulse rounded-2xl bg-card" />
      ) : (
        <form onSubmit={save} className="mt-8 space-y-4">
          <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Field label="Team name" value={form.team_name} onChange={(v) => setForm({ ...form, team_name: v })} />
          <Field label="Position" value={form.position} onChange={(v) => setForm({ ...form, position: v })} placeholder="Raider / Defender / All-rounder" />
          <Field label="District" value={form.district} onChange={(v) => setForm({ ...form, district: v })} />
          <Field label="Photo URL" value={form.photo_url} onChange={(v) => setForm({ ...form, photo_url: v })} placeholder="https://…" />

          <button
            type="submit"
            disabled={saving}
            className="flame-gradient flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-bold uppercase tracking-wider text-primary-foreground active:scale-[0.98] disabled:opacity-60"
          >
            <Save className="h-5 w-5" /> Save Profile
          </button>

          <button
            type="button"
            onClick={signOut}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3.5 font-semibold text-destructive"
          >
            <LogOut className="h-5 w-5" /> Sign out
          </button>
        </form>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-border bg-input px-4 py-3.5 outline-none focus:border-primary"
      />
    </div>
  );
}
