"use client";

import { useFormStatus } from "react-dom";

/** Submit button that asks before running a destructive form action. */
export function ConfirmButton({
  confirm,
  children,
  pendingLabel,
  className,
}: {
  confirm: string;
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
      onClick={(e) => {
        if (!window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
