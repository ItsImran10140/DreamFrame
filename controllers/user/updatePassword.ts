import { Request, Response } from "express";
import { prisma } from "../../db/db";
import {
  UpdatePasswordInput,
  updatePasswordSchema,
} from "../../utils/authValidator";
import { comparePassword, hashPassword } from "../../utils/passwords";

export const updatePassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const validatedData: UpdatePasswordInput = updatePasswordSchema.parse(
      req.body
    );
    const { currentPassword, newPassword } = validatedData;

    if (!userId) {
      res.status(401).json({
        message: "Authentication required",
      });
      return;
    }

    // Get current user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.status(404).json({
        message: "User not found",
      });
      return;
    }

    // Verify current password
    const isCurrentPasswordValid = await comparePassword(
      currentPassword,
      user.password
    );

    if (!isCurrentPasswordValid) {
      res.status(400).json({
        message: "Current password is incorrect",
      });
      return;
    }

    // Hash new password
    const hashedNewPassword = await hashPassword(newPassword);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });

    res.status(200).json({
      message: "Password updated successfully",
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      res.status(400).json({
        message: "Validation error",
        errors: error.errors,
      });
      return;
    }

    console.error("Update password error:", error);
    res.status(500).json({
      message: "Internal server error",
    });
  }
};
