import jwt from "jsonwebtoken";
import { UserPayload } from "../types/authTypes";

const JWT_SECRET: any =
  process.env.JWT_SECRET || "fallback-secret-change-in-production";
const JWT_EXPIRES_IN: any = process.env.JWT_EXPIRES_IN || "7d";

export const generateToken = (payload: UserPayload): string => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
};

export const verifyToken = (token: string): UserPayload => {
  return jwt.verify(token, JWT_SECRET) as UserPayload;
};

export const generateRefreshToken = (payload: UserPayload): string => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: "30d", // Longer expiry for refresh token
  });
};
