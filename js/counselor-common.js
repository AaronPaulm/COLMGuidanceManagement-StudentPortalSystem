// Auth splash helpers — see style.css .auth-splash. Shown immediately
// (before first paint, since this script blocks parsing) so a portal
// page never flashes on screen while the session is being checked,
// like when a logged-out user presses Back into a cached page.
let ccAuthSplashEl = null;
function ccShowAuthSplash() {
  if (ccAuthSplashEl) return;
  const el = document.createElement("div");
  el.className = "auth-splash";
  el.innerHTML = '<div class="auth-splash-spinner"></div>';
  el.setAttribute("aria-hidden", "true");
  (document.body || document.documentElement).appendChild(el);
  ccAuthSplashEl = el;
}
function ccHideAuthSplash() {
  if (ccAuthSplashEl) {
    ccAuthSplashEl.remove();
    ccAuthSplashEl = null;
  }
}
ccShowAuthSplash();

function toggleMenu() {
  document.getElementById("mobileMenu").classList.toggle("show");
}

function ccEscapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function ccFormatPhone(value) {
  const raw = String(value ?? "").trim();
  let d = raw.replace(/\D/g, "");
  if (raw.startsWith("+63") || /^63[\s-]?9/.test(raw)) d = d.slice(2);
  else if (d.startsWith("09")) d = d.slice(1);
  d = d.slice(0, 10);
  if (!d) return "";
  let out = "+63";
  if (d.length > 0) out += " " + d.slice(0, 3);
  if (d.length > 3) out += " " + d.slice(3, 6);
  if (d.length > 6) out += " " + d.slice(6);
  return out;
}

// Official school letterhead bands for the print pop-ups.
//  - On screen: absolutely-pinned to the top/bottom of the 8.5x11 paper
//    sheet preview.
//  - In print: position:fixed so each printed page gets the header band at
//    the top and the footer band at the bottom. The fixed bands overlay the
//    in-flow spacer rows from schoolPrintLetterhead(), so long content
//    never runs underneath them (that was the bug where multi-page text got
//    hidden on later pages). Drop the actual images at images/school-header.png
//    and images/school-footer.png; until they exist, the onerror hides the
//    band so reports still print clean.
function schoolPrintHeaderFooterHtml() {
  return `
    <div class="print-school-header"><img src="../images/school-header.png" alt="" style="height:135px!important;object-fit:cover;object-position:top;" onerror="this.parentElement.style.display='none'"></div>
    <div class="print-school-footer"><img src="../images/school-footer.png" alt="" onerror="this.parentElement.style.display='none'"></div>`;
}

// In-flow spacer rows for the print sheet. In Chromium (Edge/Chrome) an
// empty <thead>/<tfoot> repeats on every fragmented page and — being
// in-flow — reserves vertical space, which keeps the report text clear of
// the fixed header/footer bands below. The visible bands are the
// .print-school-header/.print-school-footer divs (position:fixed in print,
// so they appear on EVERY page INCLUDING a short last page, which repeating
// <tfoot> alone does not). Each report template wraps its content in a
// <table class="print-letterhead"> containing these spacer rows and a
// <tbody> with the report body. On screen the table is display:contents
// (see each template's CSS) so the preview layout stays exactly as before.
function schoolPrintLetterhead() {
  return `
    <thead><tr><td></td></tr></thead>
    <tfoot><tr><td></td></tr></tfoot>`;
}

