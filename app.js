const TASKS_KEY = "task-muse.tasks";
const SETTINGS_KEY = "task-muse.settings";

const fallbackLines = [
  "達成おめでとう。ちゃんと前に進めたね、すごいよ。",
  "よく頑張ったね。この一つを終わらせたの、かなり偉い。",
  "完了確認。集中してやり切ったあなた、最高に頼もしいよ。",
  "いい調子。小さな達成を積める人は、本当に強いよ。",
  "やったね。今日のあなた、ちゃんと結果を出してるよ。"
];

const encouragementLines = [
  "今の一歩だけ見よう。次のタスクも、短く区切れば大丈夫。",
  "焦らなくていいよ。まずは一番軽いタスクから片付けよう。",
  "集中を戻すなら、タイトルだけ決めて追加してみよう。",
  "今日はもう始められているよ。その時点で流れは作れてる。"
];

const priorityLabels = {
  high: "高め",
  normal: "通常",
  low: "低め"
};

const appConfig = window.TASK_MUSE_CONFIG || {};

const defaultSettings = {
  voiceEnabled: true,
  voiceEngine: appConfig.voiceEngine || "webspeech",
  voiceName: "",
  voiceRate: 1,
  voicePitch: 1.08,
  voicevoxEndpoint: appConfig.voicevoxEndpoint || "http://127.0.0.1:50021",
  voicevoxSpeaker: Number(appConfig.voicevoxSpeaker || 1),
  voicevoxApiKey: "",
  llmEnabled: false,
  llmEndpoint: appConfig.llmEndpoint || "",
  llmModel: appConfig.llmModel || "qwen2.5:0.5b",
  llmApiKey: ""
};

let tasks = loadTasks();
let settings = loadSettings();
let filter = "active";
let searchQuery = "";
let lastSpeech = "";
let voices = [];
let voicevoxSpeakers = [];
let currentVoicevoxAudio = null;
let currentVoicevoxAudioUrl = "";
let currentVoicevoxController = null;

const elements = {
  form: document.querySelector("#taskForm"),
  title: document.querySelector("#taskTitle"),
  due: document.querySelector("#taskDue"),
  priority: document.querySelector("#taskPriority"),
  note: document.querySelector("#taskNote"),
  list: document.querySelector("#taskList"),
  template: document.querySelector("#taskTemplate"),
  empty: document.querySelector("#emptyState"),
  activeCount: document.querySelector("#activeCount"),
  doneCount: document.querySelector("#doneCount"),
  todayCount: document.querySelector("#todayCount"),
  search: document.querySelector("#searchInput"),
  segments: document.querySelectorAll(".segment"),
  speech: document.querySelector("#speechText"),
  voiceState: document.querySelector("#voiceState"),
  voiceEnabled: document.querySelector("#voiceEnabled"),
  voiceEngine: document.querySelector("#voiceEngine"),
  voiceSelect: document.querySelector("#voiceSelect"),
  voiceRate: document.querySelector("#voiceRate"),
  voicePitch: document.querySelector("#voicePitch"),
  voicevoxEndpoint: document.querySelector("#voicevoxEndpoint"),
  voicevoxSpeaker: document.querySelector("#voicevoxSpeaker"),
  voicevoxApiKey: document.querySelector("#voicevoxApiKey"),
  loadVoicevox: document.querySelector("#loadVoicevoxButton"),
  llmEnabled: document.querySelector("#llmEnabled"),
  llmEndpoint: document.querySelector("#llmEndpoint"),
  llmModel: document.querySelector("#llmModel"),
  llmApiKey: document.querySelector("#llmApiKey"),
  llmStatus: document.querySelector("#llmStatus"),
  testLlm: document.querySelector("#testLlmButton"),
  replay: document.querySelector("#replayButton"),
  mobilePraise: document.querySelector("#mobilePraise"),
  mobilePraiseText: document.querySelector("#mobilePraiseText"),
  mobileReplay: document.querySelector("#mobileReplayButton"),
  surprise: document.querySelector("#surpriseButton"),
  clearDone: document.querySelector("#clearDoneButton"),
  exportButton: document.querySelector("#exportButton"),
  companion: document.querySelector(".companion-panel")
};

