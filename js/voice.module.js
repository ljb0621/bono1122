/* =========================================
   [重构] 语音交互逻辑 (弹窗控制与气泡渲染)
   ========================================= */

// 辅助方法：给单独创建的气泡绑定菜单和复选框
function attachBubbleMenuToCustomRow(bubble, row, uniqueId, text, type) {
    // 添加多选框
    const checkboxWrap = document.createElement('div');
    checkboxWrap.className = 'chat-row-checkbox';
    checkboxWrap.innerHTML = `<div class="wc-msg-checkbox" onclick="toggleMsgSelection(this)"></div>`;
    row.insertBefore(checkboxWrap, row.firstChild);

    // 绑定事件 (右键/长按菜单)
    bubble.oncontextmenu = function(e) {
        e.preventDefault();
        showBubbleMenu(e, uniqueId, text, type, row);
        return false;
    };
    let pressTimer;
    bubble.addEventListener('touchstart', (e) => {
        pressTimer = setTimeout(() => { showBubbleMenu(e, uniqueId, text, type, row); }, 600); 
    });
    bubble.addEventListener('touchend', () => clearTimeout(pressTimer));
    bubble.addEventListener('touchmove', () => clearTimeout(pressTimer));
}

// 1. 渲染【伪语音】气泡 (打字转语音外观)
function appendTypedVoiceBubble(text) {
    const chatMessages = document.getElementById('chatMessages');
    const uniqueId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    const row = document.createElement('div');
    row.className = 'chat-row sent';
    row.setAttribute('data-msg-text', text);
    row.setAttribute('data-msg-sender', 'ME');
    row.setAttribute('data-msg-id', uniqueId);

    const avatar = document.createElement('img');
    avatar.className = 'chat-avatar-img';
    avatar.src = AVATAR_USER;

    const bubble = document.createElement('div');
    // 【关键】使用标准的 message-bubble sent，它就会有黑底白字和圆角！
    bubble.className = 'message-bubble sent'; 
    const sec = Math.max(1, Math.min(59, Math.ceil(text.length / 4)));
    
    // 气泡内部内容：语音条 + 转文字
    bubble.innerHTML = `
      <div class="msg-voice-bar" onclick="this.nextElementSibling.classList.toggle('show')">
        <div class="msg-voice-duration">${sec}"</div>
        <i class="fas fa-rss msg-voice-icon" style="transform: rotate(45deg);"></i>
      </div>
      <div class="msg-voice-transcript show">${text.replace(/\n/g,'<br>')}</div>
    `;

    attachBubbleMenuToCustomRow(bubble, row, uniqueId, text, 'sent');

    row.appendChild(bubble);
    row.appendChild(avatar);
    chatMessages.appendChild(row);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 2. 渲染【真语音】气泡 (长按录音)
function appendRealVoiceBubble(blob, sec) {
    const chatMessages = document.getElementById('chatMessages');
    const url = URL.createObjectURL(blob);
    const uniqueId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    const row = document.createElement('div');
    row.className = 'chat-row sent';
    row.setAttribute('data-msg-text', '[语音]');
    row.setAttribute('data-msg-sender', 'ME');
    row.setAttribute('data-msg-id', uniqueId);

    const avatar = document.createElement('img');
    avatar.className = 'chat-avatar-img';
    avatar.src = AVATAR_USER;

    const bubble = document.createElement('div');
    // 【关键】依然使用标准的 message-bubble sent
    bubble.className = 'message-bubble sent'; 
    bubble.innerHTML = `
      <div class="msg-voice-bar" onclick="this.querySelector('audio').play()">
        <div class="msg-voice-duration">${sec}"</div>
        <i class="fas fa-rss msg-voice-icon" style="transform: rotate(45deg);"></i>
        <audio src="${url}" preload="metadata" style="display:none;"></audio>
      </div>
      <div class="msg-voice-transcript show">识别中...</div>
    `;

    attachBubbleMenuToCustomRow(bubble, row, '[语音]', 'sent');

    row.appendChild(bubble);
    row.appendChild(avatar);
    chatMessages.appendChild(row);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 3. 弹窗控制逻辑
window.openVoiceActionModal = function() {
    document.getElementById('voice-action-modal').classList.add('active');
    document.getElementById('fake-voice-input').value = '';
    switchVoiceTab('fake');
}

window.closeVoiceActionModal = function() {
    document.getElementById('voice-action-modal').classList.remove('active');
}

window.switchVoiceTab = function(tab) {
    document.getElementById('tab-btn-fake-voice').classList.remove('active');
    document.getElementById('tab-btn-real-voice').classList.remove('active');
    document.getElementById('voice-panel-fake').style.display = 'none';
    document.getElementById('voice-panel-real').style.display = 'none';

    if (tab === 'fake') {
        document.getElementById('tab-btn-fake-voice').classList.add('active');
        document.getElementById('voice-panel-fake').style.display = 'block';
    } else {
        document.getElementById('tab-btn-real-voice').classList.add('active');
        document.getElementById('voice-panel-real').style.display = 'flex';
    }
}

// 4. 伪语音发送事件
// 4. 伪语音发送事件
window.sendFakeVoice = function() {
    const text = document.getElementById('fake-voice-input').value.trim();
    if (text) {
        appendTypedVoiceBubble(text);
        if (currentChatId) {
            // 【关键修改】：存入历史记录时，前面加上 [VOICE]
            saveMessageToHistory(currentChatId, { text: '[VOICE]' + text, type: 'sent', senderName: 'ME' });
            // 发给AI时还是发纯文本
            sendMessageToAI(text);
        }
    } else {
        // 不填文字时的无字假语音
        const seconds = Math.floor(Math.random() * 10 + 2);
        const uniqueId = 'msg_' + Date.now();
        const chatMessages = document.getElementById('chatMessages');
        const row = document.createElement('div');
        row.className = 'chat-row sent';
        row.setAttribute('data-msg-text', '[语音]');
        row.setAttribute('data-msg-sender', 'ME');
        row.setAttribute('data-msg-id', uniqueId);
        
        const avatar = document.createElement('img');
        avatar.className = 'chat-avatar-img';
        avatar.src = AVATAR_USER; 
        
        const bubble = document.createElement('div');
        bubble.className = `message-bubble sent`; 
        bubble.innerHTML = `
            <div class="msg-voice-bar" onclick="playVoiceAnim(this)">
                <div class="msg-voice-duration">${seconds}"</div>
                <i class="fas fa-rss msg-voice-icon" style="transform: rotate(45deg);"></i>
            </div>
        `;
        
        attachBubbleMenuToCustomRow(bubble, row, '[语音]', 'sent');
        row.appendChild(bubble);
        row.appendChild(avatar);
        chatMessages.appendChild(row);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        if (currentChatId) {
            // 【关键修改】：无字假语音也存入标签
            saveMessageToHistory(currentChatId, { text: '[VOICE]（语音消息）', type: 'sent', senderName: 'ME' });
        }
        sendMessageToAI(`[System: User sent a voice message. Reply with a text message, BUT imply that you listened to it.]`);
    }

    closeVoiceActionModal();
    document.getElementById('chat-extra-panels').classList.remove('open');
}


// 简单的播放假动画
window.playVoiceAnim = function(el) {
    const icon = el.querySelector('i');
    icon.style.opacity = 0.5;
    setTimeout(() => icon.style.opacity = 1, 300);
    setTimeout(() => icon.style.opacity = 0.5, 600);
    setTimeout(() => icon.style.opacity = 1, 900);
}

// 5. 真实录音核心逻辑 (已修改为浏览器原生免费语音识别)
let mediaRecorder = null;
let mediaChunks = [];
let mediaStream = null;
let pressStartAt = 0;

// 新增：用于原生语音识别的变量
let nativeRecognition = null;
let recognizedText = "";

// 在 DOM 加载后绑定长按事件 (弹窗内的麦克风)
document.addEventListener('DOMContentLoaded', () => {
    const holdBtn = document.getElementById('modalHoldToTalkBtn');
    if (holdBtn) {
        holdBtn.addEventListener('pointerdown', startHoldRecord);
        holdBtn.addEventListener('pointerup', stopHoldRecord);
        holdBtn.addEventListener('pointerleave', stopHoldRecord);
    }
});

async function startHoldRecord() {
    const btn = document.getElementById('modalHoldToTalkBtn');
    if (!btn) return;

    recognizedText = ""; // 每次录音前清空文本

    try {
        // 1. 初始化原始的录音器（仅用于生成 UI 上的可播放语音条）
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(mediaStream);
        mediaChunks = [];
        pressStartAt = Date.now();

        mediaRecorder.ondataavailable = e => mediaChunks.push(e.data);
        mediaRecorder.start();
        
        // 2. 初始化浏览器原生语音识别 (免费且无需 API)
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            nativeRecognition = new SpeechRecognition();
            nativeRecognition.lang = 'zh-CN'; // 设置识别语言为中文
            nativeRecognition.continuous = true; // 持续识别
            nativeRecognition.interimResults = true; // 允许返回临时结果

            nativeRecognition.onresult = (event) => {
                let finalTranscript = '';
                let interimTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }
                recognizedText = finalTranscript + interimTranscript;
                
                // 炫酷体验：实时在按钮上显示识别出的文字
                const span = btn.querySelector('span');
                if (span && recognizedText) {
                    span.innerText = recognizedText.length > 8 
                        ? recognizedText.substring(0, 8) + '...' 
                        : recognizedText;
                }
            };

            nativeRecognition.onerror = (e) => {
                console.warn("浏览器语音识别发生错误: ", e.error);
            };

            nativeRecognition.start();
        } else {
            console.warn("当前浏览器不支持原生语音识别 API");
        }

        // 更新按钮样式为录音中
        btn.classList.add('recording');
        btn.innerHTML = `<i class="fas fa-microphone-alt" style="font-size:28px;"></i><span>录音中...</span>`;
    } catch (e) {
        alert('麦克风权限失败或被拒绝：' + e.message);
    }
}

