frappe.pages["customization-manager"].on_page_load = function (wrapper) {
	new CustomizationManagerPage(wrapper);
};

class CustomizationManagerPage {
	constructor(wrapper) {
		this.wrapper = wrapper;
		this.ensureStylesheet();
		this.page = frappe.ui.make_app_page({
			parent: wrapper,
			title: __("Customization Manager"),
			single_column: true,
		});
		this.state = {
			doctypes: [],
			seedDataDoctypes: [],
			workflows: [],
			printFormats: [],
			selectedDoctypes: new Set(),
			selectedDataDoctypes: new Set(),
			selectedWorkflows: new Set(),
			selectedPrintFormats: new Set(),
			doctypeSearch: "",
			dataSearch: "",
			workflowSearch: "",
			printFormatSearch: "",
			loadedFile: null,
			loadedBundleText: "",
			loadedBundleMeta: null,
			restoreReport: null,
			pendingFieldResolution: null,
		};
		this.renderShell();
		this.bindEvents();
		this.loadDoctypes();
		this.loadSeedDataDoctypes();
		this.loadWorkflows();
		this.loadPrintFormats();
		this.loadLogs();
	}

	ensureStylesheet() {
		const existing = document.getElementById("customization-manager-page-css");
		if (existing) {
			return;
		}

		const link = document.createElement("link");
		link.id = "customization-manager-page-css";
		link.rel = "stylesheet";
		link.href = "/assets/customization_manager/css/customization_manager.css?v=cm-ui-v6";
		document.head.appendChild(link);
	}

	renderShell() {
		const main = this.wrapper.querySelector(".layout-main-section");
		main.innerHTML = `
			<div data-role="dashboard-root" style="display:flex;flex-direction:column;gap:18px;">
				${this.renderHero()}
				<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:18px;align-items:start;">
					${this.renderExportSection()}
					${this.renderRestoreSection()}
				</div>
				${this.renderActivitySection()}
			</div>
		`;
	}

	renderHero() {
		return `
			<section class="cm-card cm-section cm-hero-card cm-card-hero">
				<div class="cm-hero-grid">
					<div class="cm-hero-copy" style="max-width:720px;">
						<div class="cm-kicker">${this.renderInlineIcon("spark")} ${__("Configuration Migration Dashboard")}</div>
						<div class="cm-title">${__("Move customizations and seed data with confidence")}</div>
						<div class="cm-subtitle">
							${__(
								"Export the setup you want, preview the impact, then restore it on another site without guessing what happens next."
							)}
						</div>
						<div class="cm-workflow-strip">
							${this.renderWorkflowCard("layers", __("Choose"), __("Pick the customizations and safe setup data your target site really needs."), "01")}
							${this.renderWorkflowCard("preview", __("Preview"), __("Load the bundle, inspect what is inside it, and dry run before writing changes."), "02")}
							${this.renderWorkflowCard("rocket", __("Apply"), __("Run the restore once you are confident, then review the activity log for traceability."), "03")}
						</div>
						<div class="cm-pill-row" style="margin-top:14px;">
							<span class="cm-chip cm-chip-soft">${this.renderInlineIcon("shield")} ${__("Dry-run first")}</span>
							<span class="cm-chip cm-chip-soft">${this.renderInlineIcon("database")} ${__("Seed data is optional")}</span>
							<span class="cm-chip cm-chip-soft">${this.renderInlineIcon("lock")} ${__("Transactions excluded")}</span>
						</div>
					</div>
					<div class="cm-hero-side-wrap">
						<div class="cm-hero-illustration" aria-hidden="true">
							<div class="cm-hero-orb cm-hero-orb-a"></div>
							<div class="cm-hero-orb cm-hero-orb-b"></div>
							<div class="cm-hero-orb cm-hero-orb-c"></div>
							<div class="cm-hero-grid-icon">${this.getIconMarkup("constellation")}</div>
						</div>
						<div class="cm-pill-row cm-hero-side">
						${this.renderHeroStat(__("Selected Customizations"), this.state.selectedDoctypes.size)}
						${this.renderHeroStat(__("Selected Seed Data"), this.state.selectedDataDoctypes.size)}
						${this.renderHeroStat(__("Bundle Ready"), this.state.loadedBundleText ? __("Yes") : __("No"))}
						</div>
					</div>
				</div>
			</section>
		`;
	}

	renderHeroStat(label, value) {
		return `
			<div class="cm-stat-pill">
				<div class="cm-stat-label">${frappe.utils.escape_html(label)}</div>
				<div class="cm-stat-value">${frappe.utils.escape_html(String(value))}</div>
			</div>
		`;
	}

	renderExportSection() {
		return `
			<section class="cm-card cm-section cm-panel cm-card-export">
				<div>
					${this.renderRibbon(__("Step 1"), "layers", "export")}
					<div class="cm-section-title">${__("Choose what to include")}</div>
					<div class="cm-help">${__("Pick the customizations and safe seed data you want to bundle.")}</div>
				</div>
				<div class="cm-pill-row">
					<span class="cm-chip">${__("Customizations")}: ${this.state.selectedDoctypes.size}</span>
					<span class="cm-chip">${__("Seed Data")}: ${this.state.selectedDataDoctypes.size}</span>
					<span class="cm-chip">${__("Workflows")}: ${this.getFilteredWorkflowRows().filter((row) => this.state.selectedWorkflows.has(row.name)).length}</span>
					<span class="cm-chip">${__("Print Formats")}: ${this.getFilteredPrintFormatRows().filter((row) => this.state.selectedPrintFormats.has(row.name)).length}</span>
				</div>
				${this.renderCustomizationsSubsection()}
				${this.renderSeedDataSubsection()}
				${this.renderExportOptionsSubsection()}
			</section>
		`;
	}

	renderCustomizationsSubsection() {
		return `
			<div class="cm-subsection">
				<div class="cm-subsection-head">
					<div>
						<div class="cm-subsection-title">${this.renderInlineIcon("sliders")} ${__("Customizations")}</div>
						<div class="cm-help">${__("Custom fields and property-driven changes grouped by DocType.")}</div>
					</div>
					<button class="btn btn-default btn-sm" data-action="toggle-selection">${this.getToggleLabel("customization")}</button>
				</div>
				<div class="cm-search">
					<input type="text" class="form-control" data-role="doctype-search" placeholder="${__(
						"Search customization doctypes"
					)}" value="${frappe.utils.escape_html(this.state.doctypeSearch)}">
				</div>
				<div data-role="doctype-list" class="cm-list">
					<div class="cm-empty">${__("Loading customized doctypes...")}</div>
				</div>
			</div>
		`;
	}

