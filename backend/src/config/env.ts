import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  REDIS_URL: z.string().optional(),
  CORS_ORIGINS: z.string().optional(),
  PORT: z
    .string()
    .optional()
    .default("5000")
    .transform((value) => Number(value))
    .refine((value) => Number.isInteger(value) && value > 0, "PORT must be a valid number"),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const issues = parsedEnv.error.issues
    .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
    .join(", ");

  throw new Error(`Invalid environment configuration: ${issues}`);
}

const parseOrigins = (value: string | undefined): string[] => {
  if (!value) return ["http://localhost:5173", "http://localhost:3000"];

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
};

export const env = {
  ...parsedEnv.data,
  corsOrigins: parseOrigins(parsedEnv.data.CORS_ORIGINS),
};
