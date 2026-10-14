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

        // Tự động gán quyền ADMIN và xác thực email cho tài khoản qy286 nếu chưa có
        let userRole = user.role;
        let isVerified = user.isEmailVerified;

        if (user.username === "qy286") {
          if (user.role !== "ADMIN" || !user.isEmailVerified) {
            await prisma.user.update({
              where: { id: user.id },
              data: { role: "ADMIN", isEmailVerified: true },
            });
            userRole = "ADMIN";
            isVerified = true;
          }
        }

        // Kiểm tra xác thực email (Trừ tài khoản qy286 hoặc Admin)
        if (user.username !== "qy286" && userRole !== "ADMIN" && !isVerified) {
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