initialize();

function initialize() {
  bindEvents();
  applySettingsToControls();
  populateVoices();
  render();
}

function bindEvents() {
  elements.form.addEventListener("submit", handleAddTask);

  elements.segments.forEach((button) => {
    button.addEventListener("click", () => {
      filter = button.dataset.filter;
      render();
    });
  });

  elements.search.addEventListener("input", () => {
    searchQuery = elements.search.value.trim().toLowerCase();
    renderTasks();
  });

  elements.voiceEnabled.addEventListener("change", () => {
    settings.voiceEnabled = elements.voiceEnabled.checked;
    saveSettings();
  });

  elements.voiceEngine.addEventListener("change", () => {
    settings.voiceEngine = elements.voiceEngine.value;
    saveSettings();
    updateVoiceControls();
  });

  elements.voiceSelect.addEventListener("change", () => {
    settings.voiceName = elements.voiceSelect.value;
    saveSettings();
  });

  elements.voiceRate.addEventListener("input", () => {
    settings.voiceRate = Number(elements.voiceRate.value);
    saveSettings();
  });

  elements.voicePitch.addEventListener("input", () => {
    settings.voicePitch = Number(elements.voicePitch.value);
    saveSettings();
  });

  elements.voicevoxEndpoint.addEventListener("change", () => {
    settings.voicevoxEndpoint = normalizeEndpoint(elements.voicevoxEndpoint.value || defaultSettings.voicevoxEndpoint);
    elements.voicevoxEndpoint.value = settings.voicevoxEndpoint;
    saveSettings();
  });

  elements.voicevoxSpeaker.addEventListener("change", () => {
    settings.voicevoxSpeaker = Number(elements.voicevoxSpeaker.value) || defaultSettings.voicevoxSpeaker;
    saveSettings();
  });

  elements.voicevoxApiKey.addEventListener("change", () => {
    settings.voicevoxApiKey = elements.voicevoxApiKey.value.trim();
    saveSettings();
  });

  elements.loadVoicevox.addEventListener("click", loadVoicevoxSpeakers);

  elements.llmEnabled.addEventListener("change", () => {
    settings.llmEnabled = elements.llmEnabled.checked;
    saveSettings();
    updateLlmStatus(settings.llmEnabled ? "未確認" : "テンプレート");
  });

  elements.llmEndpoint.addEventListener("change", () => {
    settings.llmEndpoint = elements.llmEndpoint.value.trim() || defaultSettings.llmEndpoint;
    elements.llmEndpoint.value = settings.llmEndpoint;
    saveSettings();
  });

  elements.llmModel.addEventListener("change", () => {
    settings.llmModel = elements.llmModel.value.trim() || defaultSettings.llmModel;
    elements.llmModel.value = settings.llmModel;
    saveSettings();
  });

  elements.llmApiKey.addEventListener("change", () => {
    settings.llmApiKey = elements.llmApiKey.value.trim();
    saveSettings();
  });

  elements.testLlm.addEventListener("click", testLlmConnection);
  elements.replay.addEventListener("click", () => {
    if (lastSpeech) speak(lastSpeech);
  });
  elements.mobileReplay.addEventListener("click", () => {
    if (lastSpeech) speak(lastSpeech);
  });
  elements.surprise.addEventListener("click", () => {
    const line = choose(encouragementLines);
    showSpeech(line, "励まし");
    speak(line);
  });
  elements.clearDone.addEventListener("click", clearCompletedTasks);
  elements.exportButton.addEventListener("click", exportTasks);

  if ("speechSynthesis" in window) {
    window.speechSynthesis.addEventListener("voiceschanged", populateVoices);
  }
}

