import { Request, Response } from "express";
import { prisma } from "../../db/db";
import { comparePassword } from "../../utils/passwords";
import { generateToken, generateRefreshToken } from "../../utils/jwt";
import { LoginInput, loginSchema } from "../../validator/authValidator";
import { UserPayload } from "../../types/authTypes";

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData: LoginInput = loginSchema.parse(req.body);
    const { email, password } = validatedData;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      res.status(401).json({
        message: "Invalid email or password",
      });
      return;
    }

    // Verify password
    const isPasswordValid = await comparePassword(
      password,
      user.password || ""
    );

    if (!isPasswordValid) {
      res.status(401).json({
        message: "Invalid email or password",
      });
      return;
    }

    // Generate tokens
    const userPayload: UserPayload = {
      id: user.id,
      username: user.username,
      email: user.email,
    };

    const accessToken = generateToken(userPayload);
    const refreshToken = generateRefreshToken(userPayload);

    res.status(200).json({
      message: "Login successful",
      user: userPayload,
      tokens: {
        accessToken,
        refreshToken,
      },
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      res.status(400).json({
        message: "Validation error",
        errors: error.errors,
      });
      return;
    }

    console.error("Login error:", error);
    res.status(500).json({
      message: "Internal server error",
    });
  }
};
