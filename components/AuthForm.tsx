"use client";

import { useState } from "react";
import { Coffee, Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Mode = "login" | "signup";

export default function AuthForm() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // If session is null, email confirmation is required
        if (!data.session) setConfirmSent(true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error desconegut";
      setError(
        msg === "Invalid login credentials"
          ? "Correu o contrasenya incorrectes."
          : msg === "User already registered"
          ? "Aquest correu ja té un compte. Prova d'accedir."
          : msg
      );
    } finally {
      setLoading(false);
    }
  };

  if (confirmSent) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl max-w-sm w-full p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="font-bold text-stone-800 text-xl mb-2">Confirma el teu correu</h2>
          <p className="text-stone-500 text-sm leading-relaxed">
            T'hem enviat un correu a <strong>{email}</strong>. Fes clic a l'enllaç per activar el teu compte.
          </p>
          <button
            onClick={() => { setConfirmSent(false); setMode("login"); }}
            className="mt-6 text-sm text-amber-700 hover:text-amber-900 font-medium"
          >
            Tornar a accedir
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Branding */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-amber-900 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-900/30">
            <Coffee className="w-8 h-8 text-amber-100" />
          </div>
          <h1 className="font-black text-stone-800 text-3xl tracking-tight">BeanRecipe</h1>
          <p className="text-stone-500 text-sm mt-1">El teu quadern de barista digital</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          {/* Tab switcher */}
          <div className="flex border-b border-stone-100">
            {(["login", "signup"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(null); }}
                className={`flex-1 py-4 text-sm font-bold transition-colors ${
                  mode === m
                    ? "text-amber-800 border-b-2 border-amber-800"
                    : "text-stone-400 hover:text-stone-600"
                }`}
              >
                {m === "login" ? "Accedir" : "Registrar-te"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Email */}
            <div>
              <label className="text-sm font-medium text-stone-600 block mb-1.5">
                Correu electrònic
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@exemple.com"
                  className="w-full pl-10 pr-4 py-3 border border-stone-200 rounded-xl text-stone-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-stone-300"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-sm font-medium text-stone-600 block mb-1.5">
                Contrasenya
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  type={showPw ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínim 6 caràcters"
                  className="w-full pl-10 pr-11 py-3 border border-stone-200 rounded-xl text-stone-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-stone-300"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2.5 bg-red-50 border border-red-100 rounded-xl px-3.5 py-3">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-800 text-white rounded-xl py-3.5 font-bold text-sm hover:bg-amber-900 transition-colors disabled:opacity-60 mt-2 shadow-md shadow-amber-800/20"
            >
              {loading
                ? "Carregant..."
                : mode === "login"
                ? "Accedir"
                : "Crear compte"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-stone-400 mt-5">
          Les teves dades s'emmagatzemen de forma segura a Supabase.
        </p>
      </div>
    </div>
  );
}