	renderSeedDataSubsection() {
		return `
			<div class="cm-subsection">
				<div class="cm-subsection-head">
					<div>
						<div class="cm-subsection-title">${this.renderInlineIcon("database")} ${__("Seed Data")}</div>
						<div class="cm-help">${__("Setup and master data only. Transactions stay out of this bundle.")}</div>
					</div>
					<button class="btn btn-default btn-sm" data-action="toggle-data-selection">${this.getToggleLabel("data")}</button>
				</div>
				<div class="cm-search">
					<input type="text" class="form-control" data-role="data-search" placeholder="${__(
						"Search seed data doctypes"
					)}" value="${frappe.utils.escape_html(this.state.dataSearch)}">
				</div>
				<div data-role="data-doctype-list" class="cm-list">
					<div class="cm-empty">${__("Loading seed data doctypes...")}</div>
				</div>
			</div>
		`;
	}

	renderExportOptionsSubsection() {
		return `
			<div class="cm-subsection">
				${this.renderRibbon(__("Step 2"), "spark", "options")}
				<div class="cm-subsection-title">${this.renderInlineIcon("wand")} ${__("Review export options")}</div>
				<div class="cm-help">${__("Pick the extra records you want in the bundle, then download one portable JSON file.")}</div>
				<div class="cm-pair-grid">
					${this.renderWorkflowSelectionSubsection()}
					${this.renderPrintFormatSelectionSubsection()}
				</div>
				<div style="margin-top:12px;">
					<label style="display:block;margin-bottom:6px;font-weight:600;">${__("Version Notes")}</label>
					<input type="text" data-role="notes" class="form-control" placeholder="${__(
						"Example: UAT bundle for branch rollout"
					)}">
				</div>
				<div class="cm-action-row" style="justify-content:space-between;margin-top:16px;">
					<div class="cm-muted" style="font-size:13px;">${__(
						"Your export will include customization settings plus any selected seed data."
					)}</div>
					<button class="btn btn-primary" data-action="export">${__("Download Bundle")}</button>
				</div>
			</div>
		`;
	}

	renderWorkflowSelectionSubsection() {
		return `
			<div class="cm-subsection cm-embedded-panel">
				<div class="cm-subsection-head">
					<div>
						<div class="cm-subsection-title">${this.renderInlineIcon("flow")} ${__("Workflow selection")}</div>
						<div class="cm-help">${__("Choose which workflows to include for the selected doctypes.")}</div>
					</div>
					<button class="btn btn-default btn-sm" data-action="toggle-workflow-selection">${this.getToggleLabel("workflow")}</button>
				</div>
				<div class="cm-search">
					<input type="text" class="form-control" data-role="workflow-search" placeholder="${__(
						"Search workflows"
					)}" value="${frappe.utils.escape_html(this.state.workflowSearch)}">
				</div>
				<div data-role="workflow-list" class="cm-list cm-list-compact">
					${this.renderLoadingEmptyState(__("Loading workflows..."), __("Fetching workflow options from this site."), "flow")}
				</div>
			</div>
		`;
	}

	renderPrintFormatSelectionSubsection() {
		return `
			<div class="cm-subsection cm-embedded-panel">
				<div class="cm-subsection-head">
					<div>
						<div class="cm-subsection-title">${this.renderInlineIcon("printer")} ${__("Print format selection")}</div>
						<div class="cm-help">${__("Choose which custom print formats should travel with this bundle.")}</div>
					</div>
					<button class="btn btn-default btn-sm" data-action="toggle-print-format-selection">${this.getToggleLabel("print_format")}</button>
				</div>
				<div class="cm-search">
					<input type="text" class="form-control" data-role="print-format-search" placeholder="${__(
						"Search print formats"
					)}" value="${frappe.utils.escape_html(this.state.printFormatSearch)}">
				</div>
				<div data-role="print-format-list" class="cm-list cm-list-compact">
					${this.renderLoadingEmptyState(__("Loading print formats..."), __("Fetching custom print formats from this site."), "printer")}
				</div>
			</div>
		`;
	}

	renderRestoreSection() {
		return `
			<section class="cm-card cm-section cm-panel cm-card-restore">
				<div>
					${this.renderRibbon(__("Step 3"), "preview", "restore")}
					<div class="cm-section-title">${__("Preview before you restore")}</div>
					<div class="cm-help">${__("Upload a bundle, check what it contains, then run a dry run before any live changes.")}</div>
				</div>
				<div data-role="drop-zone" class="cm-dropzone">
					<div class="cm-dropzone-title">${__("Drop your bundle here")}</div>
					<div class="cm-muted">${__("JSON files only. You can also choose a file manually below.")}</div>
				</div>
				<input type="file" data-role="file-input" accept=".json,application/json" class="form-control">
				<div data-role="bundle-preview" class="cm-preview">
					${this.renderBundlePreview()}
				</div>
				<div class="cm-options-grid">
					<label class="cm-check">
						<input type="checkbox" data-role="dry-run" checked>
						<span>${__("Preview first with dry run")}</span>
					</label>
				</div>
				<div class="cm-action-row" style="justify-content:space-between;">
					<div class="cm-muted" style="font-size:13px;">${__(
						"Dry run is recommended for every new environment."
					)}</div>
					<button class="btn btn-primary" data-action="restore" disabled>${__("Run Restore")}</button>
				</div>
				<div data-role="restore-result">
					${this.renderRestoreResultContent()}
				</div>
			</section>
		`;
	}

	renderBundlePreview() {
		const meta = this.state.loadedBundleMeta;
		if (!this.state.loadedFile) {
			return `
				${this.renderEmptyState(
					__("No file loaded yet"),
					__("Once you choose a bundle, this area will show the file name and what the bundle contains."),
					"bundle"
				)}
			`;
		}

		return `
			<div style="font-weight:700;">${frappe.utils.escape_html(this.state.loadedFile.name || __("Selected file"))}</div>
			<div class="cm-drop-meta" style="margin-top:8px;">
				<span class="cm-chip">${__("Bundle")}: ${meta ? __("Recognized") : __("Loaded")}</span>
				${meta ? `<span class="cm-chip">${__("Version")}: ${frappe.utils.escape_html(meta.version || "-")}</span>` : ""}
				${meta ? `<span class="cm-chip">${__("Exported By")}: ${frappe.utils.escape_html(meta.exported_by || "-")}</span>` : ""}
			</div>
			${meta ? `<div class="cm-help" style="margin-top:10px;">${this.getBundleSummaryText(meta)}</div>` : ""}
		`;
	}

