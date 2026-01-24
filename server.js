import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import 'dotenv/config';

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
// Replace with your actual MongoDB connection string in .env file as MONGODB_URI
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/employeeDB';

mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// Employee Performance Schema
const employeeSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    department: String,
    jobTitle: String,
    communicationSkills: String,
    teamwork: String,
    problemSolving: String,
    reviewDate: Date,
    verification: Boolean,
    timestamp: { type: Date, default: Date.now }
});

const Employee = mongoose.model('Employee', employeeSchema);

// Routes
app.post('/api/employees', async (req, res) => {
    try {
        const { firstName, lastName, reviewDate } = req.body;

        if (!firstName || !lastName || !reviewDate) {
            return res.status(400).json({ error: 'Name and Review Date are required' });
        }

        const newEmployee = new Employee(req.body);
        await newEmployee.save();

        console.log(`📝 Saved review for: ${firstName} ${lastName}`);
        res.status(201).json({ message: 'Performance review saved successfully!', id: newEmployee._id });
    } catch (error) {
        console.error('Error saving review:', error);
        res.status(500).json({ error: 'Internal Server Error: ' + error.message });
    }
});

// Car Insurance Schema
const insuranceSchema = new mongoose.Schema({
    firstName: String,
    lastName: String,
    email: String,
    phone: String,
    driverFirstName: String,
    driverLastName: String,
    commute: String,
    parking: String,
    coverage: String,
    ownership: String,
    state: String,
    timestamp: { type: Date, default: Date.now }
});

const Insurance = mongoose.model('Insurance', insuranceSchema);

app.post('/api/insurance', async (req, res) => {
    try {
        const newInsurance = new Insurance(req.body);
        await newInsurance.save();
        console.log(`📝 Saved insurance form for: ${req.body.firstName} ${req.body.lastName}`);
        res.status(201).json({ message: 'Insurance form saved successfully!', id: newInsurance._id });
    } catch (error) {
        console.error('Error saving insurance form:', error);
        res.status(500).json({ error: 'Internal Server Error: ' + error.message });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
