// js/moments.module.js
(function () {
  const MOMENTS_BG_KEY = 'myCoolPhone_momentsBg';
  const TRANS_SEPARATOR = '___TRANSLATION_SEP___';

  function init() {
    loadMomentsFeed();
    restoreMomentsBg();
    bindMomentsEvents();
  }

  function bindMomentsEvents() {
    // 点灰色 AI 图：显示描述文字
    const momentsTab = document.getElementById('tab-moments');
    if (momentsTab) {
      momentsTab.addEventListener('click', function (e) {
        const aiImg = e.target.closest('.moment-image-ai');
        if (!aiImg) return;
        const desc = aiImg.getAttribute('data-desc') || '';
        aiImg.innerText = desc;
        aiImg.classList.toggle('revealed');
      });
    }
  }

  // =========================
  // 数据读写
  // =========================
  function loadMomentsFeed() {
    const raw = localStorage.getItem(scopedLSKey(MOMENTS_FEED_KEY));
    if (raw) {
      try {
        momentsFeed = JSON.parse(raw) || [];
      } catch (e) {
        momentsFeed = [];
      }
    } else {
      momentsFeed = [];
    }
    renderMomentsFeed();
  }

  function saveMomentsFeed() {
    localStorage.setItem(scopedLSKey(MOMENTS_FEED_KEY), JSON.stringify(momentsFeed || []));
  }

  // =========================
  // 渲染
  // =========================
  function renderMomentsFeed() {
    const list = document.getElementById('moments-feed-list');
    if (!list) return;
    list.innerHTML = '';

    if (!momentsFeed || !momentsFeed.length) return;
    const sorted = [...momentsFeed].sort((a, b) => (b.time || 0) - (a.time || 0));

    sorted.forEach(m => {
      const f = friendsData[m.authorId] || {};
      const displayName = f.remark || f.realName || m.authorId;
      const avatar = f.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${f.realName || m.authorId}`;
      const likeCount = m.likeCount || 0;
      const likedClass = m.likedByMe ? 'liked' : '';
      const timeText = m.time ? new Date(m.time).toLocaleString().replace(/:\d{2}$/, '') : '';

      // 图片
      const imgs = (m.images || []).slice(0, 9);
      const count = imgs.length;
      let gridClass = 'grid-1';
      if (count >= 2 && count <= 4) gridClass = 'grid-2';
      else if (count >= 5) gridClass = 'grid-3';

      const imagesHtml = imgs.map((img, idx) => {
        if (img.isAI) {
          const safeDesc = (img.desc || '').replace(/"/g, '&quot;');
          return `<div class="moment-image-ai" data-desc="${safeDesc}"></div>`;
        } else if (img.url) {
          const safeUrl = img.url.replace(/"/g, '&quot;');
          if (count === 1) return `<img src="${safeUrl}" class="single-img">`;
          return `<div class="moment-img-wrap"><img src="${safeUrl}"></div>`;
        }
        return '';
      }).join('');

      // 评论
      const commentsHtml = (m.comments || []).map(c => {
        const safeText = (c.text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const safeAuthor = (c.authorName || c.authorId || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        // 给 inline onclick 用，转义单引号
        const safeAuthorJs = (c.authorName || c.authorId || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const safeAuthorIdJs = (c.authorId || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const safeMomentIdJs = (m.id || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const safeCommentIdJs = (c.id || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

        const aiClass = c.isAI ? 'moment-comment-ai' : '';
        const clickAttr = c.authorId !== 'ME'
          ? `onclick="setReplyTarget('${safeMomentIdJs}', '${safeCommentIdJs}', '${safeAuthorJs}', '${safeAuthorIdJs}')"`
          : '';

        const adminAction = `oncontextmenu="handleCommentAdmin(event, '${safeMomentIdJs}', '${safeCommentIdJs}'); return false;"`;

        return `
          <div class="moment-comment ${aiClass}" style="cursor:pointer;" data-comment-id="${c.id}" ${adminAction} ${clickAttr}>
            <span class="moment-comment-author">${safeAuthor}：</span>
            <span class="moment-comment-text">${safeText}</span>
          </div>
        `;
      }).join('');

      // 正文（支持翻译分隔）
      const rawText = (m.text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      let safeText = '';
      if (rawText.includes(TRANS_SEPARATOR)) {
        const parts = rawText.split(TRANS_SEPARATOR);
        safeText = `
          <div>${(parts[0] || '').trim().replace(/\n/g, '<br>')}</div>
          <div class="bubble-translation" style="display:block; border-top: 1px dashed #ccc; margin-top:8px; padding-top:8px; color:#888; font-size:12px;">
            ${(parts[1] || '').trim().replace(/\n/g, '<br>')}
          </div>
        `;
      } else {
        safeText = rawText.replace(/\n/g, '<br>');
      }

      const card = document.createElement('div');
      card.className = 'moment-card';
      card.setAttribute('data-moment-id', m.id);
      card.innerHTML = `
        <div class="moment-avatar"><img src="${avatar}"></div>
        <div class="moment-content">
          <div class="moment-name-row">
            <div class="moment-name">${displayName}</div>
            <div class="moment-card-actions">
              <i class="fas fa-edit" onclick="editMoment('${m.id}')"></i>
              <i class="fas fa-trash" onclick="deleteMoment('${m.id}')"></i>
            </div>
          </div>
          <div class="moment-text">${safeText}</div>
          <div class="moment-images ${gridClass}">${imagesHtml}</div>
          <div class="moment-meta">
            <span>${timeText}</span>
            <div class="moment-like-pill ${likedClass}" onclick="toggleMomentLike('${m.id}')">
              <i class="fas fa-heart" style="color:#ff5e5e;"></i>
              <span>${likeCount}</span>
            </div>
          </div>
          <div class="moment-comments">${commentsHtml}</div>
          <div class="moment-comment-input-row">
            <input type="text" class="moment-comment-input"
              placeholder="评论..."
              onkeydown="if(event.key==='Enter'){event.preventDefault(); addMomentComment('${m.id}');}">
            <button type="button" onclick="addMomentComment('${m.id}')">发送</button>
          </div>
        </div>
      `;
      list.appendChild(card);
    });
  }

  // =========================
  // AI 发朋友圈入口
  // =========================
  function createMomentFromAI(authorId, text, aiImageDescList = []) {
    const id = 'm_' + Date.now();
    const images = (aiImageDescList || []).map((desc, idx) => ({
      id: id + '_img_' + idx,
      isAI: true,
      desc: desc
    }));

    const moment = {
      id,
      authorId,
      text,
      time: Date.now(),
      likeCount: 0,
      likedByMe: false,
      comments: [],
      images
    };

    momentsFeed.push(moment);
    saveMomentsFeed();
    renderMomentsFeed();

    const dot = document.getElementById('moments-dot');
    if (dot) dot.style.display = 'block';
  }

  // =========================
  // 点赞 / 编辑 / 删除
  // =========================
  function toggleMomentLike(momentId) {
    const m = momentsFeed.find(x => x.id === momentId);
    if (!m) return;
    if (m.likedByMe) {
      m.likedByMe = false;
      m.likeCount = Math.max(0, (m.likeCount || 0) - 1);
    } else {
      m.likedByMe = true;
      m.likeCount = (m.likeCount || 0) + 1;
    }
    saveMomentsFeed();
    renderMomentsFeed();
  }

  function editMoment(momentId) {
    const m = momentsFeed.find(x => x.id === momentId);
    if (!m) return;
    const newText = prompt('编辑朋友圈内容：', m.text || '');
    if (newText === null) return;
    m.text = newText.trim();
    saveMomentsFeed();
    renderMomentsFeed();
  }

  function deleteMoment(momentId) {
    if (!confirm('确定删除这条朋友圈吗？')) return;
    momentsFeed = momentsFeed.filter(x => x.id !== momentId);
    saveMomentsFeed();
    renderMomentsFeed();
  }

  // =========================
  // 评论 + 回复链
  // =========================
  function setReplyTarget(momentId, commentId, authorName, authorId) {
    const card = document.querySelector(`.moment-card[data-moment-id="${momentId}"]`);
    if (!card) return;
    const input = card.querySelector('.moment-comment-input');
    if (!input) return;

    if (currentReplyTarget && currentReplyTarget.commentId === commentId) {
      cancelReplyTarget(momentId);
      return;
    }

    currentReplyTarget = { momentId, commentId, authorName, authorId };
    input.placeholder = `回复 ${authorName}:`;
    input.focus();
    input.style.border = "1px solid #07c160";
  }

  function cancelReplyTarget(momentId) {
    currentReplyTarget = null;
    const card = document.querySelector(`.moment-card[data-moment-id="${momentId}"]`);
    if (!card) return;
    const input = card.querySelector('.moment-comment-input');
    if (!input) return;
    input.placeholder = "评论...";
    input.style.border = "1px solid #e0e0e0";
  }

  function addMomentComment(momentId) {
    const card = document.querySelector(`.moment-card[data-moment-id="${momentId}"]`);
    if (!card) return;
    const input = card.querySelector('.moment-comment-input');
    let text = (input.value || '').trim();
    if (!text) return;

    const m = momentsFeed.find(x => x.id === momentId);
    if (!m) return;
    if (!m.comments) m.comments = [];

    // 是否是回复某人
    let isReply = false;
    let targetAiId = null;
    if (currentReplyTarget && currentReplyTarget.momentId === momentId) {
      isReply = true;
      targetAiId = currentReplyTarget.authorId;
      text = `回复 ${currentReplyTarget.authorName}：${text}`;
    }

    // 自己评论
    m.comments.push({
      id: 'c_' + Date.now(),
      authorId: 'ME',
      authorName: '我',
      text,
      isAI: false,
      time: Date.now()
    });

    input.value = '';
    cancelReplyTarget(momentId);
    saveMomentsFeed();
    renderMomentsFeed();

    // AI 互动
    if (isReply) {
      if (targetAiId !== 'ME' && friendsData[targetAiId]) {
        triggerAiReplyLogic(m, targetAiId, text, `User replied to your comment in a thread.`);
      }
    } else {
      if (m.authorId !== 'ME' && friendsData[m.authorId]) {
        triggerAiReplyLogic(m, m.authorId, text, `User commented on your post.`);
      }
      triggerBystandersReaction(m, text);
    }
  }

  function editMomentComment(momentId, commentId) {
    const m = momentsFeed.find(x => x.id === momentId);
    if (!m || !m.comments) return;
    const c = m.comments.find(x => x.id === commentId);
    if (!c) return;
    if (!c.isAI) {
      alert('只能编辑 AI 的评论。');
      return;
    }
    const newText = prompt('修改 AI 评论内容：', c.text || '');
    if (newText === null) return;
    c.text = newText.trim();
    saveMomentsFeed();
    renderMomentsFeed();
  }

  function handleCommentAdmin(e, momentId, commentId) {
    if (e) e.preventDefault();
    const m = momentsFeed.find(x => x.id === momentId);
    if (!m) return;
    const c = m.comments.find(x => x.id === commentId);
    if (!c) return;

    const op = confirm("管理评论：\n点击【确定】修改文字\n点击【取消】删除评论");
    if (op) {
      const newVal = prompt("请输入修改后的评论：", c.text);
      if (newVal !== null) {
        c.text = newVal;
        saveMomentsFeed();
        renderMomentsFeed();
      }
    } else {
      if (confirm("确定删除这条评论吗？")) {
        m.comments = m.comments.filter(x => x.id !== commentId);
        saveMomentsFeed();
        renderMomentsFeed();
      }
    }
  }

  // =========================
  // 发朋友圈弹窗
  // =========================
  function openPostMomentModal() {
    const modal = document.getElementById('post-moment-modal');
    if (!modal) return;

    document.getElementById('pm-text').value = '';
    document.getElementById('pm-file-input').value = '';
    document.getElementById('pm-preview-img').src = '';
    document.getElementById('pm-preview-img').style.display = 'none';
    document.getElementById('pm-plus-icon').style.display = 'block';
    document.getElementById('pm-img-desc').value = '';

    renderVisibilityList();
    modal.classList.add('active');
  }

  function closePostMomentModal() {
    const modal = document.getElementById('post-moment-modal');
    if (modal) modal.classList.remove('active');
  }

  function togglePmImgInput(mode) {
    const realBox = document.getElementById('pm-img-real-box');
    const descBox = document.getElementById('pm-img-desc-box');
    if (!realBox || !descBox) return;
    if (mode === 'real') {
      realBox.style.display = 'block';
      descBox.style.display = 'none';
    } else {
      realBox.style.display = 'none';
      descBox.style.display = 'block';
    }
  }

  function handlePmFilePreview(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      const img = document.getElementById('pm-preview-img');
      img.src = e.target.result;
      img.style.display = 'block';
      document.getElementById('pm-plus-icon').style.display = 'none';
    };
    reader.readAsDataURL(file);
  }

  function renderVisibilityList() {
    const list = document.getElementById('pm-visibility-list');
    if (!list) return;
    list.innerHTML = '';

    Object.keys(friendsData).forEach(id => {
      const f = friendsData[id];
      const item = document.createElement('div');
      item.style.display = 'flex';
      item.style.alignItems = 'center';
      item.style.padding = '5px';
      item.style.borderBottom = '1px solid #f9f9f9';
      item.innerHTML = `
        <input type="checkbox" value="${id}" checked style="width:16px; height:16px; margin-right:8px; accent-color:#333;">
        <span style="font-size:13px;">${f.remark || f.realName}</span>
      `;
      list.appendChild(item);
    });
  }

  function confirmPostMoment() {
    const text = document.getElementById('pm-text').value.trim();
    const mode = document.querySelector('input[name="pm-img-type"]:checked')?.value || 'real';

    const checkboxes = document.querySelectorAll('#pm-visibility-list input:checked');
    const allowedViewers = Array.from(checkboxes).map(cb => cb.value);

    let images = [];
    if (mode === 'real') {
      const imgEl = document.getElementById('pm-preview-img');
      if (imgEl && imgEl.style.display === 'block') {
        images.push({ url: imgEl.src, isAI: false });
      }
    } else {
      const desc = document.getElementById('pm-img-desc').value.trim();
      if (desc) images.push({ desc, isAI: true });
    }

    if (!text && images.length === 0) {
      alert("写点什么或发张图吧！");
      return;
    }

    const newMoment = {
      id: 'm_' + Date.now(),
      authorId: 'ME',
      text,
      time: Date.now(),
      likeCount: 0,
      likedByMe: false,
      comments: [],
      images,
      allowedViewers
    };

    momentsFeed.unshift(newMoment);
    saveMomentsFeed();
    renderMomentsFeed();
    closePostMomentModal();

    triggerAiReactionForMoment(newMoment);
  }

  // =========================
  // AI 朋友圈互动
  // =========================
  async function triggerAiReactionForMoment(moment) {
    const settingsJSON = localStorage.getItem(SETTINGS_KEY);
    if (!settingsJSON) return;
    const settings = JSON.parse(settingsJSON);

    for (const friendId of (moment.allowedViewers || [])) {
      const friend = friendsData[friendId];
      if (!friend) continue;

      const delay = Math.floor(Math.random() * 25000) + 5000;

      setTimeout(async () => {
        const systemPrompt = `
You are playing the role of ${friend.realName} on WeChat Moments.
Persona: ${friend.persona}

User posted:
"${moment.text}"
${moment.images.length > 0 ? `[Image: ${moment.images[0].isAI ? moment.images[0].desc : 'A photo'}]` : ''}

Output STRICT JSON:
{
  "action": "like" | "comment" | "both" | "ignore",
  "comment": "text"
}
Keep short and natural.
        `.trim();

        try {
          let baseUrl = (settings.endpoint || '').replace(/\/$/, '');
          const apiUrl = baseUrl.endsWith('/v1') ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;

          const res = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.apiKey}` },
            body: JSON.stringify({
              model: settings.model,
              messages: [{ role: "system", content: systemPrompt }, { role: "user", content: "React to this post." }],
              temperature: 0.8
            })
          });

          const data = await res.json();
          let content = data?.choices?.[0]?.message?.content || '';
          content = content.replace(/```json/g, '').replace(/```/g, '').trim();

          const result = JSON.parse(content);

          if (result.action === 'like' || result.action === 'both') {
            const m = momentsFeed.find(x => x.id === moment.id);
            if (m) {
              m.likeCount = (m.likeCount || 0) + 1;
              saveMomentsFeed();
              renderMomentsFeed();
            }
          }

          if ((result.action === 'comment' || result.action === 'both') && result.comment) {
            addAiCommentToMoment(moment.id, friendId, result.comment);
          }
        } catch (e) {
          console.error(`AI ${friendId} reaction failed:`, e);
        }
      }, delay);
    }
  }

  function addAiCommentToMoment(momentId, aiId, text) {
    const m = momentsFeed.find(x => x.id === momentId);
    if (!m) return;
    if (!m.comments) m.comments = [];

    const friend = friendsData[aiId] || {};
    m.comments.push({
      id: 'c_' + Date.now() + Math.random(),
      authorId: aiId,
      authorName: friend.remark || friend.realName || aiId,
      text,
      isAI: true,
      time: Date.now()
    });

    saveMomentsFeed();
    renderMomentsFeed();

    const dot = document.getElementById('moments-dot');
    if (dot) dot.style.display = 'block';
  }

  async function triggerAiReplyLogic(moment, aiId, userText, contextStr) {
    const friend = friendsData[aiId];
    if (!friend) return;

    const delay = Math.floor(Math.random() * 3000) + 2000;
    setTimeout(async () => {
      const settingsJSON = localStorage.getItem(SETTINGS_KEY);
      if (!settingsJSON) return;
      const settings = JSON.parse(settingsJSON);

      const systemPrompt = `
You are ${friend.realName}. Persona: ${friend.persona}.
Context: ${contextStr}
Original Post: "${moment.text}"
User said: "${userText}"

Reply briefly and casually.
Output ONLY reply text.
      `.trim();

      try {
        let baseUrl = (settings.endpoint || '').replace(/\/$/, '');
        const apiUrl = baseUrl.endsWith('/v1') ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;

        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.apiKey}` },
          body: JSON.stringify({
            model: settings.model,
            messages: [{ role: "system", content: systemPrompt }],
            temperature: 0.8
          })
        });

        const data = await res.json();
        let reply = (data?.choices?.[0]?.message?.content || '').trim();
        if (!reply) return;

        if (contextStr.includes('thread')) reply = `回复 我：${reply}`;
        addAiCommentToMoment(moment.id, aiId, reply);
      } catch (e) {
        console.error(e);
      }
    }, delay);
  }

  function triggerBystandersReaction(moment, userText) {
    const allFriendIds = Object.keys(friendsData || {});
    const potential = allFriendIds.filter(id => id !== moment.authorId && id !== 'ME');
    potential.forEach(aiId => {
      if (Math.random() > 0.7) {
        triggerAiReplyLogic(
          moment,
          aiId,
          userText,
          `User commented on a post by ${friendsData[moment.authorId]?.realName || 'someone'}. You are a mutual friend reading this.`
        );
      }
    });
  }

  // =========================
  // 朋友圈背景图
  // =========================
  function triggerChangeMomentsBg() {
    const choice = confirm("更换朋友圈背景图？\n点击[确定]输入URL，点击[取消]上传本地图片");
    if (choice) {
      const url = prompt("请输入图片 URL:");
      if (url) updateMomentsBg(url);
    } else {
      const fileInput = document.getElementById('global-img-changer');
      if (!fileInput) return;

      const oldOnChange = fileInput.onchange;
      fileInput.onchange = function (e) {
        if (e.target.files && e.target.files[0]) {
          const reader = new FileReader();
          reader.onload = function (evt) {
            updateMomentsBg(evt.target.result);
          };
          reader.readAsDataURL(e.target.files[0]);
        }
        setTimeout(() => { fileInput.onchange = oldOnChange; }, 50);
      };
      fileInput.click();
    }
  }

  function updateMomentsBg(url) {
    const bgEl = document.getElementById('moments-header-bg');
    if (bgEl) bgEl.style.backgroundImage = `url('${url}')`;
    localStorage.setItem(MOMENTS_BG_KEY, url);
  }

  function restoreMomentsBg() {
    const url = localStorage.getItem(MOMENTS_BG_KEY);
    if (!url) return;
    const bgEl = document.getElementById('moments-header-bg');
    if (bgEl) bgEl.style.backgroundImage = `url('${url}')`;
  }

  // =========================
  // 对外暴露（给 HTML onclick 用）
  // =========================
  window.MomentsModule = { init };

  window.loadMomentsFeed = loadMomentsFeed;
  window.saveMomentsFeed = saveMomentsFeed;
  window.renderMomentsFeed = renderMomentsFeed;

  window.createMomentFromAI = createMomentFromAI;
  window.toggleMomentLike = toggleMomentLike;
  window.editMoment = editMoment;
  window.deleteMoment = deleteMoment;

  window.addMomentComment = addMomentComment;
  window.editMomentComment = editMomentComment;
  window.setReplyTarget = setReplyTarget;
  window.handleCommentAdmin = handleCommentAdmin;

  window.openPostMomentModal = openPostMomentModal;
  window.closePostMomentModal = closePostMomentModal;
  window.togglePmImgInput = togglePmImgInput;
  window.handlePmFilePreview = handlePmFilePreview;
  window.confirmPostMoment = confirmPostMoment;

  window.triggerChangeMomentsBg = triggerChangeMomentsBg;
  window.updateMomentsBg = updateMomentsBg;
  window.restoreMomentsBg = restoreMomentsBg;
})();
