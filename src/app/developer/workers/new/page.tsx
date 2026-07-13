import { auth, signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { NewWorkerForm } from "./new-worker-form";

export default async function NewWorkerPage() {
  const session = await auth();

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

      {session?.user ? (
        <NewWorkerForm />
      ) : (
        <form
          action={async () => {
            "use server";
            await signIn("google");
          }}
          className="mt-8"
        >
          <p className="mb-3 text-sm text-muted-foreground">
            Sign in to publish a worker under your developer account.
          </p>
          <Button type="submit">Sign in with Google</Button>
        </form>
      )}
    </div>
  );
}
