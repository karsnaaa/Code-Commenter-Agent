import os
import google.generativeai as genai
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv(override=True)

app = FastAPI(title="Code Reasoner API (Gemini Powered)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CodeRequest(BaseModel):
    code: str
    language: str = "Auto-detect"
    output_language: str = "English"
    analysis_mode: str = "Standard"
    
class AnalysisResponse(BaseModel):
    analysis: str
    statistics: dict
    time_complexity: str = "N/A"
    space_complexity: str = "N/A"
    refactored_code: str = None
    language: str

import ast

def calculate_statistics(code: str, language: str) -> dict:
    lines = code.split('\n')
    total_lines = len(lines)
    code_lines = len([line for line in lines if line.strip() and not line.strip().startswith(('#', '//', '/*'))])
    
    stats = {
        "total_lines": total_lines,
        "code_lines": code_lines,
        "functions": 0,
        "classes": 0,
        "variables": 0,
        "imports": 0
    }
    
    # Simple Python AST parser for accurate metrics
    is_python = language.lower() in ['python', 'auto-detect']
    if is_python:
        try:
            tree = ast.parse(code)
            for node in ast.walk(tree):
                if isinstance(node, ast.FunctionDef) or isinstance(node, ast.AsyncFunctionDef):
                    stats["functions"] += 1
                elif isinstance(node, ast.ClassDef):
                    stats["classes"] += 1
                elif isinstance(node, ast.Assign):
                    stats["variables"] += len(node.targets)
                elif isinstance(node, ast.AnnAssign):
                    stats["variables"] += 1
                elif isinstance(node, ast.Import) or isinstance(node, ast.ImportFrom):
                    stats["imports"] += 1
            
            if language.lower() == 'auto-detect': # Force set if parsed successfully
                pass # The outer wrapper will handle language return
        except SyntaxError:
            pass # Fall back or not python

    return stats

SYSTEM_PROMPT = """You are an expert-level code reasoning app whose primary goal is to explain WHY a piece of code is written the way it is - not just WHAT it does.

Your task is to analyze the full script holistically and provide deep reasoning behind the design decisions, logic flow, and implementation choices.

IMPORTANT: Do NOT use any emojis anywhere in your response. Use plain text only.

Instructions:

1. Understand the Full Context First
   - Read the entire script before explaining anything.
   - Identify the purpose of the program (problem it solves).
   - Detect patterns like greedy, dynamic programming, recursion, etc.

2. Explain the Intent (WHY)
   - For each major block or function, explain:
     - Why this logic is needed
     - What problem it addresses
     - Why this approach might have been chosen over alternatives

3. Flow-Based Reasoning
   - Walk through the execution flow step by step
   - Explain how earlier decisions affect later logic
   - Highlight dependencies between variables/functions

4. Decision Justification
   - If conditions, loops, or structures are used:
     - Explain WHY that condition exists
     - Why a loop is necessary (e.g., iteration vs recursion)
     - Why specific data structures are used (list, dict, set, etc.)

5. Alternative Thinking
   - Briefly mention:
     - What alternative approaches could exist
     - Why the current approach is likely better (efficiency, simplicity, constraints)

6. Edge Cases & Safeguards
   - Identify any edge-case handling
   - Explain why those checks are important

7. Human-Like Reasoning Style
   - Avoid robotic line-by-line comments
   - Think like the original developer
   - Use phrases like:
     - "The developer likely chose this because..."
     - "This ensures that..."
     - "Without this step, the code would fail when..."

8. Summarize Strategy
   - At the end, give a short summary of:
     - Overall approach
     - Key idea behind the logic
     - Time/space complexity (if relevant)

Constraints:
- Do NOT just restate code behavior
- Do NOT explain syntax unless necessary
- Focus on reasoning, intent, and design decisions
- Do NOT use emojis anywhere in your response

9. Complexity Analysis (REQUIRED)
   - At the very end of your response, you MUST include the literal strings:
     **Time Complexity:** O(...)
     **Space Complexity:** O(...)
     Replace `...` with the actual Big-O notation. Do NOT omit this.

Output Format (use exactly this structure, no emojis):

Format each of the 6 section headings as a markdown ## heading with its number, like this:
## 1. Problem Understanding
## 2. Execution Flow Overview
## 3. Why Each Key Part Exists
## 4. Design Decisions & Tradeoffs
## 5. Edge Cases Considered
## 6. Final Strategy Summary

After each paragraph or subtopic, add a blank line for spacing.
Do NOT change this heading format under any circumstances.
"""

# Configure Gemini API
# This requires GEMINI_API_KEY to be set in the environment or in a .env file
api_key = os.getenv("GEMINI_API_KEY", "AIzaSyCgLRrgfVCC0mSUdADwBquD5d5PGN1ubY8")
if api_key:
    genai.configure(api_key=api_key)

# We can specify the model, gemini-pro is universally available for older keys
MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-2.5-flash") 

@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_code(req: CodeRequest):
    if not req.code.strip():
        raise HTTPException(status_code=400, detail="No code provided")
        
    stats = calculate_statistics(req.code, req.language)
    
    # Simple heuristics to detect Python for language label
    final_language = req.language
    if final_language.lower() == 'auto-detect':
        try:
            ast.parse(req.code)
            final_language = 'Python'
        except SyntaxError:
            final_language = 'unknown / other'
            
    persona_rules = ""
    if req.analysis_mode == "Beginner":
        persona_rules = "\n\n**PERSONA**: You are teaching a complete beginner. Use very simple words, easy-to-understand analogies, and avoid all jargon. Keep explanations short, digestible, and encouraging."
    elif req.analysis_mode == "Intermediate":
        persona_rules = "\n\n**PERSONA**: You are explaining to a developer with some experience. Use clear technical language, explain patterns and tradeoffs, and assume familiarity with basic programming concepts."
    elif req.analysis_mode == "Advanced":
        persona_rules = "\n\n**PERSONA**: You are a Lead Software Architect reviewing code for a senior peer. Be concise and precise. Focus on architectural patterns, scalability tradeoffs, Big-O optimizations, and code robustness. Skip basics entirely."

    refactoring_instruction = "\n\n10. **Refactored Code (REQUIRED)**\n   - At the raw end of your explanation (after the Big-O metrics), generate an exact, highly optimized, clean, and rewritten alternative version of the input code.\n   - You MUST place it exactly under this markdown heading:\n\n### Refactored Code\n\n```<language>\n<your better code>\n```"

    prompt = f"### 🧪 Input (Language: {final_language}):\n```\n{req.code}\n```\n\nPlease provide your analysis following the exact Output Format requested.\n\nIMPORTANT: Generate the entire detailed explanation and output in {req.output_language}. Do not use English unless the output language is English or it is necessary for code snippets.{persona_rules}{refactoring_instruction}"
    
    try:
        # Initialize the model with the system instruction
        model = genai.GenerativeModel(
            model_name=MODEL_NAME,
            system_instruction=SYSTEM_PROMPT
        )
        
        # Call the Gemini API
        response = model.generate_content(prompt)
        text = response.text
        
        import re
        time_match = re.search(r'\*\*Time Complexity:\*\*\s*(O\([^\)]+\)|[^\n]+)', text, re.IGNORECASE)
        space_match = re.search(r'\*\*Space Complexity:\*\*\s*(O\([^\)]+\)|[^\n]+)', text, re.IGNORECASE)
        refactored_match = re.search(r'### Refactored Code\s*(?:```[\w]*\s*\n)([\s\S]*?)(?:```|$)', text, re.IGNORECASE)
        
        time_complexity = time_match.group(1).strip() if time_match else "N/A"
        space_complexity = space_match.group(1).strip() if space_match else "N/A"
        
        # If the outer match fails to grab the content inside ticks, try a looser fallback match
        if refactored_match:
            refactored_code = refactored_match.group(1).strip()
        else:
            fallback = re.search(r'### Refactored Code([\s\S]*)', text, re.IGNORECASE)
            refactored_code = fallback.group(1).strip().replace("```python", "").replace("```javascript", "").replace("```", "").strip() if fallback else "Could not extract refactoring."
        
        # Optionally, remove the refactored code from the raw analysis string so it doesn't double-render
        if "### Refactored Code" in text:
            raw_analysis = text.split("### Refactored Code")[0].strip()
        else:
            raw_analysis = text

        # If the LLM awkwardly wrapped its ENTIRE output in a markdown code fence, strip it
        raw_analysis = re.sub(r'^```(?:markdown)?\s*\n', '', raw_analysis, flags=re.IGNORECASE)
        if raw_analysis.endswith("\n```"):
            raw_analysis = raw_analysis[:-4].strip()
        if raw_analysis.endswith("```"):
            raw_analysis = raw_analysis[:-3].strip()

        return AnalysisResponse(
            analysis=raw_analysis,
            statistics=stats,
            time_complexity=time_complexity,
            space_complexity=space_complexity,
            refactored_code=refactored_code,
            language=final_language
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to communicate with Gemini API: {str(e)}")

# Add a simple health check root endpoint
@app.get("/")
def read_root():
    return {"status": "ok", "message": "Code Reasoner API (Gemini backend) is running"}

