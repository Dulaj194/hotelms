export default function NoticeBox({
  tone,
  message,
  onClose,
}: {
  tone: "success" | "error";
  message: string;
  onClose: () => void;
}) {
  const toneClass =
    tone === "success"
      ? "border-green-200 bg-green-50 text-green-700"
      : "border-red-200 bg-red-50 text-red-700";

  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${toneClass}`}
    >
      <p className="leading-6">{message}</p>
      <button
        type="button"
        onClick={onClose}
        className="app-btn-compact border border-current/20 bg-white/60 text-current hover:bg-white"
      >
        Close
      </button>
    </div>
  );
}
