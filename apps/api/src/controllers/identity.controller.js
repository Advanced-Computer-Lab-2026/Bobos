// Team A Controller logic
// Example:
// exports.login = async (req, res) => {
//   res.send('Login endpoint');
// };
import * as academicsModel from '../models/academics.js';
import PDFDocument from 'pdfkit';

//Req 54: View academic history
export const getAcademicHistory = async (req, res) => {
    try{
        const { studentId } = req.params;

        const history = await academicsModel.getAcademicHistory(studentId);

        if(!history){
            return res.status(404).json({ message: "Student history not found."});
        }

        res.status(200).json(history);
    }catch(error){
        res.status(500).json({error: error.message});
    }
};

//Req 55: View transcript for a selected academic year
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

//Req 56: Download transcript as PDF    
export const downloadTranscriptPDF = async (req, res) => {
    try{
        const {studentId} = req.params;
        const {year} = req.query;

        if(!year){
            return res.status(400).json({ error: "Academic year query parameter is required." });
        }

        const transcript = await academicsModel.getTranscriptByYear(studentId, year);

        if(!transcript){
            return res.status(404).json({ message: "No transcript found to export." });
        }

        const doc = new PDFDocument({margin: 50});

       res.setHeader('Content-Type', 'application/pdf');
       res.setHeader('Content-Disposition', `attachment; filename=transcript_${studentId}_${year}.pdf`);

         doc.pipe(res);// Pipe the PDF to the response

        //Building the PDF content
        doc.fontSize(20).text('University Academic Transcript', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Student ID: ${studentId}`);
        doc.text(`Academic Year: ${year}`);
        doc.text(`Generated On: ${new Date().toLocaleDateString()}`);
        doc.moveDown(2); 

        const terms = transcript.terms;
        for (const [termName, courses] of Object.entries(terms)) {
            if (courses.length > 0) {
                // Capitalize the first letter of the term
                const formattedTerm = termName.charAt(0).toUpperCase() + termName.slice(1);
                
                doc.fontSize(14).text(`${formattedTerm} Term`, { underline: true });
                doc.moveDown(0.5);

                courses.forEach(attempt => {
                    const courseName = attempt.course ? attempt.course.name : 'Unknown Course';
                    const courseCode = attempt.course ? attempt.course.code : 'N/A';
                    const grade = attempt.grade || 'Pending';
                    
                    doc.fontSize(10).text(`${courseCode} - ${courseName} | Grade: ${grade}`);
                });
                doc.moveDown();
            }
        }

        // Finalize the PDF (this closes the stream and sends it to the user)
        doc.end();

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

//Req 61: View failed and unattended courses
export const getFailedCourses = async (req, res) => {
    try{
        const { studentId } = req.params;

        const failedCourses = await academicsModel.getFailedAndUnattended(studentId);

        if(!failedCourses || failedCourses.length === 0){
            return res.status(200).json({message: "No failed or unattended courses found."});
        }

    res.status(200).json(failedCourses);
}catch (error) {
    res.status(500).json({error: error.message});
}
};

//Req 89: View wallet
export const getWallet = async (req, res) => {
    try {
        const { studentId } = req.params;

        const walletData = await academicsModel.getWallet(studentId);
        
        if (!walletData) {
            return res.status(404).json({ message: "Wallet not found for this student." });
        }

        res.status(200).json(walletData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};