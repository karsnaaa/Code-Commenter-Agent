import os
import google.generativeai as genai

api_key = os.getenv("GEMINI_API_KEY", "AIzaSyCPh7wzrG3ScGOzYNlbVrIoaqCwJTkR89o")
genai.configure(api_key=api_key)

valid_model = None
for m in genai.list_models():
    if 'generateContent' in m.supported_generation_methods:
        if 'flash' in m.name or 'pro' in m.name or 'gemini' in m.name:
            valid_model = m.name.replace("models/", "")
            break

if valid_model:
    print(f"Found model: {valid_model}")
    with open("main.py", "r", encoding="utf-8") as f:
        content = f.read()
    
    # Replace gemini-pro or gemini-1.5-flash with the actual model name found
    import re
    content = re.sub(r'MODEL_NAME \= os\.getenv\("GEMINI_MODEL", "[^"]+"\)', f'MODEL_NAME = os.getenv("GEMINI_MODEL", "{valid_model}")', content)
    
    with open("main.py", "w", encoding="utf-8") as f:
        f.write(content)
    print("Updated main.py")
else:
    print("No valid models found")