	renderRestoreResultContent() {
		if (!this.state.restoreReport) {
			return `
				<div class="cm-subsection" style="margin-top:4px;">
					<div class="cm-subsection-title">${this.renderInlineIcon("chart")} ${__("Restore summary")}</div>
					<div class="cm-help">${__("After dry run or restore, the results will appear here in a readable summary.")}</div>
				</div>
			`;
		}

		const report = this.state.restoreReport;
		const sectionTitles = {
			custom_fields: __("Custom Fields"),
			property_setters: __("Property Setters"),
			workflows: __("Workflows"),
			print_formats: __("Print Formats"),
			client_scripts: __("Client Scripts"),
		};
		const configCards = Object.keys(sectionTitles)
			.map((key) => this.renderResultCard(sectionTitles[key], report[key]))
			.join("");

		const dataReport = report.data || { created: 0, updated: 0, skipped: 0, errors: [], by_doctype: {} };
		const dataCards = [
			this.renderResultCard(__("Seed Data Overview"), dataReport),
			...Object.keys(dataReport.by_doctype || {}).map((doctype) =>
				this.renderResultCard(doctype, dataReport.by_doctype[doctype])
			),
		].join("");

		return `
			<div class="cm-subsection">
				<div class="cm-subsection-title">${this.renderInlineIcon("chart")} ${__("Restore summary")}</div>
				<div class="cm-help">${__("Use this to confirm what changed, what already existed, and where any errors happened.")}</div>
				<div style="margin-top:14px;font-weight:700;">${__("Customization Results")}</div>
				<div class="cm-result-grid">${configCards}</div>
				<div style="margin-top:14px;font-weight:700;">${__("Seed Data Results")}</div>
				<div class="cm-result-grid">${dataCards}</div>
			</div>
		`;
	}

	renderResultCard(title, section) {
		const safeSection = section || { created: 0, updated: 0, skipped: 0, errors: [] };
		const errors = safeSection.errors || [];
		return `
			<div class="cm-result-card">
				<div class="cm-result-title">${frappe.utils.escape_html(title)}</div>
				<div class="cm-result-stats">
					<div>${__("Created")}: ${safeSection.created || 0}</div>
					<div>${__("Updated")}: ${safeSection.updated || 0}</div>
					<div>${__("Skipped")}: ${safeSection.skipped || 0}</div>
					<div>${__("Errors")}: ${errors.length}</div>
				</div>
				${errors.length ? `<div class="cm-errors">${frappe.utils.escape_html(errors.join(" | "))}</div>` : ""}
			</div>
		`;
	}

	renderActivitySection() {
		return `
			<section class="cm-card cm-section cm-card-activity">
				<div class="cm-header-row" style="justify-content:space-between;">
					<div>
						${this.renderRibbon(__("Activity"), "history", "activity")}
						<div class="cm-section-title">${__("Recent export and restore history")}</div>
						<div class="cm-help">${__("Review the latest bundle activity so your team can track what ran and when.")}</div>
					</div>
					<button class="btn btn-default btn-sm" data-action="refresh-logs">${__("Refresh")}</button>
				</div>
				<div data-role="log-table" class="cm-table-wrap">
					<div class="cm-empty">${__("Loading activity...")}</div>
				</div>
			</section>
		`;
	}

	bindEvents() {
		this.wrapper.querySelector('[data-action="toggle-selection"]').addEventListener("click", () => {
			const allSelected =
				this.state.doctypes.length && this.state.selectedDoctypes.size === this.state.doctypes.length;
			this.state.selectedDoctypes = allSelected
				? new Set()
				: new Set(this.state.doctypes.map((row) => row.doctype));
			this.refreshDashboardState();
		});

		this.wrapper.querySelector('[data-action="toggle-data-selection"]').addEventListener("click", () => {
			const allSelected =
				this.state.seedDataDoctypes.length &&
				this.state.selectedDataDoctypes.size === this.state.seedDataDoctypes.length;
			this.state.selectedDataDoctypes = allSelected
				? new Set()
				: new Set(this.state.seedDataDoctypes.map((row) => row.doctype));
			this.refreshDashboardState();
		});

		this.wrapper.querySelector('[data-action="toggle-workflow-selection"]').addEventListener("click", () => {
			const rows = this.getFilteredWorkflowRows();
			const allSelected = rows.length && rows.every((row) => this.state.selectedWorkflows.has(row.name));
			rows.forEach((row) => {
				if (allSelected) {
					this.state.selectedWorkflows.delete(row.name);
				} else {
					this.state.selectedWorkflows.add(row.name);
				}
			});
			this.refreshDashboardState();
		});

		this.wrapper.querySelector('[data-action="toggle-print-format-selection"]').addEventListener("click", () => {
			const rows = this.getFilteredPrintFormatRows();
			const allSelected = rows.length && rows.every((row) => this.state.selectedPrintFormats.has(row.name));
			rows.forEach((row) => {
				if (allSelected) {
					this.state.selectedPrintFormats.delete(row.name);
				} else {
					this.state.selectedPrintFormats.add(row.name);
				}
			});
			this.refreshDashboardState();
		});

		this.wrapper.querySelector('[data-action="export"]').addEventListener("click", () => this.handleExport());
		this.wrapper.querySelector('[data-action="restore"]').addEventListener("click", () => this.handleRestore());
		this.wrapper.querySelector('[data-action="refresh-logs"]').addEventListener("click", () => this.loadLogs());

		this.wrapper.querySelector('[data-role="doctype-search"]').addEventListener("input", (event) => {
			this.state.doctypeSearch = event.target.value || "";
			this.renderDoctypeList();
		});

		this.wrapper.querySelector('[data-role="data-search"]').addEventListener("input", (event) => {
			this.state.dataSearch = event.target.value || "";
			this.renderSeedDataList();
		});

		this.wrapper.querySelector('[data-role="workflow-search"]').addEventListener("input", (event) => {
			this.state.workflowSearch = event.target.value || "";
			this.renderWorkflowList();
		});

		this.wrapper.querySelector('[data-role="print-format-search"]').addEventListener("input", (event) => {
			this.state.printFormatSearch = event.target.value || "";
			this.renderPrintFormatList();
		});

		const fileInput = this.wrapper.querySelector('[data-role="file-input"]');
		fileInput.addEventListener("change", (event) => {
			const [file] = event.target.files || [];
			this.loadFile(file);
		});

		const dropZone = this.wrapper.querySelector('[data-role="drop-zone"]');
		dropZone.addEventListener("dragover", (event) => {
			event.preventDefault();
			dropZone.style.borderColor = "var(--primary)";
			dropZone.style.background = "color-mix(in srgb, var(--primary) 6%, var(--control-bg))";
		});
		dropZone.addEventListener("dragleave", () => {
			dropZone.style.borderColor = "var(--border-color)";
			dropZone.style.background = "var(--control-bg)";
		});
		dropZone.addEventListener("drop", (event) => {
			event.preventDefault();
			dropZone.style.borderColor = "var(--border-color)";
			dropZone.style.background = "var(--control-bg)";
			const [file] = event.dataTransfer.files || [];
			this.loadFile(file);
		});
	}

