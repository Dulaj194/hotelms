import { type ReactNode } from "react";

type Props = {
  title: string;
  description: string;
  action?: ReactNode;
};

export default function OfferPageHeader({ title, description, action }: Props) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{title}</h1>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
        {action && <div className="w-full sm:w-auto lg:shrink-0">{action}</div>}
      </div>
    </div>
  );
}
