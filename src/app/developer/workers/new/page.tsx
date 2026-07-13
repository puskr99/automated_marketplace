"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const MANIFEST_TEMPLATE = `{
  "name": "PDF Extractor",
  "version": "1.0.0",
  "category": "data-extraction",
  "description": "Extracts structured text and tables from PDFs.",
  "endpoint": {
    "url": "https://api.example.com/extract",
    "method": "POST",
    "timeout_seconds": 60
  },
  "input": {
    "type": "object",
    "required": ["file_url"],
    "properties": {
      "file_url": { "type": "string" }
    }
  },
  "output": {
    "type": "object",
    "properties": {
      "text": { "type": "string" }
    }
  },
  "pricing": {
    "model": "per_call",
    "amount_cents": 50,
    "currency": "usd"
  },
  "trial": { "free_runs": 3 },
  "privacy": {
    "logs_input": false,
    "logs_output": false,
    "retains_data": false,
    "third_party_sharing": false
  },
  "capabilities": ["pdf-parsing"],
  "outcome_policy": "STANDARD"
}`;

export default function NewWorkerPage() {
  const router = useRouter();
  const [developerEmail, setDeveloperEmail] = useState("");
  const [slug, setSlug] = useState("");
  const [readme, setReadme] = useState("");
  const [manifestJson, setManifestJson] = useState(MANIFEST_TEMPLATE);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const manifest = JSON.parse(manifestJson);
      const res = await fetch("/api/workers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ developerEmail, slug, readme, manifest }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error + (data.issues ? `: ${JSON.stringify(data.issues)}` : ""),
        );
      }
      router.push("/developer/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">
        Publish a worker
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Submitting queues the manifest for the verification pipeline
        (documentation, security, benchmark, judge). It goes live once
        approved.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <Label htmlFor="developerEmail">Your email</Label>
          <Input
            id="developerEmail"
            type="email"
            required
            value={developerEmail}
            onChange={(e) => setDeveloperEmail(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="slug">Slug (URL-safe, unique)</Label>
          <Input
            id="slug"
            required
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="pdf-extractor"
          />
        </div>
        <div>
          <Label htmlFor="readme">README</Label>
          <Textarea
            id="readme"
            required
            rows={5}
            value={readme}
            onChange={(e) => setReadme(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="manifest">Manifest JSON</Label>
          <Textarea
            id="manifest"
            rows={20}
            value={manifestJson}
            onChange={(e) => setManifestJson(e.target.value)}
            className="font-mono text-xs"
          />
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Submitting…" : "Submit for verification"}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>
    </div>
  );
}
