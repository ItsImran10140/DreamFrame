import { GoogleGenAI } from "@google/genai";

// Initialize Gemini API
const ai = new GoogleGenAI({
  apiKey: "AIzaSyDjcW3PBt9yOh5Lhyw1TnFpa8PCFLEtsI0",
});

// Base prompt - this could be imported from a separate file like in your example
const BASE_PROMPT = `You are a Manim code generation assistant.
Generate Python code using the Manim library that will create the animation described.
The code should be complete, runnable, and follow best practices.
Only respond with valid Python code that uses Manim.
Wrap the entire code in a Python class that extends Scene with a construct method.
Do not include any explanations outside the code. the video it should generate must me be attractive and should be properly creating things.`;

const generateManimCode = async (prompt: string) => {
  try {
    let generatedCode = "";

    // Create a chat similar to your implementation
    const chat = ai.chats.create({
      model: "gemini-2.0-flash", // Using the model from your code
      history: [
        {
          role: "user",
          parts: [{ text: BASE_PROMPT }],
        },
        {
          role: "model",
          parts: [
            {
              text: "Give me only the main executable code of manim and without any error.",
            },
          ],
        },
      ],
      config: {
        tools: [{ codeExecution: {} }],
      },
    });

    // Send message and get streaming response
    const response = await chat.sendMessageStream({
      message: [{ text: prompt }],
    });

    // Process streaming response
    for await (const chunk of response) {
      // Get the text content from the chunk
      const chunkText = chunk.text || "";

      // Accumulate the code
      generatedCode += chunkText;
    }

    // Clean the code just like in your implementation
    const cleanedCode = generatedCode
      .replace(/^```\s*python\s*\n?/gm, "") // Remove starting markers
      .replace(/```\s*$/gm, "") // Remove ending markers
      .trim();

    return cleanedCode;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw new Error("Failed to generate Manim code");
  }
};

export default { generateManimCode };
