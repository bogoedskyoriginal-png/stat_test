const DATA = window.ASSISTANTS_DATA;

const METRICS = [
  {
    key: 'requests',
    label: 'Количество запросов в AI-ассистента',
    description: 'Все сообщения пользователей во всех чатах ассистента.',
    format: (value) => Math.round(value).toString(),
  },
  {
    key: 'uniqueUsers',
    label: 'Количество уникальных пользователей',
    description: 'Уникальные пользователи, воспользовавшиеся ассистентом.',
    format: (value) => Math.round(value).toString(),
  },
  {
    key: 'chatsCreated',
    label: 'Количество созданных чатов',
    description: 'Новые чаты, созданные с ассистентом.',
    format: (value) => Math.round(value).toString(),
  },
  {
    key: 'avgRequestsPerChat',
    label: 'Среднее количество запросов в 1 чате',
    description: 'Среднее число сообщений в одном чате (дробные значения).',
    format: (value) => Number(value).toFixed(2),
  },
  {
    key: 'favorites',
    label: 'Добавлено в «Избранное»',
    description: 'Добавления ассистента в избранное от уникальных пользователей.',
    format: (value) => Math.round(value).toString(),
  },
];

const assistants = DATA.assistants.map((assistant, index) => ({
  ...assistant,
  status: 'Публичный',
  publishedAt: index === 0 ? '2025-12-14' : index === 1 ? '2026-01-03' : '2026-03-09',
}));

const state = {
  assistant: assistants[0],
  metricKey: 'requests',
  periodType: '30',
  customStart: null,
  customEnd: null,
  lastDownloadName: null,
};

const cardContainer = document.getElementById('assistantCards');
const rangeStart = document.getElementById('rangeStart');
const rangeEnd = document.getElementById('rangeEnd');
const modalBackdrop = document.getElementById('modalBackdrop');
const modalTitle = document.getElementById('modalTitle');
const modalSubtitle = document.getElementById('modalSubtitle');
const metricList = document.getElementById('metricList');
const metricTitle = document.getElementById('metricTitle');
const metricDescription = document.getElementById('metricDescription');
const chartCanvas = document.getElementById('chart');
const tooltip = document.getElementById('tooltip');
const axisNote = document.getElementById('axisNote');
const customRange = document.getElementById('customRange');
const customStart = document.getElementById('customStart');
const customEnd = document.getElementById('customEnd');
const customHint = document.getElementById('customHint');
const downloadBtn = document.getElementById('downloadBtn');
const availabilityNote = document.getElementById('availabilityNote');
const availabilityDate = document.getElementById('availabilityDate');

let chartPoints = [];

function formatDateLabel(dateStr) {
  const [year, month, day] = dateStr.split('-');
  return `${day}.${month}.${year}`;
}

function parseDate(value) {
  return new Date(`${value}T00:00:00Z`);
}

function formatDM(date) {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${day}.${month}`;
}

function formatDMY(date) {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}.${month}.${year}`;
}

