"use client";

import { useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";

const subscribe = () => () => {};

/** True once React has hydrated; false in the server render. */
function useHydrated() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

/**
 * Submit button for forms. With `confirm`, it asks before running a
 * destructive action, and stays disabled until hydrated so a tap on a slow
 * phone can't skip the question.
 */
export function SubmitButton({
  confirm,
  children,
  pendingLabel,
  className,
}: {
  confirm?: string;
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  const hydrated = useHydrated();
  return (
    <button
      type="submit"
      disabled={pending || (confirm !== undefined && !hydrated)}
      className={className}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

/** A SubmitButton that always asks first. */
export function ConfirmButton(props: Parameters<typeof SubmitButton>[0] & { confirm: string }) {
  return <SubmitButton {...props} />;
}