	refreshDashboardState() {
		this.updateHero();
		this.updateToggleButtons();
		this.renderDoctypeList();
		this.renderSeedDataList();
		this.renderWorkflowList();
		this.renderPrintFormatList();
	}

	updateHero() {
		const root = this.wrapper.querySelector('[data-role="dashboard-root"]');
		if (!root) {
			return;
		}
		const hero = root.querySelector(".cm-card");
		if (hero) {
			hero.outerHTML = this.renderHero();
		}
	}

	updateToggleButtons() {
		const customizationToggle = this.wrapper.querySelector('[data-action="toggle-selection"]');
		if (customizationToggle) {
			customizationToggle.textContent = this.getToggleLabel("customization");
		}

		const dataToggle = this.wrapper.querySelector('[data-action="toggle-data-selection"]');
		if (dataToggle) {
			dataToggle.textContent = this.getToggleLabel("data");
		}

		const workflowToggle = this.wrapper.querySelector('[data-action="toggle-workflow-selection"]');
		if (workflowToggle) {
			workflowToggle.textContent = this.getToggleLabel("workflow");
		}

		const printFormatToggle = this.wrapper.querySelector('[data-action="toggle-print-format-selection"]');
		if (printFormatToggle) {
			printFormatToggle.textContent = this.getToggleLabel("print_format");
		}
	}

	getToggleLabel(type) {
		if (type === "workflow") {
			const rows = this.getFilteredWorkflowRows();
			return rows.length && rows.every((row) => this.state.selectedWorkflows.has(row.name))
				? __("Deselect All")
				: __("Select All");
		}

		if (type === "print_format") {
			const rows = this.getFilteredPrintFormatRows();
			return rows.length && rows.every((row) => this.state.selectedPrintFormats.has(row.name))
				? __("Deselect All")
				: __("Select All");
		}

		if (type === "data") {
			return this.state.seedDataDoctypes.length &&
				this.state.selectedDataDoctypes.size === this.state.seedDataDoctypes.length
				? __("Deselect All")
				: __("Select All");
		}

		return this.state.doctypes.length && this.state.selectedDoctypes.size === this.state.doctypes.length
			? __("Deselect All")
			: __("Select All");
	}

	async loadDoctypes() {
		try {
			const response = await frappe.call({
				method: "customization_manager.api.get_customized_doctypes",
			});
			this.state.doctypes = response.message || [];
			this.state.selectedDoctypes = new Set(this.state.doctypes.map((row) => row.doctype));
			this.refreshDashboardState();
		} catch (error) {
			this.showAlert(__("Unable to load customized doctypes."), "red");
		}
	}

	async loadSeedDataDoctypes() {
		try {
			const response = await frappe.call({
				method: "customization_manager.api.get_exportable_data_doctypes",
			});
			this.state.seedDataDoctypes = response.message || [];
			this.refreshDashboardState();
		} catch (error) {
			this.showAlert(__("Unable to load seed data doctypes."), "red");
		}
	}

	async loadWorkflows() {
		try {
			const response = await frappe.call({
				method: "customization_manager.api.get_available_workflows",
			});
			this.state.workflows = response.message || [];
			this.state.selectedWorkflows = new Set(this.state.workflows.map((row) => row.name));
			this.refreshDashboardState();
		} catch (error) {
			this.showAlert(__("Unable to load workflows."), "red");
		}
	}

	async loadPrintFormats() {
		try {
			const response = await frappe.call({
				method: "customization_manager.api.get_available_print_formats",
			});
			this.state.printFormats = response.message || [];
			this.state.selectedPrintFormats = new Set(this.state.printFormats.map((row) => row.name));
			this.refreshDashboardState();
		} catch (error) {
			this.showAlert(__("Unable to load print formats."), "red");
		}
	}

	renderDoctypeList() {
		const container = this.wrapper.querySelector('[data-role="doctype-list"]');
		if (!container) {
			return;
		}

		const rows = this.getFilteredRows(this.state.doctypes, this.state.doctypeSearch);
		if (!this.state.doctypes.length) {
			container.innerHTML = this.renderEmptyState(
				__("No customizations found yet"),
				__("Create custom fields or property setters first, then they will appear here for export."),
				"sliders"
			);
			return;
		}

		if (!rows.length) {
			container.innerHTML = this.renderEmptyState(
				__("No matches"),
				__("Try a different DocType name in the customization search."),
				"search"
			);
			return;
		}

		container.innerHTML = rows
			.map((row) => this.renderOptionRow({
				id: row.doctype,
				title: row.doctype,
				meta: `${__("Custom Fields")}: ${row.custom_fields} • ${__("Property Setters")}: ${row.property_setters}`,
				selected: this.state.selectedDoctypes.has(row.doctype),
				attr: "data-doctype",
			}))
			.join("");

		container.querySelectorAll("input[type='checkbox']").forEach((checkbox) => {
			checkbox.addEventListener("change", (event) => {
				const doctype = event.target.getAttribute("data-doctype");
				if (event.target.checked) {
					this.state.selectedDoctypes.add(doctype);
				} else {
					this.state.selectedDoctypes.delete(doctype);
				}
				this.refreshDashboardState();
			});
		});
	}

