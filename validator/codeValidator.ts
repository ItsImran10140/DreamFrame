import { exec } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { promisify } from "util";

const execPromise = promisify(exec);

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class ManimValidator {
  public async validateManimCode(code: string): Promise<ValidationResult> {
    // First perform static analysis checks
    const staticCheckResult = this.performStaticAnalysis(code);
    if (!staticCheckResult.isValid) {
      return staticCheckResult;
    }

    // Then perform syntax validation using Python
    try {
      const syntaxCheckResult = await this.validatePythonSyntax(code);
      if (!syntaxCheckResult.isValid) {
        return syntaxCheckResult;
      }
    } catch (error: any) {
      return {
        isValid: false,
        errors: [`Failed to perform syntax validation: ${error.message}`],
        warnings: [],
      };
    }

    // Finally validate Manim-specific requirements
    const manimCheckResult = this.validateManimSpecifics(code);

    // Combine warnings from all checks
    manimCheckResult.warnings = [
      ...staticCheckResult.warnings,
      ...manimCheckResult.warnings,
    ];

    return manimCheckResult;
  }

  /**
   * Performs static analysis on the code to catch common issues
   */
  private performStaticAnalysis(code: string): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    // Check for empty code
    if (!code.trim()) {
      result.isValid = false;
      result.errors.push("Code cannot be empty");
      // No return needed since function return type is void
    }

    // Check for maximum allowed code size (e.g., 100KB)
    if (Buffer.byteLength(code, "utf8") > 100 * 1024) {
      result.isValid = false;
      result.errors.push("Code exceeds maximum allowed size (100KB)");
      return result;
    }

    // Check for potentially dangerous operations
    const dangerousPatterns = [
      {
        pattern: /os\.system\s*\(/g,
        message: "Direct system commands are not allowed (os.system)",
      },
      {
        pattern: /subprocess\..*call/g,
        message: "Subprocess calls are not allowed",
      },
      {
        pattern: /open\s*\(\s*["\']\s*\/(?!tmp)/g,
        message: "File operations outside of /tmp directory are not allowed",
      },
      {
        pattern: /import\s+socket/g,
        message: "Network operations are not allowed",
      },
      {
        pattern: /shutil\.rmtree/g,
        message: "Recursive directory removal is not allowed",
      },
      {
        pattern: /for\s+i\s+in\s+range\s*\(\s*\d{7,}\s*\)/g,
        message: "Potentially excessive loop detected",
      },
    ];

    for (const { pattern, message } of dangerousPatterns) {
      if (pattern.test(code)) {
        result.isValid = false;
        result.errors.push(message);
      }
    }

    // Check for potential infinite loops
    if (/while\s+True/.test(code) && !/break/.test(code)) {
      result.warnings.push(
        "Potential infinite loop detected (while True without break)"
      );
    }

    return result;
  }

  /**
   * Validates Python syntax using Python's built-in compiler
   */
  private async validatePythonSyntax(code: string): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    // Create a temporary file to validate
    const tmpDir = os.tmpdir();
    const tmpFile = path.join(tmpDir, `manim_validator_${Date.now()}.py`);

    try {
      // Write code to temporary file
      fs.writeFileSync(tmpFile, code);

      // Use Python to check syntax without executing
      await execPromise(`python -m py_compile ${tmpFile}`);
    } catch (error: any) {
      result.isValid = false;
      result.errors.push(
        `Python syntax error: ${error.stderr || error.message}`
      );
    } finally {
      // Clean up temp file
      try {
        fs.unlinkSync(tmpFile);
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    return result;
  }

  /**
   * Validates Manim-specific requirements and best practices
   */
  private validateManimSpecifics(code: string): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    // Check if manim is imported
    if (!(/from\s+manim\s+import/.test(code) || /import\s+manim/.test(code))) {
      result.isValid = false;
      result.errors.push("Manim library is not imported");
      return result;
    }

    // Check for Scene class definition
    if (!/class\s+\w+\s*\(\s*Scene\s*\)/.test(code)) {
      result.isValid = false;
      result.errors.push("No Scene class definition found");
      return result;
    }

    // Check for construct method in Scene class
    if (!/def\s+construct\s*\(\s*self\s*\)/.test(code)) {
      result.isValid = false;
      result.errors.push("No construct method found in Scene class");
      return result;
    }
    const commonManimObjects = [
      "Circle",
      "Square",
      "Rectangle",
      "Line",
      "Arrow",
      "Text",
      "MathTex",
      "Tex",
      "VGroup",
      "Graph",
      "Group",
    ];

    let foundManimObject = false;
    for (const object of commonManimObjects) {
      if (new RegExp(`\\b${object}\\s*\\(`).test(code)) {
        foundManimObject = true;
        break;
      }
    }

    if (!foundManimObject) {
      result.warnings.push(
        "No common Manim objects detected, code might not produce visual output"
      );
    }

    // Check for animations
    const animationPatterns = [
      /self\.play\s*\(/,
      /self\.wait\s*\(/,
      /self\.add\s*\(/,
      /self\.remove\s*\(/,
    ];

    let foundAnimation = false;
    for (const pattern of animationPatterns) {
      if (pattern.test(code)) {
        foundAnimation = true;
        break;
      }
    }

    if (!foundAnimation) {
      result.warnings.push(
        "No animation methods detected (play, wait, add, remove)"
      );
    }

    return result;
  }
  public async validateWithSandbox(code: string): Promise<ValidationResult> {
    // Only run this in trusted environments where executing Python is safe
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    // First perform the basic validation
    const basicResult = await this.validateManimCode(code);
    if (!basicResult.isValid) {
      return basicResult;
    }

    // Create a wrapper script that imports manim and validates the code without running it
    const validateScript = `
import sys
from io import StringIO
import ast

# Redirect stdout/stderr
original_stdout = sys.stdout
original_stderr = sys.stderr
sys.stdout = StringIO()
sys.stderr = StringIO()

try:
    # Parse the AST to validate without executing
    ast.parse(${JSON.stringify(code)})
    
    # Import manim to check for missing dependencies
    try:
        import manim
    except ImportError as e:
        print(f"Manim import error: {str(e)}")
        sys.exit(1)
    
    # Check for specific manim classes
    try:
        from manim import Scene, Circle, Square
    except ImportError as e:
        print(f"Manim classes import error: {str(e)}")
        sys.exit(1)
        
    print("VALIDATION_SUCCESS")
except SyntaxError as e:
    print(f"Syntax error: {str(e)}")
    sys.exit(1)
except Exception as e:
    print(f"Validation error: {str(e)}")
    sys.exit(1)
finally:
    # Restore stdout/stderr
    validation_output = sys.stdout.getvalue()
    sys.stdout = original_stdout
    sys.stderr = original_stderr
    print(validation_output)
`;

    const tmpDir = os.tmpdir();
    const tmpFile = path.join(
      tmpDir,
      `manim_validator_sandbox_${Date.now()}.py`
    );

    try {
      // Write validation script to temporary file
      fs.writeFileSync(tmpFile, validateScript);

      // Execute with timeout to prevent hanging
      const { stdout, stderr } = await execPromise(`python ${tmpFile}`, {
        timeout: 5000,
      });

      if (!stdout.includes("VALIDATION_SUCCESS")) {
        result.isValid = false;
        result.errors.push(`Manim validation failed: ${stdout.trim()}`);
      }

      if (stderr) {
        result.warnings.push(`Validation produced warnings: ${stderr.trim()}`);
      }
    } catch (error: any) {
      result.isValid = false;
      result.errors.push(
        `Sandbox validation error: ${error.stderr || error.message}`
      );
    } finally {
      // Clean up temp file
      try {
        fs.unlinkSync(tmpFile);
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    return result;
  }
}

// Example usage
export async function validateManimCode(
  code: string
): Promise<ValidationResult> {
  const validator = new ManimValidator();
  return await validator.validateManimCode(code);
}

// Helper function to properly display validation results
export async function validateAndLogManimCode(code: string): Promise<void> {
  try {
    const validator = new ManimValidator();
    const result = await validator.validateManimCode(code);

    console.log("Validation Result:");
    console.log(JSON.stringify(result, null, 2));

    if (result.isValid) {
      console.log("✅ Code is valid!");
    } else {
      console.log("❌ Code validation failed:");
      result.errors.forEach((error) => console.log(`- Error: ${error}`));
    }

    if (result.warnings.length > 0) {
      console.log("⚠️ Warnings:");
      result.warnings.forEach((warning) =>
        console.log(`- Warning: ${warning}`)
      );
    }
    // No return needed since function return type is void
  } catch (error) {
    console.error("Validation error:", error);
    throw error;
  }
}
