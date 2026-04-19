# Code Reasoner App

A sleek, simple AI-powered app that explains the **WHY** behind code decisions, not just the WHAT. 

## Structure
- `frontend/`: Simple HTML, CSS, JS using `marked.js` to render markdown properly.
- `backend/`: FastAPI Python server that accepts the code and proxy it to the Google Gemini API with a robust system prompt.

## Prerequisites
1. [Python](https://www.python.org/downloads/) 3.10+
2. A Google Gemini API Key. You can get one from Google AI Studio.

## Setup and Run

### 1. Set up the Environment
Open a terminal in the `backend` folder:
```bash
pip install -r requirements.txt
```

Create a `.env` file in the `backend/` directory and add your API key:
```env
GEMINI_API_KEY=your_api_key_here
```

### 2. Run the Backend
```bash
uvicorn main:app --reload --port 8000
```

### 3. Open the Frontend
Since it's pure HTML/JS/CSS, you can simply double-click `frontend/index.html` to open it in your browser, or serve it using an extension like Live Server in VSCode.

## Customization
If you wish to use a different Gemini model (default is `gemini-1.5-flash`), simply specify it in your `.env` file:
```env
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-1.5-pro
```
