"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

// Isolated loading/error/mode state on purpose — same reasoning as
// GoogleButton and PhoneForm: nothing here should ever block the other
// two sign-in methods on the same page.
export default function EmailPasswordForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setConfirmSent(false);
    setLoading(true);

    if (mode === "signIn") {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (signInError) {
        setError(signInError.message.includes("Invalid login credentials") ? t("errorInvalidCredentials") : t("errorGeneric"));
        return;
      }
      router.push("/");
      router.refresh();
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message.includes("already registered") ? t("errorEmailInUse") : t("errorGeneric"));
      return;
    }
    if (data.session) {
      // Email confirmation is disabled on this Supabase project — signed in immediately.
      router.push("/");
      router.refresh();
      return;
    }
    setConfirmSent(true);
  }

  if (confirmSent) {
    return <p className="rounded-lg bg-sky-pale px-4 py-3 text-sm text-navy-dark">{t("confirmEmailSent", { email })}</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-sm font-medium text-navy-dark/80">
          {t("emailLabel")}
        </label>
        <input
          id="email"
          type="email"
          required
          dir="ltr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("emailPlaceholder")}
          className="w-full rounded-lg border border-navy-dark/15 bg-white px-4 py-3 text-start text-navy-dark placeholder:text-navy-dark/30 focus:border-sky focus:outline-none focus:ring-2 focus:ring-sky/30"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="password" className="text-sm font-medium text-navy-dark/80">
          {t("passwordLabel")}
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={6}
          dir="ltr"
          autoComplete={mode === "signIn" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("passwordPlaceholder")}
          className="w-full rounded-lg border border-navy-dark/15 bg-white px-4 py-3 text-start text-navy-dark placeholder:text-navy-dark/30 focus:border-sky focus:outline-none focus:ring-2 focus:ring-sky/30"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-navy px-4 py-3 font-medium text-base transition-colors hover:bg-navy-dark disabled:opacity-50"
      >
        {loading ? (mode === "signIn" ? t("signingIn") : t("signingUp")) : mode === "signIn" ? t("signIn") : t("signUp")}
      </button>

      <button
        type="button"
        onClick={() => {
          setMode(mode === "signIn" ? "signUp" : "signIn");
          setError(null);
        }}
        className="text-sm text-navy underline-offset-4 hover:underline"
      >
        {mode === "signIn" ? t("toggleToSignUp") : t("toggleToSignIn")}
      </button>
    </form>
  );
}
