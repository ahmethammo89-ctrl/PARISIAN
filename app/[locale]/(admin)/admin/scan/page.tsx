import ScanClient from "./ScanClient";

export default async function ScanPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  return <ScanClient initialCode={code ?? ""} />;
}
