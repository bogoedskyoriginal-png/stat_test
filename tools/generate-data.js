const fs = require('fs');
const path = require('path');

const today = new Date('2026-03-12T00:00:00Z');
const days = 30;

function formatDM(date) {
  const d = String(date.getUTCDate()).padStart(2, '0');
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${d}.${m}`;
}

function formatDMY(date) {
  const d = String(date.getUTCDate()).padStart(2, '0');
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const y = String(date.getUTCFullYear()).slice(-2);
  return `${d}.${m}.${y}`;
}

function formatYMD(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const dates = [];
for (let i = days - 1; i >= 0; i -= 1) {
  const d = new Date(today);
  d.setUTCDate(d.getUTCDate() - i);
  dates.push(d);
}

function clampMin(value, min) {
  return value < min ? min : value;
}

function round(value) {
  return Math.round(value);
}

function buildAssistantA() {
  const rows = dates.map((d, i) => {
    const base = 1200 + i * 100;
    const noise = ((i % 5) - 2) * 20;
    const requests = base + noise;
    const unique = round(requests * 0.28 + ((i % 3) - 1) * 10);
    const chats = clampMin(round(unique * 0.6 + ((i % 4) - 1) * 5), 120);
    const favorites = clampMin(round(unique * 0.12 + ((i % 6) - 2) * 3), 15);
    const avg = requests / chats;

    return {
      date: formatYMD(d),
      dateLabel: formatDM(d),
      dateLabelFull: formatDMY(d),
      requests,
      uniqueUsers: unique,
      chatsCreated: chats,
      avgRequestsPerChat: Number(avg.toFixed(2)),
      favorites,
    };
  });

  return {
    id: 'finpulse',
    name: 'FinPulse',
    description: 'Финансовый ассистент для мониторинга личного бюджета и быстрых ответов по расходам и целям.',
    pattern: 'stable_growth',
    rows,
  };
}

function buildAssistantB() {
  const spikeIndexes = new Set([4, 11, 18, 25]);
  const rows = dates.map((d, i) => {
    const base = 180 + (i % 7) * 15;
    const spike = spikeIndexes.has(i) ? 900 + (i % 3) * 120 : 0;
    const requests = base + spike;
    const unique = round(requests * 0.45 + (i % 2 ? 8 : -6));
    const chats = clampMin(round(unique * 0.55 + ((i % 3) - 1) * 2), 40);
    const favorites = clampMin(round(unique * 0.18 + ((i % 4) - 2) * 2), 6);
    const avg = requests / chats;

    return {
      date: formatYMD(d),
      dateLabel: formatDM(d),
      dateLabelFull: formatDMY(d),
      requests,
      uniqueUsers: unique,
      chatsCreated: chats,
      avgRequestsPerChat: Number(avg.toFixed(2)),
      favorites,
    };
  });

  return {
    id: 'lingualift',
    name: 'LinguaLift',
    description: 'Ассистент для изучения языков с микро-диалогами и персональными тренировками.',
    pattern: 'spikes',
    rows,
  };
}

function buildAssistantC() {
  const rows = dates.map((d, i) => {
    const weekday = d.getUTCDay();
    const isWeekend = weekday === 0 || weekday === 6;
    const base = isWeekend ? 24 : 55;
    const wave = isWeekend ? (i % 3) * 4 : (i % 5) * 6;
    const requests = base + wave;
    const unique = round(requests * 0.55 + (isWeekend ? -2 : 3));
    const chats = clampMin(round(unique * 0.7 + (isWeekend ? -1 : 2)), 8);
    const favorites = clampMin(round(unique * 0.15 + (isWeekend ? -1 : 1)), 2);
    const avg = requests / chats;

    return {
      date: formatYMD(d),
      dateLabel: formatDM(d),
      dateLabelFull: formatDMY(d),
      requests,
      uniqueUsers: unique,
      chatsCreated: chats,
      avgRequestsPerChat: Number(avg.toFixed(2)),
      favorites,
    };
  });

  return {
    id: 'weekendvibe',
    name: 'WeekendVibe',
    description: 'Развлекательный ассистент для быстрых идей на выходные и лёгких сценариев отдыха.',
    pattern: 'seasonal',
    rows,
  };
}

const assistants = [buildAssistantA(), buildAssistantB(), buildAssistantC()];

const output = {
  generatedAt: formatYMD(today),
  range: {
    start: formatYMD(dates[0]),
    end: formatYMD(dates[dates.length - 1]),
  },
  assistants,
};

const dataPath = path.join(__dirname, '..', 'data', 'assistants.json');
fs.writeFileSync(dataPath, JSON.stringify(output, null, 2));

function toTable(assistant) {
  const headers = ['Дата', 'Запросы', 'Уникальные пользователи', 'Созданные чаты', 'Среднее запросов в чате', 'Добавления в избранное'];
  const lines = [];
  lines.push(`| ${headers.join(' | ')} |`);
  lines.push(`| ${headers.map(() => '---').join(' | ')} |`);
  assistant.rows.forEach((row) => {
    lines.push(`| ${row.dateLabel} | ${row.requests} | ${row.uniqueUsers} | ${row.chatsCreated} | ${row.avgRequestsPerChat.toFixed(2)} | ${row.favorites} |`);
  });
  return lines.join('\n');
}

const comments = {
  finpulse: 'Стабильный рост запросов и пользователей показывает органическое расширение аудитории. Это подчёркивает, как график по умолчанию (30 дней) даёт ясную картину тренда.',
  lingualift: 'Резкие всплески 15.02, 22.02, 01.03 и 08.03 демонстрируют эффект рекламных кампаний. Переключение метрик сохраняет те же даты пиков, но с разной амплитудой.',
  weekendvibe: 'Выраженные просадки на выходных и подъёмы в будни подчёркивают сезонность. Небольшие значения удобны для демонстрации адаптивного шага по оси Y.',
};

const report = `# Alfa AI — Демонстрационный проект статистики\n\nДата генерации: ${formatYMD(today)}\nПериод данных: ${formatDM(dates[0])} – ${formatDM(dates[dates.length - 1])}\n\n## Ассистенты и данные\n\n### FinPulse\n${toTable(assistants[0])}\n\nКомментарий: ${comments.finpulse}\n\n### LinguaLift\n${toTable(assistants[1])}\n\nКомментарий: ${comments.lingualift}\n\n### WeekendVibe\n${toTable(assistants[2])}\n\nКомментарий: ${comments.weekendvibe}\n`;

const readmePath = path.join(__dirname, '..', 'README.md');
fs.writeFileSync(readmePath, report);

console.log('Data generated:', dataPath);
console.log('README written:', readmePath);
