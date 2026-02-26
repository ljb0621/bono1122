/* =========================================
   [新增] 音乐播放器核心逻辑
   ========================================= */

const MUSIC_DATA_KEY = 'myCoolPhone_musicPlaylist';
let musicPlaylist = [];
let currentSongIndex = -1;
let isPlaying = false;
const audioEl = document.getElementById('global-audio-player');

// 1. 初始化：加载数据并恢复首页文字
document.addEventListener('DOMContentLoaded', () => {
    loadMusicData();
    restoreHomeMusicText();
    
    // 音频播放结束自动下一首
    if(audioEl) {
        audioEl.onended = () => playNextSong();
    }
});

// 加载数据
async function loadMusicData() {
    // 尝试从 IDB (大容量) 获取
    const data = await IDB.get(MUSIC_DATA_KEY);
    if (data && Array.isArray(data)) {
        musicPlaylist = data;
    } else {
        // 默认歌曲
        musicPlaylist = [
            { name: "Lover", artist: "Taylor Swift", src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", type: "link" }
        ];
    }
    renderPlaylist();
}

async function saveMusicData() {
    await IDB.set(MUSIC_DATA_KEY, musicPlaylist);
}

// 2. 界面控制
window.openMusicPlayer = function() {
    document.getElementById('musicPlayerView').classList.add('show');
    renderPlaylist();
}
window.closeMusicPlayer = function() {
    document.getElementById('musicPlayerView').classList.remove('show');
}

// 3. 导入音乐
window.triggerImportMusic = function() {
    const choice = confirm("导入音乐：\n点击【确定】选择本地 MP3 文件\n点击【取消】输入网络链接");
    if(choice) {
        document.getElementById('music-file-input').click();
    } else {
        const url = prompt("请输入音频 URL (.mp3):");
        const name = prompt("请输入歌名:");
        if(url && name) {
            addSongToPlaylist(name, "Unknown", url, "link");
        }
    }
}

window.handleMusicFile = function(input) {
    const file = input.files[0];
    if(!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        // 将文件转为 Base64 存入 (注意：文件太大可能会卡，建议控制大小)
        addSongToPlaylist(file.name.replace(/\.[^/.]+$/, ""), "Local File", e.target.result, "file");
    };
    reader.readAsDataURL(file);
    input.value = '';
}

function addSongToPlaylist(name, artist, src, type) {
    musicPlaylist.push({ name, artist, src, type });
    saveMusicData();
    renderPlaylist();
    // 如果列表只有这一首，自动选中
    if(musicPlaylist.length === 1) playMusic(0);
}

// 4. 渲染列表
function renderPlaylist() {
    const container = document.getElementById('mp-playlist-container');
    if(!container) return;
    container.innerHTML = '';
    
    musicPlaylist.forEach((song, idx) => {
        const div = document.createElement('div');
        div.className = `mp-item ${idx === currentSongIndex ? 'active' : ''}`;
        div.innerHTML = `
            <div class="mp-item-info" onclick="playMusic(${idx})">
                <div style="font-size:14px; font-weight:600;">${song.name}</div>
                <div style="font-size:11px; color:#999;">${song.artist}</div>
            </div>
            <i class="fas fa-trash" style="color:#ddd; padding:10px;" onclick="deleteSong(${idx})"></i>
        `;
        container.appendChild(div);
    });
}

// 5. 播放控制核心
window.playMusic = function(index) {
    if(index < 0 || index >= musicPlaylist.length) return;
    
    currentSongIndex = index;
    const song = musicPlaylist[index];
    
    audioEl.src = song.src;
    audioEl.play();
    isPlaying = true;
    
    updatePlayerUI();
    updateHomeWidgetUI(true); // 让唱片转起来
    renderPlaylist(); // 更新高亮
}

window.toggleMusicPlay = function() {
    if(audioEl.paused) {
        if(audioEl.src) {
            audioEl.play();
            isPlaying = true;
        } else if (musicPlaylist.length > 0) {
            playMusic(0);
        }
    } else {
        audioEl.pause();
        isPlaying = false;
    }
    updatePlayerUI();
    updateHomeWidgetUI(isPlaying);
}

window.playNextSong = function() {
    let next = currentSongIndex + 1;
    if(next >= musicPlaylist.length) next = 0;
    playMusic(next);
}

window.playPrevSong = function() {
    let prev = currentSongIndex - 1;
    if(prev < 0) prev = musicPlaylist.length - 1;
    playMusic(prev);
}

window.deleteSong = function(index) {
    if(confirm("确定删除这首歌吗？")) {
        // 如果删的是当前正在放的，先停止
        if(index === currentSongIndex) {
            audioEl.pause();
            isPlaying = false;
            updateHomeWidgetUI(false);
            audioEl.src = '';
            currentSongIndex = -1;
        } else if (index < currentSongIndex) {
            currentSongIndex--;
        }
        
        musicPlaylist.splice(index, 1);
        saveMusicData();
        renderPlaylist();
    }
}

// 6. UI 同步更新
function updatePlayerUI() {
    const btn = document.getElementById('mp-play-btn');
    const song = musicPlaylist[currentSongIndex];
    
    if(isPlaying) {
        btn.className = 'fas fa-pause-circle mp-btn-lg';
        document.getElementById('musicPlayerView').classList.add('playing');
    } else {
        btn.className = 'fas fa-play-circle mp-btn-lg';
        document.getElementById('musicPlayerView').classList.remove('playing');
    }
    
    if(song) {
        document.getElementById('mp-title-display').innerText = song.name;
        document.getElementById('mp-artist-display').innerText = song.artist;
        
        // 同步更新首页文字
        const hTitle = document.getElementById('home-music-title');
        const hArtist = document.getElementById('home-music-artist');
        if(hTitle) hTitle.innerText = song.name;
        if(hArtist) hArtist.innerText = song.artist;
        saveHomeMusicText(); // 保存文字状态
    }
}

function updateHomeWidgetUI(playing) {
    const widget = document.getElementById('home-music-widget');
    if(widget) {
        if(playing) widget.classList.add('playing');
        else widget.classList.remove('playing');
    }
}

// 7. 首页文字编辑与储存
window.saveHomeMusicText = function() {
    const title = document.getElementById('home-music-title').innerText;
    const artist = document.getElementById('home-music-artist').innerText;
    
    const data = { title, artist };
    localStorage.setItem('myCoolPhone_homeMusicText', JSON.stringify(data));
}

function restoreHomeMusicText() {
    const data = JSON.parse(localStorage.getItem('myCoolPhone_homeMusicText') || '{}');
    if(data.title) document.getElementById('home-music-title').innerText = data.title;
    if(data.artist) document.getElementById('home-music-artist').innerText = data.artist;
}
/* =========================================
   [NEW] Live App Logic (K-Style)
   ========================================= */

// 打开 App
window.openLiveApp = function() {
    const app = document.getElementById('liveApp');
    if(app) {
        app.classList.add('open');
        renderKFeed(); // 生成推荐流
    }
}

// 关闭 App
window.closeLiveApp = function() {
    document.getElementById('liveApp').classList.remove('open');
}

// 切换 Tab
window.switchLiveTab = function(tabName, btnEl) {
    document.querySelectorAll('.k-tab-content').forEach(el => el.style.display = 'none');
    document.getElementById(`lv-tab-${tabName}`).style.display = 'block';

    const dock = document.querySelector('.k-dock');
    dock.querySelectorAll('.k-dock-item').forEach(el => el.classList.remove('active'));
    
    // 如果不是中间那个白色按钮，就高亮图标
    if (!btnEl.querySelector('.k-btn-center')) {
        btnEl.classList.add('active');
    }
}

// 生成杂志风 Feed 流
function renderKFeed() {
    const container = document.getElementById('lv-feed-container');
    if (!container || container.children.length > 0) return; 

    // 这些标题和图片都要显得“冷淡”、“高级”
    const data = [
        { title: "SEOUL VIBE.", user: "Hannah", img: "1534528741775-53994a69daeb" },
        { title: "NOISE / SILENCE", user: "AI_02", img: "1507679721516-fed88ce46ea2" },
        { title: "MIDNIGHT.", user: "System", img: "1517841905240-472988babdf9" },
        { title: "COFFEE RUN", user: "User99", img: "1497935586351-b67a49e012bf" },
        { title: "STUDY W/ ME", user: "Bot_X", img: "1516321497487-e288fb19713f" },
        { title: "CINEMA 4D", user: "Render", img: "1618005182384-a83a8bd57fbe" }
    ];

    data.forEach((item, index) => {
        // 随机高度差异，但不要太夸张
        const height = index % 2 === 0 ? '240px' : '180px';
        
        const card = document.createElement('div');
        card.className = 'k-card';
        card.innerHTML = `
            <div style="position:relative;">
                <div class="k-live-tag"><span class="k-blink-dot"></span>LIVE</div>
                <img src="https://images.unsplash.com/photo-${item.img}?q=80&w=300&auto=format&fit=crop" 
                     class="k-card-img" style="height: ${height}">
            </div>
            <div class="k-card-info">
                <div class="k-card-title">${item.title}</div>
                <div class="k-card-user">${item.user}</div>
            </div>
        `;
        container.appendChild(card);
    });
}
/* =========================================
   [新增] 直播APP - 发布作品逻辑
   ========================================= */

// 存储作品的数组 (模拟数据库)
let myLiveWorks = [
    {
        id: 'work_init_1',
        img: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=300&auto=format&fit=crop',
        desc: 'Hello World! #Daily',
        likes: 120,
        comments: 45,
        shares: 12
    }
];

// 初始化：页面加载时渲染已有的作品
document.addEventListener('DOMContentLoaded', () => {
    renderLiveWorks();
});

// 1. 打开/关闭发布弹窗
window.openLivePublishModal = function() {
    // 重置表单
    document.getElementById('live-preview-img').src = '';
    document.getElementById('live-preview-img').style.display = 'none';
    document.getElementById('live-upload-icon').style.display = 'block';
    document.getElementById('live-desc').value = '';
    document.getElementById('live-file-input').value = '';
    
    document.getElementById('livePublishModal').classList.add('show');
}

window.closeLivePublishModal = function() {
    document.getElementById('livePublishModal').classList.remove('show');
}

// 2. 图片预览
window.handleLiveFilePreview = function(input) {
    const file = input.files[0];
    if(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = document.getElementById('live-preview-img');
            img.src = e.target.result;
            img.style.display = 'block';
            document.getElementById('live-upload-icon').style.display = 'none';
        }
        reader.readAsDataURL(file);
    }
}

