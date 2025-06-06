import { GoogleGenAI } from "@google/genai";

// Initialize Gemini API with your API key
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
});

// Enhanced and more robust prompt for code generation
const CODE_PROMPT = `You are an Expert Experienced Manim code generation specialist.

CRITICAL REQUIREMENTS - YOU MUST FOLLOW THESE RULES:

1. NEVER use direct indexing on Tex objects (like sentence[11] or text[5]) - this causes IndexError
2. ALWAYS use .split() method first when you need to access individual words/characters
3. ALWAYS add proper error handling and bounds checking
4. Use VGroup for grouping elements when needed
5. Test all array/list access with proper bounds checking

SAFE PATTERNS TO USE:
- For accessing text parts: text_obj.split() then check length before indexing
- For highlighting words: Use Tex with separate arguments or use MathTex
- For animations: Always ensure objects exist before animating them
- Use try-except blocks for potentially failing operations

FORBIDDEN PATTERNS (WILL CAUSE ERRORS):
- Direct indexing: text[index] without checking bounds
- Assuming text structure without validation
- Hard-coded indices without length checks
- Missing error handling for object creation

TECHNICAL REQUIREMENTS:
1. Generate complete, runnable Python code using Manim library
2. Create attractive, educational animations with smooth transitions
3. Use proper Manim best practices and efficient rendering
4. Include proper imports and class structure
5. Use descriptive variable names and clear code organization
6. Add comments for complex sections
7. Ensure all animations have appropriate timing and pacing
8. Use colors effectively to enhance visual appeal
9. Create engaging visual hierarchy and composition

CODE STRUCTURE REQUIREMENTS:
- Always extend Scene class with construct method
- Import all necessary Manim components
- Use proper animation timing (not too fast, not too slow)
- Include appropriate wait() calls between animations
- Use FadeOut to clean up between sections
- Ensure all objects are properly created before use

VISUAL DESIGN REQUIREMENTS:
- Use attractive color schemes
- Create clear visual hierarchy
- Add smooth transitions between sections
- Use appropriate scaling for text and objects
- Ensure good spacing and layout
- Add visual emphasis where needed

ERROR PREVENTION:
- Always validate object structure before accessing elements
- Use defensive programming practices
- Add bounds checking for all array/list operations
- Use safe methods for text manipulation
- Test object existence before animation

Generate Python code that creates an engaging, error-free animation. The code must be production-ready and handle edge cases gracefully.

Only respond with valid, tested Python code that follows these guidelines.`;

// Enhanced explanation prompt
const EXPLANATION_PROMPT = `You are a Manim expert teacher and educator.

For the following Manim code, provide a comprehensive educational explanation that includes:

1. **Animation Overview**: What the animation demonstrates and its educational value
2. **Code Structure Analysis**: Break down the class structure and main components
3. **Step-by-Step Walkthrough**: Detailed explanation of each major section
4. **Technical Concepts**: Explain Manim-specific concepts being used
5. **Visual Design Choices**: Why certain colors, layouts, and transitions were chosen
6. **Learning Outcomes**: What viewers will understand after watching
7. **Customization Tips**: How beginners can modify and extend the animation
8. **Best Practices**: Highlight good coding practices demonstrated
9. **Common Pitfalls**: What to avoid when creating similar animations
10. **Extension Ideas**: Suggestions for making the animation more complex or interactive

Make your explanation:
- Clear and accessible to beginners
- Technically accurate and detailed
- Educational and inspiring
- Practical with actionable advice
- Well-structured with clear sections

Focus on both the technical implementation and the educational impact of the animation.`;

