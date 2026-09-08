'use client';

interface PrintButtonProps {
  label?: string;
  className?: string;
}

export default function PrintButton({
  label = 'Print',
  className = 'bg-black text-white text-xs font-semibold px-4 py-1.5 rounded shadow hover:bg-neutral-800 cursor-pointer',
}: PrintButtonProps) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={className}
    >
      {label}
    </button>
  );
}