	renderSeedDataList() {
		const container = this.wrapper.querySelector('[data-role="data-doctype-list"]');
		if (!container) {
			return;
		}

		const rows = this.getFilteredRows(this.state.seedDataDoctypes, this.state.dataSearch);
		if (!this.state.seedDataDoctypes.length) {
			container.innerHTML = this.renderEmptyState(
				__("No seed data doctypes are available"),
				__("Only supported setup and master doctypes are shown here."),
				"database"
			);
			return;
		}

		if (!rows.length) {
			container.innerHTML = this.renderEmptyState(
				__("No matches"),
				__("Try a different setup or master doctype in the search."),
				"search"
			);
			return;
		}

		container.innerHTML = rows
			.map((row) => this.renderOptionRow({
				id: row.doctype,
				title: row.doctype,
				meta: `${__("Records")}: ${row.record_count}`,
				selected: this.state.selectedDataDoctypes.has(row.doctype),
				attr: "data-data-doctype",
			}))
			.join("");

		container.querySelectorAll("input[type='checkbox']").forEach((checkbox) => {
			checkbox.addEventListener("change", (event) => {
				const doctype = event.target.getAttribute("data-data-doctype");
				if (event.target.checked) {
					this.state.selectedDataDoctypes.add(doctype);
				} else {
					this.state.selectedDataDoctypes.delete(doctype);
				}
				this.refreshDashboardState();
			});
		});
	}

	renderWorkflowList() {
		const container = this.wrapper.querySelector('[data-role="workflow-list"]');
		if (!container) {
			return;
		}

		const rows = this.getFilteredWorkflowRows();
		if (!this.state.workflows.length) {
			container.innerHTML = this.renderEmptyState(
				__("No workflows available"),
				__("Workflows tied to your selected doctypes will appear here when they exist."),
				"flow"
			);
			return;
		}

		if (!rows.length) {
			container.innerHTML = this.renderEmptyState(
				__("No workflows match"),
				__("Adjust the selected doctypes or search term to show more workflow options."),
				"flow"
			);
			return;
		}

		container.innerHTML = rows
			.map((row) =>
				this.renderOptionRow({
					id: row.name,
					title: row.name,
					meta: `${__("DocType")}: ${row.doctype} • ${row.is_active ? __("Active") : __("Inactive")}`,
					selected: this.state.selectedWorkflows.has(row.name),
					attr: "data-workflow",
					icon: "flow",
				})
			)
			.join("");

		container.querySelectorAll("input[type='checkbox']").forEach((checkbox) => {
			checkbox.addEventListener("change", (event) => {
				const name = event.target.getAttribute("data-workflow");
				if (event.target.checked) {
					this.state.selectedWorkflows.add(name);
				} else {
					this.state.selectedWorkflows.delete(name);
				}
				this.refreshDashboardState();
			});
		});
	}

	renderPrintFormatList() {
		const container = this.wrapper.querySelector('[data-role="print-format-list"]');
		if (!container) {
			return;
		}

		const rows = this.getFilteredPrintFormatRows();
		if (!this.state.printFormats.length) {
			container.innerHTML = this.renderEmptyState(
				__("No print formats available"),
				__("Custom print formats tied to your selected doctypes will appear here."),
				"printer"
			);
			return;
		}

		if (!rows.length) {
			container.innerHTML = this.renderEmptyState(
				__("No print formats match"),
				__("Adjust the selected doctypes or search term to show more print format options."),
				"printer"
			);
			return;
		}

		container.innerHTML = rows
			.map((row) =>
				this.renderOptionRow({
					id: row.name,
					title: row.name,
					meta: `${__("DocType")}: ${row.doctype} • ${row.disabled ? __("Disabled") : __("Enabled")}`,
					selected: this.state.selectedPrintFormats.has(row.name),
					attr: "data-print-format",
					icon: "printer",
				})
			)
			.join("");

		container.querySelectorAll("input[type='checkbox']").forEach((checkbox) => {
			checkbox.addEventListener("change", (event) => {
				const name = event.target.getAttribute("data-print-format");
				if (event.target.checked) {
					this.state.selectedPrintFormats.add(name);
				} else {
					this.state.selectedPrintFormats.delete(name);
				}
				this.refreshDashboardState();
			});
		});
	}

	renderOptionRow({ id, title, meta, selected, attr, icon }) {
		const selectedClass = selected ? "cm-option-selected" : "";
		const checked = selected ? "checked" : "";
		const rowIcon = icon || (attr === "data-data-doctype" ? "database" : "sliders");
		return `
			<label class="cm-option ${selectedClass}">
				<input type="checkbox" ${attr}="${frappe.utils.escape_html(id)}" ${checked}>
				<span class="cm-option-content">
					<span class="cm-option-main">
						<span class="cm-option-icon">${this.getIconMarkup(rowIcon)}</span>
						<span class="cm-option-title">${frappe.utils.escape_html(title)}</span>
						<span class="cm-option-meta">${frappe.utils.escape_html(meta)}</span>
					</span>
					<span class="cm-option-badge">${selected ? __("Included") : __("Optional")}</span>
				</span>
			</label>
		`;
	}

	getFilteredRows(rows, query) {
		const trimmed = (query || "").trim().toLowerCase();
		if (!trimmed) {
			return rows;
		}

		return rows.filter((row) => (row.doctype || "").toLowerCase().includes(trimmed));
	}

	getFilteredWorkflowRows() {
		const selectedDoctypes = this.state.selectedDoctypes;
		const filtered = this.state.workflows.filter((row) => !selectedDoctypes.size || selectedDoctypes.has(row.doctype));
		const query = (this.state.workflowSearch || "").trim().toLowerCase();
		if (!query) {
			return filtered;
		}
		return filtered.filter(
			(row) =>
				(row.name || "").toLowerCase().includes(query) || (row.doctype || "").toLowerCase().includes(query)
		);
	}

	getFilteredPrintFormatRows() {
		const selectedDoctypes = this.state.selectedDoctypes;
		const filtered = this.state.printFormats.filter(
			(row) => !selectedDoctypes.size || selectedDoctypes.has(row.doctype)
		);
		const query = (this.state.printFormatSearch || "").trim().toLowerCase();
		if (!query) {
			return filtered;
		}
		return filtered.filter(
			(row) =>
				(row.name || "").toLowerCase().includes(query) || (row.doctype || "").toLowerCase().includes(query)
		);
	}

