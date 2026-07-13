"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RunForm({ workerSlug }: { workerSlug: string }) {
  const [buyerEmail, setBuyerEmail] = useState("");
  const [input, setInput] = useState("{}");
  const [result, setResult] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const parsedInput = JSON.parse(input);
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyerEmail, workerSlug, input: parsedInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "request failed");
      setResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : "something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="buyerEmail">Your email</Label>
        <Input
          id="buyerEmail"
          type="email"
          required
          value={buyerEmail}
          onChange={(e) => setBuyerEmail(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="input">Input JSON</Label>
        <Textarea
          id="input"
          rows={6}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="font-mono text-sm"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Auto-generated forms from the worker&apos;s input schema are on the
          roadmap — for now, paste input matching the schema above.
        </p>
      </div>
      <Button type="submit" disabled={submitting}>
        {submitting ? "Submitting…" : "Run worker"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {result && (
        <pre className="rounded-md border bg-muted p-4 text-xs overflow-auto">
          {result}
        </pre>
      )}
    </form>
  );
}
