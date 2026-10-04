// Team A Controller logic
// Example:
// exports.login = async (req, res) => {
//   res.send('Login endpoint');
// };
import * as academicsModel from '../models/academics.js';


export const getTranscript = async (req, res) => {
    try{
        const { studentId } = req.params;
        const {year} = req.query;

        if(!year){
            return res.status(400).json({ error: "Academic year query parameter is required (e.g., ?year=2026)" });
        }

    const transcript = await academicsModel.getTranscriptByYear(studentId, year);

    if(!transcript){
        return res.status(404).json({ message: "No transcript found for this academic year." });
    }

    res.status(200).json(transcript);

}catch (error) {
    res.status(500).json({error: error.message});
}
};