async function stopHoldRecord() {
    const btn = document.getElementById('modalHoldToTalkBtn');
    if (!mediaRecorder || mediaRecorder.state === 'inactive') return; // 防止重复触发
    
    // 停止原生语音识别
    if (nativeRecognition) {
        try { nativeRecognition.stop(); } catch(e) {}
    }

    if (btn) {
        btn.classList.remove('recording');
        btn.innerHTML = `<i class="fas fa-microphone" style="font-size:28px; color:#555;"></i><span style="color:#333;">按住说话</span>`;
    }

    mediaRecorder.onstop = async () => {
        const blob = new Blob(mediaChunks, { type: 'audio/webm' });
        const sec = Math.max(1, Math.round((Date.now() - pressStartAt) / 1000));

        // 立即关闭弹窗和面板
        closeVoiceActionModal();
        document.getElementById('chat-extra-panels').classList.remove('open');

        // 上屏真实语音气泡 (UI 显示音频条)
        appendRealVoiceBubble(blob, sec);

        // 稍微等待 500ms，确保浏览器的原生识别把最后一句话吐出来
        await new Promise(resolve => setTimeout(resolve, 500));

        let text = recognizedText.trim();

        // 检查浏览器兼容性兜底
        if (!text && !(window.SpeechRecognition || window.webkitSpeechRecognition)) {
            text = "（当前浏览器不支持原生识别，请使用Chrome/Edge）";
        }

        // 把识别结果填入气泡的文字区域
        const all = document.querySelectorAll('.msg-voice-transcript');
        if (all.length) {
            all[all.length - 1].innerHTML = text || '（未识别到文字，可能是没有出声）';
        }

        // 识别成功，直接发送给 AI 请求回复，并记入历史
        if (text && currentChatId) {
            await saveMessageToHistory(currentChatId, {
                text: '[VOICE]' + text, type: 'sent', senderName: 'ME'
            });
            sendMessageToAI(text);
        } else if (currentChatId) {
            await saveMessageToHistory(currentChatId, {
                text: '[VOICE]（未识别到文字）', type: 'sent', senderName: 'ME'
            });
        }
        
        cleanupRecorder();
    };

    mediaRecorder.stop();
}



