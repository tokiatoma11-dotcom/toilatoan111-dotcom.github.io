// assets/script.js
import CONFIG from './config.js';
import { GoogleGenAI } from "https://esm.run/@google/genai";

// Lấy cấu hình và API Key đã giải mã từ config.js
const GEMINI_API_KEYS = CONFIG.GEMINI_API_KEYS;
const GROQ_API_KEY = CONFIG.GROQ_API_KEY;

let currentGeminiKeyIndex = 0;

function getNextGeminiKey() {
    const key = GEMINI_API_KEYS[currentGeminiKeyIndex];
    currentGeminiKeyIndex = (currentGeminiKeyIndex + 1) % GEMINI_API_KEYS.length;
    return key;
}

let chats = JSON.parse(localStorage.getItem("multi_ai_chats_v26")) || [];
let currentChatId = null;
let selectedModel = CONFIG.DEFAULT_MODEL;

// Khởi tạo trạng thái file rỗng chuẩn
let selectedFile = { base64: null, type: null, name: null, textContent: null };

let isWebSearchEnabled = false;
let currentEffort = CONFIG.DEFAULT_EFFORT;
let isThinkingEnabled = CONFIG.IS_THINKING_ENABLED;

// Phân tích hình ảnh bằng Gemini
async function processVisionWithGemini(base64Data, mimeType, userQuery) {
    const cleanBase64 = base64Data.split(',')[1] || base64Data;
    const modelsToTry = ["gemini-3.6-flash", "gemini-2.5-flash"];
    const maxAttempts = GEMINI_API_KEYS.length;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const apiKey = getNextGeminiKey();
        const geminiAi = new GoogleGenAI({ apiKey: apiKey });

        for (const modelName of modelsToTry) {
            try {
                const response = await geminiAi.models.generateContent({
                    model: modelName,
                    contents: [
                        { inlineData: { data: cleanBase64, mimeType: mimeType } },
                        `Hãy đóng vai trò mắt thần thị giác: Trích xuất toàn bộ dữ liệu, bảng biểu, con số, văn bản, biểu đồ hoặc chi tiết hình ảnh quan trọng nhất để phục vụ trực tiếp cho câu hỏi này: "${userQuery || 'Mô tả hình ảnh này'}"`
                    ]
                });
                return response.text;
            } catch (err) {
                console.warn(`[Gemini API] Key index ${currentGeminiKeyIndex} hoặc model ${modelName} bị quá tải/lỗi:`, err);
            }
        }
    }
    return null;
}

// Xử lý các menu chọn Effort, Thinking, Search, Model
window.toggleEffortDropdown = function(e) {
    e.stopPropagation();
    document.getElementById("modelDropdownMenu")?.classList.remove("active");
    document.getElementById("modelDropdownBtn")?.classList.remove("active");
    
    const menu = document.getElementById("effortDropdownMenu");
    const btn = document.getElementById("effortDropdownBtn");
    menu.classList.toggle("active");
    btn.classList.toggle("active");
};

window.selectEffort = function(value) {
    currentEffort = value;
    document.querySelectorAll("#effortDropdownMenu .model-option").forEach(item => {
        const isTarget = item.getAttribute("data-value") === value;
        item.classList.toggle("selected", isTarget);
    });

    const labels = { low: 'Low', medium: 'Medium', high: 'High', extra: 'Extra', max: 'Max' };
    document.getElementById("effortBtnLabel").innerText = labels[value];
    
    document.getElementById("effortDropdownMenu")?.classList.remove("active");
    document.getElementById("effortDropdownBtn")?.classList.remove("active");
};

window.toggleThinking = function(enabled) {
    isThinkingEnabled = enabled;
};

window.toggleWebSearch = function() {
    isWebSearchEnabled = !isWebSearchEnabled;
    const btn = document.getElementById("webSearchToggle");
    btn.classList.toggle("active", isWebSearchEnabled);
    document.getElementById("searchStatus").innerText = isWebSearchEnabled ? "Web: Bật" : "Web: Tắt";
};