function formatYMD(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function diffDays(start, end) {
  const ms = end.getTime() - start.getTime();
  return Math.floor(ms / 86400000) + 1;
}

function clampRange(start, end, minDate, maxDate) {
  const clampedStart = start < minDate ? minDate : start;
  const clampedEnd = end > maxDate ? maxDate : end;
  return { start: clampedStart, end: clampedEnd };
}

function getRowsForPeriod() {
  const rows = state.assistant.rows;
  const minDate = parseDate(rows[0].date);
  const maxDate = parseDate(rows[rows.length - 1].date);

  if (state.periodType === '30' || state.periodType === '7') {
    const days = Number(state.periodType);
    const slice = rows.slice(Math.max(rows.length - days, 0));
    const start = parseDate(slice[0].date);
    const end = parseDate(slice[slice.length - 1].date);
    return {
      rows: slice,
      start,
      end,
      clamped: false,
      stepX: slice.length >= 26 ? 5 : slice.length >= 12 ? 2 : 1,
    };
  }

  if (state.customStart && state.customEnd) {
    let start = parseDate(state.customStart);
    let end = parseDate(state.customEnd);

    if (start > end) {
      [start, end] = [end, start];
    }

    const length = diffDays(start, end);
    if (length > 30) {
      return { invalid: true, rows: [], start, end, stepX: 1 };
    }

    const clamped = clampRange(start, end, minDate, maxDate);
    const filtered = rows.filter((row) => {
      const date = parseDate(row.date);
      return date >= clamped.start && date <= clamped.end;
    });

    return {
      rows: filtered,
      start: clamped.start,
      end: clamped.end,
      clamped: clamped.start.getTime() !== start.getTime() || clamped.end.getTime() !== end.getTime(),
      requestedLength: length,
      stepX: filtered.length >= 26 ? 5 : filtered.length >= 12 ? 2 : 1,
    };
  }

  return { rows: [], start: minDate, end: maxDate, stepX: 1 };
}

function niceStep(maxValue, targetTicks = 5) {
  if (maxValue <= 0) {
    return 1;
  }
  const rough = maxValue / targetTicks;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const candidates = [1, 2, 5, 10].map((n) => n * magnitude);
  return candidates.find((c) => c >= rough) || candidates[candidates.length - 1] * 10;
}

function updateChart() {
  if (!isStatsAvailable()) {
    return;
  }

  const { rows, start, end, stepX, invalid, clamped, requestedLength } = getRowsForPeriod();
  const metric = METRICS.find((item) => item.key === state.metricKey);

  metricTitle.textContent = metric.label;
  metricDescription.textContent = metric.description;

  const subtitle = `Период: с ${formatDMY(start)} по ${formatDMY(end)}`;
  modalSubtitle.textContent = clamped ? `${subtitle} (обрезано по доступным данным)` : subtitle;

  if (invalid) {
    customHint.textContent = 'Выбрать период более 30 дней нельзя.';
    customHint.style.color = 'var(--accent)';
    return;
  }

  if (state.periodType === 'custom' && requestedLength) {
    if (clamped) {
      customHint.textContent = 'Ассистент существует меньше выбранного периода — показываем доступные дни.';
      customHint.style.color = 'var(--accent-dark)';
    } else {
      customHint.textContent = 'Период выбран корректно (до 30 дней).';
      customHint.style.color = 'var(--accent-dark)';
    }
  } else {
    customHint.textContent = 'Максимальная длина периода — 30 дней.';
    customHint.style.color = 'var(--accent-dark)';
  }

  if (!rows.length) {
    const ctx = chartCanvas.getContext('2d');
    resizeCanvas(chartCanvas);
    ctx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);
    axisNote.textContent = 'Выберите период, чтобы отрисовать график.';
    return;
  }

  drawChart(rows, metric, stepX);
}

function resizeCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  return dpr;
}

