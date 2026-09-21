// EXAMPLE

import openai from "../config/openai.js";
import { emailAnalysisPrompt } from "../prompt/emailAnalysisPrompt.js";
import { trainingInformation } from "../prompt/trainingInformation.js";

export async function analyseEmail(emailText) {

    const response = await openai.responses.create({
        model: "gpt-5.5",

        instructions: `
            ${emailAnalysisPrompt}

            TRAINING INFORMATION:
            ${trainingInformation}
        `,

        input: `
            EMAIL TO ANALYSE:
            """
            ${emailText}
            """
        `
    });

    return response.output_text;
}