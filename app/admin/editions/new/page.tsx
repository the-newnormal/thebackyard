import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin-auth";
import { planDefaults, sgtParts } from "@/lib/editions/plan";
import { eventDateShort } from "@/lib/format";
import { getStore } from "@/lib/registrations";
import { AdminHeader } from "../../admin-header";
import { EditionForm } from "../edition-form";

export const metadata: Metadata = {
  title: "Plan a date",
  robots: { index: false, follow: false },
};

export default function NewEditionPage({ searchParams }: PageProps<"/admin/editions/new">) {
  return (
    <>
      <AdminHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <Link href="/admin/editions" className="text-sm font-semibold text-forest hover:underline">
          ← All dates
        </Link>
        <h1 className="mt-2 font-heading text-3xl text-forest">Plan a date</h1>
        <Suspense fallback={<div className="mt-8 h-96 animate-pulse rounded-2xl bg-forest/10" />}>
          <NewEdition searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

async function NewEdition({ searchParams }: Pick<PageProps<"/admin/editions/new">, "searchParams">) {
  await requireAdmin();
  const { from } = await searchParams;
  const editions = await getStore().listEditions();
  // "Plan next month" copies the latest date; "Copy to next month" a chosen one.
  const source = editions.find((e) => e.slug === from) ?? editions.at(-1) ?? null;

  return (
    <>
      <p className="mt-2 mb-8 text-muted">
        {source
          ? `Copied from ${eventDateShort(source)}: the same slot in the next month without a date, same times, venue and limits. Add a poster after saving.`
          : "Fill in the first date. You can add a poster after saving."}{" "}
        Nothing is public until you publish.
      </p>
      <EditionForm
        initial={planDefaults(
          source,
          new Date(),
          new Set(
            editions.filter((e) => e.status !== "cancelled").map((e) => sgtParts(e.startsAt).date),
          ),
        )}
      />
    </>
  );
}
