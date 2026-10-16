/*
 * Roomie Reminders
 * ----------------
 * This version saves data in the current browser with localStorage.
 * That means each roommate's browser has its own copy.
 *
 * To share one birthday list between everyone, connect a database such as
 * Supabase and replace the localStorage functions with database reads/writes.
 * Do not put a Supabase service_role key in a public GitHub Pages app.
 */

"use strict";

const STORAGE_KEY = "roomie-reminders-birthdays-v1";

const MONTHS = [
  { name: "January", emoji: "❄️", cue: "January = fresh starts, warm drinks, and new-year wishes." },
  { name: "February", emoji: "💌", cue: "February = hearts, kindness, and little love notes." },
  { name: "March", emoji: "🌷", cue: "March = spring buds, green things, and lucky charms." },
  { name: "April", emoji: "🌦️", cue: "April = rain showers, flowers, and bright umbrellas." },
  { name: "May", emoji: "🌼", cue: "May = flowers blooming and sunny-day celebrations." },
  { name: "June", emoji: "🍓", cue: "June = strawberries, sunshine, and the start of summer." },
  { name: "July", emoji: "🍉", cue: "July = watermelon, pool days, and fireworks." },
  { name: "August", emoji: "🌻", cue: "August = sunflowers, late sunsets, and summer fun." },
  { name: "September", emoji: "📚", cue: "September = fresh notebooks, new routines, and cozy plans." },
  { name: "October", emoji: "🎃", cue: "October = pumpkins, cozy sweaters, and birthday treats." },
  { name: "November", emoji: "🥧", cue: "November = pie, gratitude, and gathering together." },
  { name: "December", emoji: "✨", cue: "December = twinkle lights, warm cookies, and festive wishes." }
];

const $ = (selector) => document.querySelector(selector);

const els = {
  monthTitle: $("#monthTitle"),
  monthEmoji: $("#monthEmoji"),
  monthCue: $("#monthCue"),
  calendarGrid: $("#calendarGrid"),
  prevMonth: $("#prevMonth"),
  nextMonth: $("#nextMonth"),
  thisMonth: $("#thisMonth"),
  birthdayForm: $("#birthdayForm"),
  roommateName: $("#roommateName"),
  birthday: $("#birthday"),
  roommateColor: $("#roommateColor"),
  roommateSticker: $("#roommateSticker"),
  formMessage: $("#formMessage"),
  upcomingList: $("#upcomingList"),
  upcomingCount: $("#upcomingCount"),
  crewList: $("#crewList"),
  crewCount: $("#crewCount"),
  birthdayDialog: $("#birthdayDialog"),
  dialogSticker: $("#dialogSticker"),
  dialogTitle: $("#dialogTitle"),
  dialogDate: $("#dialogDate"),
  dialogAge: $("#dialogAge"),
  storageNote: $("#storageNote")
};

let visibleMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let selectedDateKey = null;
let birthdays = loadBirthdays();

function loadBirthdays() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((person) => person && person.id && person.name && isValidDateKey(person.birthday))
      : [];
  } catch (error) {
    console.warn("Could not read saved birthdays:", error);
    return [];
  }
}

function saveBirthdays() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(birthdays));
    els.storageNote.textContent = "Saved in this browser";
  } catch (error) {
    console.error("Could not save birthdays:", error);
    els.storageNote.textContent = "Could not save — check browser storage";
  }
}

function makeId() {
  return (window.crypto && typeof window.crypto.randomUUID === "function")
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseDateKey(dateKey) {
  const parts = dateKey.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isInteger(n))) return null;
  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

function isValidDateKey(dateKey) {
  return typeof dateKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateKey) && Boolean(parseDateKey(dateKey));
}