// 3. 确认发布
window.confirmPublishWork = function() {
    const imgEl = document.getElementById('live-preview-img');
    const desc = document.getElementById('live-desc').value;
    const tag = document.getElementById('live-tag').value;
    
    // 简单校验
    if (imgEl.style.display === 'none') {
        alert("请先上传一张图片/视频封面！");
        return;
    }
    
    // 创建新作品对象
    const newWork = {
        id: 'work_' + Date.now(),
        img: imgEl.src,
        desc: desc + ' ' + tag,
        likes: 0,
        comments: 0,
        shares: 0
    };
    
    // 存入数组 (插到最前面)
    myLiveWorks.unshift(newWork);
    
    // 重新渲染列表
    renderLiveWorks();
    
    // 关闭弹窗并提示
    closeLivePublishModal();
    alert("发布成功！");
}

// 4. 渲染作品列表到个人主页
function renderLiveWorks() {
    const container = document.getElementById('k-my-works-grid');
    if (!container) return;
    
    container.innerHTML = ''; // 清空
    
    myLiveWorks.forEach(work => {
        const item = document.createElement('div');
        item.className = 'k-work-item';
        item.onclick = () => openWorkDetail(work.id);
        
        item.innerHTML = `
            <img src="${work.img}">
            <div class="k-work-stats">
                <i class="far fa-heart"></i> ${work.likes}
            </div>
        `;
        container.appendChild(item);
    });
}

