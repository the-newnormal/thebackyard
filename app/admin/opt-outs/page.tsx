import type { Metadata } from "next";
import { Suspense } from "react";
import { ConfirmButton } from "@/components/confirm-button";
import { series } from "@/content/series";
import { requireAdmin } from "@/lib/admin-auth";
import { formatTimestamp } from "@/lib/format";
import { getStore } from "@/lib/registrations";
import { AdminHeader } from "../admin-header";
import { removeOptOut } from "../actions";
import { OptOutForm } from "./opt-out-form";

export const metadata: Metadata = {
  title: "Opt-outs",
  robots: { index: false, follow: false },
};

export default function OptOutsPage() {
  return (
    <>
      <AdminHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-2xl bg-forest/10" />}>
          <OptOuts />
        </Suspense>
      </main>
    </>
  );
}

async function OptOuts() {
  await requireAdmin();
  const optOuts = await getStore().listOptOuts();
  return (
    <>
      <h1 className="font-heading text-3xl text-forest">Opt-outs</h1>
      <p className="mt-1 max-w-xl text-muted">
        Everyone who registers agrees to updates. When someone emails{" "}
        {series.contact.dpo || "the Data Protection Officer"} to opt out, add their email address
        or mobile number here. They’re left out of “Want updates” and the CSV’s wants_updates
        column on every date, including any they sign up for later, until you remove them.
      </p>

      <OptOutForm />

      <h2 className="mt-10 font-bold text-forest">Opted out ({optOuts.length})</h2>
      {optOuts.length ? (
        <ul className="mt-3 divide-y-2 divide-forest/10 overflow-hidden rounded-2xl border-2 border-forest/15 bg-card">
          {optOuts.map((o) => (
            <li key={o.contact} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-semibold text-ink [overflow-wrap:anywhere]">{o.contact}</p>
                <p className="text-sm text-muted">since {formatTimestamp(o.createdAt)}</p>
              </div>
              <form action={removeOptOut}>
                <input type="hidden" name="contact" value={o.contact} />
                <ConfirmButton
                  confirm={`Send updates to ${o.contact} again? Only do this if they’ve asked in writing.`}
                  className="rounded-full px-3 py-2 text-sm font-semibold text-muted hover:text-red"
                >
                  Remove
                </ConfirmButton>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-2xl border-2 border-dashed border-forest/20 p-6 text-muted">
          Nobody has opted out yet.
        </p>
      )}
    </>
  );
}
