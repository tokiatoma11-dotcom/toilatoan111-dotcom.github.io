import os
import itertools
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List

app = FastAPI(title="Multi AI Studio Backend")

# Cho phép Frontend kết nối CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. Khai báo 11 Gemini Keys (Mặc định lấy từ biến môi trường GEMINI_KEYS phân cách bằng dấu '|')
RAW_GEMINI_KEYS = os.getenv(
    "GEMINI_KEYS",
    "AQ.Ab8RN6ITpaGq7IreWiKjDXRMs_Wc6cE9do_JzpSDG2-45WC79Q | AQ.Ab8RN6ITpaGq7IreWiKjDXRMs_Wc6cE9do_JzpSDG2-45WC79Q | AQ.Ab8RN6KEabKP85u7808fHQ5jQZu_iIF01RjAoFqxaWAQFI86ZA | AQ.Ab8RN6JbX8nQohDj9vxd3vMOWTAQ98OD_3Nl6cNjA9g5c-DmZg | AQ.Ab8RN6LH20fDJdDCUMX0cEee5Q8GQfxDb8NFSWFzrVS8Yk9XUQ | AQ.Ab8RN6K8_R6h_z1lI6a_h2wU-yIAJLwB1dWOpIq7KdBIuXObHg | AQ.Ab8RN6Ktn4JgxS4OkioPQKf6nb4BrLMs4za4FJj6_SbiyXNAHA | AQ.Ab8RN6KcR_QRGOLB5EEuCyPBuvB09Z0N7cBA2ctECkuLcJ25eQ | AQ.Ab8RN6IveejKg0xbR48bxhmrBApLbPs0dAATWi7mUNHz9XUoOQ | AQ.Ab8RN6KflkQ03zo10naDLvqH5mmSsTgBkUNm53lMxedx-TA3iA | AQ.Ab8RN6JDFM65tm4EDcCHQpc8U20vF7YfLXrBq2z4jFyGWvqG2A | AQ.Ab8RN6K7Y4Hk5RzcMuDtHY0PshVBXZmCGEs14aDxIJNw_YxjXw"
)
GEMINI_KEYS = [k.strip() for k in RAW_GEMINI_KEYS.split("|") if k.strip()]
gemini_pool = itertools.cycle(GEMINI_KEYS) if GEMINI_KEYS else None

# 2. Groq Keys
RAW_GROQ_KEYS = os.getenv("GROQ_KEYS", "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")
GROQ_KEYS = [k.strip() for k in RAW_GROQ_KEYS.replace("|", ",").split(",") if k.strip()]
groq_pool = itertools.cycle(GROQ_KEYS) if GROQ_KEYS else None


class VisionRequest(BaseModel):
    base64_data: str
    mime_type: str
    user_query: Optional[str] = "Mô tả hình ảnh này"


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    model: str
    messages: List[ChatMessage]
    temperature: float = 0.5
    top_p: float = 0.9
    reasoning_effort: str = "medium"


# --- API TRÍCH XUẤT ẢNH BẰNG GEMINI (XOAY VÒNG 11 KEYS) ---
@app.post("/api/vision")
async def process_vision(req: VisionRequest):
    if not GEMINI_KEYS:
        raise HTTPException(status_code=500, detail="Chưa cấu hình Gemini Keys")

    clean_base64 = req.base64_data.split(",")[-1]
    prompt_text = f"Hãy đóng vai trò mắt thần thị giác: Trích xuất toàn bộ dữ liệu, bảng biểu, con số, văn bản, biểu đồ hoặc chi tiết hình ảnh quan trọng nhất để phục vụ trực tiếp cho câu hỏi này: '{req.user_query}'"

    # Thử xoay vòng qua các Key đến khi có Key thành công
    for _ in range(len(GEMINI_KEYS)):
        current_key = next(gemini_pool)
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={current_key}"
        
        payload = {
            "contents": [{
                "parts": [
                    {"inlineData": {"mimeType": req.mime_type, "data": clean_base64}},
                    {"text": prompt_text}
                ]
            }]
        }

        async with httpx.AsyncClient() as client:
            try:
                res = await client.post(url, json=payload, timeout=30.0)
                if res.status_code == 429:
                    continue  # Key bị dính Rate Limit -> chuyển Key tiếp theo
                if res.status_code == 200:
                    data = res.json()
                    text = data["candidates"][0]["content"]["parts"][0]["text"]
                    return {"success": True, "text": text}
            except Exception:
                continue

    raise HTTPException(status_code=429, detail="Tất cả Gemini API Keys đều bận hoặc hết hạn!")


# --- API STREAM CHAT QUA GROQ ---
@app.post("/api/chat")
async def stream_chat(req: ChatRequest):
    if not GROQ_KEYS:
        raise HTTPException(status_code=500, detail="Chưa cấu hình Groq Key")

    current_groq_key = next(groq_pool)
    url = "https://api.groq.com/openai/v1/chat/completions"
    
    payload = {
        "model": req.model,
        "messages": [m.model_dump() for m in req.messages],
        "temperature": req.temperature,
        "top_p": req.top_p,
        "reasoning_effort": req.reasoning_effort,
        "max_completion_tokens": 2048,
        "stream": True
    }
    
    headers = {
        "Authorization": f"Bearer {current_groq_key}",
        "Content-Type": "application/json"
    }

    async def generate_stream():
        async with httpx.AsyncClient() as client:
            async with client.stream("POST", url, headers=headers, json=payload, timeout=60.0) as response:
                async for chunk in response.aiter_bytes():
                    yield chunk

    return StreamingResponse(generate_stream(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
