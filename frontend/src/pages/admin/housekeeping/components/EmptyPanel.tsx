export default function EmptyPanel({
  message,
  compact = false,
}: {
  message: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-dashed border-gray-200 text-center text-gray-400 ${
        compact ? "py-6 text-sm" : "py-10 text-sm"
      }`}
    >
      {message}
    </div>
  );
}
