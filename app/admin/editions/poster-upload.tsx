"use client";

import { useState, useTransition } from "react";
import type { Poster } from "@/lib/editions/types";
import { uploadPoster } from "./actions";

const MAX_EDGE = 1600;
const MAX_BYTES = 900_000;

/**
 * Shrinks a photo in the browser before upload: at most 1600px on the long
 * edge, saved as JPEG under 900KB. Redrawing it also drops the photo's
 * metadata (location included).
 */
async function shrink(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#fff"; // JPEG has no transparency.
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  for (let quality = 0.85; quality >= 0.4; quality -= 0.15) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (blob && blob.size <= MAX_BYTES) return { blob, width, height };
  }
  throw new Error("Still too big after shrinking");
}

export function PosterUpload({ slug, poster }: { slug: string; poster: Poster | null }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const send = (data: FormData) =>
    startTransition(async () => {
      data.set("slug", slug);
      const result = await uploadPoster(data);
      setError(result.error ?? null);
    });

  return (
    <div className="flex flex-col gap-5 sm:flex-row">
      <div className="w-40 shrink-0">
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element -- a small admin preview
          <img
            src={poster.src}
            width={poster.width}
            height={poster.height}
            alt="Current poster"
            className="h-auto w-full rounded-lg bg-forest shadow-md"
          />
        ) : (
          <div className="grid aspect-[4/5] place-items-center rounded-lg border-2 border-dashed border-forest/30 p-3 text-center text-sm text-muted">
            No poster yet. The site shows a date card instead.
          </div>
        )}
      </div>
      <div className="space-y-3">
        <p className="text-muted">
          A portrait image works best (the current one is 4:5). Photos are shrunk before
          upload, so any size is fine.
        </p>
        <label className={`btn btn-primary cursor-pointer px-5 py-3 ${pending ? "opacity-60" : ""}`}>
          {pending ? "Uploading…" : poster ? "Replace poster" : "Upload poster"}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={pending}
            onChange={async (event) => {
              const input = event.currentTarget;
              const file = input.files?.[0];
              input.value = "";
              if (!file) return;
              setError(null);
              try {
                const { blob, width, height } = await shrink(file);
                const data = new FormData();
                data.set("poster", blob, "poster.jpg");
                data.set("width", String(width));
                data.set("height", String(height));
                send(data);
              } catch {
                setError("We couldn’t read that image. Try a JPG or PNG.");
              }
            }}
          />
        </label>
        {poster && (
          <button
            type="button"
            disabled={pending}
            className="ml-3 text-sm font-semibold text-muted underline underline-offset-4 hover:text-red"
            onClick={() => {
              if (!window.confirm("Remove the poster? The site will show a date card instead.")) return;
              const data = new FormData();
              data.set("intent", "remove");
              send(data);
            }}
          >
            Remove
          </button>
        )}
        {error && (
          <p role="alert" className="text-sm font-semibold text-red">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
