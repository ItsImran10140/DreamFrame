import { Request, Response } from "express";
import { prisma } from "../../db/db";
import { hashPassword } from "../../utils/passwords";
import { generateToken, generateRefreshToken } from "../../utils/jwt";
import { registerSchema, RegisterInput } from "../../validator/authValidator";
import { UserPayload } from "../../types/authTypes";

// Register User
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData: RegisterInput = registerSchema.parse(req.body);
    const { username, email, password } = validatedData;

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      res.status(409).json({
        message:
          existingUser.email === email
            ? "Email already registered"
            : "Username already taken",
      });
      return;
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
      },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
      },
    });

    // Generate tokens
    const userPayload: UserPayload = {
      id: user.id,
      username: user.username,
      email: user.email,
    };

    const accessToken = generateToken(userPayload);
    const refreshToken = generateRefreshToken(userPayload);
    console.log(userPayload);
    console.log(accessToken);
    console.log(refreshToken);

    res.status(201).json({
      message: "User registered successfully",
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

    console.error("Registration error:", error);
    res.status(500).json({
      message: "Internal server error",
    });
  }
};

//  ======================================================================

// import { Request, Response } from "express";
// import { prisma } from "../../db/db";

// export const createUser = async (req: Request, res: Response) => {
//   try {
//     const { username, email, password } = req.body;

//     if (!username || !email || !password) {
//       res.status(400).json({
//         message: "Username, email, and password are required",
//       });
//       return;
//     }

//     await prisma.user.create({
//       data: {
//         username,
//         email,
//         password,
//       },
//     });

//     res.status(200).json({
//       message: "User created successfully",
//     });
//   } catch (error) {
//     console.log("Error creating user:", error);
//   }
// };
