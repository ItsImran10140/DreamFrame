import express, { Request, Response } from "express";
import cors from "cors";
import { prisma, connectDB } from "./db";
import manimRoutes from "../routes/manim";
const app = express();

const PORT = 3000;

app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use("/api/manim", manimRoutes);

// Connect to database
connectDB();

// Cleanup on startup
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit();
});

app.listen(PORT, () => {
  console.log(`Server is running on port : ${PORT}`);
});
