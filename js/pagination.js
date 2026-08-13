// Shared pagination helper for long tables (student-history.html,
// counselor-student.html, counselor-cases.html, counselor-appointments.html,
// counselor-account.html, counselor-forms.html) so none of them render an
// unbounded list of rows in one go.

function paginateItems(items, page, pageSize) {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

// Renders "Showing X-Y of Z" + Prev/Next controls into `container`, clamps
// `page` to a valid range, and returns that clamped page so callers can
// keep their own page variable in sync.
function renderPaginationControls(container, { totalItems, page, pageSize, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const clampedPage = Math.min(Math.max(1, page), totalPages);

  if (totalItems === 0) {
    container.innerHTML = "";
    return clampedPage;
  }

  const start = (clampedPage - 1) * pageSize + 1;
  const end = Math.min(clampedPage * pageSize, totalItems);

  container.innerHTML = `
    <span class="pagination-info">Showing ${start}–${end} of ${totalItems}</span>
    <div class="pagination-buttons">
      <button type="button" class="pagination-btn" data-page="${clampedPage - 1}" ${clampedPage <= 1 ? "disabled" : ""} aria-label="Previous page">
        <i class="fa-solid fa-chevron-left"></i>
      </button>
      <span class="pagination-current">Page ${clampedPage} of ${totalPages}</span>
      <button type="button" class="pagination-btn" data-page="${clampedPage + 1}" ${clampedPage >= totalPages ? "disabled" : ""} aria-label="Next page">
        <i class="fa-solid fa-chevron-right"></i>
      </button>
    </div>
  `;

  container.querySelectorAll("button[data-page]").forEach((btn) => {
    btn.addEventListener("click", () => onPageChange(Number(btn.dataset.page)));
  });

  return clampedPage;
}
