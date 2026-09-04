import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import VerifyForm from "./VerifyForm";

export default async function VerifyPage() {
  const t = await getTranslations("auth");

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <h1 className="font-heading text-3xl text-navy-dark">{t("verifyTitle")}</h1>
      </div>
      <div className="rounded-2xl border border-sky/20 bg-white/60 p-8 shadow-sm">
        <Suspense fallback={null}>
          <VerifyForm />
        </Suspense>
      </div>
    </div>
  );
}
