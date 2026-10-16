import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-3xl border-2 border-forest bg-card p-8 shadow-[8px_8px_0_var(--color-forest)]">
        <Link href="/" className="font-display text-3xl text-forest">
          BACKYARD
        </Link>
        <h1 className="mt-2 font-serif text-2xl text-muted italic">organiser dashboard</h1>
        <LoginForm />
      </div>
    </main>
  );
}
