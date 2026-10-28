"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function useUserId(): string | null | undefined {
  // undefined = still checking, null = signed out
  const [id, setId] = useState<string | null | undefined>(() => (supabase() ? undefined : null));
  useEffect(() => {
    const db = supabase();
    if (!db) return;
    db.auth.getSession().then(({ data }) => setId(data.session?.user.id ?? null));
    const { data } = db.auth.onAuthStateChange((_e, session) => setId(session?.user.id ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  return id;
}

/** The school lives in the account's metadata, so it is set once at sign-up and follows the account. */
export function useSchool(): [string | null | undefined, (school: string) => Promise<void>] {
  const id = useUserId();
  const [fetched, setFetched] = useState<string | null | undefined>(undefined);
  const school = id === null ? null : id ? fetched : undefined;
  useEffect(() => {
    if (!id) return;
    supabase()?.auth.getUser().then(({ data }) => {
      const s = data.user?.user_metadata?.school;
      setFetched(typeof s === "string" && s.trim() ? s : null);
    });
  }, [id]);
  async function save(next: string) {
    try {
      const { error } = await supabase()!.auth.updateUser({ data: { school: next.trim().slice(0, 100) } });
      if (error) throw error;
      setFetched(next.trim().slice(0, 100));
    } catch (err) {
      console.error("[auth] saving school failed:", err);
    }
  }
  return [school, save];
}

function AuthBox() {
  const id = useUserId();
  const [email, setEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", school: "", agreed: false });
  const [msg, setMsg] = useState("");

  useEffect(() => {
    supabase()?.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, [id]);

  if (!supabase() || id === undefined) return null;

  async function submit(mode: "in" | "up") {
    setMsg("");
    try {
      const db = supabase()!;
      if (mode === "up" && form.school.trim().length < 3) throw new Error("Enter your school to create an account.");
      if (mode === "up" && !form.agreed) throw new Error("Please confirm the notice below to create an account.");
      const res = mode === "in"
        ? await db.auth.signInWithPassword({ email: form.email, password: form.password })
        : await db.auth.signUp({ email: form.email, password: form.password, options: { emailRedirectTo: window.location.origin, data: { school: form.school.trim().slice(0, 100) } } });
      if (res.error) throw res.error;
      if (mode === "up" && !res.data.session) setMsg("Check your email to confirm your account, then sign in.");
      else setOpen(false);
    } catch (err) {
      console.error("[auth] failed:", err);
      setMsg(err instanceof Error ? err.message : "Sign-in failed.");
    }
  }

  if (id) {
    return (
      <span className="auth">
        {email ?? "Signed in"} · <button type="button" className="link" onClick={() => supabase()?.auth.signOut()}>Sign out</button>
      </span>
    );
  }
  return (
    <span className="auth">
      <button type="button" className="link" onClick={() => setOpen(!open)} aria-expanded={open}>Sign in to save</button>
      {open && (
        <form className="authform" onSubmit={(e) => { e.preventDefault(); submit("in"); }}>
          <label>Email<input type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
          <label>Password<input type="password" autoComplete="current-password" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label>
          <label>School (new accounts)<input type="text" autoComplete="organization" value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })} placeholder="University of Oregon" /></label>
          <label className="consent">
            <input type="checkbox" checked={form.agreed} onChange={(e) => setForm({ ...form, agreed: e.target.checked })} />
            <span>I understand that when I audit a syllabus, quotes from it, the instructor&rsquo;s name, and where it differs from my school&rsquo;s published policies are recorded in this app&rsquo;s system. Those records are not linked to my account.</span>
          </label>
          <button type="submit">Sign in</button>{" "}
          <button type="button" onClick={() => submit("up")}>Create account</button>
          {msg && <p role="alert" className="warn">{msg}</p>}
        </form>
      )}
    </span>
  );
}

export default function Nav() {
  return (
    <nav className="nav noprint" aria-label="Main">
      <Link href="/">Syllabus audit</Link>
      <Link href="/opportunities">Find funding</Link>
      <Link href="/policies">UO against itself</Link>
      <AuthBox />
    </nav>
  );
}