window.toggleModelDropdown = function(e) {
    e.stopPropagation();
    document.getElementById("effortDropdownMenu")?.classList.remove("active");
    document.getElementById("effortDropdownBtn")?.classList.remove("active");

    const menu = document.getElementById("modelDropdownMenu");
    const btn = document.getElementById("modelDropdownBtn");
    menu.classList.toggle("active");
    btn.classList.toggle("active");
};

document.addEventListener('click', () => {
    document.getElementById("modelDropdownMenu")?.classList.remove("active");
    document.getElementById("modelDropdownBtn")?.classList.remove("active");
    document.getElementById("effortDropdownMenu")?.classList.remove("active");
    document.getElementById("effortDropdownBtn")?.classList.remove("active");
    document.getElementById("attachMenu")?.classList.remove('active');
});

window.selectModel = function(value, label) {
    selectedModel = value;
    document.getElementById("currentModelLabel").innerText = label;
    document.querySelectorAll("#modelDropdownMenu .model-option").forEach(opt => {
        opt.classList.toggle("selected", opt.getAttribute("data-value") === value);
    });
    handleModelChange(value);
};

async function performWebSearch(query) {
    try {
        const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`);
        const data = await res.json();
        let text = "";
        if (data.RelatedTopics) text = data.RelatedTopics.filter(i => i.Text).slice(0, 3).map(i => `- ${i.Text}`).join('\n');
        if (!text && data.Abstract) text = `- ${data.Abstract}`;
        return text ? `[Web Search Results for "${query}"]:\n${text}` : "";
    } catch { return ""; }
}

function showCustomModal(title, desc, okText, cancelText, onOk, onCancel) {
    const modalOverlay = document.getElementById("customModalOverlay");
    document.getElementById("modalTitle").innerText = title;
    document.getElementById("modalDesc").innerText = desc;
    
    const okBtn = document.getElementById("modalOkBtn");
    const cancelBtn = document.getElementById("modalCancelBtn");
    
    okBtn.innerText = okText;
    cancelBtn.innerText = cancelText;

    modalOverlay.classList.add("active");

    const newOkBtn = okBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    newOkBtn.addEventListener("click", () => {
        modalOverlay.classList.remove("active");
        if (onOk) onOk();
    });

    newCancelBtn.addEventListener("click", () => {
        modalOverlay.classList.remove("active");
        if (onCancel) onCancel();
    });
}

// Xử lý đính kèm tệp và xem ảnh/video
window.toggleAttachmentMenu = (e) => { e.stopPropagation(); document.getElementById('attachMenu').classList.toggle('active'); };
window.openInput = (id) => { document.getElementById(id).click(); document.getElementById('attachMenu').classList.remove('active'); };

window.openMediaViewer = (src, type) => {
    const container = document.getElementById("viewerMediaContainer");
    container.innerHTML = type === 'image' ? `<img src="${src}" class="image-viewer-content">` : `<video src="${src}" class="image-viewer-content" controls autoplay></video>`;
    document.getElementById("imageViewer").classList.add("active");
};
window.closeImageViewer = () => document.getElementById("imageViewer").classList.remove("active");

window.handleFileSelect = function(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Reset lại bộ nhớ file trước khi nhận file mới
    clearSelectedFile();

    selectedFile.name = file.name;
    selectedFile.type = file.type;

    if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.csv')) {
        const reader = new FileReader();
        reader.onload = (evt) => selectedFile.textContent = evt.target.result;
        reader.readAsText(file);
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
        selectedFile.base64 = evt.target.result;
        document.getElementById("fileName").innerText = `📎 ${file.name}`;
        document.getElementById("filePreview").classList.add("active");
    };
    reader.readAsDataURL(file);
};

// Hàm dọn dẹp sạch sẽ dữ liệu file tạm
window.clearSelectedFile = function() {
    selectedFile = { base64: null, type: null, name: null, textContent: null };
    ['imageInput', 'videoInput', 'fileInput'].forEach(id => {
        const input = document.getElementById(id);
        if (input) input.value = '';
    });
    const preview = document.getElementById("filePreview");
    if (preview) preview.classList.remove("active");
};

// Xử lý Sidebar & Chat History
window.toggleSidebar = () => {
    document.getElementById("sidebar").classList.toggle("open");
    document.getElementById("overlay").classList.toggle("active");
};

window.promptNewChat = function() {
    const active = chats.find(c => c.id === currentChatId);
    if (active && active.messages.length > 0) {
        showCustomModal(
            "Cuộc trò chuyện mới",
            "Bạn muốn lưu cuộc trò chuyện hiện tại và bắt đầu đoạn chat mới chứ?",
            "Tạo mới",
            "Hủy",
            () => createNewChat(),
            () => {}
        );
    } else {
        createNewChat();
    }
};

window.createNewChat = function() {
    currentChatId = Date.now();
    chats.unshift({ id: currentChatId, title: "Cuộc trò chuyện mới", model: selectedModel, messages: [] });
    saveAndRender();
    renderMessages([]);
};

window.handleModelChange = function(newModel) {
    const active = chats.find(c => c.id === currentChatId);
    if (active && active.messages.length > 0) {
        showCustomModal(
            "Chuyển đổi mô hình AI",
            "Bạn muốn giữ lại đoạn chat hiện tại hay tạo cuộc trò chuyện mới với AI này?",
            "Tạo chat mới",
            "Giữ đoạn chat",
            () => {
                createNewChat();
                selectedModel = newModel;
                chats[0].model = newModel;
                saveAndRender();
            },
            () => {
                active.model = newModel;
                saveAndRender();
            }
        );
    } else {
        if (active) active.model = newModel;
        saveAndRender();
    }
};

window.deleteChat = function(e, id) {
    e.stopPropagation();
    showCustomModal(
        "Xóa cuộc trò chuyện",
        "Bạn có chắc chắn muốn xóa cuộc trò chuyện này không?",
        "Xóa",
        "Hủy",
        () => {
            chats = chats.filter(c => c.id !== id);
            if (currentChatId === id) {
                if (chats.length > 0) loadChat(chats[0].id);
                else createNewChat();
            } else {
                saveAndRender();
            }
        },
        () => {}
    );
};

function renderMessages(messages) {
    const chatBox = document.getElementById("chatBox");
    if (!messages || messages.length === 0) {
        chatBox.innerHTML = `<div class="message-wrapper ai"><div class="message ai-msg">Xin chào! Hãy nhập câu hỏi hoặc tải ảnh/bảng biểu lên để bắt đầu...</div></div>`;
        return;
    }
    chatBox.innerHTML = messages.map(m => {
        if (m.role === 'user') {
            let media = '';
            if (m.file) {
                if (m.file.type && m.file.type.startsWith('image/')) media = `<img src="${m.file.base64}" class="chat-img" onclick="openMediaViewer('${m.file.base64}', 'image')">`;
                else if (m.file.type && m.file.type.startsWith('video/')) media = `<video src="${m.file.base64}" class="chat-video" onclick="openMediaViewer('${m.file.base64}', 'video')"></video>`;
                else media = `<div class="file-card">📄 ${m.file.name}</div>`;
            }
            return `<div class="message-wrapper user"><div class="message user-msg">${media}${m.text ? m.text.replace(/</g, "&lt;").replace(/\n/g, '<br>') : ''}</div></div>`;
        } else {
            return `<div class="message-wrapper ai"><div class="message ai-msg">${marked.parse(cleanResponseText(m.text || ''))}</div></div>`;
        }
    }).join('');
    chatBox.scrollTop = chatBox.scrollHeight;
}

function cleanResponseText(text) {
    return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

// Gửi tin nhắn và xử lý phân tích dữ liệu
window.sendMessage = async function() {
    const tx = document.getElementById("userInput");
    const prompt = tx.value.trim();

    if (!prompt && !selectedFile.base64) return;

    if (!currentChatId) createNewChat();
    const active = chats.find(c => c.id === currentChatId);
    active.model = selectedModel;

    // Lấy bản sao của file hiện tại và làm sạch ngay bộ nhớ tạm
    const currentFile = selectedFile.base64 ? { ...selectedFile } : null;
    clearSelectedFile();

    const userMessage = { 
        role: "user", 
        text: prompt || `Đã gửi tệp: ${currentFile.name}`, 
        file: currentFile 
    };

    active.messages.push(userMessage);
    if (active.messages.length === 1) {
        active.title = prompt ? prompt.substring(0, 20) + "..." : currentFile.name;
    }

    tx.value = "";
    renderMessages(active.messages);
    saveAndRender();

    const chatBox = document.getElementById("chatBox");
    const msgId = "ai-" + Date.now();
    chatBox.insertAdjacentHTML('beforeend', `<div class="message-wrapper ai"><div class="message ai-msg streaming-cursor" id="${msgId}">AI đang suy nghĩ...</div></div>`);
    chatBox.scrollTop = chatBox.scrollHeight;

    const targetMsgEl = document.getElementById(msgId);

    try {
        let apiContent = prompt;

        // Xử lý nếu LƯỢT CHAT NÀY có ảnh mới gửi lên
        if (currentFile && currentFile.type && currentFile.type.startsWith('image/')) {
            targetMsgEl.innerText = "Đang phân tích hình ảnh mới...";
            const visionResult = await processVisionWithGemini(currentFile.base64, currentFile.type, prompt);

            if (visionResult) {
                apiContent = `[Thông tin trích xuất từ hình ảnh hiện tại]:\n${visionResult}\n\n[Câu hỏi/Yêu cầu của người dùng]: ${prompt || "Hãy phân tích thông tin trên hình ảnh."}`;
            } else {
                apiContent = `[Hệ thống: Không thể phân tích hình ảnh này].\n${prompt}`;
            }
        }

        if (currentFile && currentFile.textContent) {
            apiContent += `\n\n[Nội dung tệp dữ liệu ${currentFile.name}]:\n${currentFile.textContent}\n\nHãy tổng hợp, phân tích các số liệu hoặc bảng thông tin trên.`;
        }

        if (isWebSearchEnabled && prompt) {
            const searchRes = await performWebSearch(prompt);
            if (searchRes) apiContent = `${searchRes}\n\n[Dựa vào thông tin trên, hãy trả lời]: ${prompt}`;
        }

        userMessage.apiText = apiContent;

        // Tạo payload chuẩn gửi cho Groq API
        const payload = active.messages.map(m => ({ 
            role: m.role === 'user' ? 'user' : 'assistant', 
            content: m.apiText || m.text 
        }));
        
        let modelName = selectedModel === "gpt_oss_20b" ? "openai/gpt-oss-20b" : "openai/gpt-oss-120b";

        const effortConfigs = {
            low:    { effort: "low",    temp: 0.2, top_p: 0.8 },
            medium: { effort: "medium", temp: 0.5, top_p: 0.9 },
            high:   { effort: "high",   temp: 0.7, top_p: 0.95 },
            extra:  { effort: "high",   temp: 0.85, top_p: 1.0 },
            max:    { effort: "high",   temp: 1.0,  top_p: 1.0 }
        };

        const config = effortConfigs[currentEffort] || effortConfigs["medium"];

        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { 
                "Authorization": `Bearer ${GROQ_API_KEY}`, 
                "Content-Type": "application/json" 
            },
            body: JSON.stringify({
                model: modelName,
                messages: payload,
                temperature: isThinkingEnabled ? config.temp : 0.1,
                top_p: config.top_p,
                reasoning_effort: isThinkingEnabled ? config.effort : "low",
                max_completion_tokens: 2048,
                stream: true
            })
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

        let fullReply = "";
        let displayReply = "";
        let charQueue = [];
        let isStreamingFinished = false;
        targetMsgEl.innerText = "";

        const renderInterval = setInterval(() => {
            if (charQueue.length > 0) {
                const chunkSize = charQueue.length > 20 ? 3 : 1;
                for (let i = 0; i < chunkSize && charQueue.length > 0; i++) {
                    displayReply += charQueue.shift();
                }
                targetMsgEl.innerHTML = marked.parse(cleanResponseText(displayReply));
                chatBox.scrollTop = chatBox.scrollHeight;
            } else if (isStreamingFinished) {
                clearInterval(renderInterval);
                targetMsgEl.classList.remove("streaming-cursor");
                active.messages.push({ role: "ai", text: fullReply });
                saveAndRender();
            }
        }, 5);

        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                const cleanedLine = line.trim();
                if (!cleanedLine || cleanedLine.startsWith(':') || cleanedLine === 'data: [DONE]') continue;

                if (cleanedLine.startsWith('data: ')) {
                    try {
                        const parsed = JSON.parse(cleanedLine.replace('data: ', ''));
                        const content = parsed.choices[0]?.delta?.content || "";
                        if (content) {
                            fullReply += content;
                            charQueue.push(...content.split(''));
                        }
                    } catch (e) {
                        console.error("Lỗi parse SSE:", e);
                    }
                }
            }
        }

        isStreamingFinished = true;

    } catch (err) {
        if (targetMsgEl) {
            targetMsgEl.classList.remove("streaming-cursor");
            targetMsgEl.innerText = "⚠️ Lỗi kết nối: " + err.message;
        }
    }
};

function saveAndRender() {
    localStorage.setItem("multi_ai_chats_v26", JSON.stringify(chats));
    document.getElementById("historyList").innerHTML = chats.map(c => `
        <div class="history-item ${c.id === currentChatId ? 'active' : ''}" onclick="loadChat(${c.id})">
            <span class="history-title">${c.title.replace(/</g, "&lt;")}</span>
            <button class="delete-chat-btn" onclick="deleteChat(event, ${c.id})">×</button>
        </div>
    `).join('');
}

window.loadChat = function(id) {
    currentChatId = id;
    const active = chats.find(c => c.id === currentChatId);
    if (active) {
        selectedModel = active.model || 'gpt_oss_120b';
        const labels = { 'gpt_oss_120b': 'GPT OSS 120B', 'gpt_oss_20b': 'GPT OSS 20B' };
        document.getElementById("currentModelLabel").innerText = labels[selectedModel];
        document.querySelectorAll("#modelDropdownMenu .model-option").forEach(opt => {
            opt.classList.toggle("selected", opt.getAttribute("data-value") === selectedModel);
        });
        renderMessages(active.messages);
    }
    saveAndRender();
};

function showCopyToast(message = "📋 Đã sao chép liên kết vào khay nhớ tạm!") {
    const toast = document.getElementById("copyToast");
    if (!toast) return;
    toast.innerText = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2000);
}

document.getElementById("chatBox").addEventListener("click", function(e) {
    const link = e.target.closest("a");
    if (link) {
        e.preventDefault();
        const urlToCopy = link.getAttribute("href") || link.href;
        if (urlToCopy) {
            navigator.clipboard.writeText(urlToCopy).then(() => {
                showCopyToast();
            }).catch(err => {
                console.error("Lỗi sao chép:", err);
            });
        }
    }
});

// Khởi chạy ứng dụng
if (chats.length > 0) loadChat(chats[0].id);
else createNewChat();