// 5. 打开作品详情页
window.openWorkDetail = function(workId) {
    const work = myLiveWorks.find(w => w.id === workId);
    if (!work) return;
    
    // 填充数据
    document.getElementById('work-detail-img').src = work.img;
    document.getElementById('work-detail-likes').innerText = work.likes;
    document.getElementById('work-detail-comments').innerText = work.comments;
    document.getElementById('work-detail-shares').innerText = work.shares;
    document.getElementById('work-detail-desc').innerText = work.desc;
    
    // 显示弹窗
    document.getElementById('liveWorkDetailModal').classList.add('show');
}

window.closeWorkDetailModal = function() {
    document.getElementById('liveWorkDetailModal').classList.remove('show');
}
/* =========================================
   [更新] 支付/钱包 (Pay) 系统核心逻辑 (分卡+小游戏版)
   ========================================= */

const PAY_DATA_KEY = 'myCoolPhone_payData';
let payData = {
    balance: 0.00,        // 钱包零钱 (初始为0)
    bankCard: 0.00,       // 银行卡余额 (初始为0)
    yuebao: 0.00,         // 余额宝金额
    lastInterestDate: 0,  // 上次发放余额宝收益的时间戳
    totalProfit: 0.00,    // 余额宝累计收益
    transactions: [],     // 账单流水 {id, type:'income'|'expense', amount, title, time}
    career: {             // 职业与发钱配置
        type: 'worker', 
        day: 15, 
        amount: 0, 
        lastPayMonth: -1 
    },
    intimatePay: {}       // 亲密付
};

// 1. 初始化与打开App
window.openPayApp = async function() {
    const app = document.getElementById('payApp');
    if(app) {
        app.classList.add('open');
        await loadPayData();
        
        checkYuebaoInterest();
        checkCareerSalary();
        simulateIntimatePayConsumption();

        renderPayMainPage();
    }
}
window.closePayApp = function() {
    document.getElementById('payApp').classList.remove('open');
}

// 2. 数据加载与保存
async function loadPayData() {
    const data = await IDB.get(PAY_DATA_KEY);
    if(data) {
        payData = { ...payData, ...data };
        if(!payData.intimatePay) payData.intimatePay = {};
    }
}
async function savePayData() {
    await IDB.set(PAY_DATA_KEY, payData);
    renderPayMainPage();
}

