import { Request, Response } from "express";
import { oauth2client } from "../../utils/googleConfig";
import axios from "axios";
import { prisma } from "../../db/db";
import jwt from "jsonwebtoken";

export const googleLogin = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { code }: any = req.query;
    const googleRes = await oauth2client.getToken(code);
    oauth2client.setCredentials(googleRes.tokens);

    const userRes = await axios.get(
      `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${googleRes.tokens.access_token}`
    );
    const { email, name } = userRes.data;
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          username: name,
          email,
          password: "", // Set a default or random password, or handle accordingly
        },
      });
    }
    const { id } = user;
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error("JWT_SECRET is not defined in environment variables");
    }
    const token = jwt.sign({ id, email }, jwtSecret, {
      expiresIn: "24h",
    });
    return res.status(200).json({
      message: "Success",
      token,
      user,
    });
  } catch (error) {
    res.status(500).json({
      message: "Internal Server Error",
    });
  }
};