function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function birthdayDateForYear(person, year) {
  const birth = parseDateKey(person.birthday);
  if (!birth) return null;
  // Use Feb 28 for leap-day birthdays in non-leap years.
  const month = birth.getMonth();
  const day = month === 1 && birth.getDate() === 29 && !isLeapYear(year) ? 28 : birth.getDate();
  return new Date(year, month, day);
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function nextBirthday(person, fromDate = new Date()) {
  const today = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  let next = birthdayDateForYear(person, today.getFullYear());
  if (!next) return null;
  if (next < today) next = birthdayDateForYear(person, today.getFullYear() + 1);
  return next;
}

function daysBetween(a, b) {
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / 86400000);
}

function formatDate(date, options = { month: "long", day: "numeric" }) {
  return new Intl.DateTimeFormat(undefined, options).format(date);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function peopleOnDate(date) {
  return birthdays.filter((person) => {
    const birth = parseDateKey(person.birthday);
    return birth && birth.getMonth() === date.getMonth() && birth.getDate() === date.getDate();
  });
}

function renderMonthHeader() {
  const month = MONTHS[visibleMonth.getMonth()];
  els.monthTitle.innerHTML = `${month.name} <span>${visibleMonth.getFullYear()}</span>`;
  els.monthEmoji.textContent = month.emoji;
  els.monthCue.textContent = month.cue;
}

function renderCalendar() {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - firstDay.getDay());
  const todayKey = dateKey(new Date());
  const cells = [];

  for (let i = 0; i < 42; i++) {
    const day = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    const key = dateKey(day);
    const people = peopleOnDate(day);
    const classes = ["calendar-day"];
    if (day.getMonth() !== month) classes.push("outside");
    if (key === todayKey) classes.push("today");
    if (key === selectedDateKey) classes.push("selected");

    const stickers = people.slice(0, 3).map((person) =>
      `<span class="day-sticker" title="${escapeHtml(person.name)}">${escapeHtml(person.sticker || "🎂")}</span>`
    ).join("");
    const more = people.length > 3 ? `<span class="day-more">+${people.length - 3}</span>` : "";
    const birthdayNames = people.length ? ` Birthday: ${people.map((p) => p.name).join(", ")}.` : "";
    cells.push(`
      <button class="${classes.join(" ")}" type="button" data-date="${key}"
        aria-label="${escapeHtml(formatDate(day, { weekday: "long", month: "long", day: "numeric", year: "numeric" }) + birthdayNames)}">
        <span class="day-number">${day.getDate()}</span>
        <span class="day-birthday-icons">${stickers}${more}</span>
      </button>
    `);
  }

  els.calendarGrid.innerHTML = cells.join("");
  els.calendarGrid.querySelectorAll("[data-date]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedDateKey = button.dataset.date;
      const selected = parseDateKey(selectedDateKey);
      const people = peopleOnDate(selected);
      renderCalendar();
      if (people.length) openBirthdayDialog(people, selected);
      else {
        els.formMessage.textContent = `No birthdays on ${formatDate(selected)} yet. Add one using the form.`;
      }
    });
  });
}

function renderUpcoming() {
  const today = new Date();
  const sorted = birthdays.map((person) => {
    const next = nextBirthday(person, today);
    return next ? { person, next, days: daysBetween(new Date(today.getFullYear(), today.getMonth(), today.getDate()), next) } : null;
  }).filter(Boolean).sort((a, b) => a.days - b.days).slice(0, 4);

  els.upcomingCount.textContent = String(birthdays.length);
  if (!sorted.length) {
    els.upcomingList.innerHTML = `<div class="empty-state"><span>🎈</span>No birthdays yet. Add your first roommate above!</div>`;
    return;
  }

  els.upcomingList.innerHTML = sorted.map(({ person, next, days }) => `
    <div class="upcoming-item">
      <div class="person-sticker" style="background:${safeColor(person.color)}22">${escapeHtml(person.sticker || "🎂")}</div>
      <div class="person-info">
        <div class="person-name">${escapeHtml(person.name)}</div>
        <div class="person-date">${escapeHtml(formatDate(next, { month: "short", day: "numeric" }))}</div>
      </div>
      <span class="days-away">${days === 0 ? "Today!" : days === 1 ? "Tomorrow" : `In ${days} days`}</span>
    </div>
  `).join("");
}