// 3. 渲染主页数据 (修复版)
function renderPayMainPage() {
    // 安全获取并更新元素
    const elTotal = document.getElementById('pay-total-balance');
    if (elTotal) elTotal.innerText = payData.balance.toFixed(2);

    const elBank = document.getElementById('pay-bank-balance');
    if (elBank) elBank.innerText = payData.bankCard.toFixed(2);

    // 修复点：这里加了判断，防止 index.html 没这个 ID 时报错
    const elYuebao = document.getElementById('pay-yuebao-balance');
    if (elYuebao) elYuebao.innerText = payData.yuebao.toFixed(2);
    
    let yestProfit = 0;
    const records = payData.transactions.filter(t => t.title === '余额宝收益');
    if(records.length > 0) yestProfit = records[0].amount;
    
    const elYest = document.getElementById('pay-yuebao-yesterday');
    if (elYest) elYest.innerText = yestProfit.toFixed(2);
}


// 4. 记账通用函数
function addTransaction(title, amount, type) {
    payData.transactions.unshift({
        id: 'tx_' + Date.now(),
        title: title,
        amount: parseFloat(amount),
        type: type,
        time: Date.now()
    });
}

// 5. 页面路由
window.openPaySubPage = function(pageId) {
    document.querySelectorAll('.pay-sub-page').forEach(el => el.classList.remove('show'));
    const page = document.getElementById('pay-page-' + pageId);
    if(page) {
        page.classList.add('show');
        if(pageId === 'bill') renderBillList();
        if(pageId === 'yuebao') renderYuebaoPage();
        if(pageId === 'career') renderCareerPage();
        if(pageId === 'intimate') renderIntimatePage();
    }
}
window.closePaySubPage = function(pageId) {
    document.getElementById('pay-page-' + pageId).classList.remove('show');
}


// ==========================================
// [新增架构] 统一的高级定制弹窗系统 (替代 native alert/prompt)
// ==========================================
function showKAlert(desc, callback = null) {
    const overlay = document.getElementById('k-dialog-overlay');
    document.getElementById('k-dialog-title').innerText = "提示";
    document.getElementById('k-dialog-desc').innerHTML = desc; // 支持HTML换行
    document.getElementById('k-dialog-input').style.display = 'none';
    document.getElementById('k-dialog-cancel').style.display = 'none'; // 警告框只有确定
    
    const confirmBtn = document.getElementById('k-dialog-confirm');
    
    // 清理旧事件
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
    
    newBtn.onclick = () => {
        overlay.classList.remove('active');
        if(callback) callback();
    };
    overlay.classList.add('active');
}

function showKPrompt(title, desc, placeholder, callback) {
    const overlay = document.getElementById('k-dialog-overlay');
    document.getElementById('k-dialog-title').innerText = title;
    document.getElementById('k-dialog-desc').innerHTML = desc;
    
    const input = document.getElementById('k-dialog-input');
    input.style.display = 'block';
    input.placeholder = placeholder;
    input.value = ''; // 清空
    
    document.getElementById('k-dialog-cancel').style.display = 'block';
    
    const confirmBtn = document.getElementById('k-dialog-confirm');
    const cancelBtn = document.getElementById('k-dialog-cancel');
    
    // 清理旧事件
    const newConfirm = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
    const newCancel = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
    
    newCancel.onclick = () => overlay.classList.remove('active');
    newConfirm.onclick = () => {
        overlay.classList.remove('active');
        if(callback) callback(input.value);
    };
    
    overlay.classList.add('active');
    setTimeout(() => input.focus(), 300);
}

// ==========================================
// [核心机制] 1：AI 财富测算 (已接入高级弹窗)
// ==========================================
window.generateInitialWealthByAI = async function() {
    const persona = document.getElementById('my-global-persona')?.value || "普通人";
    const prompt = `
    用户当前的人设是：“${persona}”。
    请根据这个人设，推断TA的【微信零钱】和【银行存款】是多少（人民币）。
    如果人设是落魄打工人，可能零钱只有几块。如果是霸道总裁，可能零钱几十万。
    直接返回纯JSON格式：{"balance": 数字, "bankCard": 数字}。注意：只能返回纯JSON，不要输出任何其他文本或markdown标记！
    `;
    
    const btn = document.getElementById('btn-ai-wealth');
    const oldHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 命运齿轮转动中...';
    btn.style.pointerEvents = 'none';
    
    const res = await callAiForSpecialTask(prompt);
    btn.innerHTML = oldHtml;
    btn.style.pointerEvents = 'auto';
    
    if(res) {
        try {
            const cleanStr = res.replace(/```json/g, '').replace(/```/g, '').trim();
            const data = JSON.parse(cleanStr);
            if(data.balance !== undefined && data.bankCard !== undefined) {
                payData.balance = parseFloat(data.balance);
                payData.bankCard = parseFloat(data.bankCard);
                addTransaction('AI 命运赐予', payData.balance, 'income');
                savePayData();
                showKAlert(`<b style="color:#07c160; font-size:16px;">测算完成！</b><br><br>根据你的设定...<br>你的零钱为：<b>¥${payData.balance}</b><br>银行存款为：<b>¥${payData.bankCard}</b><br><br>努力生活吧！`);
            }
        } catch(e) {
            showKAlert('AI 给出的数字太模糊，请再试一次。');
        }
    }
}

