/* =================================================================
   [核心逻辑修复] 多身份系统 (已切换至 IDB 大容量存储)
   ================================================================= */

const PERSONA_META_KEY = 'myCoolPhone_personaMeta';
const CURRENT_PERSONA_KEY = 'myCoolPhone_currentPersonaId';

let personasMeta = {};
let currentPersonaId = 'p_default';

// 1. 初始化系统 (改为异步加载，从 IDB 读取)
async function initPersonaSystem() {
    // 尝试从大仓库 IDB 获取
    let data = await IDB.get(PERSONA_META_KEY);

    // 如果 IDB 里没数据，试试看是不是还在 LocalStorage 里 (迁移旧数据)
    if (!data) {
        const oldData = localStorage.getItem(PERSONA_META_KEY);
        if (oldData) {
            try {
                data = JSON.parse(oldData);
                await IDB.set(PERSONA_META_KEY, data); // 搬家到大仓库
                // localStorage.removeItem(PERSONA_META_KEY); // 可选：删掉旧的腾空间
            } catch (e) { console.error(e); }
        }
    }

    // 如果还是没数据，创建默认身份
    if (!data || Object.keys(data).length === 0) {
        data = {
            p_default: {
                id: 'p_default', name: 'Hannah', gender: '女',
                avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=200&auto=format&fit=crop',
                persona: '默认身份'
            }
        };
        await IDB.set(PERSONA_META_KEY, data);
    }
    
    personasMeta = data;

    // 读取当前是谁 (ID 很短，存 LocalStorage 没问题)
    currentPersonaId = localStorage.getItem(CURRENT_PERSONA_KEY) || 'p_default';
    if (!personasMeta[currentPersonaId]) currentPersonaId = 'p_default';
    
    // 加载完数据后，立刻刷新一下 UI
    applyPersonaToUI();
}

// 2. 获取带身份后缀的 Key
function scopedLSKey(baseKey) {
    return `${baseKey}__${currentPersonaId}`;
}
window.scopedChatKey = function(chatId) {
    return `chat_history__${currentPersonaId}__${chatId}`;
}

// 3. 应用身份到 UI
function applyPersonaToUI() {
    const me = personasMeta[currentPersonaId];
    if (!me) return;

    // 首页 & Me页
    const homeName = document.querySelector('.editable-name');
    const homeAvatar = document.querySelector('.avatar-circle-sm img');
    const meAvatar = document.querySelector('#tab-me .wc-avatar.lg img');
    const meName = document.querySelector('#tab-me .wc-me-name');
    const meId = document.querySelector('#tab-me .wc-me-id');
    
    if (homeName) homeName.innerText = me.name || 'Me';
    if (homeAvatar) homeAvatar.src = me.avatar || '';
    if (meAvatar) meAvatar.src = me.avatar || '';
    if (meName) meName.innerText = me.name || 'Me';
    if (meId) meId.innerText = `ID: ${me.wxId || 'unknown'}`;

    // 朋友圈背景 & 头像
    const momentsAvatar = document.querySelector('.user-avatar-overlay img');
    const momentsName = document.querySelector('.user-name-overlay');
    const momentsBg = document.getElementById('moments-header-bg');

    if (momentsAvatar) momentsAvatar.src = me.avatar || '';
    if (momentsName) momentsName.innerText = me.name || 'Daily Moments';
    if (momentsBg) {
        momentsBg.style.backgroundImage = me.momentsBg ? `url('${me.momentsBg}')` : 
            `url('https://images.unsplash.com/photo-1494859802809-d069c3b71a8a?q=80&w=400&auto=format&fit=crop')`;
    }

    if (typeof AVATAR_USER !== 'undefined') AVATAR_USER = me.avatar || AVATAR_USER;
    const gp = document.getElementById('my-global-persona');
    if (gp) gp.value = me.persona || '';
}

/* ===== 弹窗操作函数 ===== */

window.openIdentityModal = function(e) {
    if(e) e.stopPropagation();
    const modal = document.getElementById('identity-modal');
    if (!modal) return;
    
    renderIdentitySelect();
    fillIdentityForm(currentPersonaId);
    modal.classList.add('active');
};

window.closeIdentityModal = function() {
    document.getElementById('identity-modal').classList.remove('active');
};

