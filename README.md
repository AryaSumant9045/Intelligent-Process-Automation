# Car Insurance Chatbot

A smart, AI-powered web application designed to simplify the car insurance application process. This tool features a chatbot that interacts with users to collect information and automatically populates the insurance form, supporting both natural language text input and file uploads.

## Features

*   **AI-Powered Assistance**: utilizes LLMs (Gemini, OpenRouter, Groq) to understand user intent and extract relevant data.
*   **Auto-Fill Capability**: Automatically populates form fields based on chat conversation or uploaded document analysis.
*   **File Processing**: Supports file uploads (e.g., CSV, text) to extract insurance details.
*   **Responsive Form**: A clean, accessible HTML form for manual entry or verification.
*   **Data Persistence**: securely stores submitted applications in a MongoDB database.
*   **Real-time Feedback**: Instant visual confirmation of form submission status.

## Tech Stack

*   **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES Modules).
*   **Backend**: Node.js, Express.js.
*   **Database**: MongoDB (Mongoose Schema).
*   **AI Integration**: Google Gemini, OpenRouter, Groq APIs.

## Prerequisites

Before running this project, ensure you have the following installed:

*   [Node.js](https://nodejs.org/) (v16 or higher)
*   [MongoDB](https://www.mongodb.com/try/download/community) (running locally or a cloud URI)

## Installation

1.  **Clone the repository** (if applicable) or navigate to the project directory.

2.  **Install Dependencies**:
    Run the following command to install the required Node.js packages:
    ```bash
    npm install
    ```

3.  **Environment Configuration**:
    Create a `.env` file in the root directory and add your API keys and database configuration:
    ```env
    # Database
    MONGODB_URI=mongodb://localhost:27017/employeeDB

    # AI API Keys (Add at least one)
    GEMINI_API_KEY=your_gemini_api_key
    OPENROUTER_API_KEY=your_openrouter_api_key
    GROQ_API_KEY=your_groq_api_key
    ```

## Usage

1.  **Start the Backend Server**:
    ```bash
    node server.js
    ```
    The server will start at `http://localhost:3000`.

2.  **Launch the Frontend**:
    Open `index.html` in your web browser. You can also use a simple HTTP server like "Live Server" in VS Code for a better experience.

3.  **Interact with the Chatbot**:
    *   **Text Mode**: Type your details (e.g., "My name is John Doe, email is john@example.com...") and the chatbot will fill the form for you.
    *   **File Mode**: Upload a file containing your information to have it parsed and entered automatically.

4.  **Submit the Form**:
    Review the auto-filled data and click "Submit" to save your application to the database.

## API Endpoints

*   **POST** `/api/insurance`: Submits a new insurance application.
    *   **Body**: JSON object containing fields like `firstName`, `lastName`, `email`, `phone`, `coverage`, etc.
*   **POST** `/api/employees`: (Legacy/Utility) Endpoint for reducing employee performance reviews.

## Project Structure

*   `server.js`: Express server setup and database connection.
*   `chatbot.js`: Main frontend logic handling UI interactions and form submission.
*   `chatbot-logic.js`: Core AI logic for processing user input and API calls.
*   `index.html`: Main application interface.
*   `style.css`, `form-style.css`: Stylesheets for the application.

## License

ISC
