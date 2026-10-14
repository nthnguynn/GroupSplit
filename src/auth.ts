import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const { prisma } = await import("@/lib/prisma");

        const usernameStr = (credentials.username as string).trim();
        const user = await prisma.user.findUnique({
          where: { username: usernameStr },
        });

        if (!user) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isValid) return null;

        // Quyền Admin chỉ dựa vào cột role trong DB (không hardcode username)
        const userRole = user.role;
        const isVerified = user.isEmailVerified;

        // Kiểm tra xác thực email (Admin được miễn)
        if (userRole !== "ADMIN" && !isVerified) {
          throw new Error("UNVERIFIED_EMAIL");
        }

        return {
          id: user.id,
          name: user.displayName,
          username: user.username,
          image: user.avatar,
          role: userRole,
          email: user.email,
          isEmailVerified: isVerified,
        } as any;
      },
    }),
  ],
});
