// Tactile feedback effects: Web Audio synthesizer, Canvas Confetti, Toast with Undo, and Custom Confirm Modal

let audioCtx = null;
let toastTimer = null;
let confettiParticles = [];
let confettiAnimId = null;
let confirmResolver = null;

// --- Sound Preferences & Synthesizer ---

export function isSoundEnabled() {
  const saved = localStorage.getItem('tasklist_sound_enabled');
  return saved === null ? true : saved === 'true';
}

export function setSoundEnabled(enabled) {
  localStorage.setItem('tasklist_sound_enabled', enabled ? 'true' : 'false');
}

function getAudioContext() {
  if (!audioCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      audioCtx = new AudioCtx();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playSound(type) {
  if (!isSoundEnabled()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (type === 'check') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.11);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.16);
    } else if (type === 'uncheck') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(280, now + 0.09);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.11);
    } else if (type === 'add') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(660, now + 0.09);
      gain.gain.setValueAtTime(0.11, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.14);
    } else if (type === 'celebrate') {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.075);
        gain.gain.setValueAtTime(0.13, now + idx * 0.075);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.075 + 0.36);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.075);
        osc.stop(now + idx * 0.075 + 0.36);
      });
    } else if (type === 'chime') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.9);
    }
  } catch (err) {
    // Ignore audio context restrictions silently
  }
}

// --- Canvas Confetti Engine ---

function getConfettiCanvas() {
  return document.getElementById('confettiCanvas');
}

export function resizeConfettiCanvas() {
  const canvas = getConfettiCanvas();
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

export function launchConfetti(count = 65, originX = null, originY = null) {
  const canvas = getConfettiCanvas();
  if (!canvas) return;
  resizeConfettiCanvas();

  const colors = ['#aee8e4', '#ffc4b0', '#ffec99', '#4ade80', '#fb7185', '#60a5fa', '#fcd34d'];
  const startX = originX !== null ? originX : window.innerWidth / 2;
  const startY = originY !== null ? originY : window.innerHeight * 0.32;

  for (let i = 0; i < count; i++) {
    confettiParticles.push({
      x: startX + (Math.random() - 0.5) * 200,
      y: startY + (Math.random() - 0.5) * 40,
      vx: (Math.random() - 0.5) * 13,
      vy: -(Math.random() * 9 + 4),
      size: Math.random() * 7 + 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.25,
      alpha: 1,
      shape: Math.random() > 0.3 ? 'rect' : 'circle'
    });
  }

  if (!confettiAnimId) {
    animateConfetti();
  }
}

function animateConfetti() {
  const canvas = getConfettiCanvas();
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  confettiParticles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.27;
    p.vx *= 0.992;
    p.rotation += p.vRot;
    p.alpha -= 0.0085;

    ctx.save();
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.fillStyle = p.color;
    if (p.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(0, 0, p.size * 0.45, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.62);
    }
    ctx.restore();
  });

  confettiParticles = confettiParticles.filter(p => p.alpha > 0 && p.y < canvas.height + 30);

  if (confettiParticles.length > 0) {
    confettiAnimId = requestAnimationFrame(animateConfetti);
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    confettiAnimId = null;
  }
}

// --- Floating Toast Notification (with optional Undo action) ---

export function showToast(message, options = {}) {
  const toast = document.getElementById('appToast');
  const toastText = document.getElementById('appToastText');
  const toastActionBtn = document.getElementById('appToastAction');
  if (!toast || !toastText) return;

  const { type = 'default', duration = 3000, actionLabel = null, onAction = null } =
    typeof options === 'string' ? { type: options } : options;

  toastText.textContent = message;
  toast.dataset.type = type;

  if (toastActionBtn) {
    if (actionLabel && typeof onAction === 'function') {
      toastActionBtn.textContent = actionLabel;
      toastActionBtn.style.display = 'inline-flex';
      toastActionBtn.onclick = () => {
        hideToast();
        onAction();
      };
    } else {
      toastActionBtn.style.display = 'none';
      toastActionBtn.onclick = null;
    }
  }

  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, actionLabel ? Math.max(duration, 4800) : duration);
}

export function hideToast() {
  const toast = document.getElementById('appToast');
  if (toast) toast.classList.remove('show');
}

// --- Custom Confirmation Modal (Replaces native confirm/alert) ---

export function initConfirmModal() {
  const modal = document.getElementById('confirmModal');
  const btnCancel = document.getElementById('btnCancelConfirm');
  const btnOk = document.getElementById('btnAcceptConfirm');
  const btnClose = document.getElementById('btnCloseConfirm');
  if (!modal) return;

  const finish = (result) => {
    modal.classList.remove('open');
    if (confirmResolver) {
      const resolve = confirmResolver;
      confirmResolver = null;
      resolve(result);
    }
  };

  if (btnCancel) btnCancel.addEventListener('click', () => finish(false));
  if (btnClose) btnClose.addEventListener('click', () => finish(false));
  if (btnOk) btnOk.addEventListener('click', () => finish(true));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) finish(false);
  });
}

export function confirmAction({
  title = 'Confirmar ação',
  description = 'Tem certeza que deseja continuar?',
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false
}) {
  const modal = document.getElementById('confirmModal');
  if (!modal) {
    return Promise.resolve(window.confirm(description));
  }

  const titleEl = document.getElementById('confirmModalTitle');
  const descEl = document.getElementById('confirmModalDesc');
  const btnOk = document.getElementById('btnAcceptConfirm');
  const btnCancel = document.getElementById('btnCancelConfirm');

  if (titleEl) titleEl.textContent = title;
  if (descEl) descEl.textContent = description;
  if (btnOk) {
    btnOk.textContent = confirmLabel;
    btnOk.classList.toggle('btn-danger', danger);
    btnOk.classList.toggle('btn-primary', !danger);
  }
  if (btnCancel) btnCancel.textContent = cancelLabel;

  modal.classList.add('open');

  return new Promise(resolve => {
    confirmResolver = resolve;
  });
}

// Bind resize automatically only while confetti is animating
window.addEventListener('resize', () => {
  if (confettiAnimId) resizeConfettiCanvas();
});
