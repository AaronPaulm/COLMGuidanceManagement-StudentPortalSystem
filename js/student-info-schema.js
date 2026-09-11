// ============================================================
// Student Information Sheet — single source of truth for the
// annual multi-section form students fill out every school year.
//
// BOTH portals read this file:
//   • student/student-forms.html renders the fill-out wizard from it
//   • counselor/counselor-student.html renders the read-only viewer
//     and the Section VII notes editor from it
//
// Changing a question later = edit the field here, no DB migration
// (answers live in a JSONB column keyed by field key).
//
// Field types: text | number | date | email | tel | textarea |
//              radio | checks | table | select
//   radio  — single choice, stored as a string
//   checks — multi-choice, stored as an array of strings
//   select — single choice dropdown, stored as a string
//   table  — stored as an array of row objects; fixed tables declare
//            rowLabels (one row each), dynamic tables get add/remove
//            buttons (extra-curricular orgs, consultations, tests)
//   half   — render at half width in the two-column grid
//
// Requiredness (per your paper form):
//   I, II, III, V          — every field required (unless marked optional)
//   IV                     — subblock A required, subblock B optional
//   VI                     — nothing required
// ============================================================

window.STUDENT_INFO_SCHEMA = (function () {
  // ---------- Sections I–VI (student-facing) ----------

  const SECTIONS = [
    {
      id: "personal",
      numeral: "I",
      title: "Personal Information",
      description: "Your basic personal data. Name and Year & Section come from your school record.",
      req: { mode: "all" },
      fields: [
        { key: "last_name", label: "Surname", type: "text", auto: true, half: true },
        { key: "first_name", label: "Given Name", type: "text", auto: true, half: true },
        { key: "middle_name", label: "Middle Name", type: "text", auto: true, half: true, optional: true },
        { key: "gender", label: "Gender", type: "select", options: ["Male", "Female"], half: true },
        { key: "age", label: "Age", type: "number", min: 0, half: true },
        { key: "civil_status", label: "Civil Status", type: "text", noDigits: true, half: true },
        { key: "dob", label: "Date of Birth", type: "date", half: true },
        { key: "pob", label: "Place of Birth", type: "text", noDigits: true, half: true },
        { key: "religion", label: "Religion", type: "text", noDigits: true, half: true },
        { key: "year_level", label: "Year Level", type: "text", auto: true, half: true },
        { key: "section", label: "Section", type: "text", auto: true, half: true },
        { key: "course", label: "Course", type: "text", half: true, optional: true },
        { key: "complexion", label: "Complexion", type: "text", noDigits: true, half: true },
        { key: "height_m", label: "Height (m)", type: "number", step: "0.01", min: 0, half: true },
        { key: "weight_kg", label: "Weight (kg)", type: "number", min: 0, half: true },
        { key: "address", label: "Address", type: "textarea", rows: 2 },
        { key: "email", label: "Email Address", type: "email", half: true },
        { key: "contact", label: "Contact Number", type: "tel", phone: true, half: true },
      ],
    },
    {
      id: "education",
      numeral: "II",
      title: "Educational Background",
      description: "Schools you attended before this one. Fill only the levels that apply to you.",
      req: { mode: "all" },
      fields: [
        {
          key: "education_table",
          label: "Schools Graduated",
          type: "table",
          rowLabels: ["Pre-Elementary", "Elementary", "High School", "Vocational", "College"],
          columns: [
            { key: "school", label: "School Graduated", type: "text" },
            { key: "school_address", label: "School Address", type: "text" },
            { key: "inclusive_dates", label: "Inclusive Dates", type: "text" },
            { key: "general_average", label: "General Average", type: "text" },
            { key: "honors", label: "Honors Received", type: "text", optional: true },
          ],
        },
        {
          key: "schooling_nature",
          label: "Nature of Schooling",
          type: "radio",
          options: ["Continuous", "Interrupted"],
          half: true,
        },
        {
          key: "schooling_interrupt_reason",
          label: "If Interrupted, Reason",
          type: "text",
          half: true,
          // Only typeable while "Interrupted" is the chosen nature.
          enableIf: { field: "schooling_nature", values: ["Interrupted"] },
        },
      ],
    },
    {
      id: "family",
      numeral: "III",
      title: "Family Background",
      description: "Information about your parents/guardian and household.",
      req: { mode: "all" },
      fields: [
        { key: "father_name", label: "Name of Father", type: "text", half: true },
        { key: "father_age", label: "Father's Age", type: "number", min: 0, half: true },
        {
          key: "father_living",
          label: "Father's Status",
          type: "radio",
          options: ["Living", "Deceased"],
          half: true,
        },
        { key: "father_education", label: "Father's Educational Attainment", type: "text", noDigits: true, half: true },
        { key: "father_occupation", label: "Father's Occupation", type: "text", noDigits: true, half: true },
        { key: "father_employer", label: "Father's Name of Employer", type: "text", noDigits: true, half: true },
        { key: "father_employer_address", label: "Father's Address of Employer", type: "text", half: true },

        { key: "mother_name", label: "Name of Mother", type: "text", half: true },
        { key: "mother_age", label: "Mother's Age", type: "number", min: 0, half: true },
        {
          key: "mother_living",
          label: "Mother's Status",
          type: "radio",
          options: ["Living", "Deceased"],
          half: true,
        },
        { key: "mother_education", label: "Mother's Educational Attainment", type: "text", noDigits: true, half: true },
        { key: "mother_occupation", label: "Mother's Occupation", type: "text", noDigits: true, half: true },
        { key: "mother_employer", label: "Mother's Name of Employer", type: "text", noDigits: true, half: true },
        { key: "mother_employer_address", label: "Mother's Address of Employer", type: "text", half: true },

        // Guardian block is optional — not every student has one.
        { key: "guardian_name", label: "Name of Guardian", type: "text", half: true, optional: true },
        { key: "guardian_age", label: "Guardian's Age", type: "number", min: 0, half: true, optional: true },
        { key: "guardian_contact", label: "Guardian's Contact Number", type: "tel", phone: true, half: true, optional: true },
        { key: "guardian_education", label: "Guardian's Educational Attainment", type: "text", noDigits: true, half: true, optional: true },
        { key: "guardian_occupation", label: "Guardian's Occupation", type: "text", noDigits: true, half: true, optional: true },
        { key: "guardian_employer", label: "Guardian's Name of Employer", type: "text", noDigits: true, half: true, optional: true },
        { key: "guardian_employer_address", label: "Guardian's Address of Employer", type: "text", half: true, optional: true },

        {
          key: "marital_status",
          label: "Parents' Marital Status",
          type: "radio",
          options: [
            "Single Parent",
            "Married and Staying together",
            "Married but Separated",
            "Not married but living together",
            "Others",
          ],
        },
        { key: "marital_others", label: "If Others, Please Specify", type: "text", enableIf: { field: "marital_status", values: ["Others"] } },

        { key: "num_children", label: "Number of Children in the Family (including yourself)", type: "number", min: 0, half: true },
        { key: "num_brothers", label: "Number of Brother/s", type: "number", min: 0, half: true },
        { key: "num_sisters", label: "Number of Sister/s", type: "number", min: 0, half: true },
        { key: "siblings_employed", label: "Number of Brother/s or Sister/s Gainfully Employed", type: "number", min: 0, half: true },
        { key: "ordinal_position", label: "Ordinal Position (e.g., 1st child)", type: "text", half: true },
        {
          key: "sibling_support",
          label: "Which of the following do your employed brother/s or sister/s support?",
          type: "checks",
          options: ["Family", "Your studies", "His/her own family", "None"],
        },
        {
          key: "financing",
          label: "Who finances your schooling?",
          type: "radio",
          options: ["Parents", "Brother/Sister", "Spouse", "Relatives", "Scholarship", "Self"],
          half: true,
        },
        { key: "weekly_allowance", label: "Weekly Allowance (amount)", type: "text", decimalOnly: true, half: true },
        {
          key: "income_bracket",
          label: "Parent's Total Monthly Income",
          type: "radio",
          options: [
            "Below PHP 5,000",
            "PHP 5,001 – PHP 10,000",
            "PHP 10,001 – PHP 15,000",
            "PHP 15,001 – PHP 20,000",
            "PHP 20,001 – PHP 25,000",
            "PHP 25,001 – PHP 30,000",
            "PHP 30,001 – PHP 35,000",
            "PHP 35,001 – PHP 40,000",
            "PHP 40,001 – PHP 45,000",
            "PHP 45,001 – PHP 50,000",
            "Above PHP 50,000",
            "Others",
          ],
        },
        { key: "income_others", label: "If Others, Please Specify", type: "text", enableIf: { field: "income_bracket", values: ["Others"] } },
        { key: "quiet_place", label: "Do you have a quiet place to study?", type: "radio", options: ["Yes", "No"], half: true },
        { key: "share_room", label: "Do you share your room with anyone?", type: "radio", options: ["Yes", "No"], half: true },
        { key: "share_room_whom", label: "If Yes, With Whom?", type: "text", half: true, enableIf: { field: "share_room", values: ["Yes"] } },
        {
          key: "residence",
          label: "Nature of Residence while attending school",
          type: "radio",
          options: [
            "Family Home",
            "Bed Spacer",
            "House of married brother/sister",
            "Relative's house",
            "Rented apartment",
            "Dorm (including boarding & lodging)",
            "Shares apartment with friends/relatives",
          ],
        },
      ],
    },
    {
      id: "health",
      numeral: "IV",
      title: "Health",
      description: "This helps your guidance counselor understand how to support you. Answers stay confidential.",
      req: { mode: "subblocks", required: ["A"] },
      fields: [
        { type: "subblock", zone: "A", label: "A. Health Status (required)" },
        { key: "vision_problem", label: "Do you have problems with your vision?", type: "radio", options: ["Yes", "No"], half: true },
        { key: "vision_specify", label: "If Yes, Please Specify", type: "text", half: true, enableIf: { field: "vision_problem", values: ["Yes"] } },
        { key: "speech_problem", label: "Do you have problems with your speech?", type: "radio", options: ["Yes", "No"], half: true },
        { key: "speech_specify", label: "If Yes, Please Specify", type: "text", half: true, enableIf: { field: "speech_problem", values: ["Yes"] } },
        { key: "psych_consulted", label: "Have you had previous psychological consultations?", type: "radio", options: ["Yes", "No"] },

        { type: "subblock", zone: "B", label: "B. Previous Consultations (optional)" },
        {
          key: "psych_consultations",
          label: "Previous Consultations",
          type: "table",
          optional: true,
          dynamic: true,
          addLabel: "Add consultation",
          columns: [
            { key: "date", label: "Date", type: "date" },
            { key: "reason", label: "Reason", type: "text" },
          ],
        },
      ],
    },
    {
      id: "interests",
      numeral: "V",
      title: "Interests and Hobbies",
      description: "",
      req: { mode: "all" },
      fields: [
        { key: "fav_subjects", label: "What is/are your favorite subject/s?", type: "text", noDigits: true },
        { key: "least_subjects", label: "What is/are the subject/s you like least?", type: "text", noDigits: true },
        { key: "hobby_1", label: "Hobby #1 (most preferred)", type: "text", noDigits: true, half: true },
        { key: "hobby_2", label: "Hobby #2", type: "text", noDigits: true, half: true, optional: true },
        { key: "hobby_3", label: "Hobby #3", type: "text", noDigits: true, half: true, optional: true },
        { key: "hobby_4", label: "Hobby #4", type: "text", noDigits: true, half: true, optional: true },
        {
          key: "organizations",
          label: "Extra-Curricular Organizations",
          type: "table",
          optional: true,
          dynamic: true,
          addLabel: "Add organization",
          columns: [
            { key: "organization", label: "Organization", type: "text" },
            { key: "position", label: "Position", type: "text" },
            { key: "membership_year", label: "Membership Year", type: "text" },
          ],
        },
      ],
    },
    {
      id: "tests",
      numeral: "VI",
      title: "Test Results",
      description: "Guidance/aptitude tests you have taken, if any. Your counselor may also fill this in during interviews.",
      req: { mode: "none" },
      fields: [
        {
          key: "test_results",
          label: "Tests Taken",
          type: "table",
          dynamic: true,
          addLabel: "Add test result",
          columns: [
            { key: "date", label: "Date", type: "date" },
            { key: "test_name", label: "Name of Test", type: "text" },
            { key: "raw_score", label: "Raw Score", type: "text" },
            { key: "percentile", label: "Percentile Score", type: "text" },
            { key: "description", label: "Description", type: "text" },
          ],
        },
      ],
    },
  ];

  // ---------- Section VII (counselor-only, see student_info_guidance_notes) ----------

  const NOTES_SECTION = {
    numeral: "VII",
    title: "Significant Notes (For Guidance Counselors only)",
    columns: [
      { key: "date", label: "Date", type: "date" },
      { key: "incident", label: "Incident", type: "text" },
      { key: "remarks", label: "Remarks", type: "text" },
    ],
  };

  // On submit, these sheet answers also update the student's official
  // record (students table). One-way: the record stays the single
  // authority for current data; the sheet keeps its own snapshot.
  const SYNC_TO_STUDENT_RECORD = [
    { field: "email", column: "student_email" },
    { field: "contact", column: "contact_number" },
    { field: "guardian_name", column: "parent_guardian" },
  ];

  // ---------- Rendering / collecting helpers (shared) ----------

  function esc(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
  }

  function escAttr(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function disabledAttr(disabled) {
    return disabled ? "disabled" : "";
  }

  // Normalizes any phone input to 09XX-XXX-XXXX: digits are extracted,
  // capped at 11, and the dashes are inserted at positions 4 and 8.
  function formatPhone(value) {
    const d = String(value ?? "").replace(/\D/g, "").slice(0, 11);
    if (!d) return "";
    if (d.length > 7) return `${d.slice(0, 4)}-${d.slice(4, 7)}-${d.slice(7)}`;
    if (d.length > 4) return `${d.slice(0, 4)}-${d.slice(4)}`;
    return d;
  }

  // Basic but practical email check: something@something.something.
  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim());
  }

  function simpleInputHtml(field, value, disabled) {
    const dis = disabledAttr(disabled);
    const step = field.step ? `step="${escAttr(field.step)}"` : "";

    // Sanitize an already-stored value at render time so pre-existing data
    // (or autofill) never injects characters the field forbids.
    let v = value ?? "";
    if (field.noDigits) {
      v = v.replace(/\d/g, "");
    } else if (field.decimalOnly) {
      v = v.replace(/[^\d.]/g, "");
    } else if (field.phone) {
      v = formatPhone(v);
    }

    switch (field.type) {
      case "textarea":
        return `<textarea data-field="${escAttr(field.key)}" rows="${field.rows || 3}" ${dis}>${esc(v)}</textarea>`;
      case "number":
        return `<input type="number" data-field="${escAttr(field.key)}" value="${escAttr(v)}" ${step} ${field.min !== undefined ? `min="${field.min}"` : ""} ${dis}>`;
      case "date":
        return `<input type="date" data-field="${escAttr(field.key)}" value="${escAttr(v)}" ${dis}>`;
      case "email":
        return `<input type="email" data-email="1" data-field="${escAttr(field.key)}" value="${escAttr(v)}" ${dis}>`;
      case "tel": {
        const mask = field.phone ? ` data-phone="1"` : "";
        return `<input type="tel" data-field="${escAttr(field.key)}" value="${escAttr(v)}" ${mask} ${dis}>`;
      }
      default: {
        const attrs = [];
        if (field.noDigits) attrs.push(`data-nodigits="1"`);
        if (field.decimalOnly) attrs.push(`data-decimalonly="1"`);
        return `<input type="text" data-field="${escAttr(field.key)}" value="${escAttr(v)}" ${attrs.join(" ")} ${dis}>`;
      }
    }
  }

  function tableHtml(field, rows, disabled) {
    const cols = field.columns;
    let headCells = field.rowLabels ? `<th style="width:130px;"></th>` : `<th style="width:36px;">#</th>`;
    headCells += cols.map((c) => `<th>${esc(c.label)}</th>`).join("");
    if (!disabled) headCells += `<th style="width:36px;"></th>`;

    const rowCount = field.rowLabels ? field.rowLabels.length : Math.max((rows || []).length, 1);

    let body = "";
    for (let i = 0; i < rowCount; i++) {
      const row = (rows || [])[i] || {};
      const labelCell = field.rowLabels
        ? `<td class="sis-row-label">${esc(field.rowLabels[i])}</td>`
        : `<td class="sis-row-num">${i + 1}</td>`;
      const cells = cols
        .map(
          (c) =>
            `<td><input type="${c.type === "date" ? "date" : "text"}" data-field="${escAttr(field.key)}" data-row="${i}" data-col="${escAttr(c.key)}" value="${escAttr(row[c.key] ?? "")}" ${disabledAttr(disabled)}></td>`
        )
        .join("");
      const removeCell = disabled
        ? ""
        : `<td><button type="button" class="icon-btn sm sis-remove-row" title="Remove row"><i class="fa-solid fa-xmark"></i></button></td>`;
      body += `<tr data-row="${i}">${labelCell}${cells}${removeCell}</tr>`;
    }

    const addBtn = field.dynamic && !disabled
      ? `<button type="button" class="btn btn-outline btn-sm sis-add-row"><i class="fa-solid fa-plus"></i> ${esc(field.addLabel || "Add row")}</button>`
      : "";

    return `
      <div class="sis-table-wrap" data-table-field="${escAttr(field.key)}">
        <table class="simple-table sis-table">
          <thead><tr>${headCells}</tr></thead>
          <tbody>${body}</tbody>
        </table>
        ${addBtn}
      </div>
    `;
  }

  function fieldInnerHtml(field, value, disabled) {
    switch (field.type) {
      case "select":
        return `<div class="sis-select-wrap"><select data-field="${escAttr(field.key)}" ${disabledAttr(disabled)}>
            <option value="">— Select —</option>
            ${(field.options || [])
              .map(
                (o) =>
                  `<option value="${escAttr(o)}" ${String(value ?? "") === o ? "selected" : ""}>${esc(o)}</option>`
              )
              .join("")}
          </select></div>`;
      case "radio":
        return `<div class="sis-choices">${(field.options || [])
          .map(
            (o) => `
          <label class="radio-option">
            <input type="radio" name="sis-${escAttr(field.key)}" data-field="${escAttr(field.key)}" value="${escAttr(o)}" ${String(value ?? "") === o ? "checked" : ""} ${disabledAttr(disabled)}>
            <span>${esc(o)}</span>
          </label>`
          )
          .join("")}</div>`;
      case "checks": {
        const selected = Array.isArray(value) ? value : [];
        return `<div class="sis-choices">${(field.options || [])
          .map(
            (o) => `
          <label class="checkbox-option">
            <input type="checkbox" data-field="${escAttr(field.key)}" value="${escAttr(o)}" ${selected.includes(o) ? "checked" : ""} ${disabledAttr(disabled)}>
            <span>${esc(o)}</span>
          </label>`
          )
          .join("")}</div>`;
      }
      case "table":
        return tableHtml(field, value, disabled);
      default:
        return simpleInputHtml(field, value, disabled);
    }
  }

  // One field rendered as a labeled block. Subblock headers split a
  // section into lettered parts (IV-A / IV-B); tables render full-width
  // without the standard form-field box (they carry their own styling).
  function fieldHtml(field, value, disabled) {
    if (field.type === "subblock") {
      return `<div class="sis-subblock">${esc(field.label)}</div>`;
    }

    if (field.type === "table") {
      return `
        <div class="sis-field sis-field-table">
          <label class="sis-table-label">${esc(field.label)}</label>
          ${tableHtml(field, value, disabled)}
        </div>
      `;
    }

    const hint = field.hint ? `<span class="hint">${esc(field.hint)}</span>` : "";
    return `
      <div class="sis-field ${field.half ? "half" : ""}">
        <div class="form-field">
          <label>${esc(field.label)}</label>
          ${fieldInnerHtml(field, value, disabled)}
          ${hint}
        </div>
      </div>
    `;
  }

  // Reads every input inside `container` back into `answers`, keyed by
  // field key. Called on section navigation / save / submit rather than
  // wiring per-input listeners — one pass over the DOM, no drift.
  function collectSection(container, fields, answers) {
    fields.forEach((field) => {
      if (field.type === "subblock") return;

      if (field.type === "table") {
        const wrap = container.querySelector(`[data-table-field="${field.key}"]`);
        if (!wrap) return;

        // Fixed and dynamic tables collect identically — one object per
        // <tr>, in DOM order (fixed tables always render all their rows).
        const rows = [];
        wrap.querySelectorAll("tbody tr").forEach((tr) => {
          const row = {};
          field.columns.forEach((c) => {
            row[c.key] = tr.querySelector(`[data-col="${c.key}"]`)?.value ?? "";
          });
          rows.push(row);
        });
        answers[field.key] = rows;
        return;
      }

      if (field.type === "radio") {
        const checked = container.querySelector(`input[type="radio"][data-field="${field.key}"]:checked`);
        answers[field.key] = checked ? checked.value : "";
        return;
      }

      if (field.type === "checks") {
        answers[field.key] = Array.from(
          container.querySelectorAll(`input[type="checkbox"][data-field="${field.key}"]:checked`)
        ).map((cb) => cb.value);
        return;
      }

      const el = container.querySelector(`[data-field="${field.key}"]`);
      if (el) answers[field.key] = el.value;
    });
  }

  // Enables/disables conditional fields (enableIf) based on the
  // current answers. Skipped entirely in read-only mode, where every
  // input is already disabled and must stay that way. Disabling also
  // clears the box so a half-typed "reason" can't be collected after
  // the student switches back to "Continuous", etc.
  function applyFieldStates(container, answers, readOnly) {
    if (readOnly) return;
    SECTIONS.forEach((sec) =>
      sec.fields.forEach((f) => {
        if (!f.enableIf) return;
        const allowed = f.enableIf.values.includes(String(answers[f.enableIf.field] ?? ""));
        container.querySelectorAll(`[data-field="${f.key}"]`).forEach((el) => {
          el.disabled = !allowed;
          if (!allowed) el.value = "";
        });
      })
    );
  }

  // Inside a checks group containing a "None" option, None excludes
  // everything else — and picking anything else clears None.
  function handleChecksChange(container, input) {
    const key = input.dataset.field;
    if (!key) return;
    const group = Array.from(container.querySelectorAll(`input[type="checkbox"][data-field="${key}"]`));
    const noneOpt = group.find((g) => g.value.trim().toLowerCase() === "none");
    if (!noneOpt) return;

    if (input === noneOpt && input.checked) {
      group.forEach((g) => {
        if (g !== noneOpt) g.checked = false;
      });
    } else if (input !== noneOpt && input.checked) {
      noneOpt.checked = false;
    }
  }

  // Required-field validation for one wizard step. Returns the labels
  // of everything still missing (empty array = step is complete).
  //
  // Rules:
  //   • section req.mode "none"  → nothing required (VI)
  //   • section req.mode "all"   → every field required unless optional
  //   • req.mode "subblocks"     → only fields inside the lettered
  //                                subblocks listed in req.required (IV-A)
  //   • disabled inputs (conditional "specify" boxes) never count
  //   • checkbox groups stay optional everywhere — they're multi-selects
  //   • fixed tables: a row counts only if at least one cell has text;
  //     a used row must then fill every non-optional column, so students
  //     can skip levels that don't apply but can't half-fill one
  function validateSection(container, step) {
    const missing = [];
    const req = step.req || { mode: "all" };
    if (req.mode === "none") return missing;

    const requiredZones = req.mode === "subblocks" ? req.required || [] : null;
    let zone = null;

    step.fields.forEach((field) => {
      if (field.type === "subblock") {
        zone = field.zone || null;
        return;
      }
      if (field.optional) return;
      if (requiredZones && !requiredZones.includes(zone)) return;

      if (field.type === "table") {
        const wrap = container.querySelector(`[data-table-field="${field.key}"]`);
        if (!wrap) {
          missing.push(field.label);
          return;
        }
        const optionalCols = new Set((field.columns || []).filter((c) => c.optional).map((c) => c.key));
        let sawUsedRow = false;
        let incomplete = null;

        Array.from(wrap.querySelectorAll("tbody tr")).forEach((tr, idx) => {
          const cells = (field.columns || []).map((c) => ({
            col: c,
            val: (tr.querySelector(`[data-col="${c.key}"]`)?.value || "").trim(),
          }));
          if (!cells.some((x) => x.val !== "")) return;
          sawUsedRow = true;

          const gap = cells.find((x) => !optionalCols.has(x.col.key) && x.val === "");
          if (gap && !incomplete) {
            const rowName = field.rowLabels?.[idx] ? `${field.rowLabels[idx]} row` : `row ${idx + 1}`;
            incomplete = `${field.label} (${rowName} — ${gap.col.label})`;
          }
        });

        if (!sawUsedRow) missing.push(field.label);
        else if (incomplete) missing.push(incomplete);
        return;
      }

      if (field.type === "radio") {
        if (!container.querySelector(`input[type="radio"][data-field="${field.key}"]:checked`)) {
          missing.push(field.label);
        }
        return;
      }

      if (field.type === "checks") return;

      const el = container.querySelector(`[data-field="${field.key}"]`);
      if (el && !el.disabled && !(el.value || "").trim()) missing.push(field.label);
    });

    return missing;
  }

  return {
    sections: SECTIONS,
    notesSection: NOTES_SECTION,
    syncToStudentRecord: SYNC_TO_STUDENT_RECORD,
    fieldHtml,
    collectSection,
    applyFieldStates,
    handleChecksChange,
    validateSection,
    formatPhone,
    isValidEmail,
  };
})();