	async handleExport() {
		const selected = Array.from(this.state.selectedDoctypes);
		const selectedDataDoctypes = Array.from(this.state.selectedDataDoctypes);
		const selectedWorkflows = this.getFilteredWorkflowRows()
			.filter((row) => this.state.selectedWorkflows.has(row.name))
			.map((row) => row.name);
		const selectedPrintFormats = this.getFilteredPrintFormatRows()
			.filter((row) => this.state.selectedPrintFormats.has(row.name))
			.map((row) => row.name);
		const notes = this.wrapper.querySelector('[data-role="notes"]').value || "";

		try {
			const response = await frappe.call({
				method: "customization_manager.api.export_bundle",
				args: {
					doctypes: selected.length ? JSON.stringify(selected) : null,
					include_workflows: selectedWorkflows.length ? 1 : 0,
					include_print_formats: selectedPrintFormats.length ? 1 : 0,
					notes,
					data_doctypes: selectedDataDoctypes.length ? JSON.stringify(selectedDataDoctypes) : null,
					workflows: selectedWorkflows.length ? JSON.stringify(selectedWorkflows) : null,
					print_formats: selectedPrintFormats.length ? JSON.stringify(selectedPrintFormats) : null,
				},
				freeze: true,
				freeze_message: __("Preparing bundle..."),
			});

			const bundle = response.message || {};
			const jsonText = JSON.stringify(bundle, null, 2);
			const filename = `customization_bundle_${frappe.datetime.now_date()}.json`;
			const blob = new Blob([jsonText], { type: "application/json" });
			const url = window.URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = filename;
			anchor.click();
			window.URL.revokeObjectURL(url);

			this.showAlert(__("Bundle exported successfully."), "green");
			this.loadLogs();
		} catch (error) {
			this.showAlert(__("Bundle export failed."), "red");
		}
	}

	loadFile(file) {
		if (!file) {
			return;
		}

		const reader = new FileReader();
		reader.onload = () => {
			this.state.loadedFile = file;
			this.state.loadedBundleText = reader.result;
			this.state.restoreReport = null;
			this.state.loadedBundleMeta = this.parseBundleMeta(reader.result);
			this.updateBundlePreview();
			this.updateRestoreButtonState();
			this.updateHero();
			this.updateRestoreResult();
		};
		reader.onerror = () => this.showAlert(__("Could not read the selected file."), "red");
		reader.readAsText(file);
	}

	parseBundleMeta(bundleText) {
		try {
			const parsed = JSON.parse(bundleText || "{}");
			if (!parsed || typeof parsed !== "object") {
				return null;
			}
			return parsed.meta || {
				version: parsed.version || "",
			};
		} catch (error) {
			return null;
		}
	}

	getBundleSummaryText(meta) {
		const bundle = this.safeParseBundle();
		if (!bundle) {
			return __("The file is loaded, but its bundle preview could not be fully read.");
		}

		const summaryParts = [];
		if ((bundle.custom_fields || []).length || (bundle.property_setters || []).length) {
			summaryParts.push(
				__(
					"Customization content is present with {0} custom fields and {1} property setters."
				)
					.replace("{0}", (bundle.custom_fields || []).length)
					.replace("{1}", (bundle.property_setters || []).length)
			);
		}
		if ((bundle.data || []).length) {
			summaryParts.push(
				__(
					"Seed data is present for {0} doctypes."
				).replace("{0}", (bundle.data || []).length)
			);
		}
		if ((bundle.workflows || []).length) {
			summaryParts.push(__("Workflows included: {0}.").replace("{0}", (bundle.workflows || []).length));
		}
		if ((bundle.print_formats || []).length) {
			summaryParts.push(__("Print formats included: {0}.").replace("{0}", (bundle.print_formats || []).length));
		}
		if (!summaryParts.length) {
			summaryParts.push(__("The bundle is loaded and ready for preview or restore."));
		}
		return summaryParts.join(" ");
	}

	safeParseBundle() {
		try {
			return JSON.parse(this.state.loadedBundleText || "{}");
		} catch (error) {
			return null;
		}
	}

	updateBundlePreview() {
		const target = this.wrapper.querySelector('[data-role="bundle-preview"]');
		if (target) {
			target.innerHTML = this.renderBundlePreview();
		}
	}

	updateRestoreButtonState() {
		const button = this.wrapper.querySelector('[data-action="restore"]');
		if (button) {
			button.disabled = !this.state.loadedBundleText;
		}
	}

	handleRestore() {
		if (!this.state.loadedBundleText) {
			return;
		}

		this.prepareRestoreFlow();
	}

	async prepareRestoreFlow() {
		try {
			const response = await frappe.call({
				method: "customization_manager.api.analyze_bundle_compatibility",
				args: {
					bundle_json: this.state.loadedBundleText,
				},
				freeze: true,
				freeze_message: __("Checking bundle compatibility..."),
			});
			const analysis = response.message || {};
			if (analysis.has_issues) {
				this.openFieldResolutionDialog(analysis);
				return;
			}
			this.confirmAndRestore({}, {});
		} catch (error) {
			this.showAlert(__("Could not analyze bundle compatibility."), "red");
		}
	}

	confirmAndRestore(fieldMapping, generatedFields) {
		const dryRun = this.wrapper.querySelector('[data-role="dry-run"]').checked;
		const message = dryRun
			? __("Run a dry-run preview? No changes will be written to this site.")
			: __("Run a live restore? This will create and update customizations and seed data on this site.");

		frappe.confirm(message, () => this.executeRestore(dryRun, fieldMapping, generatedFields));
	}

	openFieldResolutionDialog(analysis) {
		const dialog = new frappe.ui.Dialog({
			title: __("Resolve Missing Fields"),
			size: "extra-large",
			fields: [
				{
					fieldtype: "HTML",
					fieldname: "content",
				},
			],
			primary_action_label: __("Continue Restore"),
			primary_action: () => {
				const resolution = this.collectFieldResolution(dialog, analysis);
				dialog.hide();
				this.confirmAndRestore(resolution.fieldMapping, resolution.generatedFields);
			},
		});

		dialog.fields_dict.content.$wrapper.html(this.renderFieldResolutionDialog(analysis));
		dialog.show();
	}

