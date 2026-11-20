// Bespoke SVG illustrations and smart icon matcher for Gustavo & Isabella Tasklist

export const GUS_AVATAR_SVG = `
  <svg viewBox="0 0 48 48" class="avatar-svg" aria-hidden="true">
    <path d="M12 20 C12 10 36 10 36 20 Z" fill="#6b4423" stroke="#0f172a" stroke-width="2.2"/>
    <circle cx="24" cy="23" r="10" fill="#fbd3b6" stroke="#0f172a" stroke-width="2.2"/>
    <path d="M14 19 Q19 13 25 17 Q30 13 34 19" fill="#6b4423" stroke="#0f172a" stroke-width="2" stroke-linecap="round"/>
    <circle cx="20.5" cy="23" r="1.5" fill="#0f172a"/>
    <circle cx="27.5" cy="23" r="1.5" fill="#0f172a"/>
    <path d="M21 27.5 Q24 30 27 27.5" fill="none" stroke="#0f172a" stroke-width="2" stroke-linecap="round"/>
    <path d="M15 43 C15 35 33 35 33 43" fill="#38bdf8" stroke="#0f172a" stroke-width="2.2" stroke-linecap="round"/>
  </svg>
`;

export const ISA_AVATAR_SVG = `
  <svg viewBox="0 0 48 48" class="avatar-svg" aria-hidden="true">
    <path d="M11 24 C11 9 37 9 37 24 L39 35 C34 36 14 36 9 35 Z" fill="#5c3a21" stroke="#0f172a" stroke-width="2.2" stroke-linejoin="round"/>
    <circle cx="24" cy="23" r="9.5" fill="#fbd3b6" stroke="#0f172a" stroke-width="2.2"/>
    <path d="M14.5 20 Q20 14 24 18 Q28 14 33.5 20" fill="#5c3a21" stroke="#0f172a" stroke-width="2" stroke-linecap="round"/>
    <circle cx="20.5" cy="23" r="1.5" fill="#0f172a"/>
    <circle cx="27.5" cy="23" r="1.5" fill="#0f172a"/>
    <path d="M21 27.5 Q24 30 27 27.5" fill="none" stroke="#0f172a" stroke-width="2" stroke-linecap="round"/>
    <path d="M15 43 C15 35 33 35 33 43" fill="#fb7185" stroke="#0f172a" stroke-width="2.2" stroke-linecap="round"/>
  </svg>
`;

export const AMBOS_AVATAR_SVG = `
  <svg viewBox="0 0 48 48" class="avatar-svg" aria-hidden="true">
    <path d="M24 39s-13-8.35-13-17.5A7.5 7.5 0 0 1 24 16a7.5 7.5 0 0 1 13 5.5C37 30.65 24 39 24 39z" fill="#ef4444" stroke="#0f172a" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M18 21a3 3 0 0 1 3-3" stroke="#fecaca" stroke-width="2" stroke-linecap="round" fill="none"/>
  </svg>
`;

