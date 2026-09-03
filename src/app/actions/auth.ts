"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import {
  comparePassword,
  hashPassword,
  setSessionCookie,
  clearSessionCookie,
  signToken,
} from "@/lib/auth";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

export interface AuthResponse {
  success?: boolean;
  error?: string;
}

export async function registerAction(formData: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const email = formData.email?.trim().toLowerCase();
  const password = formData.password;

  if (!email || !email.includes("@")) {
    return { error: "Por favor, informe um e-mail válido." };
  }

  if (!password || password.length < 6) {
    return { error: "A senha deve ter pelo menos 6 caracteres." };
  }

  try {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing.length > 0) {
      return { error: "Este e-mail já está cadastrado. Tente entrar." };
    }

    const passwordHash = await hashPassword(password);
    const now = new Date();

    const [newUser] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        createdAt: now,
        lastLoginAt: now,
      })
      .returning({ id: users.id, email: users.email });

    const token = await signToken({
      userId: newUser.id,
      email: newUser.email,
    });

    await setSessionCookie(token);

    return { success: true };
  } catch (err: unknown) {
    console.error("Erro no registro:", err);
    return { error: "Ocorreu um erro ao criar a conta. Tente novamente." };
  }
}

export async function loginAction(formData: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const email = formData.email?.trim().toLowerCase();
  const password = formData.password;

  if (!email || !password) {
    return { error: "Preencha e-mail e senha." };
  }

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      return { error: "E-mail ou senha incorretos." };
    }

    const isValid = await comparePassword(password, user.passwordHash);
    if (!isValid) {
      return { error: "E-mail ou senha incorretos." };
    }

    // Atualiza lastLoginAt
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));

    const token = await signToken({
      userId: user.id,
      email: user.email,
    });

    await setSessionCookie(token);

    return { success: true };
  } catch (err: unknown) {
    console.error("Erro no login:", err);
    return { error: "Ocorreu um erro ao entrar. Tente novamente." };
  }
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