// ==========================================
// [核心机制] 2：凭空增加余额 & 抢金币小游戏
// ==========================================
window.addBalancePrompt = function() {
    showKPrompt("增加余额", "你要凭空为自己增加多少零钱？", "输入金额 (如: 1000)", (val) => {
        const amt = parseFloat(val);
        if(isNaN(amt) || amt <= 0) return;
        
        if(amt < 1000) {
            // 小于1000，直接给
            payData.balance += amt;
            addTransaction('天降横财', amt, 'income');
            savePayData();
            showKAlert(`成功增加余额 <b style="color:#07c160;">¥${amt.toFixed(2)}</b>`);
        } else {
            // 超过1000触发小游戏
            const isHard = amt >= 10000;
            const kaomoji = isHard ? "Σ(っ °Д °;)っ" : "(๑•̀ㅂ•́)و✧";
            showKAlert(`<b style="font-size:16px;">太多啦！${kaomoji}</b><br><br>想要凭空拿这么多钱，必须先通过我的考验！准备好了吗？`, () => {
                startCoinGame(amt, isHard);
            });
        }
    });
}

let cgTimer = null;
let cgInterval = null;

function startCoinGame(amount, isHard) {
    const view = document.getElementById('coin-game-view');
    view.classList.add('open');
    
    let time = 10.0;
    let score = 0;
    const target = isHard ? 20 : 10;
    
    document.getElementById('cg-target').innerText = `目标：在 10 秒内收集 ${target} 个金币`;
    const timeEl = document.getElementById('cg-countdown');
    timeEl.innerText = time.toFixed(1);
    timeEl.className = ''; // reset
    document.getElementById('cg-score').innerText = score;
    
    const playArea = document.getElementById('cg-play-area');
    playArea.innerHTML = '';
    
    // 生成频率与存活时间
    const spawnRate = isHard ? 350 : 600;
    const lifeTime = isHard ? 800 : 1200;
    
    cgInterval = setInterval(() => {
        spawnCoin(playArea, isHard, lifeTime, (x, y) => {
            score++;
            document.getElementById('cg-score').innerText = score;
            createFloatingScore(x, y, playArea);
        });
    }, spawnRate);
    
    cgTimer = setInterval(() => {
        time -= 0.1;
        timeEl.innerText = Math.max(0, time).toFixed(1);
        if(time <= 3.0) timeEl.classList.add('cg-time-warning');
        
        if(time <= 0) {
            endCoinGame(score, target, amount);
        }
    }, 100);
}

function spawnCoin(playArea, isHard, lifeTime, onCatch) {
    const coin = document.createElement('div');
    coin.className = 'gold-coin';
    coin.innerHTML = '¥';
    
    const maxX = playArea.clientWidth - 50;
    const maxY = playArea.clientHeight - 50;
    
    const limitX = maxX > 0 ? maxX : 250; 
    const limitY = maxY > 0 ? maxY : 400;

    coin.style.left = (Math.random() * limitX) + 'px';
    coin.style.top = (Math.random() * limitY) + 'px';
    
    if(isHard) {
        coin.style.transition = 'top 0.4s ease, left 0.4s ease, transform 0.2s';
        setTimeout(() => {
            if(coin.parentNode) {
                coin.style.left = (Math.random() * limitX) + 'px';
                coin.style.top = (Math.random() * limitY) + 'px';
            }
        }, lifeTime / 2);
    }
    
    coin.onpointerdown = (e) => {
        e.stopPropagation();
        onCatch(e.clientX, e.clientY);
        coin.remove();
    };
    
    playArea.appendChild(coin);
    
    setTimeout(() => {
        if(coin.parentNode) coin.remove();
    }, lifeTime);
}

function createFloatingScore(x, y, container) {
    const float = document.createElement('div');
    float.innerText = '+1';
    const rect = container.getBoundingClientRect();
    float.style.cssText = `
        position: absolute; left: ${x - rect.left}px; top: ${y - rect.top}px;
        color: #07c160; font-weight: 900; font-size: 24px;
        pointer-events: none; z-index: 100; text-shadow: 0 2px 4px rgba(255,255,255,0.8);
        animation: floatUpFade 0.8s ease forwards;
    `;
    container.appendChild(float);
    setTimeout(() => float.remove(), 800);
}