function renderCrew() {
  const sorted = [...birthdays].sort((a, b) => {
    const da = nextBirthday(a);
    const db = nextBirthday(b);
    return da - db;
  });
  els.crewCount.textContent = `${birthdays.length} ${birthdays.length === 1 ? "roommate" : "roommates"}`;

  if (!sorted.length) {
    els.crewList.innerHTML = `<div class="empty-state crew-empty"><span>🏡</span>Your crew will show up here after you add a birthday.</div>`;
    return;
  }

  els.crewList.innerHTML = sorted.map((person) => {
    const birth = parseDateKey(person.birthday);
    return `
      <article class="crew-card" style="--person-color:${safeColor(person.color)}">
        <div class="person-sticker" style="background:${safeColor(person.color)}22">${escapeHtml(person.sticker || "🎂")}</div>
        <div class="person-info">
          <div class="person-name">${escapeHtml(person.name)}</div>
          <div class="crew-birthday">${escapeHtml(formatDate(birth, { month: "long", day: "numeric" }))}</div>
        </div>
        <button class="delete-button" type="button" data-delete="${escapeHtml(person.id)}" aria-label="Remove ${escapeHtml(person.name)}" title="Remove birthday">×</button>
      </article>
    `;
  }).join("");

  els.crewList.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      const person = birthdays.find((item) => item.id === button.dataset.delete);
      if (!person) return;
      if (!window.confirm(`Remove ${person.name}'s birthday?`)) return;
      birthdays = birthdays.filter((item) => item.id !== person.id);
      saveBirthdays();
      renderAll();
      els.formMessage.textContent = `${person.name}'s birthday was removed.`;
    });
  });
}

function safeColor(color) {
  const allowed = /^#[0-9a-f]{6}$/i;
  return allowed.test(color || "") ? color : "#79a88a";
}

function openBirthdayDialog(people, date) {
  if (!people.length) return;
  const person = people[0];
  els.dialogSticker.textContent = person.sticker || "🎂";
  els.dialogTitle.textContent = people.length === 1
    ? `${person.name}'s birthday`
    : `${people.length} birthdays!`;
  els.dialogDate.textContent = formatDate(date, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const names = people.map((p) => p.name).join(", ");
  els.dialogAge.textContent = people.length > 1 ? `Celebrate ${names}!` : "A perfect excuse for cake, cards, and a little extra love.";
  if (typeof els.birthdayDialog.showModal === "function") els.birthdayDialog.showModal();
}

function renderAll() {
  renderMonthHeader();
  renderCalendar();
  renderUpcoming();
  renderCrew();
}

els.birthdayForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = els.roommateName.value.trim();
  const birthday = els.birthday.value;
  if (!name) {
    els.formMessage.textContent = "Please enter a name.";
    els.roommateName.focus();
    return;
  }
  if (!isValidDateKey(birthday)) {
    els.formMessage.textContent = "Please choose a valid birthday.";
    els.birthday.focus();
    return;
  }

  birthdays.push({
    id: makeId(),
    name,
    birthday,
    color: safeColor(els.roommateColor.value),
    sticker: els.roommateSticker.value
  });
  saveBirthdays();
  const date = parseDateKey(birthday);
  visibleMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  selectedDateKey = birthday;
  els.birthdayForm.reset();
  els.formMessage.textContent = `${name}'s birthday was added!`;
  renderAll();
});

els.prevMonth.addEventListener("click", () => {
  visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
  selectedDateKey = null;
  renderAll();
});
els.nextMonth.addEventListener("click", () => {
  visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
  selectedDateKey = null;
  renderAll();
});
els.thisMonth.addEventListener("click", () => {
  const now = new Date();
  visibleMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  selectedDateKey = null;
  renderAll();
});

// Initialize the date field to today for convenience, without forcing the user to keep it.
els.birthday.value = dateKey(new Date());
renderAll();
