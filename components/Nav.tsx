"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function useUserId(): string | null | undefined {
  // undefined = still checking, null = signed out
  const [id, setId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    const db = supabase();
    if (!db) {
      setId(null);
      return;
    }
    db.auth.getSession().then(({ data }) => setId(data.session?.user.id ?? null));
    const { data } = db.auth.onAuthStateChange((_e, session) => setId(session?.user.id ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  return id;
}

function AuthBox() {
  const id = useUserId();
  const [email, setEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const [msg, setMsg] = useState("");

  useEffect(() => {
    supabase()?.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, [id]);

  if (!supabase() || id === undefined) return null;

  async function submit(mode: "in" | "up") {
    setMsg("");
    try {
      const db = supabase()!;
      const res = mode === "in"
        ? await db.auth.signInWithPassword({ email: form.email, password: form.password })
        : await db.auth.signUp({ email: form.email, password: form.password });
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
      <AuthBox />
    </nav>
  );
}
