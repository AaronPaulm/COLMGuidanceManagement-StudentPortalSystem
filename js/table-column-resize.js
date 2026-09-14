// Draggable column resize for every .simple-table on the page.
//
// A slim vertical handle is added to each <thead> cell; dragging it widens
// or narrows that column (clamped to a sane minimum). Widths live only in
// inline styles, so they reset on every page load — a cramped custom
// layout can never get "stuck".
//
// Works with both layouts used in this app:
//   • table-layout:fixed (desktop lists)  — px overrides the % column width
//   • table-layout:auto   (mobile & SIS)  — px acts as a width hint
//
// Tables that are rebuilt later (SIS viewer, wizard steps, filtered lists)
// pick up handles automatically via a MutationObserver.
(function () {
  var MIN_WIDTH = 56;
  var MAX_WIDTH = 2000;

  function clamp(v, lo, hi) {
    return Math.min(Math.max(v, lo), hi);
  }

  function attachGrip(th, table) {
    if (th.dataset.resizeAttached === "1") return;
    th.dataset.resizeAttached = "1";

    var grip = document.createElement("span");
    grip.className = "table-resize-grip";
    grip.setAttribute("role", "separator");
    grip.title = "Drag to resize column";
    th.appendChild(grip);

    var startX = 0;
    var startW = 0;

    grip.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      startX = e.clientX;
      startW = th.getBoundingClientRect().width;
      document.body.classList.add("table-resizing");
      th.classList.add("resizing");

      function onMove(ev) {
        var width = clamp(startW + (ev.clientX - startX), MIN_WIDTH, MAX_WIDTH);
        th.style.width = width + "px";
      }

      function onUp() {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.body.classList.remove("table-resizing");
        th.classList.remove("resizing");
      }

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    });
  }

  function attachAll() {
    document.querySelectorAll("table.simple-table").forEach(function (table) {
      table.querySelectorAll("thead th").forEach(function (th) {
        attachGrip(th, table);
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    attachAll();
    if (document.body) {
      var mo = new MutationObserver(attachAll);
      mo.observe(document.body, { childList: true, subtree: true });
    }
  });
})();