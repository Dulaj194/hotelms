type Props = {
  tone: "success" | "error" | "warning";
  message: string;
};

export default function OfferNotice({ tone, message }: Props) {
  const toneClasses =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-rose-200 bg-rose-50 text-rose-700";

  return <div className={`rounded-lg border p-4 text-sm ${toneClasses}`}>{message}</div>;
}
