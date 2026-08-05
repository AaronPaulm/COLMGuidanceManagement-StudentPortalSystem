function toggleMenu() {
  document.getElementById("mobileMenu").classList.toggle("show");
}

// Philippine school years run roughly June-March/April — before June,
// a record still belongs to the school year that started the previous
// calendar year. Mirrors the counselor-side helper in
// js/counselor-common.js so both portals agree on the same convention.
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
// wired up by initNotifications(), called from requireStudentAuth()
// once we know who's logged in.
// ============================================================

(function injectNotificationBell() {
  // GreetingsCard is the header at the top of main.content — unlike the
  // sidebar's .profile block (which the mobile layout hides entirely and
  // replaces with a bottom tab bar), this element is always visible, so
  // the bell stays reachable on every screen size. Not every page has one
  // (some go straight into their content, e.g. section lists), so fall
  // back to main.content itself — it's already position:relative in the CSS.
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
        // notification (appointments, forms, etc.) was only ever fetched
        // once on page load — without this, a student staring at their
        // appointments page wouldn't see a status change until they
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

async function logoutStudent(reason) {
  sessionStorage.removeItem("studentName");
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
    logoutStudent("timeout");
  }
}

["click", "mousemove", "keydown", "scroll", "touchstart"].forEach((evt) => {
  window.addEventListener(evt, recordActivity, { passive: true });
});

recordActivity();
setInterval(checkInactivity, 30 * 1000);

async function requireStudentAuth() {
  const cachedName = sessionStorage.getItem("studentName");
  if (cachedName) {
    document.getElementById("sidebarName").textContent = cachedName;
  }

  const { data: { session } } = await supabaseClient.auth.getSession();

  // Not logged in? send back to login page
  if (!session) {
    window.location.href = "../index.html?reason=required";
    return null;
  }

  // Confirm this account is actually a student (not a counselor
  // landing here by direct URL). Fetched alongside the student row
  // instead of after it — both only depend on session.user.id, so
  // there's no need to wait on one before starting the other.
  const [{ data: userRow }, { data: student }] = await Promise.all([
    supabaseClient.from("users").select("role").eq("user_id", session.user.id).single(),
    supabaseClient
      .from("students")
      .select("student_id, first_name, last_name, is_archived")
      .eq("user_id", session.user.id)
      .single(),
  ]);

  const role = userRow?.role?.toLowerCase();

  switch (role) {
    case "student":
      break;
    case "counselor":
      window.location.href = "../counselor/counselor-dashboard.html";
      return null;
    default:
      window.location.href = "../index.html";
      return null;
  }

  // Defense in depth: the auth account should already be banned server-side
  // when a counselor archives a student (disable-student-account Edge
  // Function), but that only blocks *new* sign-ins — a session opened
  // before the ban, or a ban that silently failed to apply (e.g. the
  // function isn't deployed yet), would otherwise still let them straight
  // into the portal. This check closes that gap regardless of the ban's
  // own state.
  if (student.is_archived) {
    await supabaseClient.auth.signOut();
    window.location.href = "../index.html?reason=archived";
    return null;
  }

  const fullName = `${student.first_name} ${student.last_name}`;
  document.getElementById("sidebarName").textContent = fullName;
  sessionStorage.setItem("studentName", fullName);

  initNotifications(session.user.id);

  return { session, student };
}

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await logoutStudent();
});

document.getElementById("mobileLogoutBtn").addEventListener("click", async (e) => {
  e.preventDefault();
  await logoutStudent();
});
