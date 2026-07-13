import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// JWT sessions, no database adapter: our own User table is the source of
// truth for app data (jobs, workers, reviews), and API routes upsert a User
// row by session email the same way they already did before auth existed —
// this just makes that email verified instead of client-supplied.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  trustHost: true,
});
