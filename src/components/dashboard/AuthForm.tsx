"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, registerAction, demoLoginAction, type FormState } from "@/app/actions/auth";

export function AuthForm({ mode, demo, notice }: { mode: "login" | "register"; demo: boolean; notice?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(mode === "login" ? loginAction : registerAction, undefined);
  return (
    <div className="w-full max-w-sm space-y-4">
      <form action={action} className="card space-y-1" aria-busy={pending}>
        <h1 className="font-display text-2xl">{mode === "login" ? "Masuk ke WeddingOS" : "Buat akun pengantin"}</h1>
        {notice && <p className="text-sm" style={{ color: "var(--app-danger)" }}>{notice}</p>}
        {mode === "register" && (<><label className="label" htmlFor="name">Nama Anda</label><input id="name" name="name" className="input" required minLength={2} autoComplete="name" /></>)}
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" className="input" required autoComplete="email" />
        <label className="label" htmlFor="password">Kata sandi</label>
        <input id="password" name="password" type="password" className="input" required minLength={mode === "register" ? 8 : 1} autoComplete={mode === "login" ? "current-password" : "new-password"} />
        <p role="alert" aria-live="polite" className="text-sm min-h-5" style={{ color: "var(--app-danger)" }}>{state?.error}</p>
        <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Memproses…" : mode === "login" ? "Masuk" : "Daftar gratis"}</button>
        <p className="text-sm muted pt-2">
          {mode === "login" ? <>Belum punya akun? <Link href="/register" className="underline">Daftar</Link></> : <>Sudah punya akun? <Link href="/login" className="underline">Masuk</Link></>}
        </p>
        <p className="text-xs muted">Magic link & Google OAuth belum diaktifkan pada build ini (lihat docs/DECISIONS.md).</p>
      </form>
      {demo && mode === "login" && (
        <div className="card space-y-2">
          <p className="text-sm font-medium">Mode Demo</p>
          <form action={demoLoginAction.bind(null, "demo")}><button className="btn w-full">Masuk sebagai demo (pengantin)</button></form>
          <form action={demoLoginAction.bind(null, "admin")}><button className="btn w-full">Masuk sebagai Super Admin</button></form>
        </div>
      )}
    </div>
  );
}