// Add retry mechanism with exponential backoff
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  let lastError: Error;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry if it's a non-retryable error
      if (error instanceof Error && error.message.includes("API key")) {
        throw error;
      }

      if (i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        console.log(`Attempt ${i + 1} failed, retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  throw lastError!;
};

export const generateManimCode = async (prompt: string) => {
  try {
    // Validate input
    if (!prompt || prompt.trim().length === 0) {
      throw new Error("Prompt cannot be empty");
    }

    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY environment variable is not set");
    }

    let generatedCode = "";

    // Create a chat for code generation with enhanced context
    const generateCode = async () => {
      const codeChat = ai.chats.create({
        model: "gemini-2.0-flash",
        history: [
          {
            role: "user",
            parts: [{ text: CODE_PROMPT }],
          },
          {
            role: "model",
            parts: [
              {
                text: "I understand. I will generate robust, error-free Manim code that follows all safety guidelines, uses proper error handling, avoids direct indexing on Tex objects, and creates engaging educational animations. I'll ensure the code is production-ready with defensive programming practices.",
              },
            ],
          },
        ],
        config: {
          tools: [{ codeExecution: {} }],
        },
      });

      // Enhanced prompt with specific context
      const enhancedPrompt = `${prompt}

ADDITIONAL CONTEXT:
- Create visually appealing educational content
- Use safe coding practices (no direct text indexing)
- Include smooth animations and proper timing
- Add error handling where needed
- Make it suitable for educational purposes
- Ensure all code is tested and production-ready

Generate the complete Manim code now:`;

      // Send message and get streaming response for code
      const codeResponse = await codeChat.sendMessageStream({
        message: [{ text: enhancedPrompt }],
      });

      let code = "";
      // Process streaming response for code
      for await (const chunk of codeResponse) {
        const chunkText = chunk.text || "";
        code += chunkText;
      }

      if (!code || code.trim().length === 0) {
        throw new Error("No code generated from API");
      }

      return code;
    };

    // Use retry mechanism for code generation
    generatedCode = await retryWithBackoff(generateCode);

    // Enhanced code cleaning with better regex patterns
    const cleanedCode = generatedCode
      .replace(/^```\s*python\s*\n?/gm, "")
      .replace(/^```\s*\n?/gm, "")
      .replace(/```\s*$/gm, "")
      .replace(/^\s*```/gm, "")
      .trim();

    // Validate that we have actual Python code
    if (!cleanedCode.includes("class") || !cleanedCode.includes("Scene")) {
      throw new Error("Generated code doesn't appear to be valid Manim code");
    }

    let explanation = "";

    try {
      const generateExplanation = async () => {
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
                  text: "I'll provide a comprehensive, educational explanation that breaks down the Manim code into understandable sections, explains the technical concepts, and provides practical learning guidance.",
                },
              ],
            },
          ],
        });

        // Send the code to get an explanation
        const explanationResponse = await explanationChat.sendMessage({
          message: [
            {
              text: `Please provide a detailed educational explanation for this Manim code:\n\n\`\`\`python\n${cleanedCode}\n\`\`\`\n\nFocus on making it educational and helpful for someone learning Manim and the subject matter being animated.`,
            },
          ],
        });

        // Get the explanation text
        const explanationText =
          typeof explanationResponse.text === "string"
            ? explanationResponse.text
            : "";

        if (!explanationText || explanationText.trim().length === 0) {
          throw new Error("No explanation generated from API");
        }

        return explanationText;
      };

      // Use retry mechanism for explanation generation
      explanation = await retryWithBackoff(generateExplanation);
    } catch (explanationError) {
      console.error("Error generating explanation:", explanationError);
      // Enhanced fallback explanation
      explanation = `
## Animation Code Analysis

This Manim animation code creates an educational visualization. Here's a basic breakdown:

### Code Structure
- The code defines a Scene class that extends Manim's base Scene
- The construct() method contains all animation logic
- Various Manim objects are created and animated in sequence

### Key Components
- Text and mathematical expressions using Tex/MathTex
- Geometric shapes and visual elements
- Animation sequences with proper timing
- Color coding for visual emphasis

### Learning Tips
- Study how objects are created and positioned
- Notice the use of self.play() for animations
- Observe timing with self.wait() calls
- See how colors enhance visual communication

### Best Practices Demonstrated
- Clean code organization
- Proper object lifecycle management
- Effective use of visual hierarchy
- Educational pacing and flow

For detailed analysis, review the specific methods and objects used in your generated code.

**Note**: Full explanation was not available due to API limitations. The generated code should still be functional and well-structured.
      `.trim();
    }

    // Return both the code and the explanation
    return {
      code: cleanedCode,
      explanation: explanation,
      success: true,
    };
  } catch (error) {
    console.error("Error calling Gemini API:", error);

    let errorMessage = "Unknown error occurred";
    let errorCode = "UNKNOWN_ERROR";

    if (error instanceof Error) {
      errorMessage = error.message;

      // Categorize different types of errors
      if (
        error.message.includes("503") ||
        error.message.includes("overloaded")
      ) {
        errorCode = "SERVICE_UNAVAILABLE";
        errorMessage =
          "The AI service is currently overloaded. Please try again in a few minutes.";
      } else if (error.message.includes("API key")) {
        errorCode = "API_KEY_ERROR";
        errorMessage = "API key configuration error. Please check your setup.";
      } else if (
        error.message.includes("quota") ||
        error.message.includes("limit")
      ) {
        errorCode = "QUOTA_EXCEEDED";
        errorMessage = "API quota exceeded. Please try again later.";
      } else if (
        error.message.includes("network") ||
        error.message.includes("timeout")
      ) {
        errorCode = "NETWORK_ERROR";
        errorMessage =
          "Network error occurred. Please check your connection and try again.";
      }
    }

    // Return error information instead of throwing
    return {
      code: null,
      explanation: null,
      success: false,
      error: {
        message: errorMessage,
        code: errorCode,
        originalError: error instanceof Error ? error.message : String(error),
      },
    };
  }
};