export const CUSTOM_SVGS = {
  forms: `
    <svg viewBox="0 0 40 40" class="task-custom-svg" aria-hidden="true">
      <rect x="8" y="6" width="24" height="29" rx="3" fill="#93c5fd" stroke="#0f172a" stroke-width="2"/>
      <rect x="11" y="10" width="18" height="22" rx="1.5" fill="#eff6ff" stroke="#0f172a" stroke-width="1.5"/>
      <rect x="14" y="4" width="12" height="5" rx="2" fill="#cbd5e1" stroke="#0f172a" stroke-width="1.8"/>
      <line x1="14" y1="16" x2="26" y2="16" stroke="#2563eb" stroke-width="2" stroke-linecap="round"/>
      <line x1="14" y1="21" x2="26" y2="21" stroke="#2563eb" stroke-width="2" stroke-linecap="round"/>
      <line x1="14" y1="26" x2="22" y2="26" stroke="#2563eb" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
  dishes: `
    <svg viewBox="0 0 40 40" class="task-custom-svg" aria-hidden="true">
      <circle cx="24" cy="21" r="10" fill="#f8fafc" stroke="#0f172a" stroke-width="2"/>
      <circle cx="24" cy="21" r="6" fill="#e0f2fe" stroke="#0f172a" stroke-width="1.4"/>
      <ellipse cx="14" cy="29" rx="8" ry="2.5" fill="#cbd5e1" stroke="#0f172a" stroke-width="1.8"/>
      <ellipse cx="14" cy="26" rx="8" ry="2.5" fill="#f8fafc" stroke="#0f172a" stroke-width="1.8"/>
      <circle cx="11" cy="12" r="2.5" fill="#bae6fd" stroke="#0f172a" stroke-width="1.4"/>
      <circle cx="33" cy="10" r="2" fill="#bae6fd" stroke="#0f172a" stroke-width="1.4"/>
    </svg>`,
  kitchen: `
    <svg viewBox="0 0 40 40" class="task-custom-svg" aria-hidden="true">
      <line x1="18" y1="6" x2="10" y2="26" stroke="#b45309" stroke-width="2.5" stroke-linecap="round"/>
      <polygon points="6,25 15,27 12,35 3,32" fill="#facc15" stroke="#0f172a" stroke-width="1.8" stroke-linejoin="round"/>
      <rect x="19" y="21" width="15" height="12" rx="2" fill="#94a3b8" stroke="#0f172a" stroke-width="2"/>
      <path d="M17 23 H36" stroke="#0f172a" stroke-width="2" stroke-linecap="round"/>
      <path d="M24 18 Q26 15 28 18" fill="none" stroke="#0f172a" stroke-width="1.8" stroke-linecap="round"/>
    </svg>`,
  college: `
    <svg viewBox="0 0 40 40" class="task-custom-svg" aria-hidden="true">
      <rect x="8" y="9" width="15" height="22" rx="2" transform="rotate(-10 15 20)" fill="#86efac" stroke="#0f172a" stroke-width="2"/>
      <rect x="17" y="9" width="15" height="22" rx="2" transform="rotate(6 24 20)" fill="#fda4af" stroke="#0f172a" stroke-width="2"/>
      <rect x="20" y="13" width="9" height="5" rx="1" transform="rotate(6 24 15)" fill="#fff1f2" stroke="#0f172a" stroke-width="1.4"/>
    </svg>`,
  bathroom: `
    <svg viewBox="0 0 40 40" class="task-custom-svg" aria-hidden="true">
      <polygon points="8,18 24,18 22,33 10,33" fill="#93c5fd" stroke="#0f172a" stroke-width="2" stroke-linejoin="round"/>
      <ellipse cx="16" cy="18" rx="8" ry="2.8" fill="#e0f2fe" stroke="#0f172a" stroke-width="1.8"/>
      <line x1="32" y1="6" x2="27" y2="29" stroke="#b45309" stroke-width="2.4" stroke-linecap="round"/>
      <rect x="23" y="29" width="9" height="5" rx="1.5" fill="#fde047" stroke="#0f172a" stroke-width="1.8"/>
      <circle cx="14" cy="11" r="2.2" fill="#fff" stroke="#0f172a" stroke-width="1.3"/>
    </svg>`,
  laundry: `
    <svg viewBox="0 0 40 40" class="task-custom-svg" aria-hidden="true">
      <path d="M4 11 Q20 16 36 11" fill="none" stroke="#0f172a" stroke-width="1.8" stroke-linecap="round"/>
      <polygon points="8,14 19,14 18,26 9,26" fill="#fde047" stroke="#0f172a" stroke-width="1.8" stroke-linejoin="round"/>
      <polygon points="22,14 33,14 34,33 29,33 27.5,22 26,33 21,33" fill="#60a5fa" stroke="#0f172a" stroke-width="1.8" stroke-linejoin="round"/>
    </svg>`,
  xmasTree: `
    <svg viewBox="0 0 40 40" class="task-custom-svg" aria-hidden="true">
      <rect x="17" y="31" width="6" height="5" fill="#92400e" stroke="#0f172a" stroke-width="1.8"/>
      <polygon points="20,6 9,18 31,18" fill="#4ade80" stroke="#0f172a" stroke-width="1.8" stroke-linejoin="round"/>
      <polygon points="20,13 7,25 33,25" fill="#22c55e" stroke="#0f172a" stroke-width="1.8" stroke-linejoin="round"/>
      <polygon points="20,19 5,32 35,32" fill="#16a34a" stroke="#0f172a" stroke-width="1.8" stroke-linejoin="round"/>
      <circle cx="20" cy="5" r="2.5" fill="#facc15" stroke="#0f172a" stroke-width="1.4"/>
      <circle cx="16" cy="22" r="1.8" fill="#ef4444"/>
      <circle cx="25" cy="27" r="1.8" fill="#fde047"/>
    </svg>`,
  bruce: `
    <svg viewBox="0 0 40 40" class="task-custom-svg" aria-hidden="true">
      <polygon points="20,6 5,18 35,18" fill="#ef4444" stroke="#0f172a" stroke-width="2" stroke-linejoin="round"/>
      <rect x="9" y="18" width="22" height="16" fill="#fed7aa" stroke="#0f172a" stroke-width="2"/>
      <path d="M14 34 V24 A6 6 0 0 1 26 24 V34 Z" fill="#78350f" stroke="#0f172a" stroke-width="1.8"/>
      <circle cx="20" cy="27" r="5" fill="#d97706" stroke="#0f172a" stroke-width="1.6"/>
      <ellipse cx="15.5" cy="26" rx="2" ry="3.5" fill="#92400e" stroke="#0f172a" stroke-width="1.4"/>
      <ellipse cx="24.5" cy="26" rx="2" ry="3.5" fill="#92400e" stroke="#0f172a" stroke-width="1.4"/>
      <circle cx="18.5" cy="26.5" r="1" fill="#0f172a"/>
      <circle cx="21.5" cy="26.5" r="1" fill="#0f172a"/>
      <circle cx="20" cy="28.5" r="1.3" fill="#0f172a"/>
    </svg>`,
  iceCream: `
    <svg viewBox="0 0 40 40" class="task-custom-svg" aria-hidden="true">
      <polygon points="14,21 26,21 20,36" fill="#f59e0b" stroke="#0f172a" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="17" cy="17" r="5" fill="#fef08a" stroke="#0f172a" stroke-width="1.8"/>
      <circle cx="23" cy="17" r="5" fill="#f472b6" stroke="#0f172a" stroke-width="1.8"/>
      <circle cx="20" cy="11" r="5" fill="#fbcfe8" stroke="#0f172a" stroke-width="1.8"/>
      <circle cx="20" cy="6" r="2" fill="#ef4444" stroke="#0f172a" stroke-width="1.3"/>
    </svg>`,
  wardrobe: `
    <svg viewBox="0 0 40 40" class="task-custom-svg" aria-hidden="true">
      <path d="M20 11 C20 8 23 8 23 10 C23 12 20 12.5 20 14 L6 23 H34 L20 14" fill="none" stroke="#0f172a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="12" y="23" width="16" height="11" rx="1.5" fill="#fb7185" stroke="#0f172a" stroke-width="2"/>
    </svg>`,
  market: `
    <svg viewBox="0 0 40 40" class="task-custom-svg" aria-hidden="true">
      <path d="M5 10 H10 L14 26 H30 L34 14 H12" fill="#fde047" stroke="#0f172a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="16" cy="32" r="2.8" fill="#475569" stroke="#0f172a" stroke-width="1.8"/>
      <circle cx="28" cy="32" r="2.8" fill="#475569" stroke="#0f172a" stroke-width="1.8"/>
      <circle cx="20" cy="18" r="3" fill="#4ade80" stroke="#0f172a" stroke-width="1.4"/>
      <circle cx="26" cy="18" r="3" fill="#fb7185" stroke="#0f172a" stroke-width="1.4"/>
    </svg>`,
  home: `
    <svg viewBox="0 0 40 40" class="task-custom-svg" aria-hidden="true">
      <polygon points="20,6 5,19 35,19" fill="#fb7185" stroke="#0f172a" stroke-width="2" stroke-linejoin="round"/>
      <rect x="9" y="19" width="22" height="15" rx="1.5" fill="#fef3c7" stroke="#0f172a" stroke-width="2"/>
      <rect x="16" y="24" width="8" height="10" rx="1" fill="#60a5fa" stroke="#0f172a" stroke-width="1.8"/>
    </svg>`,
  trash: `
    <svg viewBox="0 0 40 40" class="task-custom-svg" aria-hidden="true">
      <rect x="10" y="13" width="20" height="21" rx="2.5" fill="#94a3b8" stroke="#0f172a" stroke-width="2"/>
      <path d="M7 13 H33" stroke="#0f172a" stroke-width="2.4" stroke-linecap="round"/>
      <rect x="15" y="8" width="10" height="5" rx="1.5" fill="#cbd5e1" stroke="#0f172a" stroke-width="1.8"/>
      <line x1="16" y1="18" x2="16" y2="29" stroke="#0f172a" stroke-width="1.8" stroke-linecap="round"/>
      <line x1="20" y1="18" x2="20" y2="29" stroke="#0f172a" stroke-width="1.8" stroke-linecap="round"/>
      <line x1="24" y1="18" x2="24" y2="29" stroke="#0f172a" stroke-width="1.8" stroke-linecap="round"/>
    </svg>`,
  finance: `
    <svg viewBox="0 0 40 40" class="task-custom-svg" aria-hidden="true">
      <rect x="6" y="11" width="28" height="19" rx="3" fill="#4ade80" stroke="#0f172a" stroke-width="2"/>
      <circle cx="20" cy="20.5" r="5" fill="#fef08a" stroke="#0f172a" stroke-width="1.8"/>
      <line x1="10" y1="16" x2="12" y2="16" stroke="#0f172a" stroke-width="2" stroke-linecap="round"/>
      <line x1="28" y1="25" x2="30" y2="25" stroke="#0f172a" stroke-width="2" stroke-linecap="round"/>
    </svg>`
};

export const EMOJI_PRESETS = {
  Gus: ['📋', '🍽️', '🧹', '🛒', '💻', '🔧', '🏃', '✨'],
  Isa: ['📚', '🫧', '👕', '🪴', '🎓', '🌸', '🎨', '✨'],
  Shared: ['💛', '🐶', '🏠', '🛒', '🍦', '🍿', '✈️', '🎄']
};

export const ALL_EMOJIS = [
  '✨', '📋', '🍽️', '🧹', '🫧', '👕', '🧥', '🏠',
  '🛒', '🐶', '📚', '💻', '💰', '🍦', '🍿', '✈️',
  '🪴', '🎁', '💛', '🎄', '❤️', '🏃', '💊', '🚗'
];

/**
 * Automatically detects a matching bespoke SVG key from a task title
 * when the task doesn't explicitly define a custom emoji/svgKey.
 */
export function detectSvgKeyFromTitle(title) {
  if (!title) return null;
  const lower = title.toLowerCase();
  if (lower.includes('forms') || lower.includes('formul') || lower.includes('planilha')) return 'forms';
  if (lower.includes('louça') || lower.includes('louca') || lower.includes('prato')) return 'dishes';
  if (lower.includes('cozinha') || lower.includes('fogão') || lower.includes('fogao') || lower.includes('varrer')) return 'kitchen';
  if (lower.includes('facul') || lower.includes('estud') || lower.includes('aula') || lower.includes('prova') || lower.includes('livro') || lower.includes('caderno')) return 'college';
  if (lower.includes('banheiro') || lower.includes('box') || lower.includes('lavar chão')) return 'bathroom';
  if (lower.includes('estender') || lower.includes('lavanderia') || lower.includes('lavar roupa')) return 'laundry';
  if (lower.includes('guardar roupa') || lower.includes('cabide') || lower.includes('armário') || lower.includes('armario') || lower.includes('dobrar')) return 'wardrobe';
  if (lower.includes('natal') || lower.includes('árvore') || lower.includes('arvore')) return 'xmasTree';
  if (lower.includes('bruce') || lower.includes('cachorro') || lower.includes('pet') || lower.includes('ração') || lower.includes('racao') || lower.includes('passear')) return 'bruce';
  if (lower.includes('sorvete') || lower.includes('doce') || lower.includes('sobremesa')) return 'iceCream';
  if (lower.includes('mercado') || lower.includes('compra') || lower.includes('feira') || lower.includes('supermercado')) return 'market';
  if (lower.includes('lixo') || lower.includes('recicl')) return 'trash';
  if (lower.includes('conta') || lower.includes('pagar') || lower.includes('boleto') || lower.includes('banco') || lower.includes('pix')) return 'finance';
  if (lower.includes('casa') || lower.includes('quarto') || lower.includes('sala')) return 'home';
  return null;
}

/**
 * Renders the best visual icon for a task (bespoke SVG or emoji pill)
 */
export function renderTaskIcon(task) {
  if (task.svgKey && CUSTOM_SVGS[task.svgKey]) {
    return CUSTOM_SVGS[task.svgKey];
  }
  if (!task.emoji) {
    const autoSvg = detectSvgKeyFromTitle(task.title);
    if (autoSvg && CUSTOM_SVGS[autoSvg]) {
      return CUSTOM_SVGS[autoSvg];
    }
  }
  const emoji = task.emoji || '✨';
  return `<span class="task-emoji-badge" aria-hidden="true">${emoji}</span>`;
}
