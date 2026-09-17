const CONFIG = {
    API_BASE_URL: "https://toilatoan111-dotcom-github-io.onrender.com"
};

let chats = JSON.parse(localStorage.getItem("multi_ai_chats_v26")) || [];
let currentChatId = null;
let selectedModel = "gpt_oss_120b";
let selectedFile = { base64: null, type: null, name: null, textContent: null };
let isWebSearchEnabled = false;
let currentEffort = "medium";
let isThinkingEnabled = true;

// 1. Gán trực tiếp hàm vào Window để HTML onclick luôn nhận
window.toggleSidebar = () => {
    document.getElementById("sidebar")?.classList.toggle("open");
    document.getElementById("overlay")?.classList.toggle("active");
};

window.toggleModelDropdown = (e) => {
    if (e) e.stopPropagation();
    document.getElementById("modelDropdownMenu")?.classList.toggle("active");
};

window.selectModel = (value, label) => {
    selectedModel = value;
    const labelEl = document.getElementById("currentModelLabel");
    if (labelEl) labelEl.innerText = label;
    document.getElementById("modelDropdownMenu")?.classList.remove("active");
};

window.toggleAttachmentMenu = (e) => {
    if (e) e.stopPropagation();
    document.getElementById("attachMenu")?.classList.toggle("active");
};

window.openInput = (id) => {
    document.getElementById(id)?.click();
    document.getElementById("attachMenu")?.classList.remove("active");
};

window.handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    selectedFile.name = file.name;
    selectedFile.type = file.type;
    
    const reader = new FileReader();
    reader.onload = (evt) => {
        selectedFile.base64 = evt.target.result;
        const nameEl = document.getElementById("fileName");
        if (nameEl) nameEl.innerText = `📎 ${file.name}`;
        document.getElementById("filePreview")?.classList.add("active");
    };
    reader.readAsDataURL(file);
};

window.clearSelectedFile = () => {
    selectedFile = { base64: null, type: null, name: null, textContent: null };
    ['imageInput', 'videoInput', 'fileInput'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById("filePreview")?.classList.remove("active");
};

window.promptNewChat = () => {
    createNewChat();
};

window.createNewChat = () => {
    currentChatId = Date.now();
    chats.unshift({ id: currentChatId, title: "Cuộc trò chuyện mới", messages: [] });
    saveAndRender();
    renderMessages([]);
};

window.deleteChat = (e, id) => {
    if (e) e.stopPropagation();
    chats = chats.filter(c => c.id !== id);
    if (currentChatId === id) {
        if (chats.length > 0) loadChat(chats[0].id);
        else createNewChat();
    } else {
        saveAndRender();
    }
};

window.loadChat = (id) => {
    currentChatId = id;
    const active = chats.find(c => c.id === currentChatId);
    if (active) renderMessages(active.messages);
    saveAndRender();
};

function saveAndRender() {
    localStorage.setItem("multi_ai_chats_v26", JSON.stringify(chats));
    const hList = document.getElementById("historyList");
    if (hList) {
        hList.innerHTML = chats.map(c => `
            <div class="history-item ${c.id === currentChatId ? 'active' : ''}" onclick="loadChat(${c.id})">
                <span class="history-title">${c.title.replace(/</g, "&lt;")}</span>
                <button class="delete-chat-btn" onclick="deleteChat(event, ${c.id})">×</button>
            </div>
        `).join('');
    }
}

function renderMessages(messages) {
    const chatBox = document.getElementById("chatBox");
    if (!chatBox) return;
    if (!messages || messages.length === 0) {
        chatBox.innerHTML = `<div class="message-wrapper ai"><div class="message ai-msg">Xin chào! Hãy gửi câu hỏi để bắt đầu...</div></div>`;
        return;
    }
    chatBox.innerHTML = messages.map(m => {
        if (m.role === 'user') {
            return `<div class="message-wrapper user"><div class="message user-msg">${m.text.replace(/</g, "&lt;").replace(/\n/g, '<br>')}</div></div>`;
        } else {
            const txt = typeof marked !== 'undefined' ? marked.parse(m.text || '') : (m.text || '');
            return `<div class="message-wrapper ai"><div class="message ai-msg">${txt}</div></div>`;
        }
    }).join('');
    chatBox.scrollTop = chatBox.scrollHeight;
}

// 2. Hàm gửi tin nhắn chính
window.sendMessage = async function() {
    const tx = document.getElementById("userInput");
    const prompt = tx ? tx.value.trim() : "";
    if (!prompt && !selectedFile.base64) return;

    if (!currentChatId) createNewChat();
    const active = chats.find(c => c.id === currentChatId);
    if (!active) return;

    active.messages.push({ role: "user", text: prompt || `Đã gửi tệp: ${selectedFile.name}` });
    if (active.messages.length === 1) active.title = prompt ? prompt.substring(0, 15) + "..." : "Trò chuyện";

    if (tx) tx.value = "";
    clearSelectedFile();
    renderMessages(active.messages);
    saveAndRender();

    const chatBox = document.getElementById("chatBox");
    if (!chatBox) return;

    const msgId = "ai-" + Date.now();
    chatBox.insertAdjacentHTML('beforeend', `<div class="message-wrapper ai"><div class="message ai-msg" id="${msgId}">AI đang suy nghĩ...</div></div>`);
    chatBox.scrollTop = chatBox.scrollHeight;

    const targetMsgEl = document.getElementById(msgId);

    try {
        const payload = active.messages.map(m => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.text
        }));

        const res = await fetch(`${CONFIG.API_BASE_URL}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "gemini-2.5-flash",
                messages: payload,
                temperature: 0.5
            })
        });

        if (!res.ok) throw new Error(`Lỗi HTTP: ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let fullReply = "";
        if (targetMsgEl) targetMsgEl.innerText = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
                const cleaned = line.trim();
                if (cleaned.startsWith('data: ') && cleaned !== 'data: [DONE]') {
                    try {
                        const parsed = JSON.parse(cleaned.replace('data: ', ''));
                        const text = parsed.choices[0]?.delta?.content || "";
                        fullReply += text;
                        if (targetMsgEl) {
                            targetMsgEl.innerHTML = typeof marked !== 'undefined' ? marked.parse(fullReply) : fullReply;
                        }
                        chatBox.scrollTop = chatBox.scrollHeight;
                    } catch (e) {}
                }
            }
        }

        active.messages.push({ role: "ai", text: fullReply });
        saveAndRender();

    } catch (err) {
        if (targetMsgEl) targetMsgEl.innerText = "⚠️ " + err.message;
    }
};

// 3. Khởi chạy sự kiện sau khi DOM sẵn sàng
document.addEventListener("DOMContentLoaded", () => {
    document.addEventListener("click", () => {
        document.getElementById("modelDropdownMenu")?.classList.remove("active");
        document.getElementById("attachMenu")?.classList.remove("active");
    });

    const userInput = document.getElementById("userInput");
    if (userInput) {
        userInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    if (chats.length > 0) loadChat(chats[0].id);
    else createNewChat();
});
