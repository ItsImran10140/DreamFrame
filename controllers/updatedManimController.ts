import { Request, Response } from "express";
import {
  validateAndLogManimCode,
  validateManimCode,
} from "../utils/codeValidator";

export const updateManimCode = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { projectId } = req.params;
  const { code } = req.body;
  console.log(projectId);
  console.log(code);

  const validationResult = await validateManimCode(code);
  console.log(
    JSON.stringify(validationResult, null, 2) + " \n Result Successful \n"
  );
};

// create a put ( Update Request ) in route that update the code in backend;
// fetch the updated code from the database. using query
