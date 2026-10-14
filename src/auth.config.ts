import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  providers: [], // Providers will be added in auth.ts for Node context
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = (user as any).username;
        token.role = (user as any).role || "USER";
        token.email = (user as any).email || null;
        token.isEmailVerified = (user as any).isEmailVerified ?? true;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        (session.user as any).username = token.username;
        (session.user as any).role = token.role;
        (session.user as any).email = token.email;
        (session.user as any).isEmailVerified = token.isEmailVerified;
        (session.user as any).isAdmin =
          token.username === "qy286" || token.role === "ADMIN";
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
} satisfies NextAuthConfig;