function endCoinGame(score, target, amount) {
    clearInterval(cgTimer);
    clearInterval(cgInterval);
    document.getElementById('cg-play-area').innerHTML = '';
    
    setTimeout(() => {
        document.getElementById('coin-game-view').classList.remove('open');
        if(score >= target) {
            payData.balance += amount;
            addTransaction('游戏挑战赢金', amount, 'income');
            savePayData();
            setTimeout(() => {
                showKAlert(`<b style="font-size:16px; color:#07c160;">挑战成功！(oﾟvﾟ)ノ</b><br><br>你不仅手速惊人，还抢到了 <b>${score}</b> 个金币！<br><br>【¥${amount.toFixed(2)}】 已存入你的钱包！`);
            }, 300);
        } else {
            setTimeout(() => {
                showKAlert(`<b style="font-size:16px; color:#ff4d4f;">挑战失败...(；′⌒\`)</b><br><br>只收集了 ${score} 个金币，距离目标 ${target} 个还差一点。<br>横财从指缝中溜走了~`);
            }, 300);
        }
    }, 100);
}

// ==========================================
// [接入新 UI] 3：充值、提现与余额宝
// ==========================================
window.payActionPrompt = function(action) {
    if(action === 'recharge') {
        showKPrompt("充值到零钱", `当前银行卡存款: ¥${payData.bankCard.toFixed(2)}`, "输入转入金额", (val) => {
            const amt = parseFloat(val);
            if(amt > 0 && amt <= payData.bankCard) {
                payData.bankCard -= amt;
                payData.balance += amt;
                addTransaction('从银行卡转入', amt, 'income');
                savePayData();
                showKAlert(`充值成功！`);
            } else {
                showKAlert("操作失败：金额无效或银行卡余额不足。");
            }
        });
    } else if(action === 'withdraw') {
        showKPrompt("提现到银行卡", `当前可提现零钱: ¥${payData.balance.toFixed(2)}`, "输入提现金额", (val) => {
            const amt = parseFloat(val);
            if(amt > 0 && amt <= payData.balance) {
                payData.balance -= amt;
                payData.bankCard += amt;
                addTransaction('提现至银行卡', amt, 'expense');
                savePayData();
                showKAlert(`提现成功！`);
            } else {
                showKAlert("操作失败：金额无效或零钱不足。");
            }
        });
    }
}




// 余额宝结算逻辑 (保持不变)
function checkYuebaoInterest() {
    if(payData.yuebao <= 0) return;
    const now = new Date();
    const lastDate = new Date(payData.lastInterestDate || 0);
    if(now.getDate() !== lastDate.getDate() || now.getMonth() !== lastDate.getMonth() || now.getFullYear() !== lastDate.getFullYear()) {
        const dailyRate = 0.00005; 
        let profit = payData.yuebao * dailyRate;
        if(profit < 0.01 && payData.yuebao > 0) profit = 0.01;
        payData.yuebao += profit;
        payData.totalProfit += profit;
        payData.lastInterestDate = now.getTime();
        addTransaction('余额宝收益', profit, 'income');
        savePayData();
    }
}
function renderYuebaoPage() {
    document.getElementById('yb-detail-balance').innerText = payData.yuebao.toFixed(2);
    document.getElementById('yb-total-profit').innerText = payData.totalProfit.toFixed(2);
    const list = document.getElementById('yb-profit-list');
    const profits = payData.transactions.filter(t => t.title === '余额宝收益');
    if(profits.length === 0) {
        list.innerHTML = '<div style="color:#999; font-size:12px;">暂无收益记录</div>';
    } else {
        list.innerHTML = profits.map(t => `
            <div style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding-bottom:10px;">
                <span style="font-size:12px;">${new Date(t.time).toLocaleDateString()}</span>
                <span style="color:#ff5000; font-weight:700;">+${t.amount.toFixed(2)}</span>
            </div>
        `).join('');
    }
}
window.handleYuebao = function(action) {
    if(action === 'in') {
        const val = prompt(`将零钱转入余额宝。\n当前零钱: ¥${payData.balance.toFixed(2)}\n输入转入金额：`);
        const amt = parseFloat(val);
        if(amt > 0 && amt <= payData.balance) {
            payData.balance -= amt;
            payData.yuebao += amt;
            addTransaction('转入余额宝', amt, 'expense'); 
            savePayData();
            renderYuebaoPage();
        }
    } else {
        const val = prompt(`从余额宝转出到零钱。\n可转出: ¥${payData.yuebao.toFixed(2)}\n输入转出金额：`);
        const amt = parseFloat(val);
        if(amt > 0 && amt <= payData.yuebao) {
            payData.yuebao -= amt;
            payData.balance += amt;
            addTransaction('余额宝转出', amt, 'income'); 
            savePayData();
            renderYuebaoPage();
        }
    }
}