function renderIdentitySelect() {
    const sel = document.getElementById('identity-select');
    if(!sel) return;
    sel.innerHTML = '';
    Object.values(personasMeta).forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.name} (${p.gender || '未知'})`;
        if (p.id === currentPersonaId) opt.selected = true;
        sel.appendChild(opt);
    });
}

window.onIdentitySelectChange = function(id) {
    fillIdentityForm(id);
};

function fillIdentityForm(id) {
    const p = personasMeta[id];
    if (!p) return;
    document.getElementById('id-name').value = p.name || '';
    document.getElementById('id-avatar-url').value = p.avatar || '';
    document.getElementById('id-moments-bg').value = p.momentsBg || '';
    document.getElementById('id-persona').value = p.persona || '';
    
    updateIdPreview(p.avatar);

    const genderSel = document.getElementById('id-gender-select');
    const genderInp = document.getElementById('id-gender-input');
    if (['男','女'].includes(p.gender)) {
        genderSel.value = p.gender;
        genderInp.style.display = 'none';
    } else {
        genderSel.value = 'custom';
        genderInp.style.display = 'block';
        genderInp.value = p.gender || '';
    }
}

// 图片压缩 (依然保留，虽然空间大了，但压缩能让界面跑得更快)
function compressAvatarImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // 稍微放宽一点限制，允许 300px
                const maxWidth = 300; 
                let w = img.width;
                let h = img.height;
                if (w > maxWidth) {
                    h = Math.round(h * (maxWidth / w));
                    w = maxWidth;
                }
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                resolve(dataUrl);
            };
        };
    });
}

window.handleIdAvatarFile = async function(input) {
    if (input.files && input.files[0]) {
        try {
            const previewImg = document.getElementById('id-preview-img');
            previewImg.style.opacity = '0.5';
            const compressedBase64 = await compressAvatarImage(input.files[0]);
            previewImg.src = compressedBase64;
            previewImg.style.opacity = '1';
            previewImg.setAttribute('data-base64', compressedBase64);
            document.getElementById('id-avatar-url').value = '';
        } catch (e) {
            alert("图片处理失败");
        }
    }
};

window.toggleIdGenderInput = function(val) {
    document.getElementById('id-gender-input').style.display = (val === 'custom') ? 'block' : 'none';
};
window.updateIdPreview = function(url) {
    document.getElementById('id-preview-img').src = url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${Date.now()}`;
};

// 新建身份 (写入 IDB)
window.createNewIdentity = async function() {
    const id = 'p_' + Date.now();
    personasMeta[id] = {
        id: id, name: '新身份', gender: '未知',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + id,
        persona: ''
    };
    // === 关键：保存到 IDB ===
    await IDB.set(PERSONA_META_KEY, personasMeta);
    
    renderIdentitySelect();
    document.getElementById('identity-select').value = id;
    fillIdentityForm(id);
};

// 删除身份 (写入 IDB)
window.deleteCurrentIdentity = async function() {
    const id = document.getElementById('identity-select').value;
    if (Object.keys(personasMeta).length <= 1) return alert('至少保留一个身份！');
    if (!confirm('确认删除？数据无法恢复。')) return;
    
    delete personasMeta[id];
    if (currentPersonaId === id) currentPersonaId = Object.keys(personasMeta)[0];
    
    // === 关键：保存到 IDB ===
    await IDB.set(PERSONA_META_KEY, personasMeta);
    localStorage.setItem(CURRENT_PERSONA_KEY, currentPersonaId);
    
    renderIdentitySelect();
    fillIdentityForm(currentPersonaId);
};

// 保存并切换 (写入 IDB)
window.saveAndSwitchIdentity = async function() {
    const id = document.getElementById('identity-select').value;
    const p = personasMeta[id];
    if (!p) return;

    // 更新数据
    p.name = document.getElementById('id-name').value.trim() || '未命名';
    p.momentsBg = document.getElementById('id-moments-bg').value.trim();
    p.persona = document.getElementById('id-persona').value.trim();
    
    const gSel = document.getElementById('id-gender-select').value;
    p.gender = (gSel === 'custom') ? document.getElementById('id-gender-input').value.trim() : gSel;

    const previewImg = document.getElementById('id-preview-img');
    const newBase64 = previewImg.getAttribute('data-base64');
    const newUrl = document.getElementById('id-avatar-url').value.trim();
    
    if (newBase64) p.avatar = newBase64;
    else if (newUrl) p.avatar = newUrl;

    try {
        // === 关键修改：存入大仓库 IDB ===
        await IDB.set(PERSONA_META_KEY, personasMeta);
        
        // ID 存入 LocalStorage (因为它很短，没关系)
        localStorage.setItem(CURRENT_PERSONA_KEY, id);
        
        currentPersonaId = id;
        closeIdentityModal();

        // 刷新界面
        const chatLayer = document.getElementById('chatLayer');
        if (chatLayer) chatLayer.classList.remove('show');
        document.getElementById('chatMessages').innerHTML = '';
        
        friendsData = {}; 
        momentsFeed = [];
        await loadFriendsData();
        loadMomentsFeed();
        applyPersonaToUI();
        
        previewImg.removeAttribute('data-base64');
        alert("保存并切换成功！");

    } catch (e) {
        alert("保存出错：" + e.message);
        console.error(e);
    }
};
