import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const t = await getTranslations("auth");

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <h1 className="font-heading text-3xl text-navy-dark">{t("loginTitle")}</h1>
        <p className="mt-2 text-navy-dark/60">{t("loginSubtitle")}</p>
      </div>
      <div className="rounded-2xl border border-sky/20 bg-white/60 p-8 shadow-sm">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
