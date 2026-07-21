"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Send, Paperclip, Download, Loader2, Gift, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatSc } from "@/lib/currency";
import type { InputShape, OutputShape } from "@/lib/manifest-ui";

type JobDTO = {
  id: string;
  input: unknown;
  output: unknown;
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "REFUNDED";
  errorMessage: string | null;
  createdAt: string;
  escrowTransaction: { id: string } | null;
};

function base64ToBlobUrl(base64: string, mimeType: string): string {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}

function guessMimeType(fileName: string | undefined): string {
  const ext = fileName?.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    txt: "text/plain",
  };
  return (ext && map[ext]) ?? "application/octet-stream";
}

// Blob URLs are a browser-only concept (Node's `URL.createObjectURL`, where
// it exists at all, produces incompatible identifiers) — creating one
// during SSR causes a hydration mismatch. This defers creation to a client
// effect, which is the correct tool here (not a mount-detection workaround):
// it's allocating a real browser resource tied to `base64`, with a matching
// cleanup, exactly the "external system" case effects exist for.
function FileDownload({
  base64,
  mimeType,
  fileName,
}: {
  base64: string;
  mimeType: string;
  fileName?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const objectUrl = base64ToBlobUrl(base64, mimeType);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- allocating a browser Blob URL, not derivable synchronously
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [base64, mimeType]);

  if (!url) {
    return <p className="text-sm text-muted-foreground">Preparing download…</p>;
  }
  return (
    <a
      href={url}
      download={fileName ?? "download"}
      className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm hover:bg-muted"
    >
      <Download className="size-4" />
      {fileName ?? "Download result"}
    </a>
  );
}

function InputPreview({
  input,
  inputShape,
}: {
  input: unknown;
  inputShape: InputShape;
}) {
  if (inputShape.kind === "structured" || typeof input !== "object" || input === null) {
    return (
      <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(input, null, 2)}</pre>
    );
  }
  const value = (input as Record<string, unknown>)[inputShape.fieldName];
  if (inputShape.kind === "file") {
    return (
      <div className="flex items-center gap-1.5">
        <Paperclip className="size-3.5 shrink-0" />
        <span className="truncate text-sm">{String(value)}</span>
      </div>
    );
  }
  return <p className="text-sm">{String(value)}</p>;
}

function OutputBubble({
  job,
  outputShape,
}: {
  job: JobDTO;
  outputShape: OutputShape;
}) {
  if (job.status === "PENDING" || job.status === "RUNNING") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Running…
      </div>
    );
  }

  if (job.status === "FAILED" || job.status === "REFUNDED") {
    return (
      <p className="text-sm text-destructive">
        {job.errorMessage ?? "This run failed."}
        {job.status === "REFUNDED" && " You were refunded automatically."}
      </p>
    );
  }

  const output = job.output as Record<string, unknown> | null;
  if (!output) return <p className="text-sm text-muted-foreground">No output.</p>;

  if (outputShape.kind === "file") {
    const base64 = output[outputShape.fileField];
    const fileName = outputShape.fileNameField
      ? (output[outputShape.fileNameField] as string | undefined)
      : undefined;
    if (typeof base64 !== "string") {
      return <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(output, null, 2)}</pre>;
    }
    return (
      <FileDownload base64={base64} mimeType={guessMimeType(fileName)} fileName={fileName} />
    );
  }

  return (
    <dl className="space-y-1 text-sm">
      {Object.entries(output).map(([key, value]) => (
        <div key={key} className="flex gap-2">
          <dt className="shrink-0 text-muted-foreground capitalize">
            {key.replace(/_/g, " ")}:
          </dt>
          <dd>{String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ChatRunner({
  workerSlug,
  amountCents,
  freeRunsAllowed,
  inputShape,
  outputShape,
  initialJobs,
  initialFreeRunsUsed,
}: {
  workerSlug: string;
  amountCents: number;
  freeRunsAllowed: number;
  inputShape: InputShape;
  outputShape: OutputShape;
  initialJobs: JobDTO[];
  initialFreeRunsUsed: number;
}) {
  const [jobs, setJobs] = useState<JobDTO[]>(initialJobs);
  const [freeRunsUsed, setFreeRunsUsed] = useState(initialFreeRunsUsed);
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insufficientCredits, setInsufficientCredits] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const freeRunsRemaining = Math.max(0, freeRunsAllowed - freeRunsUsed);
  const isFreeTrial = freeRunsRemaining > 0;

  function buildInput(): unknown {
    if (inputShape.kind === "structured") return JSON.parse(value);
    return { [inputShape.fieldName]: value };
  }

  async function pollJob(jobId: string) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < 90_000) {
      await new Promise((r) => setTimeout(r, 1500));
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) return;
      const { job } = await res.json();
      setJobs((prev) => prev.map((j) => (j.id === jobId ? job : j)));
      if (job.status === "SUCCEEDED" || job.status === "FAILED" || job.status === "REFUNDED") {
        return;
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim() || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const input = buildInput();

      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerSlug, input }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 402 && data.insufficientCredits) {
          setInsufficientCredits(true);
        }
        throw new Error(data.error ?? "request failed");
      }

      const optimisticJob: JobDTO = {
        id: data.jobId,
        input,
        output: null,
        status: "PENDING",
        errorMessage: null,
        createdAt: new Date().toISOString(),
        escrowTransaction: isFreeTrial ? null : { id: "credits" },
      };
      setJobs((prev) => [...prev, optimisticJob]);
      if (isFreeTrial) setFreeRunsUsed((n) => n + 1);
      setValue("");
      setInsufficientCredits(false);

      await pollJob(data.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && inputShape.kind !== "structured") {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  }

  return (
    <div className="flex flex-col">
      <div className="max-h-[28rem] space-y-4 overflow-y-auto rounded-md border bg-muted/20 p-4">
        {jobs.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No runs yet — try it out below.
          </p>
        )}
        {jobs.map((job) => (
          <div key={job.id} className="space-y-2">
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-lg bg-primary px-3 py-2 text-primary-foreground">
                <InputPreview input={job.input} inputShape={inputShape} />
              </div>
            </div>
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-lg border bg-background px-3 py-2">
                <OutputBubble job={job} outputShape={outputShape} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-3 space-y-2">
        <div className="flex items-end gap-2">
          <Textarea
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              inputShape.kind === "file"
                ? "Paste a public file URL…"
                : inputShape.kind === "structured"
                  ? "Input JSON matching the schema above…"
                  : "Message…"
            }
            rows={inputShape.kind === "structured" ? 6 : 2}
            className={inputShape.kind === "structured" ? "font-mono text-xs" : undefined}
          />
          <Button type="submit" disabled={submitting || !value.trim()} size="icon">
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          {isFreeTrial ? (
            <span className="flex items-center gap-1">
              <Gift className="size-3.5" />
              {freeRunsRemaining} free run{freeRunsRemaining === 1 ? "" : "s"} left
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Coins className="size-3.5" />
              Free trial used — {formatSc(amountCents)} per run
            </span>
          )}
        </div>
        {error && (
          <p className="text-sm text-destructive">
            {error}
            {insufficientCredits && (
              <>
                {" "}
                <Link href="/credits" className="underline">
                  Top up credits
                </Link>
                .
              </>
            )}
          </p>
        )}
      </form>
    </div>
  );
}
