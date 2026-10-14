import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { verifyPassword } from "@/lib/password";
import { verifyLoginTicket } from "@/lib/login-ticket";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
        // Vé từ /api/auth/login-check (đã kiểm tra captcha + mật khẩu) → khỏi chạy bcrypt lần 2
        ticket: { type: "hidden" },
      },
      async authorize(credentials) {
        const { prisma } = await import("@/lib/prisma");

        let user;
        if (typeof credentials?.ticket === "string" && credentials.ticket) {
          const userId = verifyLoginTicket(credentials.ticket);
          if (!userId) return null;
          user = await prisma.user.findUnique({ where: { id: userId } });
          if (!user) return null;
        } else {
          if (!credentials?.username || !credentials?.password) return null;
          user = await prisma.user.findUnique({
            where: { username: (credentials.username as string).trim() },
          });
          if (!user) return null;
          if (!(await verifyPassword(credentials.password as string, user.passwordHash))) return null;
        }

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
