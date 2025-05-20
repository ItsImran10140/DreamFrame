import { GoogleGenAI } from "@google/genai";

// Initialize Gemini API with your API key
const ai = new GoogleGenAI({
  apiKey:
    process.env.GEMINI_API_KEY || "AIzaSyDjcW3PBt9yOh5Lhyw1TnFpa8PCFLEtsI0",
});

// Base prompt for code generation
const CODE_PROMPT = `You are a Manim code generation assistant.
Generate Python code using the Manim library that will create the animation described.
The code should be complete, runnable, and follow best practices.
Only respond with valid Python code that uses Manim.
Wrap the entire code in a Python class that extends Scene with a construct method.
Do not include any explanations outside the code. The video it should generate must be attractive and should be properly creating things.`;

// Base prompt for explanation generation
const EXPLANATION_PROMPT = `You are a Manim expert teacher.
For the following Manim code, provide a detailed explanation that includes:
1. A high-level overview of what the animation will show
2. Step-by-step explanation of important parts of the code
3. Learning tips for beginners on how to customize this animation
4. Best practices being demonstrated
5. Suggestions for how to extend or modify the animation

Explain in a clear, educational way that helps someone learning Manim understand both the concepts and implementation details.`;

/**
 * Generates Manim code and an explanation for the given prompt using Gemini API
 * @param prompt User prompt describing the animation
 * @returns Object containing the generated code and explanation
 */
const generateManimCode = async (prompt: string) => {
  try {
    let generatedCode = "";

    // Create a chat for code generation
    const codeChat = ai.chats.create({
      model: "gemini-2.0-flash", // You might want to adjust the model name if needed
      history: [
        {
          role: "user",
          parts: [{ text: CODE_PROMPT }],
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

    // Send message and get streaming response for code
    const codeResponse = await codeChat.sendMessageStream({
      message: [{ text: prompt }],
    });

    // Process streaming response for code
    for await (const chunk of codeResponse) {
      const chunkText = chunk.text || "";
      generatedCode += chunkText;
    }

    // Clean the code
    const cleanedCode = generatedCode
      .replace(/^```\s*python\s*\n?/gm, "") // Remove starting markers
      .replace(/```\s*$/gm, "") // Remove ending markers
      .trim();

    // Now generate explanation for the cleaned code
    let explanation = "";
    try {
      const explanationChat = ai.chats.create({
        model: "gemini-2.0-flash",
        history: [
          {
            role: "user",
            parts: [{ text: EXPLANATION_PROMPT }],
          },
          {
            role: "model",
            parts: [
              {
                text: "I'll provide a comprehensive, educational explanation for the Manim code.",
              },
            ],
          },
        ],
      });

      // Send the code to get an explanation
      const explanationResponse = await explanationChat.sendMessage({
        message: [
          {
            text: `Here's the Manim code to explain:\n\n\`\`\`python\n${cleanedCode}\n\`\`\``,
          },
        ],
      });

      // Get the explanation text
      explanation =
        typeof explanationResponse.text === "string"
          ? explanationResponse.text
          : "";
    } catch (explanationError) {
      console.error("Error generating explanation:", explanationError);
      // If explanation fails, provide a basic fallback explanation
      explanation =
        "Unable to generate detailed explanation for this code. You can analyze the code by breaking down the Scene class and understanding how the construct method builds animations step by step.";
    }

    // Return both the code and the explanation
    return {
      code: cleanedCode,
      explanation: explanation,
    };
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw new Error("Failed to generate Manim code or explanation");
  }
};

export default {
  generateManimCode,
};