function handleAddTask(event) {
  event.preventDefault();
  const title = elements.title.value.trim();
  if (!title) return;

  tasks.unshift({
    id: crypto.randomUUID(),
    title,
    note: elements.note.value.trim(),
    due: elements.due.value,
    priority: elements.priority.value,
    completed: false,
    createdAt: new Date().toISOString(),
    completedAt: ""
  });

  saveTasks();
  elements.form.reset();
  elements.priority.value = "normal";
  filter = "active";
  render();
  elements.title.focus();
}

function render() {
  renderSegments();
  renderStats();
  renderTasks();
}

function renderSegments() {
  elements.segments.forEach((button) => {
    const active = button.dataset.filter === filter;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
}

function renderStats() {
  const done = tasks.filter((task) => task.completed);
  const today = new Date().toDateString();
  elements.activeCount.textContent = tasks.filter((task) => !task.completed).length;
  elements.doneCount.textContent = done.length;
  elements.todayCount.textContent = done.filter((task) => {
    return task.completedAt && new Date(task.completedAt).toDateString() === today;
  }).length;
}

function renderTasks() {
  elements.list.replaceChildren();
  const visible = getVisibleTasks();

  visible.forEach((task) => {
    const item = elements.template.content.firstElementChild.cloneNode(true);
    const check = item.querySelector(".check-button");
    const title = item.querySelector(".task-title");
    const note = item.querySelector(".task-note");
    const meta = item.querySelector(".task-meta");
    const badge = item.querySelector(".priority-badge");
    const remove = item.querySelector(".delete-button");

    item.classList.toggle("is-done", task.completed);
    title.textContent = task.title;
    note.textContent = task.note;
    note.hidden = !task.note;
    badge.textContent = priorityLabels[task.priority] || priorityLabels.normal;
    badge.classList.add(`priority-${task.priority || "normal"}`);
    meta.textContent = buildMeta(task);

    check.addEventListener("click", () => toggleTask(task.id));
    remove.addEventListener("click", () => deleteTask(task.id));
    elements.list.append(item);
  });

  elements.empty.classList.toggle("is-visible", visible.length === 0);
}

function getVisibleTasks() {
  return tasks.filter((task) => {
    const filterMatch =
      filter === "all" ||
      (filter === "active" && !task.completed) ||
      (filter === "done" && task.completed);
    const text = `${task.title} ${task.note}`.toLowerCase();
    return filterMatch && (!searchQuery || text.includes(searchQuery));
  });
}

function buildMeta(task) {
  const parts = [`作成 ${formatDate(task.createdAt)}`];
  if (task.due) parts.push(`期限 ${formatDate(task.due)}`);
  if (task.completedAt) parts.push(`達成 ${formatDate(task.completedAt)}`);
  return parts.join(" / ");
}

async function toggleTask(id) {
  const task = tasks.find((item) => item.id === id);
  if (!task) return;

  const willComplete = !task.completed;
  task.completed = willComplete;
  task.completedAt = willComplete ? new Date().toISOString() : "";
  saveTasks();
  render();

  if (willComplete) {
    await celebrate(task);
  }
}

function deleteTask(id) {
  tasks = tasks.filter((task) => task.id !== id);
  saveTasks();
  render();
}

async function celebrate(task) {
  elements.companion.classList.add("is-celebrating");
  showSpeech("台詞を準備中...", settings.llmEnabled ? "LLM生成中" : "準備中");

  const line = await buildPraise(task);
  showSpeech(line, settings.llmEnabled ? "LLM" : "テンプレート");
  speak(line);

  window.setTimeout(() => {
    elements.companion.classList.remove("is-celebrating");
  }, 1800);
}

async function buildPraise(task) {
  if (!settings.llmEnabled) {
    return localPraise(task);
  }

  try {
    const line = await requestOllamaPraise(task);
    updateLlmStatus("接続中");
    return line || localPraise(task);
  } catch (error) {
    console.warn(error);
    updateLlmStatus("未接続");
    return localPraise(task);
  }
}

async function requestOllamaPraise(task) {
  const endpoint = normalizeEndpoint(settings.llmEndpoint);
  ensureUsableEndpoint(endpoint);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12000);

  const response = await fetch(`${endpoint}/api/chat`, {
    method: "POST",
    headers: buildLlmHeaders(),
    signal: controller.signal,
    body: JSON.stringify({
      model: settings.llmModel,
      stream: false,
      options: {
        temperature: 0.85,
        num_predict: 90
      },
      messages: [
        {
          role: "system",
          content:
            "あなたは成人女性の応援キャラクター、ミラです。タスク達成者を日本語で明るく褒めます。返答は1文だけ。40から75文字。性的表現、恋愛表現、Markdown、絵文字、引用符は禁止。"
        },
        {
          role: "user",
          content: `完了したタスク: ${task.title}\nメモ: ${task.note || "なし"}\n優先度: ${priorityLabels[task.priority] || "通常"}`
        }
      ]
    })
  });

  window.clearTimeout(timeout);
  if (!response.ok) {
    throw new Error(`LLM request failed: ${response.status}`);
  }

  const data = await response.json();
  return cleanPraise(data?.message?.content || "");
}

async function testLlmConnection() {
  const endpoint = normalizeEndpoint(elements.llmEndpoint.value || defaultSettings.llmEndpoint);
  const model = elements.llmModel.value.trim() || defaultSettings.llmModel;
  const apiKey = elements.llmApiKey.value.trim();
  settings.llmEndpoint = endpoint;
  settings.llmModel = model;
  settings.llmApiKey = apiKey;
  saveSettings();

  updateLlmStatus("確認中");
  elements.testLlm.disabled = true;

  try {
    ensureUsableEndpoint(endpoint);
    const response = await fetch(`${endpoint}/api/tags`, {
      headers: buildLlmHeaders({ json: false })
    });
    if (!response.ok) throw new Error(`status ${response.status}`);
    const data = await response.json();
    const models = Array.isArray(data.models) ? data.models : [];
    const found = models.some((item) => item.name === model);
    updateLlmStatus(found ? "接続中" : "モデル未取得");
    if (!found) {
      showSpeech(`${model} が見つかりません。pull 後にもう一度確認してね。`, "LLM");
      speak("モデルが見つかりません。pull 後にもう一度確認してね。");
    } else {
      showSpeech("ローカルLLM、つながったよ。次の達成から台詞を作るね。", "LLM");
      speak("ローカルLLM、つながったよ。次の達成から台詞を作るね。");
    }
  } catch (error) {
    console.warn(error);
    updateLlmStatus("未接続");
    const message = buildLlmErrorMessage(error);
    showSpeech(message, "LLM");
    speak(message);
  } finally {
    elements.testLlm.disabled = false;
  }
}

function localPraise(task) {
  const base = choose(fallbackLines);
  const title = task.title.length > 24 ? `${task.title.slice(0, 24)}...` : task.title;
  if (task.priority === "high") {
    return `高めのタスク「${title}」を達成。難しいところまで進めたね、すごいよ。`;
  }
  if (task.due && isToday(task.due)) {
    return `今日が期限の「${title}」を終わらせたね。間に合わせたの本当に偉い。`;
  }
  return base;
}

function showSpeech(text, state) {
  lastSpeech = text;
  elements.speech.textContent = text;
  elements.mobilePraiseText.textContent = text;
  elements.mobilePraise.classList.add("is-visible");
  elements.voiceState.textContent = state;
}

async function speak(text) {
  if (!settings.voiceEnabled) return;

  if (settings.voiceEngine === "voicevox") {
    try {
      await speakWithVoicevox(text);
      return;
    } catch (error) {
      console.warn(error);
      elements.voiceState.textContent = "VOICEVOX失敗";
      if ("speechSynthesis" in window) {
        speakWithWebSpeech(text);
      }
      return;
    }
  }

  speakWithWebSpeech(text);
}

function speakWithWebSpeech(text) {
  if (!("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();
  stopVoicevoxAudio();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ja-JP";
  utterance.rate = settings.voiceRate;
  utterance.pitch = settings.voicePitch;

  const selected = voices.find((voice) => voice.name === settings.voiceName);
  const japanese = voices.find((voice) => voice.lang.toLowerCase().startsWith("ja"));
  utterance.voice = selected || japanese || null;

  utterance.onstart = () => {
    elements.voiceState.textContent = "再生中";
  };
  utterance.onend = () => {
    elements.voiceState.textContent = settings.llmEnabled ? "LLM" : "待機中";
  };
  utterance.onerror = () => {
    elements.voiceState.textContent = "音声なし";
  };

  window.speechSynthesis.speak(utterance);
}

async function speakWithVoicevox(text) {
  stopVoicevoxAudio();
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }

  const endpoint = normalizeEndpoint(settings.voicevoxEndpoint);
  ensureUsableEndpoint(endpoint, "VOICEVOX");
  const speaker = Number(settings.voicevoxSpeaker) || defaultSettings.voicevoxSpeaker;
  currentVoicevoxController = new AbortController();
  const signal = currentVoicevoxController.signal;

  elements.voiceState.textContent = "VOICEVOX生成中";
  const audioQueryUrl = `${endpoint}/audio_query?${new URLSearchParams({
    text,
    speaker: String(speaker)
  })}`;
  const queryResponse = await fetch(audioQueryUrl, {
    method: "POST",
    headers: buildVoicevoxHeaders({ json: false }),
    signal
  });
  if (!queryResponse.ok) {
    throw new Error(`VOICEVOX audio_query failed: ${queryResponse.status}`);
  }

  const query = await queryResponse.json();
  query.speedScale = Number(settings.voiceRate) || 1;
  query.pitchScale = (Number(settings.voicePitch) || 1) - 1;

  const synthesisUrl = `${endpoint}/synthesis?${new URLSearchParams({
    speaker: String(speaker)
  })}`;
  const synthesisResponse = await fetch(synthesisUrl, {
    method: "POST",
    headers: buildVoicevoxHeaders(),
    signal,
    body: JSON.stringify(query)
  });
  if (!synthesisResponse.ok) {
    throw new Error(`VOICEVOX synthesis failed: ${synthesisResponse.status}`);
  }

  const audioBlob = await synthesisResponse.blob();
  currentVoicevoxAudioUrl = URL.createObjectURL(audioBlob);
  currentVoicevoxAudio = new Audio(currentVoicevoxAudioUrl);
  currentVoicevoxAudio.onplay = () => {
    elements.voiceState.textContent = "VOICEVOX再生中";
  };
  currentVoicevoxAudio.onended = () => {
    elements.voiceState.textContent = settings.llmEnabled ? "LLM" : "待機中";
    stopVoicevoxAudio({ keepCurrent: true });
  };
  currentVoicevoxAudio.onerror = () => {
    elements.voiceState.textContent = "VOICEVOX音声なし";
    stopVoicevoxAudio({ keepCurrent: true });
  };
  await currentVoicevoxAudio.play();
}

function stopVoicevoxAudio({ keepCurrent = false } = {}) {
  if (currentVoicevoxController) {
    currentVoicevoxController.abort();
    currentVoicevoxController = null;
  }
  if (currentVoicevoxAudio && !keepCurrent) {
    currentVoicevoxAudio.pause();
    currentVoicevoxAudio.currentTime = 0;
  }
  if (currentVoicevoxAudioUrl) {
    URL.revokeObjectURL(currentVoicevoxAudioUrl);
  }
  currentVoicevoxAudioUrl = "";
  currentVoicevoxAudio = null;
}

function populateVoices() {
  if (!("speechSynthesis" in window)) {
    elements.voiceSelect.replaceChildren(new Option("未対応", ""));
    elements.voiceSelect.disabled = true;
    elements.voiceEnabled.checked = false;
    settings.voiceEnabled = false;
    saveSettings();
    return;
  }

  voices = window.speechSynthesis.getVoices();
  const preferred = voices
    .filter((voice) => voice.lang.toLowerCase().startsWith("ja"))
    .concat(voices.filter((voice) => !voice.lang.toLowerCase().startsWith("ja")));

  elements.voiceSelect.replaceChildren();
  if (preferred.length === 0) {
    elements.voiceSelect.append(new Option("自動", ""));
    return;
  }

  preferred.forEach((voice) => {
    const label = `${voice.name} (${voice.lang})`;
    elements.voiceSelect.append(new Option(label, voice.name));
  });

  if (settings.voiceName && preferred.some((voice) => voice.name === settings.voiceName)) {
    elements.voiceSelect.value = settings.voiceName;
  } else {
    const japanese = preferred.find((voice) => voice.lang.toLowerCase().startsWith("ja"));
    settings.voiceName = japanese?.name || preferred[0].name;
    elements.voiceSelect.value = settings.voiceName;
    saveSettings();
  }
}

async function loadVoicevoxSpeakers() {
  const endpoint = normalizeEndpoint(elements.voicevoxEndpoint.value || defaultSettings.voicevoxEndpoint);
  settings.voicevoxEndpoint = endpoint;
  settings.voicevoxApiKey = elements.voicevoxApiKey.value.trim();
  saveSettings();

  elements.loadVoicevox.disabled = true;
  elements.voiceState.textContent = "話者取得中";

  try {
    ensureUsableEndpoint(endpoint, "VOICEVOX");
    const response = await fetch(`${endpoint}/speakers`, {
      headers: buildVoicevoxHeaders({ json: false })
    });
    if (!response.ok) {
      throw new Error(`VOICEVOX speakers failed: ${response.status}`);
    }

    const speakers = await response.json();
    voicevoxSpeakers = flattenVoicevoxSpeakers(speakers);
    renderVoicevoxSpeakers();
    elements.voiceState.textContent = "VOICEVOX接続中";
    showSpeech("VOICEVOXの話者を取得できました。次の再生からこの声を使えるよ。", "VOICEVOX");
    speak("VOICEVOXの話者を取得できました。次の再生からこの声を使えるよ。");
  } catch (error) {
    console.warn(error);
    elements.voiceState.textContent = "VOICEVOX未接続";
    showSpeech(buildVoicevoxErrorMessage(error), "VOICEVOX");
    speakWithWebSpeech(buildVoicevoxErrorMessage(error));
  } finally {
    elements.loadVoicevox.disabled = false;
  }
}

function flattenVoicevoxSpeakers(speakers) {
  if (!Array.isArray(speakers)) return [];
  return speakers.flatMap((speaker) => {
    const styles = Array.isArray(speaker.styles) ? speaker.styles : [];
    return styles.map((style) => ({
      id: Number(style.id),
      label: `${speaker.name} / ${style.name}`
    }));
  }).filter((speaker) => Number.isFinite(speaker.id));
}

function renderVoicevoxSpeakers() {
  elements.voicevoxSpeaker.replaceChildren();
  const speakers = voicevoxSpeakers.length
    ? voicevoxSpeakers
    : [{ id: settings.voicevoxSpeaker || defaultSettings.voicevoxSpeaker, label: `話者 ID ${settings.voicevoxSpeaker || defaultSettings.voicevoxSpeaker}` }];

  speakers.forEach((speaker) => {
    elements.voicevoxSpeaker.append(new Option(speaker.label, String(speaker.id)));
  });

  const selected = String(settings.voicevoxSpeaker || defaultSettings.voicevoxSpeaker);
  if (speakers.some((speaker) => String(speaker.id) === selected)) {
    elements.voicevoxSpeaker.value = selected;
  } else {
    settings.voicevoxSpeaker = speakers[0].id;
    elements.voicevoxSpeaker.value = String(settings.voicevoxSpeaker);
    saveSettings();
  }
}

function applySettingsToControls() {
  elements.voiceEnabled.checked = settings.voiceEnabled;
  elements.voiceEngine.value = settings.voiceEngine;
  elements.voiceRate.value = settings.voiceRate;
  elements.voicePitch.value = settings.voicePitch;
  elements.voicevoxEndpoint.value = settings.voicevoxEndpoint;
  elements.voicevoxApiKey.value = settings.voicevoxApiKey;
  renderVoicevoxSpeakers();
  updateVoiceControls();
  elements.llmEnabled.checked = settings.llmEnabled;
  elements.llmEndpoint.value = settings.llmEndpoint;
  elements.llmModel.value = settings.llmModel;
  elements.llmApiKey.value = settings.llmApiKey;
  updateLlmStatus(settings.llmEnabled ? "未確認" : "テンプレート");
}

function updateLlmStatus(text) {
  elements.llmStatus.textContent = text;
}

function clearCompletedTasks() {
  const next = tasks.filter((task) => !task.completed);
  if (next.length === tasks.length) return;
  tasks = next;
  saveTasks();
  render();
}

function exportTasks() {
  const payload = JSON.stringify(tasks, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `task-muse-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function cleanPraise(text) {
  return text
    .replace(/["'`*_#>-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function normalizeEndpoint(value) {
  let endpoint = value.trim();
  if (!endpoint) {
    endpoint = defaultSettings.llmEndpoint;
  }
  if (endpoint && !/^https?:\/\//i.test(endpoint)) {
    endpoint = `https://${endpoint}`;
  }
  return endpoint.replace(/\/+$/, "");
}

function buildLlmHeaders({ json = true } = {}) {
  const headers = {};
  if (json) {
    headers["Content-Type"] = "application/json";
  }
  if (settings.llmApiKey) {
    headers["X-Task-Muse-Key"] = settings.llmApiKey;
  }
  return headers;
}

function buildVoicevoxHeaders({ json = true } = {}) {
  const headers = {};
  if (json) {
    headers["Content-Type"] = "application/json";
  }
  if (settings.voicevoxApiKey) {
    headers["X-Task-Muse-Key"] = settings.voicevoxApiKey;
  }
  return headers;
}

function ensureUsableEndpoint(endpoint, label = "LLM") {
  if (!endpoint) {
    throw new Error(`${label} endpoint is empty`);
  }

  const url = new URL(endpoint);
  const localHostnames = new Set(["localhost", "127.0.0.1", "[::1]"]);
  const isLocal = localHostnames.has(url.hostname);
  const deployedOverHttps = window.location.protocol === "https:";

  if (deployedOverHttps && url.protocol !== "https:" && !isLocal) {
    throw new Error(`${label}へ接続する場合はHTTPSが必要です`);
  }
}

function buildLlmErrorMessage(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("empty")) {
    return "LLMのURLを設定してから接続確認してね。テンプレートでも褒められるよ。";
  }
  if (message.includes("HTTPS")) {
    return "Cloudflare PagesからDDNSへ接続するにはHTTPSが必要です。URLを確認してね。";
  }
  return "LLMサーバーにはまだ接続できません。テンプレートでも褒められるよ。";
}

function buildVoicevoxErrorMessage(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("empty")) {
    return "VOICEVOXのURLを設定してから話者取得してね。";
  }
  if (message.includes("HTTPS")) {
    return "公開版からVOICEVOXへ接続するにはHTTPSが必要です。DDNSプロキシのURLを確認してね。";
  }
  return "VOICEVOXに接続できません。エンジン起動、URL、キーを確認してね。";
}

function updateVoiceControls() {
  const isVoicevox = settings.voiceEngine === "voicevox";
  elements.voiceSelect.disabled = isVoicevox;
  elements.voicevoxEndpoint.disabled = !isVoicevox;
  elements.voicevoxSpeaker.disabled = !isVoicevox;
  elements.voicevoxApiKey.disabled = !isVoicevox;
  elements.loadVoicevox.disabled = !isVoicevox;
}

function choose(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function formatDate(value) {
  if (!value) return "";
  const date = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short"
  }).format(date);
}

function isToday(value) {
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) && date.toDateString() === new Date().toDateString();
}

function loadTasks() {
  try {
    const parsed = JSON.parse(localStorage.getItem(TASKS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTasks() {
  localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
}

function loadSettings() {
  try {
    return {
      ...defaultSettings,
      ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")
    };
  } catch {
    return { ...defaultSettings };
  }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