// 薪水职业与亲密付逻辑 (保持不变，已兼容新的分离架构)
window.saveGlobalPersona = function() {
    const val = document.getElementById('my-global-persona').value;
    localStorage.setItem('myCoolPhone_globalPersona', val);
}
document.addEventListener('DOMContentLoaded', () => {
    const val = localStorage.getItem('myCoolPhone_globalPersona');
    if(val && document.getElementById('my-global-persona')) {
        document.getElementById('my-global-persona').value = val;
    }
});

function renderCareerPage() {
    document.getElementById('career-type-select').value = payData.career.type || 'worker';
    document.getElementById('career-day-input').value = payData.career.day || 15;
    document.getElementById('career-amount-input').value = payData.career.amount || 0;
}
window.saveCareerConfig = function() {
    payData.career.type = document.getElementById('career-type-select').value;
    payData.career.day = parseInt(document.getElementById('career-day-input').value) || 15;
    payData.career.amount = parseFloat(document.getElementById('career-amount-input').value) || 0;
    savePayData();
    alert("职业与发薪设定已保存！到日子会自动打入银行卡。");
}
window.generateCareerAmountByAI = async function() {
    const persona = document.getElementById('my-global-persona').value || "普通人";
    const jobType = document.getElementById('career-type-select').options[document.getElementById('career-type-select').selectedIndex].text;
    const btn = document.getElementById('btn-gen-salary');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 生成中';
    const prompt = `用户人设：“${persona}”。职业身份：“${jobType}”。推断TA每个月应发多少钱。只输出一个纯数字，例如：8500`;
    const result = await callAiForSpecialTask(prompt);
    btn.innerHTML = '<i class="fas fa-magic"></i> AI生成';
    if(result) {
        const match = result.match(/\d+(\.\d+)?/);
        if(match) {
            const money = parseFloat(match[0]);
            document.getElementById('career-amount-input').value = money;
            alert(`AI 判定你每月应得：¥${money}`);
        } else {
            alert("AI 返回格式异常，请重试或手动输入。");
        }
    }
}
function checkCareerSalary() {
    const c = payData.career;
    if(c.amount <= 0) return;
    const now = new Date();
    if(now.getDate() >= c.day) {
        if(c.lastPayMonth !== now.getMonth()) {
            payData.bankCard += c.amount;
            const title = (c.type === 'worker' || c.type === 'freelance') ? '工资/项目款入账' : '生活费/零花钱入账';
            addTransaction(title, c.amount, 'income');
            c.lastPayMonth = now.getMonth();
            savePayData();
            setTimeout(() => alert(`叮！你的当月【${title}】 ¥${c.amount} 已自动打入银行卡！`), 1000);
        }
    }
}