	renderFieldResolutionDialog(analysis) {
		const sections = (analysis.missing_fields || [])
			.map((section) => {
				const rows = (section.fields || [])
					.map((field) => {
						const options = [
							{
								value: field.has_bundle_custom_field ? "bundle" : "create",
								label: field.has_bundle_custom_field ? __("Use bundle field") : __("Create new field"),
							},
							{ value: "skip", label: __("Skip this field") },
							...(section.available_fields || []).map((candidate) => ({
								value: `map:${candidate.fieldname}`,
								label: `${__("Map to")}: ${candidate.label} (${candidate.fieldname})`,
							})),
						];
						return `
							<tr>
								<td style="font-weight:600;">${frappe.utils.escape_html(field.label || field.fieldname)}</td>
								<td><code>${frappe.utils.escape_html(field.fieldname)}</code></td>
								<td>${frappe.utils.escape_html(field.sample_value || "-")}</td>
								<td>${field.has_bundle_custom_field ? `<span class="cm-chip">${__("Bundle field available")}</span>` : `<span class="cm-chip">${__("No field on target")}</span>`}</td>
								<td>
									<select class="form-control" data-role="field-resolution" data-doctype="${frappe.utils.escape_html(
										section.doctype
									)}" data-fieldname="${frappe.utils.escape_html(field.fieldname)}">
										${options
											.map(
												(option) =>
													`<option value="${frappe.utils.escape_html(option.value)}">${frappe.utils.escape_html(option.label)}</option>`
											)
											.join("")}
									</select>
								</td>
							</tr>
						`;
					})
					.join("");

				return `
					<div class="cm-resolution-block">
						<div class="cm-subsection-title">${this.renderInlineIcon("chart")} ${frappe.utils.escape_html(section.doctype)}</div>
						<div class="cm-help" style="margin-bottom:10px;">${__(
							"These fields appear in incoming data but do not exist on this site yet."
						)}</div>
						<div class="cm-resolution-table">
							<table class="table table-bordered">
								<thead>
									<tr>
										<th>${__("Label")}</th>
										<th>${__("Incoming Field")}</th>
										<th>${__("Sample Value")}</th>
										<th>${__("Status")}</th>
										<th>${__("Action")}</th>
									</tr>
								</thead>
								<tbody>${rows}</tbody>
							</table>
						</div>
					</div>
				`;
			})
			.join("");

		return `
			<div class="cm-resolution-wrap">
				<div class="cm-help" style="margin-bottom:14px;">
					${__(
						"Review each missing field before restore. You can use a bundled field definition, create a new field, skip it, or map the incoming value to an existing field."
					)}
				</div>
				${sections}
			</div>
		`;
	}

	collectFieldResolution(dialog) {
		const fieldMapping = {};
		const generatedFields = {};
		const wrapper = dialog.$wrapper && dialog.$wrapper.get ? dialog.$wrapper.get(0) : null;
		const selects = wrapper ? wrapper.querySelectorAll('[data-role="field-resolution"]') : [];

		selects.forEach((element) => {
			const doctype = element.getAttribute("data-doctype");
			const fieldname = element.getAttribute("data-fieldname");
			const value = element.value;

			if (!doctype || !fieldname || !value || value === "bundle" || value === "skip") {
				if (value === "create") {
					if (!generatedFields[doctype]) {
						generatedFields[doctype] = [];
					}
					generatedFields[doctype].push(fieldname);
				}
				return;
			}

			if (value === "create") {
				if (!generatedFields[doctype]) {
					generatedFields[doctype] = [];
				}
				generatedFields[doctype].push(fieldname);
				return;
			}

			if (value.startsWith("map:")) {
				if (!fieldMapping[doctype]) {
					fieldMapping[doctype] = {};
				}
				fieldMapping[doctype][fieldname] = value.replace("map:", "");
			}
		});

		return { fieldMapping, generatedFields };
	}

	async executeRestore(dryRun, fieldMapping, generatedFields) {
		try {
			const response = await frappe.call({
				method: "customization_manager.api.restore_bundle",
				args: {
					bundle_json: this.state.loadedBundleText,
					dry_run: dryRun ? 1 : 0,
					field_mapping: JSON.stringify(fieldMapping || {}),
					generated_fields: JSON.stringify(generatedFields || {}),
				},
				freeze: true,
				freeze_message: dryRun ? __("Running dry run...") : __("Applying bundle..."),
			});
			this.state.restoreReport = response.message || {};
			this.updateRestoreResult();
			this.showAlert(dryRun ? __("Dry run completed.") : __("Restore completed."), dryRun ? "blue" : "green");
			this.loadLogs();
		} catch (error) {
			this.showAlert(__("Restore failed."), "red");
		}
	}

	updateRestoreResult() {
		const target = this.wrapper.querySelector('[data-role="restore-result"]');
		if (target) {
			target.innerHTML = this.renderRestoreResultContent();
		}
	}

	async loadLogs() {
		const target = this.wrapper.querySelector('[data-role="log-table"]');
		if (target) {
			target.innerHTML = `<div class="cm-empty">${__("Loading activity...")}</div>`;
		}

		try {
			const response = await frappe.call({
				method: "frappe.client.get_list",
				args: {
					doctype: "Bundle Log",
					fields: ["action", "status", "details", "user", "timestamp"],
					order_by: "timestamp desc",
					limit_page_length: 10,
				},
			});
			const rows = response.message || [];
			if (!rows.length) {
				target.innerHTML = this.renderEmptyState(
					__("No export or restore activity yet"),
					__("Once your team runs exports or restores, the latest ten entries will show up here."),
					"history"
				);
				return;
			}

			target.innerHTML = `
				<table class="table table-bordered" style="margin:0;">
					<thead>
						<tr>
							<th>${__("Timestamp")}</th>
							<th>${__("Action")}</th>
							<th>${__("Status")}</th>
							<th>${__("User")}</th>
							<th>${__("Details")}</th>
						</tr>
					</thead>
					<tbody>
						${rows
							.map((row) => {
								const badge = this.getStatusBadge(row.status);
								return `
									<tr>
										<td>${frappe.datetime.str_to_user(row.timestamp)}</td>
										<td>${frappe.utils.escape_html(row.action || "")}</td>
										<td>${badge}</td>
										<td>${frappe.utils.escape_html(row.user || "")}</td>
										<td>${frappe.utils.escape_html(row.details || "")}</td>
									</tr>
								`;
							})
							.join("")}
					</tbody>
				</table>
			`;
		} catch (error) {
			target.innerHTML = `<div class="cm-empty" style="color:var(--red-600, #d9534f);">${__(
				"Could not load recent activity."
			)}</div>`;
		}
	}

