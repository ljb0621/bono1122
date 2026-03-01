/**
 * 更新时钟和日期
 */
function updateClock() {
    const d = new Date();
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    
    // 确保元素存在再更新
    const hElement = document.getElementById('h');
    const mElement = document.getElementById('m');
    const fullDateElement = document.getElementById('fullDate');

    if (hElement) hElement.innerText = h;
    if (mElement) mElement.innerText = m;

    // === 新增：更新状态栏时间 ===
    const sbTimeElement = document.getElementById('sb-time-display');
    if (sbTimeElement) {
        sbTimeElement.innerText = `${h}:${m}`;
    }

    if (fullDateElement) {
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        fullDateElement.innerText = `${months[d.getMonth()]} ${d.getDate()}`;
    }
}

/**
 * (新添加) 初始化问候语打字机效果
 */
function initializeGreetingTypewriter() {
    const greetingElement = document.getElementById("greetingText");
    if (!greetingElement) return;
    greetingElement.innerHTML = '';
    const currentHour = new Date().getHours();
    let text = "Good Evening,";
    if (currentHour < 12) text = "Good Morning,";
    else if (currentHour < 18) text = "Good Afternoon,";
    const speed = 100;
    let i = 0;
    function typeWriter() {
        if (i < text.length) {
            greetingElement.innerHTML += text.charAt(i);
            i++;
            setTimeout(typeWriter, speed);
        }
    }
    setTimeout(typeWriter, 500);
}


/**
 * 切换聊天界面的显示和隐藏
 */
function toggleChat() {
    const chat = document.getElementById('chatLayer');
    if (chat) {
        chat.classList.toggle('show');
    }
}

/**
 * 切换设置界面的显示和隐藏
 */
function toggleSettings() {
    const settings = document.getElementById('settingsView');
    if (settings) {
        settings.classList.toggle('show');
    }
}


// --- 页面加载后立即执行的函数 ---
document.addEventListener('DOMContentLoaded', (event) => {
    updateClock();
    setInterval(updateClock, 60000);
});
