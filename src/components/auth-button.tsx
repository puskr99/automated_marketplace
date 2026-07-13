import { auth, signIn, signOut } from "@/auth";
import { Button } from "@/components/ui/button";

export async function AuthButton() {
  const session = await auth();

  if (session?.user) {
    return (
      <form
        action={async () => {
          "use server";
          await signOut();
        }}
        className="flex items-center gap-3"
      >
        <span className="text-sm text-muted-foreground">
          {session.user.email}
        </span>
        <Button type="submit" variant="outline" size="sm">
          Sign out
        </Button>
      </form>
    );
  }

  return (
    <form
      action={async () => {
        "use server";
        await signIn("google");
      }}
    >
      <Button type="submit" size="sm">
        Sign in with Google
      </Button>
    </form>
  );
}
