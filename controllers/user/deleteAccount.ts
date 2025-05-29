import { Request, Response } from "express";
import { prisma } from "../../db/db";

export const deleteAccount = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        message: "Authentication required",
      });
      return;
    }

    await prisma.user.delete({
      where: { id: userId },
    });

    res.status(200).json({
      message: "Account deleted successfully",
    });
  } catch (error) {
    console.error("Delete account error:", error);
    res.status(500).json({
      message: "Internal server error",
    });
  }
};
