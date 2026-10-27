"use client";

import { useActionState } from "react";
import { ConfirmButton } from "@/components/confirm-button";
import { sendReminders } from "./actions";

/** "Email reminder": one email to each confirmed sign-up, sent when pressed. */
export function ReminderForm({ slug, guests }: { slug: string; guests: number }) {
  const [state, action] = useActionState(sendReminders, {});
  const failed = state.failed ?? [];
  return (
    // `contents`, so the result wraps under the dashboard's buttons.
    <form action={action} className="contents">
      <input type="hidden" name="slug" value={slug} />
      <ConfirmButton
        confirm={`Email a reminder to ${guests} confirmed ${guests === 1 ? "guest" : "guests"} now, with their code and pass? Pressing this again sends it again.`}
        pendingLabel="Sending…"
        className="btn btn-outline px-4 py-2 text-sm"
      >
        Email reminder
      </ConfirmButton>
      {state.error && (
        <p role="alert" className="basis-full text-sm font-semibold text-red">
          {state.error}
        </p>
      )}
      {state.sent !== undefined && (
        <p role="status" className="basis-full text-sm font-semibold text-forest">
          {state.sent > 0
            ? `Reminder sent to ${state.sent} ${state.sent === 1 ? "guest" : "guests"}.`
            : "No reminders went out."}
          {failed.length > 0 && (
            <span className="text-red">
              {" "}
              Didn’t go to {failed.join(", ")}, so message {failed.length === 1 ? "them" : "those"}{" "}
              yourself.
            </span>
          )}
        </p>
      )}
    </form>
  );
}