// Printable Parent/Guardian's Visitation Slip — prefills whatever the
// school already has on record (student, grade-section, schedule,
// parent/guardian contact) and leaves the rest as blank writing lines
// for handwriting. Same "open a new tab, print / save as PDF" pattern
// as the Reports page's openPrintableReport().
function openVisitationSlip(opts) {
  const {
    studentName,
    gradeSection = "",
    parentGuardian = "",
    parentAge = "",
    contactNumber = "",
    homeAddress = "",
    date,
    time,
    concern = "",
    rescheduled = false,
  } = opts;
  const formattedContact = ccFormatPhone(contactNumber);

  const win = window.open("", "_blank");
  if (!win) {
    showToast("Please allow pop-ups to generate this slip.", "error");
    return;
  }

  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Parent/Guardian&rsquo;s Visitation Slip</title>
      <style>
        html { background:#eef1f5; margin:0; padding:0; }
        body { font-family: Arial, sans-serif; color:#111827; width:8.5in; min-height:11in; margin:24px auto; box-sizing:border-box; position:relative; background:#fff; box-shadow:0 2px 18px rgba(0,0,0,.28); padding:140px 40px 130px; }
        .print-school-header, .print-school-footer { background:#fff; }
        .print-school-header img, .print-school-footer img { width:100%; height:auto; display:block; }
        .print-school-header { position:absolute; top:0; left:0; right:0; }
        .print-school-footer { position:absolute; bottom:0; left:0; right:0; }
        h1 { font-size:18px; margin:0 0 26px; text-align:center; }
        .row { display:flex; align-items:flex-end; gap:10px; font-size:13.5px; margin-bottom:15px; }
        .conference-row { gap:6px; font-size:11px; }
        .conference-row label { font-size:11px; }
        .row label { white-space:nowrap; }
        .fill { flex:1; min-height:17px; border-bottom:1px solid #111827; padding:0 4px; font-size:13px; overflow:hidden; }
        .fill.grow2 { flex:2.2; }
        .fill.fixed { flex:none; width:120px; }
        .reason { font-size:13.5px; margin-bottom:16px; }
        .reason > .reason-label { display:block; margin-bottom:6px; }
        .reason .lines { margin-top:4px; }
        .reason-box { border:1px solid #111827; min-height:66px; padding:4px; font-size:13px; overflow:visible; white-space:pre-wrap; overflow-wrap:break-word; word-break:break-word; }
        .actions-title { font-size:13.5px; margin-bottom:8px; }
        .actions { display:grid; grid-template-columns:1fr 1fr; gap:9px 28px; font-size:13px; margin-bottom:18px; }
        .cb { display:inline-block; width:11px; height:11px; border:1px solid #111827; margin-right:7px; vertical-align:-1px; }
        .privacy { font-size:12px; line-height:1.55; color:#374151; margin-top:4px; }
        .privacy strong { color:#111827; }
        .print-letterhead { display:contents; border-collapse:collapse; }
        .print-letterhead > thead, .print-letterhead > tfoot { display:none; }
        .print-letterhead > tbody { display:contents; }
        .print-letterhead > tbody > tr { display:contents; }
        .print-letterhead > tbody > tr > td { display:contents; }
        .print-btn { position:fixed; top:12px; right:12px; z-index:20; padding:8px 16px; border-radius:8px; border:none; background:#2563eb; color:#fff; font-weight:600; cursor:pointer; box-shadow:0 2px 8px rgba(0,0,0,.25); }
        .resched-stamp { display:inline-block; border:2px solid #b91c1c; color:#b91c1c; font-weight:700; font-size:15px; letter-spacing:2px; padding:4px 18px; border-radius:6px; margin:0 0 20px; text-transform:uppercase; }
        .resched-line { display:flex; align-items:center; gap:14px; margin:0 0 8px; }
        @media screen and (max-width: 900px) { body { width:100%; min-height:auto; margin:0; box-shadow:none; } }
        @page { size:8.5in 11in; margin:0; }
        @media print {
          .print-btn { display:none; }
          html { background:#fff; }
          body { width:auto; min-height:auto; margin:0; padding:0; box-shadow:none; position:static; }
          .print-school-header { position:fixed; top:0; left:0; right:0; z-index:10; height:135px; overflow:hidden; }
          .print-school-footer { position:fixed; bottom:0; left:0; right:0; z-index:10; height:100px; overflow:hidden; }
          .print-letterhead { display:table; width:8.5in; border-collapse:collapse; }
          .print-letterhead > thead { display:table-header-group; }
          .print-letterhead > thead > tr { display:table-row; }
          .print-letterhead > thead > tr > td { display:table-cell; height:135px; padding:0; border:none; }
          .print-letterhead > tfoot { display:table-footer-group; }
          .print-letterhead > tfoot > tr { display:table-row; }
          .print-letterhead > tfoot > tr > td { display:table-cell; height:100px; padding:0; border:none; }
          .print-letterhead > tbody { display:table-row-group; }
          .print-letterhead > tbody > tr { display:table-row; }
          .print-letterhead > tbody > tr > td { display:table-cell; vertical-align:top; padding:4px 40px 10px; border:none; }
        }
      </style>
    </head>
    <body>
      ${schoolPrintHeaderFooterHtml()}
      <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
      <table class="print-letterhead">
        ${schoolPrintLetterhead()}
        <tbody>
          <tr>
            <td>
              <h1>Parent/Guardian&rsquo;s Visitation Slip</h1>

              <div class="resched-line">
                <div class="row" style="flex:1; margin-bottom:0;">
                  <label>Date:</label>
                  <div class="fill">${ccEscapeHtml(date)}</div>
                  <label>Time:</label>
                  <div class="fill">${ccEscapeHtml(time)}</div>
                </div>
                ${rescheduled ? '<span class="resched-stamp">RESCHEDULED</span>' : ""}
              </div>

              <div class="row">
                <label>Name of Mother/Father/Guardian:</label>
                <div class="fill grow2">${ccEscapeHtml(parentGuardian)}</div>
                <label>Age:</label>
                <div class="fill fixed">${ccEscapeHtml(parentAge)}</div>
              </div>
              <div class="row">
                <label>Contact No.:</label>
                <div class="fill">${ccEscapeHtml(formattedContact)}</div>
              </div>
              <div class="row">
                <label>Home Address:</label>
                <div class="fill">${ccEscapeHtml(homeAddress)}</div>
              </div>
              <div class="row">
                <label>Name of son/daughter:</label>
                <div class="fill grow2">${ccEscapeHtml(studentName)}</div>
                <label>Grade-Section:</label>
                <div class="fill">${ccEscapeHtml(gradeSection)}</div>
              </div>
              <div class="row">
                <label>Child&rsquo;s Class Adviser:</label>
                <div class="fill"></div>
              </div>
              <div class="row conference-row">
                <label>Number of Conference with the Class Adviser:</label>
                <div class="fill"></div>
                <label>Date of Last Conference:</label>
                <div class="fill"></div>
              </div>

              <div class="reason">
                <div class="reason-label">Reason for Visit:</div>
                <div class="lines">
                  <div class="reason-box">${ccEscapeHtml(concern)}</div>
                </div>
              </div>

              <div class="actions-title">Action Taken:</div>
              <div class="actions">
                <div><span class="cb"></span>referral to the class adviser</div>
                <div><span class="cb"></span>referral to the concerned teacher</div>
                <div><span class="cb"></span>referral to the JHS Coordinator</div>
                <div><span class="cb"></span>referral to the SHS Coordinator</div>
                <div><span class="cb"></span>referral to the Discipline Officer</div>
                <div><span class="cb"></span>referral to Registered Guidance Personnel</div>
              </div>

              <p class="privacy"><strong>Data Privacy Act:</strong> All data gathered will be kept confidential in compliance with Republic Act 10173 otherwise known as the Data Privacy Act of 2012 and shall only be used for school record purposes and shall be accessed only by authorized school personnel.</p>
            </td>
          </tr>
        </tbody>
      </table>
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

async function logoutCounselor(reason) {
  sessionStorage.removeItem("counselorName");
  await supabaseClient.auth.signOut();
  window.location.href = reason ? `../personnel-login.html?reason=${reason}` : "../personnel-login.html";
}

// Fills every .avatar-initials element (the sidebar header + profile page)
// with the user's initials, e.g. "Aaron Punsalan" -> "AP". Named avatars use
// first-letter-of-first + first-letter-of-last; single-word names use the
// Fills every .avatar-initials element (the sidebar header + profile page)
// with the user's initials derived from the NAME fields, e.g. "Juan" +
// "Dela Cruz" -> "JD". A single-word name falls back to its first two letters.
function setUserAvatar(firstName, lastName) {
  const els = document.querySelectorAll(".avatar-initials");
  if (!els.length) return;
  const first = String(firstName || "").trim();
  const last = String(lastName || "").trim();
  let initials;
  if (first) {
    initials = first[0] + (last ? last[0] : (first[1] || ""));
  } else if (last) {
    initials = last.slice(0, 2);
  } else {
    return;
  }
  els.forEach((el) => {
    el.textContent = initials.toUpperCase();
  });
}

// Returns the current user's access token, refreshing it first when it's
// within ~60s of expiry, or null (with a redirect to login) when there's no
// usable session. The Authorization header on every function call is exactly
// this token, passed on the invoke itself (see invokeEdge): supabaseClient
// .functions is a getter that builds a fresh FunctionsClient on EVERY property
// access, so functions.setAuth() only mutates a throwaway instance and never
// reaches the request underneath — and the real header must not be left to
// chance.
async function attachSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "../personnel-login.html?reason=required";
    return null;
  }

  let accessToken = session.access_token;
  if (session.expires_at && session.expires_at * 1000 < Date.now() + 60_000) {
    const { data: refreshed, error } = await supabaseClient.auth.refreshSession();
    if (error || !refreshed?.session) {
      window.location.href = "../personnel-login.html?reason=timeout";
      return null;
    }
    accessToken = refreshed.session.access_token;
  }

  return accessToken;
}

// Invokes an Edge Function with a guaranteed-fresh access token. attachSession
// only refreshes when the token is within ~60s of expiry, so an Edge Function
// can STILL answer 401 with a token that PostgREST accepted a moment earlier
// (rotation race, silently-expired JWT, clock skew...). On HTTP 401 this forces
// one refreshSession and retries the call once. Callers receive { data, error }
// shaped exactly like supabaseClient.functions.invoke — error.context.status and
// error.context.data stay available for the existing toasts.
async function invokeEdge(fnName, body = {}, options = {}) {
  const token = await attachSession();
  if (!token) return { data: null, error: new Error("Not authenticated") };

  return invokeEdgeWithToken(fnName, body, options, token);
}

// Shared by invokeEdge for the initial call and its 401 retry. The token rides
// in the request headers (invoke merges options.headers into the outgoing
// request, and supabase-js only auto-fills Authorization when one isn't already
// present), so the user's session token always reaches the gateway — the
// anon-key fallback can never be used and the FunctionsClient getter quirk
// above can't strip it.
async function invokeEdgeWithToken(fnName, body, options, token) {
  const headers = Object.assign({}, options.headers, { Authorization: `Bearer ${token}` });

  const first = await supabaseClient.functions.invoke(fnName, { body, ...options, headers });
  if (!first.error || first.error.context?.status !== 401) return first;

  // The token was rejected — force a fresh one and try once more.
  const { data: refreshed, error: refreshError } = await supabaseClient.auth.refreshSession();
  if (refreshError || !refreshed?.session) return first;

  const retryHeaders = Object.assign({}, options.headers, { Authorization: `Bearer ${refreshed.session.access_token}` });
  return supabaseClient.functions.invoke(fnName, { body, ...options, headers: retryHeaders });
}

async function requireCounselorAuth() {
  const cachedName = sessionStorage.getItem("counselorName");
  if (cachedName) {
    const nameEl = document.getElementById("sidebarName");
    if (nameEl) nameEl.textContent = cachedName;
    const cachedInitials = sessionStorage.getItem("counselorInitials");
    if (cachedInitials) {
      document.querySelectorAll(".avatar-initials").forEach((el) => { el.textContent = cachedInitials; });
    } else {
      const parts = cachedName.trim().split(/\s+/).filter(Boolean);
      setUserAvatar(parts[0] || "", parts.slice(1).join(" "));
    }
  }

  const { data: { session } } = await supabaseClient.auth.getSession();

  // Not logged in? send back to login page
  if (!session) {
    window.location.href = "../personnel-login.html?reason=required";
    return null;
  }

  // Confirm this account is actually a counselor (not a student
  // landing here by direct URL). Fetched alongside the counselor row
  // instead of after it — both only depend on session.user.id, so
  // there's no need to wait on one before starting the other.
  const [{ data: userRow }, { data: counselor }] = await Promise.all([
    supabaseClient.from("users").select("role").eq("user_id", session.user.id).single(),
    supabaseClient.from("counselors").select("counselor_id, first_name, last_name, is_active").eq("user_id", session.user.id).eq("is_active", true).maybeSingle(),
  ]);

  const role = userRow?.role?.toLowerCase();

  switch (role) {
    case "counselor":
      break;
    case "student":
      window.location.href = "../student/student-dashboard.html";
      return null;
    default:
      window.location.href = "../personnel-login.html";
      return null;
  }

  // Role says counselor but the row is missing/deactivated -> the
  // account was soft-disabled (is_active=false). Send them back to
  // the login page; the auth ban also blocks fresh sign-ins.
  if (!counselor) {
    window.location.href = "../personnel-login.html?reason=deactivated";
    return null;
  }

  const fullName = `${counselor.first_name} ${counselor.last_name}`;
  const nameEl = document.getElementById("sidebarName");
  if (nameEl) nameEl.textContent = fullName;
  setUserAvatar(counselor.first_name, counselor.last_name);
  const initialsEl = document.querySelector(".avatar-initials");
  if (initialsEl) sessionStorage.setItem("counselorInitials", initialsEl.textContent);
  sessionStorage.setItem("counselorName", fullName);

  // Session confirmed — lift the auth splash before anything renders.
  ccHideAuthSplash();

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

function startBtnLoading(btn, label) {
  if (!btn.dataset.idleLabel) btn.dataset.idleLabel = btn.textContent.trim() || "Save";
  btn.disabled = true;
  btn.innerHTML = `<span class="btn-spinner"></span>${label}`;
}

function stopBtnLoading(btn, idleLabel) {
  btn.disabled = false;
  btn.textContent = idleLabel || btn.dataset.idleLabel || btn.textContent;
}

// Full-screen "working" overlay for slow account-status actions
// (activating/deactivating students or staff accounts). Blocks all
// clicks so nobody double-acts in the middle of a change or trips a
// toast under it. Pairs with hideBlockingLoading() — always hide it in
// a finally block. Safe to call repeatedly: reuses one element.
function showBlockingLoading(message) {
  let overlay = document.getElementById("actionLoadingOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "actionLoadingOverlay";
    overlay.className = "page-load-overlay blocking-overlay";
    overlay.innerHTML =
      '<div style="display:flex;flex-direction:column;align-items:center;gap:16px;">' +
      '<div class="page-load-spinner"></div>' +
      '<p id="actionLoadingMsg" style="font-weight:600;">Working…</p>' +
      "</div>";
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.zIndex = "2000";
    document.body.appendChild(overlay);
  }
  overlay.classList.remove("hide");
  const msg = overlay.querySelector("#actionLoadingMsg");
  if (msg && message) msg.textContent = message;
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
}

function hideBlockingLoading() {
  const overlay = document.getElementById("actionLoadingOverlay");
  if (overlay) overlay.classList.add("hide");
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
}

// Content-only "loading" overlay for tab navigation. When a sidebar /
// mobile-nav link is clicked we switch to another page, so this gives
// immediate feedback inside the main content area while the next page
// loads — WITHOUT covering the sidebar/bottom-nav, which stay visible
// and clickable. Deliberately different from showBlockingLoading():
// that one is the full-site, dark, click-blocking overlay reserved for
// mutating actions (reset password, imports, form assignment, etc.)
// where navigation must be prevented while the write finishes.
function showContentLoading(message) {
  const target = document.querySelector("main.content");
  if (!target) return;
  let overlay = document.getElementById("contentLoadingOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "contentLoadingOverlay";
    overlay.className = "content-loading-overlay";
    overlay.innerHTML =
      '<div style="display:flex;flex-direction:column;align-items:center;gap:12px;">' +
      '<div class="page-load-spinner"></div>' +
      '<p id="contentLoadingMsg" style="font-weight:600;color:#374151;">Loading…</p>' +
      "</div>";
    target.prepend(overlay);
  }
  overlay.classList.add("show");
  const msg = overlay.querySelector("#contentLoadingMsg");
  if (msg && message) msg.textContent = message;
}

function hideContentLoading() {
  const overlay = document.getElementById("contentLoadingOverlay");
  if (overlay) overlay.classList.remove("show");
}

// Any sidebar or mobile-menu link that navigates to another in-portal
// page gets the content-only overlay. Skipped for "#" logout anchors,
// javascript: links, and modified clicks (new tab/window), which don't
// navigate this page.
document.querySelectorAll(".sidebar nav a[href], .mobile-menu a[href]").forEach((link) => {
  const href = link.getAttribute("href") || "";
  if (href === "#" || href.startsWith("javascript:")) return;
  link.addEventListener("click", (e) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) return;
    showContentLoading();
  });
});

function setUploadProgress(el, percent) {
  if (!el) return;
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  const fill = el.querySelector(".upload-progress-fill");
  if (fill) fill.style.width = pct + "%";
  el.classList.add("visible");
}

function hideUploadProgress(el) {
  if (!el) return;
  const fill = el.querySelector(".upload-progress-fill");
  if (fill) fill.style.width = "0";
  el.classList.remove("visible");
}

function makeImgLazy(img) {
  if (!img) return;
  img.classList.add("img-lazy");
  img.addEventListener(
    "load",
    () => img.classList.add("is-loaded"),
    { once: true }
  );
  img.addEventListener(
    "error",
    () => img.classList.remove("img-lazy"),
    { once: true }
  );
}

// Office documents served from storage don't render in a browser tab —
// navigating straight there makes the browser download the file and leaves
// the new tab blank. Route those through Google's online viewer instead so
// the user gets a real preview; everything else opens as it did before.
function openDocFile(signedUrl, fileName) {
  const name = fileName || signedUrl || "";
  const ext = String(name).split(".").pop().toLowerCase();
  const officeExts = ["doc", "docx", "xls", "xlsx", "ppt", "pptx", "rtf", "odt", "ods", "odp", "csv"];
  if (officeExts.includes(ext)) {
    const viewerUrl = "https://docs.google.com/viewer?url=" + encodeURIComponent(signedUrl);
    window.open(viewerUrl, "_blank", "noopener");
    return;
  }
  window.open(signedUrl, "_blank");
}

// A logged-out user pressing the browser Back button can be served the
// portal page from the back/forward cache — scripts don't re-run, so the
// normal auth guard never fires and account data would still be shown.
// pageshow fires on every restore (before the browser repaints the cached
// snapshot), so cover the page synchronously first, then re-check the
// session and kick out to the personnel sign-in when it's gone.
window.addEventListener("pageshow", (e) => {
  if (!e.persisted) return;

  // A page pulled from the back/forward cache keeps the exact DOM it had
  // when it was paused — including a load/blocking overlay if one was still
  // up when the user navigated away (covers back/forward from another page
  // and the content overlay added by the nav-click handler). Clear them so
  // the restored page is never stuck underneath one.
  hidePageLoadOverlay();
  hideBlockingLoading();
  hideContentLoading();

  ccShowAuthSplash();
  supabaseClient.auth.getSession().then(({ data: { session } }) => {
    if (session) {
      ccHideAuthSplash();
      return;
    }
    window.location.replace("../personnel-login.html?reason=required");
  });
});
