// EXAMPLE

import { analyseEmail } from "../services/openaiService.js";

export async function analyseEmailController(req, res) {
    try {

        const emailText = req.body.email;

        const result = await analyseEmail(emailText);

        res.json({
            success: true,
            result
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to analyse email"
        });
    }
}