	getStatusBadge(status) {
		const colorMap = {
			Success: "var(--green-600, #28a745)",
			"Dry Run": "var(--blue-600, #0d6efd)",
			Error: "var(--red-600, #d9534f)",
		};
		const color = colorMap[status] || "var(--text-muted)";
		return `<span style="display:inline-block;padding:4px 8px;border-radius:999px;background:${color};color:var(--neutral-white, #fff);font-size:12px;">${frappe.utils.escape_html(status || "")}</span>`;
	}

	showAlert(message, indicator) {
		frappe.show_alert({ message, indicator });
	}

	renderWorkflowCard(icon, title, text, stepNumber) {
		return `
			<div class="cm-workflow-card">
				<div class="cm-workflow-topline">
					<div class="cm-workflow-icon">${this.getIconMarkup(icon)}</div>
					<div class="cm-workflow-stepno">${frappe.utils.escape_html(stepNumber)}</div>
				</div>
				<div class="cm-workflow-title">${frappe.utils.escape_html(title)}</div>
				<div class="cm-workflow-text">${frappe.utils.escape_html(text)}</div>
			</div>
		`;
	}

	renderRibbon(label, icon, tone) {
		return `<div class="cm-ribbon cm-ribbon-${frappe.utils.escape_html(tone)}">${this.renderInlineIcon(icon)} ${frappe.utils.escape_html(label)}</div>`;
	}

	renderInlineIcon(icon) {
		return `<span class="cm-inline-icon" aria-hidden="true">${this.getIconMarkup(icon)}</span>`;
	}

	renderEmptyState(title, text, icon) {
		return `
			<div class="cm-empty-state">
				<div class="cm-empty-art">
					<div class="cm-empty-bubble cm-empty-bubble-a"></div>
					<div class="cm-empty-bubble cm-empty-bubble-b"></div>
					<div class="cm-empty-symbol">${this.getIconMarkup(icon)}</div>
				</div>
				<div class="cm-empty-title">${frappe.utils.escape_html(title)}</div>
				<div class="cm-empty-copy">${frappe.utils.escape_html(text)}</div>
			</div>
		`;
	}

	renderLoadingEmptyState(title, text, icon) {
		return `${this.renderEmptyState(title, text, icon)}`;
	}

	getIconMarkup(icon) {
		const icons = {
			spark: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M18 15l.9 2.4L21.3 18l-2.4.9L18 21l-.9-2.1L14.7 18l2.4-.6L18 15z" fill="currentColor"/></svg>',
			layers: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 4l8 4-8 4-8-4 8-4z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M4 12l8 4 8-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 16l8 4 8-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
			preview: '<svg viewBox="0 0 24 24" fill="none"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/></svg>',
			rocket: '<svg viewBox="0 0 24 24" fill="none"><path d="M14 4c3.5 0 6 2.5 6 6 0 4-4 7-8 10-1.3-2.1-3-5-3-8 0-3.5 2.5-8 5-8z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 15l-4 4M8 10l-4-1 1-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="15" cy="9" r="1.5" fill="currentColor"/></svg>',
			shield: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3l7 3v5c0 4.5-2.6 7.7-7 10-4.4-2.3-7-5.5-7-10V6l7-3z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9.5 12.2l1.8 1.8 3.4-4.1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
			database: '<svg viewBox="0 0 24 24" fill="none"><ellipse cx="12" cy="6" rx="7" ry="3" stroke="currentColor" stroke-width="1.8"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" stroke="currentColor" stroke-width="1.8"/><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" stroke="currentColor" stroke-width="1.8"/></svg>',
			lock: '<svg viewBox="0 0 24 24" fill="none"><rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M8 10V7.8C8 5.7 9.8 4 12 4s4 1.7 4 3.8V10" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="15" r="1.2" fill="currentColor"/></svg>',
			sliders: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 7h8M15 7h5M4 17h5M12 17h8M10 4v6M14 14v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="7" r="2" fill="currentColor"/><circle cx="14" cy="17" r="2" fill="currentColor"/></svg>',
			wand: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 20l9-9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M13 5l1-2 1 2 2 1-2 1-1 2-1-2-2-1 2-1zM18 11l.7-1.4L20 11l1.4.7L20 12.4 18.7 14 18 12.4l-1.4-.7L18 11z" fill="currentColor"/><path d="M10 14l-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
			chart: '<svg viewBox="0 0 24 24" fill="none"><path d="M5 19V9M12 19V5M19 19v-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M4 19h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
			history: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 12a8 8 0 108-8 8.4 8.4 0 00-5.8 2.3L4 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 4v4h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 8v4l2.5 1.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
			flow: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="7" height="5" rx="1.8" stroke="currentColor" stroke-width="1.8"/><rect x="14" y="4" width="7" height="5" rx="1.8" stroke="currentColor" stroke-width="1.8"/><rect x="8.5" y="15" width="7" height="5" rx="1.8" stroke="currentColor" stroke-width="1.8"/><path d="M6.5 9v3h11V9M12 12v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
			printer: '<svg viewBox="0 0 24 24" fill="none"><path d="M7 8V4h10v4" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><rect x="4" y="8" width="16" height="8" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M7 13h10v7H7z" stroke="currentColor" stroke-width="1.8"/><circle cx="17" cy="11" r="1" fill="currentColor"/></svg>',
			search: '<svg viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="1.8"/><path d="M16 16l4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
			bundle: '<svg viewBox="0 0 24 24" fill="none"><path d="M6 7.5h12M8 4h8l1 3.5H7L8 4z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><rect x="4" y="7.5" width="16" height="12.5" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M10 11.5h4M10 15h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
			constellation: '<svg viewBox="0 0 120 120" fill="none"><circle cx="24" cy="24" r="7" fill="currentColor"/><circle cx="84" cy="30" r="6" fill="currentColor"/><circle cx="60" cy="60" r="9" fill="currentColor"/><circle cx="94" cy="82" r="7" fill="currentColor"/><circle cx="28" cy="88" r="6" fill="currentColor"/><path d="M24 24l36 36 24-30 10 52-66 6 32-28" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/></svg>',
		};
		return icons[icon] || icons.spark;
	}
}
