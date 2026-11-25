import { z } from "zod";

const contact = z.string().trim().max(191).transform((value) => {
  if (value.includes("@")) return value.toLowerCase();

  const phone = value.replace(/[\s()-]/g, "");
  if (/^0[789][01]\d{8}$/.test(phone)) return "+234" + phone.slice(1);
  if (/^234\d{10}$/.test(phone)) return "+" + phone;
  return /^\d+$/.test(phone) ? "+" + phone : phone;
}).refine((value) => (
  value.includes("@") ? z.email().safeParse(value).success : /^\+[1-9]\d{9,14}$/.test(value)
), "Enter a valid email or phone number.");

const password = z.string().min(1, "Password is required.").refine(
  (value) => new TextEncoder().encode(value).byteLength <= 72,
  "Password must be 72 bytes or fewer.",
);

export const loginSchema = z.object({ emailOrPhone: contact, password });
export const signupSchema = loginSchema.extend({
  name: z.string().trim().min(2, "Enter your name or nickname.").max(100, "Name must be 100 characters or fewer."),
  password: password.refine((value) => value.length >= 8, "Password must be at least 8 characters."),
});

export type AuthUser = { id: number; name: string; role: "USER" | "ADMIN" };
