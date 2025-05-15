import { exec } from "child_process";
import path from "path";
import util from "util";
import fs from "fs";

const mkdirPromise = util.promisify(fs.mkdir);
const execPromise = util.promisify(exec);

// we are oly getting code
export const runManimDocker = async (workDir: any, pythonFilePath: any) => {
  try {
    const fileName = path.basename(pythonFilePath, ".py");
    const outputDir = path.join(workDir, "");
    const mediaDir = path.join(workDir, "media");

    for (const dir of [outputDir, mediaDir]) {
      try {
        await mkdirPromise(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
      } catch (error: any) {
        if (error.code != "EXIST") throw error;
      }
    }

    const mediaVideoDir = path.join(mediaDir, "videos", fileName);
    try {
      await mkdirPromise(mediaVideoDir, { recursive: true });
      console.log(`Created media video directory: ${mediaVideoDir}`);
    } catch (err: any) {
      // Ignore if already exists
      console.log(`Note: ${err.message}`);
    }

    const normalizedWorkDir = workDir.replace(/\\/g, "/");
    const outputFolderInDocker = "/manim/output";
    const qualityFlag = "-qm";
    const verbosityFlag = "--verbosity DEBUG";

    try {
      const fullPythonPath = path.join(workDir, `${fileName}.py`);
      console.log(`Checking if Python file exists: ${fullPythonPath}`);
      if (!fs.existsSync(fullPythonPath)) {
        throw new Error(`Python file not found: ${fullPythonPath}`);
      }
    } catch (err: any) {
      console.error(`Error checking Python file: ${err.message}`);
    }

    // Get Manim version to determine correct command format
    try {
      const versionCheckCmd = `docker run --rm manimcommunity/manim:latest python -m manim --version`;
      const versionResult = await execPromise(versionCheckCmd);
      console.log(`Manim version: ${versionResult.stdout}`);
    } catch (err: any) {
      console.log(`Could not determine Manim version: ${err.message}`);
    }

    let dockerCommand = `docker run --rm -v "${normalizedWorkDir}:/manim" manimcommunity/manim:latest python -m manim render ${fileName}.py -o ${outputFolderInDocker} ${qualityFlag} ${verbosityFlag}`;

    console.log(`Running Docker command: ${dockerCommand}`);

    let stdout, stderr;
    try {
      // First try with 'render' subcommand (newer Manim versions)
      const renderCommand = `docker run --rm -v "${normalizedWorkDir}:/manim" manimcommunity/manim:latest python -m manim render ${fileName}.py -o ${outputFolderInDocker} ${qualityFlag} ${verbosityFlag}`;
      console.log(`Trying command with 'render' subcommand: ${renderCommand}`);

      const renderResult = await execPromise(renderCommand, {
        cwd: workDir,
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
      });

      stdout = renderResult.stdout;
      stderr = renderResult.stderr;
    } catch (renderError: any) {
      console.log(`Render subcommand failed: ${renderError.message}`);
      console.log("Trying legacy command format without render subcommand...");

      try {
        // Fall back to older format without 'render' subcommand
        const legacyCommand = `docker run --rm -v "${normalizedWorkDir}:/manim" manimcommunity/manim:latest python -m manim ${fileName}.py -o ${outputFolderInDocker} ${qualityFlag}`;
        console.log(`Trying legacy command: ${legacyCommand}`);

        const legacyResult = await execPromise(legacyCommand, {
          cwd: workDir,
          maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        });

        stdout = legacyResult.stdout;
        stderr = legacyResult.stderr;
      } catch (legacyError: any) {
        console.log(`Legacy command also failed: ${legacyError.message}`);

        // Try with -p flag for production quality as a last resort
        try {
          const lastResortCommand = `docker run --rm -v "${normalizedWorkDir}:/manim" manimcommunity/manim:latest python -m manim ${fileName}.py -qh`;
          console.log(`Trying simplified command: ${lastResortCommand}`);

          const lastResortResult = await execPromise(lastResortCommand, {
            cwd: workDir,
            maxBuffer: 1024 * 1024 * 10, // 10MB buffer
          });

          stdout = lastResortResult.stdout;
          stderr = lastResortResult.stderr;
        } catch (finalError: any) {
          throw new Error(
            `All Manim command attempts failed. Latest error: ${finalError.message}`
          );
        }
      }
    }
    console.log("Docker execution stdout:", stdout);
    if (stderr) console.error("Docker execution stderr:", stderr);

    // Check if output directories exist and what they contain
    try {
      // Look for videos in both the output directory and the media directory structure
      const dirsToCheck = [
        outputDir,
        mediaVideoDir,
        path.join(mediaDir, "videos", "scenes", fileName), // Alternative structure some Manim versions use
      ];

      console.log("Checking for output files in these directories:");
      console.log(dirsToCheck);

      // Look for any video files (MP4, webm, etc.)
      const videoExtensions = ["mp4", "webm", "mov", "avi"];
      let foundVideoFile = null;

      for (const ext of videoExtensions) {
        // Check each directory for the video extension
        for (const dirToCheck of dirsToCheck) {
          try {
            // Skip directories that don't exist
            if (!fs.existsSync(dirToCheck)) {
              console.log(`Directory doesn't exist, skipping: ${dirToCheck}`);
              continue;
            }

            console.log(`Checking for ${ext} files in ${dirToCheck}`);
            const findCommand =
              process.platform === "win32"
                ? `dir /s /b "${dirToCheck}\\*.${ext}" 2>nul`
                : `find ${dirToCheck} -name "*.${ext}" 2>/dev/null`;

            try {
              const result = await execPromise(findCommand);
              const files = result.stdout.trim().split("\n").filter(Boolean);

              if (files.length > 0) {
                console.log(`Found ${ext} file in ${dirToCheck}: ${files[0]}`);
                foundVideoFile = files[0];
                break;
              }
            } catch (findErr) {
              // Ignore dir command errors
              console.log(`No ${ext} files found in ${dirToCheck}`);
            }
          } catch (err: any) {
            console.log(
              `Error checking directory ${dirToCheck}: ${err.message}`
            );
          }
        }

        if (foundVideoFile) break;
      }

      if (foundVideoFile) {
        return foundVideoFile;
      }

      // If no video file was found, check for any files recursively
      console.log("Looking for any output files recursively...");

      let allFilesList = [];
      for (const dirToCheck of [outputDir, mediaDir]) {
        if (fs.existsSync(dirToCheck)) {
          const allFilesCmd =
            process.platform === "win32"
              ? `dir "${dirToCheck}" /s /b`
              : `find ${dirToCheck} -type f`;

          try {
            const allFiles = await execPromise(allFilesCmd);
            console.log(`All files in ${dirToCheck}:`);
            console.log(allFiles.stdout);
            allFilesList.push(
              ...allFiles.stdout.trim().split("\n").filter(Boolean)
            );
          } catch (err: any) {
            console.log(`Error listing files in ${dirToCheck}: ${err.message}`);
          }
        }
      }

      if (allFilesList.length > 0) {
        // If there are any files at all, return the first one as a fallback
        console.log(
          `No video files found, but returning first available file: ${allFilesList[0]}`
        );
        return allFilesList[0];
      }

      throw new Error(
        "No output files were generated. Check the Python script for errors."
      );
    } catch (error: any) {
      throw new Error(`Failed to find output files: ${error.message}`);
    }
  } catch (error: any) {
    console.error("Error running Docker:", error);
    throw new Error(`Failed to run Manim in Docker: ${error.message}`);
  }
};