// 彻底删除或注释掉原来的 transcribeAudio API 请求函数
// async function transcribeAudio(blob) { ... }



// 语音转文字 API (调用设置里的接口)
async function transcribeAudio(blob) {
    try {
        const settings = JSON.parse(localStorage.getItem('myCoolPhone_aiSettings') || '{}');
        if (!settings.apiKey || !settings.endpoint) return '';

        let baseUrl = settings.endpoint.replace(/\/$/, '');
        const url = baseUrl.endsWith('/v1') ? `${baseUrl}/audio/transcriptions` : `${baseUrl}/v1/audio/transcriptions`;

        const fd = new FormData();
        fd.append('file', blob, 'voice.webm');
        fd.append('model', 'whisper-1');

        const res = await fetch(url, {
            method: 'POST',
            headers: { Authorization: `Bearer ${settings.apiKey}` },
            body: fd
        });
        if (!res.ok) throw new Error('STT失败');

        const data = await res.json();
        const text = (data.text || '').trim();

        // 把识别结果填入气泡中
        const all = document.querySelectorAll('.msg-voice-transcript');
        if (all.length) {
            all[all.length - 1].innerHTML = text || '（未识别到文字）';
        }

        return text;
    } catch (e) {
        console.error(e);
        const all = document.querySelectorAll('.msg-voice-transcript');
        if (all.length) all[all.length - 1].innerHTML = '（语音识别失败）';
        return '';
    }
}

function cleanupRecorder() {
    if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
    mediaRecorder = null;
    mediaStream = null;
    mediaChunks = [];
}
