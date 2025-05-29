import { Request, Response } from "express";

export const logout = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({
    message: "Logout successful",
  });
};
