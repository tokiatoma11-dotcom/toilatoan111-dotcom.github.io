import os
import itertools
import base64
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
from google import genai
from google.genai import types

app = FastAPI()

# Bật CORS cho phép tất cả các nguồn truy cập
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. Lấy và phân tách danh sách API Key
RAW_KEYS = os.getenv("GEMINI_KEYS", "")
API_KEYS = [key.strip() for key in RAW_KEYS.split("|") if key.strip()]
key_cycle = itertools.cycle(API_KEYS) if API_KEYS else None

def get_next_key():
    if not key_cycle:
        raise HTTPException(status_code=500, detail="Chưa cấu hình GEMINI_KEYS trên Render!")
    return next(key_cycle)

# 2. Schema dữ liệu
class VisionRequest(BaseModel):
    base64_data: str
    mime_type: str
    user_query: Optional[str] = "Phân tích chi tiết hình ảnh này."

class MessageItem(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    model: Optional[str] = "gemini-2.5-flash"
    messages: List[MessageItem]
    temperature: Optional[float] = 0.5
    top_p: Optional[float] = 0.9
    reasoning_effort: Optional[str] = "medium"

@app.get("/")
def root():
    return {"status": "Backend multi-ai ready", "active_keys": len(API_KEYS)}

# 3. Endpoint xử lý hình ảnh (/api/vision)
@app.post("/api/vision")
def process_vision(data: VisionRequest):
    current_key = get_next_key()
    try:
        client = genai.Client(api_key=current_key)
        
        raw_base64 = data.base64_data
        if "," in raw_base64:
            raw_base64 = raw_base64.split(",")[1]
            
        image_bytes = base64.b64decode(raw_base64)
        
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type=data.mime_type),
                data.user_query or "Hãy mô tả và trích xuất dữ liệu từ ảnh này."
            ]
        )
        return {"text": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Vision Error: {str(e)}")

# 4. Endpoint Chat chuẩn SSE Streaming (/api/chat)
@app.post("/api/chat")
def chat_stream(data: ChatRequest):
    current_key = get_next_key()
    
    try:
        client = genai.Client(api_key=current_key)
        
        conversation_prompt = ""
        for msg in data.messages:
            role_label = "User" if msg.role == "user" else "Model"
            conversation_prompt += f"{role_label}: {msg.content}\n"
        conversation_prompt += "Model:"

        def generate_sse():
            try:
                response_stream = client.models.generate_content_stream(
                    model="gemini-2.5-flash",
                    contents=conversation_prompt
                )
                for chunk in response_stream:
                    if chunk.text:
                        payload = {
                            "choices": [
                                {"delta": {"content": chunk.text}}
                            ]
                        }
                        yield f"data: {json.dumps(payload)}\n\n"
                yield "data: [DONE]\n\n"
            except Exception as stream_err:
                err_payload = {"choices": [{"delta": {"content": f"\n[Lỗi Stream: {str(stream_err)}]"}}]}
                yield f"data: {json.dumps(err_payload)}\n\n"
                yield "data: [DONE]\n\n"

        return StreamingResponse(
            generate_sse(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
            }
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat Error: {str(e)}")