function drawChart(rows, metric, stepX) {
  const ctx = chartCanvas.getContext('2d');
  const dpr = resizeCanvas(chartCanvas);
  const width = chartCanvas.width;
  const height = chartCanvas.height;

  ctx.clearRect(0, 0, width, height);

  const padding = { top: 24, right: 24, bottom: 42, left: 54 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const values = rows.map((row) => row[metric.key]);
  const maxValue = Math.max(...values, 0);
  const stepY = niceStep(maxValue);
  const yMax = stepY * 5;

  ctx.strokeStyle = 'rgba(199, 63, 58, 0.15)';
  ctx.lineWidth = 1 * dpr;
  ctx.font = `${12 * dpr}px Manrope`;
  ctx.fillStyle = '#6f4b4a';

  for (let i = 0; i <= 5; i += 1) {
    const y = padding.top + (plotHeight / 5) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();

    const value = Math.round(yMax - (yMax / 5) * i);
    ctx.fillText(value.toString(), 6 * dpr, y + 4 * dpr);
  }

  ctx.strokeStyle = 'rgba(199, 63, 58, 0.25)';
  ctx.lineWidth = 2 * dpr;
  ctx.beginPath();

  const denom = Math.max(rows.length - 1, 1);
  chartPoints = rows.map((row, index) => {
    const value = row[metric.key];
    const x = padding.left + (plotWidth / denom) * index;
    const y = padding.top + plotHeight - (value / yMax) * plotHeight;
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
    return { x, y, row };
  });

  ctx.stroke();

  ctx.fillStyle = 'rgba(199, 63, 58, 0.8)';
  chartPoints.forEach((point) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 3.5 * dpr, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = '#6f4b4a';
  ctx.font = `${11 * dpr}px Manrope`;

  rows.forEach((row, index) => {
    if (index % stepX !== 0 && index !== rows.length - 1) {
      return;
    }
    const x = padding.left + (plotWidth / denom) * index;
    const label = row.dateLabel;
    ctx.fillText(label, x - 10 * dpr, height - 14 * dpr);
  });

  axisNote.textContent = `Адаптивные подписи: шаг X — каждые ${stepX} дн., шаг Y — ${stepY}`;
}

function showTooltip(event) {
  if (!chartPoints.length) {
    return;
  }
  const rect = chartCanvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const x = (event.clientX - rect.left) * dpr;
  const closest = chartPoints.reduce((prev, current) => {
    return Math.abs(current.x - x) < Math.abs(prev.x - x) ? current : prev;
  });

  const metric = METRICS.find((item) => item.key === state.metricKey);
  const value = metric.format(closest.row[metric.key]);
  tooltip.textContent = `${closest.row.dateLabelFull} · ${value}`;
  tooltip.style.display = 'block';
  tooltip.style.left = `${(closest.x / dpr) + 12}px`;
  tooltip.style.top = `${(closest.y / dpr) - 12}px`;
}

function hideTooltip() {
  tooltip.style.display = 'none';
}

function renderCards() {
  cardContainer.innerHTML = '';
  assistants.forEach((assistant) => {
    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `
      <button class="card-menu" aria-label="Меню" data-id="${assistant.id}">⋮</button>
      <div class="status">● ${assistant.status}</div>
      <h3>${assistant.name}</h3>
      <p>${assistant.description}</p>
      <div class="dropdown" data-dropdown="${assistant.id}">
        <button class="menu-stat" data-id="${assistant.id}">Статистика</button>
        <button>Сгенерировать ссылку</button>
        <button>Редактировать</button>
        <button>Удалить</button>
        <button>Скрыть</button>
      </div>
    `;
    cardContainer.appendChild(card);
  });
}


function renderMetricList() {
  metricList.innerHTML = '';
  METRICS.forEach((metric) => {
    const button = document.createElement('button');
    button.className = 'metric';
    button.dataset.metric = metric.key;
    button.textContent = metric.label;
    if (metric.key === state.metricKey) {
      button.classList.add('active');
    }
    metricList.appendChild(button);
  });
}

function openModal(assistantId) {
  state.assistant = assistants.find((item) => item.id === assistantId);
  state.metricKey = 'requests';
  state.periodType = '30';
  state.customStart = null;
  state.customEnd = null;

  modalTitle.textContent = `${state.assistant.name}`;

  document.querySelectorAll('.pill').forEach((pill) => {
    pill.classList.toggle('active', pill.dataset.period === '30');
  });
  customRange.classList.remove('active');
  modalBackdrop.classList.add('active');
  modalBackdrop.setAttribute('aria-hidden', 'false');

  const rows = state.assistant.rows;
  customStart.min = rows[0].date;
  customStart.max = rows[rows.length - 1].date;
  customEnd.min = rows[0].date;
  customEnd.max = rows[rows.length - 1].date;
  customStart.value = '';
  customEnd.value = '';

  renderMetricList();
  updateAvailability();
  if (isStatsAvailable()) {
    updateChart();
  }
}

function closeModal() {
  modalBackdrop.classList.remove('active');
  modalBackdrop.setAttribute('aria-hidden', 'true');
}

function updatePeriod(type) {
  state.periodType = type;
  document.querySelectorAll('.pill').forEach((pill) => {
    pill.classList.toggle('active', pill.dataset.period === type);
  });
  if (type === 'custom') {
    customRange.classList.add('active');
  } else {
    customRange.classList.remove('active');
  }
  updateAvailability();
  updateChart();
}

function setCustomRange() {
  if (!customStart.value || !customEnd.value) {
    return;
  }
  state.customStart = customStart.value;
  state.customEnd = customEnd.value;
  updateChart();
}

function downloadCsv() {
  if (!isStatsAvailable()) {
    return;
  }
  const { rows, start, end, invalid } = getRowsForPeriod();
  if (invalid || !rows.length) {
    return;
  }

  const startLabel = formatYMD(start).replace(/-/g, '');
  const endLabel = formatYMD(end).replace(/-/g, '');
  const filename = `${state.assistant.name}_${startLabel}-${endLabel}.csv`;

  if (state.lastDownloadName === filename) {
    axisNote.textContent = 'Отчёт уже скачан для этого периода (идемпотентная выдача).';
    return;
  }

  const headers = ['Дата', ...METRICS.map((metric) => metric.label)];
  const lines = [headers.join(';')];

  rows.forEach((row) => {
    const values = METRICS.map((metric) => metric.format(row[metric.key]));
    lines.push([row.dateLabel, ...values].join(';'));
  });

  const csvContent = '\ufeff' + lines.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  state.lastDownloadName = filename;
  axisNote.textContent = `Отчёт «${filename}» сформирован.`;
}

function closeAllDropdowns() {
  document.querySelectorAll('.dropdown').forEach((dropdown) => {
    dropdown.style.display = 'none';
  });
}

cardContainer.addEventListener('click', (event) => {
  const menuButton = event.target.closest('.card-menu');
  const statButton = event.target.closest('.menu-stat');

  if (menuButton) {
    const dropdown = document.querySelector(`.dropdown[data-dropdown="${menuButton.dataset.id}"]`);
    const isOpen = dropdown.style.display === 'block';
    closeAllDropdowns();
    dropdown.style.display = isOpen ? 'none' : 'block';
    return;
  }

  if (statButton) {
    closeAllDropdowns();
    openModal(statButton.dataset.id);
  }
});

window.addEventListener('click', (event) => {
  if (!event.target.closest('.card')) {
    closeAllDropdowns();
  }
});

metricList.addEventListener('click', (event) => {
  const button = event.target.closest('.metric');
  if (!button) {
    return;
  }
  state.metricKey = button.dataset.metric;
  renderMetricList();
  updateChart();
});

customStart.addEventListener('change', setCustomRange);
customEnd.addEventListener('change', setCustomRange);

chartCanvas.addEventListener('mousemove', showTooltip);
chartCanvas.addEventListener('mouseleave', hideTooltip);

window.addEventListener('resize', () => {
  if (modalBackdrop.classList.contains('active')) {
    updateChart();
  }
});

modalBackdrop.addEventListener('click', (event) => {
  if (event.target === modalBackdrop) {
    closeModal();
  }
});

document.getElementById('modalClose').addEventListener('click', closeModal);

document.querySelectorAll('.pill').forEach((pill) => {
  pill.addEventListener('click', () => updatePeriod(pill.dataset.period));
});

downloadBtn.addEventListener('click', downloadCsv);

function isStatsAvailable() {
  const publishedAt = parseDate(state.assistant.publishedAt);
  const availableAt = new Date(publishedAt);
  availableAt.setUTCDate(availableAt.getUTCDate() + 7);
  const now = parseDate(DATA.range.end);
  return now >= availableAt;
}

function updateAvailability() {
  const available = isStatsAvailable();
  const publishedAt = parseDate(state.assistant.publishedAt);
  const availableAt = new Date(publishedAt);
  availableAt.setUTCDate(availableAt.getUTCDate() + 7);

  availabilityNote.classList.toggle('active', !available);
  metricList.style.display = available ? 'block' : 'none';
  document.querySelector('.chart-area').style.display = available ? 'block' : 'none';
  document.querySelector('.period-controls').style.display = available ? 'flex' : 'none';
  if (!available) {
    customRange.classList.remove('active');
  }
  availabilityDate.textContent = `Доступно с ${formatDMY(availableAt)} (00:00 МСК)`;
}

function init() {
  rangeStart.textContent = formatDM(parseDate(DATA.range.start));
  rangeEnd.textContent = formatDM(parseDate(DATA.range.end));
  renderCards();
}

init();
