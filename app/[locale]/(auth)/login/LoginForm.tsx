"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import GoogleButton from "./GoogleButton";
import EmailPasswordForm from "./EmailPasswordForm";
import PhoneForm from "./PhoneForm";

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 text-xs text-navy-dark/40">
      <span className="h-px flex-1 bg-navy-dark/10" />
      {label}
      <span className="h-px flex-1 bg-navy-dark/10" />
    </div>
  );
}

export default function LoginForm() {
  const t = useTranslations("auth");
  const searchParams = useSearchParams();
  const oauthFailed = searchParams.get("error") === "auth_failed";

  return (
    <div className="flex flex-col gap-6">
      {oauthFailed && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{t("errorOAuth")}</p>}

      <GoogleButton />
      <Divider label={t("or")} />
      <EmailPasswordForm />
      <Divider label={t("or")} />
      <PhoneForm />
    </div>
  );
}
