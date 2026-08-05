function toggleMenu() {
  document.getElementById("mobileMenu").classList.toggle("show");
}

function ccEscapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// Printable invitation / notice letter — student data, the scheduled
// date/time, and a signature line, same "open a new tab, print / save
// as PDF" pattern as the Reports page's openPrintableReport(). Doubles
// as the missed-session notice (set missed: true) so a parent has a
// paper record that a session was missed and when the new one is.
function openInvitationLetter(opts) {
  const { studentName, section = "", counselorName = "", date, time, concern = "", missed = false } = opts;

  const win = window.open("", "_blank");
  if (!win) {
    showToast("Please allow pop-ups to generate this letter.", "error");
    return;
  }

  const heading = missed ? "Missed Session — New Schedule Notice" : "Guidance Counseling Invitation";
  const intro = missed
    ? `This is to inform the parent/guardian of <strong>${ccEscapeHtml(studentName)}</strong> that the student did not attend their scheduled guidance counseling session. A new session has been set as follows:`
    : `<strong>${ccEscapeHtml(studentName)}</strong> is invited to attend a guidance counseling session as follows:`;

  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${ccEscapeHtml(heading)}</title>
      <style>
        body { font-family: Arial, sans-serif; color:#111827; padding:40px; max-width:680px; margin:0 auto; }
        h1 { font-size:19px; margin:0 0 4px; text-align:center; }
        .office { text-align:center; color:#6b7280; font-size:12px; margin-bottom:28px; }
        .intro { font-size:14px; line-height:1.6; margin-bottom:18px; }
        table.details { width:100%; border-collapse:collapse; margin-bottom:22px; }
        table.details td { padding:7px 0; font-size:13.5px; border-bottom:1px solid #e5e7eb; }
        table.details td:first-child { color:#6b7280; width:150px; }
        .missed-note { background:#fef2f2; border:1px solid #fecaca; color:#991b1b; padding:10px 14px; border-radius:8px; font-size:13px; margin-bottom:20px; }
        .sign-row { display:flex; justify-content:space-between; margin-top:64px; gap:40px; }
        .sign-block { flex:1; text-align:center; }
        .sign-line { border-top:1px solid #111827; margin-bottom:6px; padding-top:6px; font-size:12px; color:#374151; }
        .print-btn { margin-bottom:24px; padding:8px 16px; border-radius:8px; border:none; background:#2563eb; color:#fff; font-weight:600; cursor:pointer; }
        @media print { .print-btn { display:none; } }
      </style>
    </head>
    <body>
      <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
      <h1>${ccEscapeHtml(heading)}</h1>
      <div class="office">Guidance Office</div>
      <p class="intro">${intro}</p>
      <table class="details">
        <tr><td>Student</td><td>${ccEscapeHtml(studentName)}</td></tr>
        <tr><td>Section</td><td>${ccEscapeHtml(section || "—")}</td></tr>
        <tr><td>Date</td><td>${ccEscapeHtml(date)}</td></tr>
        <tr><td>Time</td><td>${ccEscapeHtml(time)}</td></tr>
        ${concern ? `<tr><td>Concern</td><td>${ccEscapeHtml(concern)}</td></tr>` : ""}
        <tr><td>Counselor</td><td>${ccEscapeHtml(counselorName || "—")}</td></tr>
      </table>
      ${missed ? `<div class="missed-note">Please make sure the student attends the new schedule above.</div>` : ""}
      <div class="sign-row">
        <div class="sign-block"><div class="sign-line">Counselor's Signature over Printed Name</div></div>
        <div class="sign-block"><div class="sign-line">Parent/Guardian Signature over Printed Name</div></div>
      </div>
    </body>
    </html>
  `);
  win.document.close();
}

// Philippine school years run roughly June-March/April — before June,
// students are still in the school year that started the previous
// calendar year.
function defaultSchoolYear() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  return m >= 6 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

(function injectPageLoadOverlay() {
  const target = document.querySelector("main.content") || document.body;
  const overlay = document.createElement("div");
  overlay.id = "pageLoadOverlay";
  overlay.className = "page-load-overlay";
  overlay.innerHTML = `<div class="page-load-spinner"></div>`;
  target.prepend(overlay);

  // The greeting header (title + welcome text) is static/near-instant —
  // don't make the visitor wait behind a spinner for it. Only cover the
  // area below it, where the actual data-dependent content loads.
  //
  // Positioned relative to the *viewport* (not the content box) and
  // recalculated on resize, so the spinner always centers in whatever's
  // actually visible on screen — otherwise, on a tall page, centering
  // within the full remaining content height can push it far below the
  // fold where nobody sees it.
  const header = target.querySelector(":scope > header.GreetingsCard");

  function positionOverlay() {
    const contentRect = target.getBoundingClientRect();
    overlay.style.position = "fixed";
    overlay.style.left = `${contentRect.left}px`;
    overlay.style.width = `${contentRect.width}px`;
    overlay.style.right = "auto";
    overlay.style.bottom = "0";
    overlay.style.top = `${(header ? header.getBoundingClientRect().bottom : contentRect.top)}px`;
  }

  positionOverlay();
  window.addEventListener("resize", positionOverlay);

  // The header's height isn't fixed at load time — e.g. welcomeMsg often
  // starts with a short cached name, then gets replaced with the real one
  // once auth resolves, which can make the text wrap to a second line and
  // grow the header. Without tracking that, the overlay's top (measured
  // once above) would stay put and start creeping over the now-taller
  // header. Re-measure whenever the header's actual size changes.
  if (header && "ResizeObserver" in window) {
    new ResizeObserver(positionOverlay).observe(header);
  }

  // The overlay only covers the viewport, not the full scrollable page —
  // on a page taller than the screen (the common case on mobile), a user
  // could scroll while data was still loading and see unstyled/incomplete
  // content slide out from under it. Block scrolling entirely for as long
  // as the overlay is up; hidePageLoadOverlay() restores it.
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
})();

// ============================================================
// Notifications bell — injected into the sidebar profile header
// so every page gets it without needing its own markup. Data is
// wired up by initNotifications(), called from requireCounselorAuth()
// once we know who's logged in.
// ============================================================

(function injectNotificationBell() {
  // GreetingsCard is the header at the top of main.content — unlike the
  // sidebar's .profile block (which the mobile layout hides entirely and
  // replaces with a bottom tab bar), this element is always visible, so
  // the bell stays reachable on every screen size. Not every page has one
  // (some go straight into their content, e.g. section lists — including
  // counselor-appointments.html, the page a counselor lands on from an
  // appointment notification), so fall back to main.content itself — it's
  // already position:relative in the CSS.
  const header = document.querySelector("main.content > header.GreetingsCard") || document.querySelector("main.content");
  if (!header) return;

  const wrap = document.createElement("div");
  wrap.className = "notif-wrap";
  wrap.id = "notifWrap";

  const bell = document.createElement("button");
  bell.type = "button";
  bell.className = "notif-bell";
  bell.id = "notifBell";
  bell.setAttribute("aria-label", "Notifications");
  bell.innerHTML = `<i class="fa-solid fa-bell"></i><span class="notif-badge" id="notifBadge" hidden>0</span>`;

  const dropdown = document.createElement("div");
  dropdown.className = "notif-dropdown";
  dropdown.id = "notifDropdown";
  dropdown.hidden = true;
  dropdown.innerHTML = `
    <div class="notif-dropdown-header">
      <div>
        <h4>Notifications</h4>
        <span class="notif-unread-count" id="notifUnreadCount"></span>
      </div>
      <button type="button" class="notif-mark-all" id="notifMarkAllBtn" hidden>
        <i class="fa-solid fa-check-double"></i> Mark all read
      </button>
    </div>
    <div class="notif-filter-tabs" id="notifFilterTabs">
      <button type="button" class="active" data-filter="all">All</button>
      <button type="button" data-filter="unread">Unread</button>
      <button type="button" data-filter="read">Read</button>
    </div>
    <div class="notif-list" id="notifList"><div class="notif-empty">Loading…</div></div>
  `;

  wrap.appendChild(bell);
  wrap.appendChild(dropdown);
  header.appendChild(wrap);

  bell.addEventListener("click", (e) => {
    e.stopPropagation();
    const wasHidden = dropdown.hidden;
    dropdown.hidden = !wasHidden;
    if (wasHidden && notifCurrentUserId) refreshNotifications(notifCurrentUserId);
  });

  document.addEventListener("click", (e) => {
    if (!dropdown.hidden && !dropdown.contains(e.target) && !bell.contains(e.target)) {
      dropdown.hidden = true;
    }
  });

  dropdown.querySelector("#notifMarkAllBtn").addEventListener("click", async (e) => {
    e.stopPropagation();
    if (notifCurrentUserId) await markAllNotificationsRead(notifCurrentUserId);
  });

  dropdown.querySelector("#notifFilterTabs").addEventListener("click", (e) => {
    e.stopPropagation();
    const btn = e.target.closest("button[data-filter]");
    if (!btn || btn.classList.contains("active")) return;
    dropdown.querySelectorAll("#notifFilterTabs button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    notifActiveFilter = btn.dataset.filter;
    renderNotifications(notifCache);
  });
})();

let notifCurrentUserId = null;
let notifCache = [];
let notifActiveFilter = "all";

function notifEscapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function notifTimeAgo(dateStr) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const NOTIF_TYPE_ICONS = {
  appointment: "fa-calendar-check",
  announcement: "fa-bullhorn",
  form: "fa-file-lines",
  intervention: "fa-hand-holding-medical",
};

function updateNotifBadge(list) {
  const badge = document.getElementById("notifBadge");
  if (!badge) return;
  const unreadCount = list.filter((n) => !n.is_read).length;
  badge.textContent = unreadCount > 9 ? "9+" : String(unreadCount);
  badge.hidden = unreadCount === 0;
}

function updateNotifHeader(list) {
  const countEl = document.getElementById("notifUnreadCount");
  const markAllBtn = document.getElementById("notifMarkAllBtn");
  const unreadCount = list.filter((n) => !n.is_read).length;
  if (countEl) countEl.textContent = unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up";
  if (markAllBtn) markAllBtn.hidden = unreadCount === 0;
}

function renderNotifications(list) {
  const listEl = document.getElementById("notifList");
  if (!listEl) return;

  const filtered =
    notifActiveFilter === "all" ? list : list.filter((n) => (notifActiveFilter === "unread" ? !n.is_read : n.is_read));

  listEl.innerHTML = filtered.length
    ? filtered
        .map((n) => {
          const icon = NOTIF_TYPE_ICONS[n.type] || "fa-bell";
          return `
      <button type="button" class="notif-item ${n.is_read ? "read" : "unread"}" data-id="${n.notification_id}" data-link="${notifEscapeHtml(n.link || "")}">
        <span class="notif-item-icon type-${notifEscapeHtml(n.type || "")}"><i class="fa-solid ${icon}"></i></span>
        <span class="notif-item-body">
          <span class="notif-item-top">
            <span class="notif-item-title">${notifEscapeHtml(n.title)}</span>
            ${n.is_read ? "" : `<span class="notif-item-dot"></span>`}
          </span>
          ${n.message ? `<span class="notif-item-message">${notifEscapeHtml(n.message)}</span>` : ""}
          <span class="notif-item-time">${notifTimeAgo(n.created_at)}</span>
        </span>
      </button>
    `;
        })
        .join("")
    : `<div class="notif-empty"><i class="fa-regular fa-bell-slash"></i><p>${
        notifActiveFilter === "all" ? "No notifications yet." : `No ${notifActiveFilter} notifications.`
      }</p></div>`;

  listEl.querySelectorAll(".notif-item").forEach((item) => {
    item.addEventListener("click", async () => {
      await markNotificationRead(Number(item.dataset.id));
      if (item.dataset.link) window.location.href = item.dataset.link;
    });
  });

  updateNotifBadge(list);
  updateNotifHeader(list);
}

async function refreshNotifications(userId) {
  const { data, error } = await supabaseClient
    .from("notifications")
    .select("notification_id, type, title, message, link, is_read, created_at")
    .eq("recipient_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    console.error(error);
    return;
  }

  notifCache = data || [];
  renderNotifications(notifCache);
}

async function markNotificationRead(id) {
  const notif = notifCache.find((n) => n.notification_id === id);
  if (!notif || notif.is_read) return;

  notif.is_read = true;
  renderNotifications(notifCache);

  const { error } = await supabaseClient.from("notifications").update({ is_read: true }).eq("notification_id", id);
  if (error) console.error(error);
}

async function markAllNotificationsRead(userId) {
  if (!notifCache.some((n) => !n.is_read)) return;

  notifCache.forEach((n) => (n.is_read = true));
  renderNotifications(notifCache);

  const { error } = await supabaseClient
    .from("notifications")
    .update({ is_read: true })
    .eq("recipient_user_id", userId)
    .eq("is_read", false);
  if (error) console.error(error);
}

function initNotifications(userId) {
  notifCurrentUserId = userId;
  refreshNotifications(userId);

  supabaseClient
    .channel(`notifications-${userId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_user_id=eq.${userId}` },
      (payload) => {
        notifCache = [payload.new, ...notifCache];
        renderNotifications(notifCache);
        // The bell updates live, but whatever list triggered this
        // notification (appointments, cases, etc.) was only ever fetched
        // once on page load — without this, a counselor staring at their
        // appointments page wouldn't see a new request until they
        // manually refreshed. Pages listen for this to refetch themselves.
        window.dispatchEvent(new CustomEvent("app:notification", { detail: payload.new }));
      }
    )
    .subscribe();
}

// ============================================================
// Toast + confirm modal — shared replacements for alert()/confirm()
// so every page gets consistent, non-blocking feedback instead of
// native browser dialogs.
// ============================================================

(function injectToastStack() {
  const stack = document.createElement("div");
  stack.id = "toastStack";
  stack.className = "toast-stack";
  document.body.appendChild(stack);
})();

function toastEscapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function dismissToast(toast) {
  toast.classList.remove("show");
  setTimeout(() => toast.remove(), 200);
}

function showToast(message, type = "info") {
  const stack = document.getElementById("toastStack");
  if (!stack) return;

  const icons = { success: "fa-circle-check", error: "fa-circle-exclamation", info: "fa-circle-info" };
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span>${toastEscapeHtml(message)}</span>`;
  stack.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));

  let dismissTimer = setTimeout(() => dismissToast(toast), 4000);
  toast.addEventListener("mouseenter", () => clearTimeout(dismissTimer));
  toast.addEventListener("mouseleave", () => {
    dismissTimer = setTimeout(() => dismissToast(toast), 1500);
  });
  toast.addEventListener("click", () => dismissToast(toast));
}

let confirmModalResolve = null;

function closeConfirmModal(result) {
  document.getElementById("confirmModalOverlay").classList.remove("show");
  if (confirmModalResolve) {
    confirmModalResolve(result);
    confirmModalResolve = null;
  }
}

// Returns a Promise<boolean> — await it in place of the old `if (!confirm(...))`.
function confirmDialog(message, opts = {}) {
  const { confirmLabel = "Confirm", danger = false } = opts;
  document.getElementById("confirmModalMessage").textContent = message;

  const okBtn = document.getElementById("confirmModalOkBtn");
  okBtn.textContent = confirmLabel;
  okBtn.className = `btn ${danger ? "btn-danger" : "btn-primary"}`;

  document.getElementById("confirmModalOverlay").classList.add("show");

  return new Promise((resolve) => {
    confirmModalResolve = resolve;
  });
}

(function injectConfirmModal() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "confirmModalOverlay";
  overlay.innerHTML = `
    <div class="modal-box confirm-modal-box">
      <div class="modal-body">
        <p id="confirmModalMessage" class="modal-content-text"></p>
        <div class="form-actions" style="justify-content:flex-end; gap:10px; margin-top:18px;">
          <button type="button" class="btn btn-outline" id="confirmModalCancelBtn">Cancel</button>
          <button type="button" class="btn btn-primary" id="confirmModalOkBtn">Confirm</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector("#confirmModalCancelBtn").addEventListener("click", () => closeConfirmModal(false));
  overlay.querySelector("#confirmModalOkBtn").addEventListener("click", () => closeConfirmModal(true));
  overlay.addEventListener("click", (e) => {
    if (e.target.id === "confirmModalOverlay") closeConfirmModal(false);
  });
})();

function hidePageLoadOverlay() {
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";

  const overlay = document.getElementById("pageLoadOverlay");
  if (!overlay) return;
  overlay.classList.add("hide");
  setTimeout(() => overlay.remove(), 250);
}

function highlightActiveNav() {
  const currentPage = window.location.pathname.split("/").pop();
  document.querySelectorAll(".sidebar nav a, .mobile-menu a").forEach((link) => {
    link.classList.toggle("active", link.getAttribute("href") === currentPage);
  });
}

highlightActiveNav();

const INACTIVITY_LIMIT_MS = 15 * 60 * 1000; // 15 minutes

async function logoutCounselor(reason) {
  sessionStorage.removeItem("counselorName");
  sessionStorage.removeItem("lastActivity");
  await supabaseClient.auth.signOut();
  window.location.href = reason ? `../index.html?reason=${reason}` : "../index.html";
}

function recordActivity() {
  sessionStorage.setItem("lastActivity", Date.now().toString());
}

function checkInactivity() {
  const last = Number(sessionStorage.getItem("lastActivity"));
  if (last && Date.now() - last > INACTIVITY_LIMIT_MS) {
    logoutCounselor("timeout");
  }
}

["click", "mousemove", "keydown", "scroll", "touchstart"].forEach((evt) => {
  window.addEventListener(evt, recordActivity, { passive: true });
});

recordActivity();
setInterval(checkInactivity, 30 * 1000);

async function requireCounselorAuth() {
  const cachedName = sessionStorage.getItem("counselorName");
  if (cachedName) {
    const nameEl = document.getElementById("sidebarName");
    if (nameEl) nameEl.textContent = cachedName;
  }

  const { data: { session } } = await supabaseClient.auth.getSession();

  // Not logged in? send back to login page
  if (!session) {
    window.location.href = "../index.html?reason=required";
    return null;
  }

  // Confirm this account is actually a counselor (not a student
  // landing here by direct URL). Fetched alongside the counselor row
  // instead of after it — both only depend on session.user.id, so
  // there's no need to wait on one before starting the other.
  const [{ data: userRow }, { data: counselor }] = await Promise.all([
    supabaseClient.from("users").select("role").eq("user_id", session.user.id).single(),
    supabaseClient.from("counselors").select("counselor_id, first_name, last_name").eq("user_id", session.user.id).single(),
  ]);

  const role = userRow?.role?.toLowerCase();

  switch (role) {
    case "counselor":
      break;
    case "student":
      window.location.href = "../student/student-dashboard.html";
      return null;
    default:
      window.location.href = "../index.html";
      return null;
  }

  const fullName = `${counselor.first_name} ${counselor.last_name}`;
  const nameEl = document.getElementById("sidebarName");
  if (nameEl) nameEl.textContent = fullName;
  sessionStorage.setItem("counselorName", fullName);

  initNotifications(session.user.id);

  return { session, counselor };
}

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await logoutCounselor();
});

document.getElementById("mobileLogoutBtn").addEventListener("click", async (e) => {
  e.preventDefault();
  await logoutCounselor();
});
