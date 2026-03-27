type Props = {
  message: string;
};

export default function OfferEmptyState({ message }: Props) {
  return (
    <div className="rounded-xl border bg-white p-10 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}
