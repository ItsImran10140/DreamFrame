import { Request, Response } from "express";
import { prisma } from "../../db/db";
import {
  UpdateProfileInput,
  updateProfileSchema,
} from "../../validator/authValidator";

export const updateProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const validatedData: UpdateProfileInput = updateProfileSchema.parse(
      req.body
    );

    if (!userId) {
      res.status(401).json({
        message: "Authentication required",
      });
      return;
    }

    // Check if username/email is already taken by another user
    if (validatedData.username || validatedData.email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          AND: [
            { id: { not: userId } },
            {
              OR: [
                validatedData.username
                  ? { username: validatedData.username }
                  : {},
                validatedData.email ? { email: validatedData.email } : {},
              ].filter((obj) => Object.keys(obj).length > 0),
            },
          ],
        },
      });

      if (existingUser) {
        res.status(409).json({
          message: "Username or email already taken",
        });
        return;
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: validatedData,
      select: {
        id: true,
        username: true,
        email: true,
        updatedAt: true,
      },
    });

    res.status(200).json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      res.status(400).json({
        message: "Validation error",
        errors: error.errors,
      });
      return;
    }

    console.error("Update profile error:", error);
    res.status(500).json({
      message: "Internal server error",
    });
  }
};