// 亲密付与打工逻辑保持无缝衔接
function renderIntimatePage() {
    const list = document.getElementById('intimate-list-container');
    list.innerHTML = '';
    const binds = Object.keys(payData.intimatePay);
    if(binds.length === 0) {
        list.innerHTML = '<div style="text-align:center; color:#999; font-size:12px; padding:20px;">还没有为任何人开通亲密付</div>';
        return;
    }
    binds.forEach(id => {
        const info = payData.intimatePay[id];
        const f = friendsData[id] || { realName: id, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}` };
        const nowMonth = new Date().getMonth();
        if(info.month !== nowMonth) { info.spent = 0; info.month = nowMonth; savePayData(); }
        const remain = info.limit - info.spent;
        list.innerHTML += `
            <div class="intimate-card">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <img src="${f.avatar}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;">
                        <div>
                            <div style="font-weight:700; font-size:14px; color:#333;">${f.remark || f.realName}</div>
                            <div style="font-size:10px; color:#999;">本月已花: ¥${info.spent.toFixed(2)}</div>
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:10px; color:#888;">剩余额度</div>
                        <div style="font-size:14px; font-weight:700; color:#2b2b2b;">¥${remain.toFixed(2)}</div>
                    </div>
                </div>
                <div style="display:flex; gap:10px; border-top:1px solid #f0f0f0; padding-top:10px; margin-top:5px;">
                    <button class="btn-secondary" style="flex:1; height:30px; font-size:11px;" onclick="unbindIntimate('${id}')">解除绑定</button>
                </div>
            </div>
        `;
    });
}
window.openBindIntimateModal = function() {
    const select = document.getElementById('intimate-ai-select');
    select.innerHTML = '';
    Object.keys(friendsData).forEach(id => {
        if(!payData.intimatePay[id]) {
            const f = friendsData[id];
            select.innerHTML += `<option value="${id}">${f.remark || f.realName}</option>`;
        }
    });
    if(select.options.length === 0) { alert("没有可绑定的 AI"); return; }
    document.getElementById('intimate-limit-input').value = '';
    document.getElementById('modal-bind-intimate').classList.add('active');
}
window.confirmBindIntimate = function() {
    const id = document.getElementById('intimate-ai-select').value;
    const limit = parseFloat(document.getElementById('intimate-limit-input').value);
    if(!id || isNaN(limit) || limit <= 0) { alert("请输入有效的额度！"); return; }
    payData.intimatePay[id] = { limit: limit, spent: 0, month: new Date().getMonth() };
    savePayData();
    document.getElementById('modal-bind-intimate').classList.remove('active');
    renderIntimatePage();
    alert("亲密付绑定成功！");
}
window.unbindIntimate = function(id) {
    if(confirm("确定要解除对 TA 的亲密付吗？")) {
        delete payData.intimatePay[id];
        savePayData();
        renderIntimatePage();
    }
}
function simulateIntimatePayConsumption() {
    if(Math.random() > 0.3) return;
    const binds = Object.keys(payData.intimatePay);
    if(binds.length === 0) return;
    const id = binds[Math.floor(Math.random() * binds.length)];
    const info = payData.intimatePay[id];
    const remain = info.limit - info.spent;
    if(remain > 10 && payData.balance > 10) {
        let cost = Math.floor(Math.random() * 190) + 10;
        cost = Math.min(cost, remain, payData.balance);
        const f = friendsData[id];
        const name = f ? (f.remark || f.realName) : id;
        const items = ['买了杯奶茶', '点了一份外卖', '买了一束花', '充值了游戏', '买了张电影票'];
        const desc = items[Math.floor(Math.random() * items.length)];
        info.spent += cost;
        payData.balance -= cost;
        addTransaction(`亲密付: ${name} ${desc}`, cost, 'expense');
        savePayData();
        setTimeout(() => { alert(`【亲密付扣款通知】\n你的宝贝 "${name}" 刚刚消费了 ¥${cost.toFixed(2)} (${desc})。`); }, 3000);
    }
}

let partTimeCooldown = false;
window.doPartTimeWork = function() {
    if(partTimeCooldown) return;
    partTimeCooldown = true;
    const earn = Math.floor(Math.random() * 26) + 5;
    payData.balance += earn;
    addTransaction('兼职打工收入', earn, 'income');
    savePayData();
    const fb = document.getElementById('work-feedback');
    fb.innerText = `+ ¥${earn.toFixed(2)}`;
    fb.style.opacity = '1';
    fb.style.transform = 'translateY(-10px)';
    setTimeout(() => {
        fb.style.opacity = '0';
        fb.style.transform = 'translateY(0)';
        partTimeCooldown = false;
    }, 1000);
}

function renderBillList() {
    const list = document.getElementById('pay-bill-list');
    list.innerHTML = '';
    if(payData.transactions.length === 0) {
        list.innerHTML = '<div style="text-align:center; padding:40px; color:#aaa; font-size:12px;">没有任何消费记录</div>';
        return;
    }
    payData.transactions.forEach(t => {
        const sign = t.type === 'income' ? '+' : '-';
        const colorClass = t.type === 'income' ? 'income' : 'expense';
        const dateStr = new Date(t.time).toLocaleString([], {month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'});
        list.innerHTML += `
            <div class="bill-item">
                <div class="bill-item-left">
                    <div class="bill-item-title">${t.title}</div>
                    <div class="bill-item-time">${dateStr}</div>
                </div>
                <div class="bill-item-amount ${colorClass}">${sign}${t.amount.toFixed(2)}</div>
            </div>
        `;
    });
}
// ===============================
// Settings 面板控制
// ===============================
window.toggleSettings = function (defaultTab = 'ai') {
    const view = document.getElementById('settingsView');
    if (!view) return;

    const opened = view.classList.contains('show');
    if (opened) {
        view.classList.remove('show');
        return;
    }

    view.classList.add('show');
    window.switchSettingsTab(defaultTab);
};

window.switchSettingsTab = function (tabName = 'ai') {
    const ai = document.getElementById('tab-content-ai');
    const theme = document.getElementById('tab-content-theme');

    if (ai) ai.style.display = (tabName === 'ai') ? 'block' : 'none';
    if (theme) theme.style.display = (tabName === 'theme') ? 'block' : 'none';

    // 顶部 tab 按钮 active 样式
    const btns = document.querySelectorAll('#settingsView .settings-tabs-switch .tab-btn');
    btns.forEach(b => b.classList.remove('active'));

    const target = document.querySelector(
        `#settingsView .settings-tabs-switch .tab-btn[onclick="switchSettingsTab('${tabName}')"]`
    );
    if (target) target.classList.add('active');
};
