import { PrismaClient } from "../generated/prisma/client";

const prisma = new PrismaClient({
  log: ["warn", "error"],
});

async function connectDB() {
  try {
    await prisma.$connect();
    console.log(`Connected to Database`);
  } catch (error) {
    console.log("Database connection error", error);
    process.exit(1);
  }
}

export { prisma, connectDB };
