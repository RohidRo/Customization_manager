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
			activeTab: "export",
			activeSection: "doctypes",
			exportNotes: "",
			includePermissions: false,
			dryRun: true,
			restoreSections: new Set(["custom_fields","property_setters","workflows","print_formats","client_scripts","form_layouts","notifications","custom_docperms","data"]),
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
		const VERSION = "cm-ui-v13";
		const STYLE_ID = "customization-manager-inline-css";
		let style = document.getElementById(STYLE_ID);
		if (!style) {
			style = document.createElement("style");
			style.id = STYLE_ID;
			document.head.appendChild(style);
		}
		style.textContent = `
			[data-role="dashboard-root"]{--cm-sky:#0ea5e9;--cm-sky-hover:#0284c7;--cm-sky-dim:rgba(14,165,233,.10);--cm-sky-mid:rgba(14,165,233,.22);--cm-cyan:#38bdf8;--cm-cyan-dim:rgba(56,189,248,.15);--cm-cyan-mid:rgba(56,189,248,.30);--cm-bg:#f0f9ff;--cm-surface:#fff;--cm-surface-2:#f8fafc;--cm-surface-3:#e0f2fe;--cm-text:#0c4a6e;--cm-text-2:#475569;--cm-text-3:#94a3b8;--cm-border:rgba(14,165,233,.14);--cm-border-2:rgba(14,165,233,.24);--cm-shadow-card:0 1px 3px rgba(14,165,233,.05),0 4px 14px rgba(14,165,233,.07);--cm-green:#10b981;--cm-red:#ef4444;--cm-blue:#0ea5e9}
			[data-role="dashboard-root"] .cm-app-shell{display:grid;grid-template-columns:220px 1fr;height:78vh;min-height:520px;max-height:880px;background:var(--cm-surface);border:1px solid var(--cm-border);border-radius:18px;box-shadow:var(--cm-shadow-card);overflow:hidden}
			[data-role="dashboard-root"] .cm-sidebar{display:flex;flex-direction:column;background:var(--cm-surface-2);border-right:1px solid var(--cm-border);overflow:hidden}
			[data-role="dashboard-root"] .cm-sidebar-brand{display:flex;align-items:center;gap:12px;padding:18px 16px 14px;border-bottom:1px solid var(--cm-border);flex-shrink:0}
			[data-role="dashboard-root"] .cm-brand-icon{width:36px;height:36px;border-radius:10px;background:var(--cm-sky-dim);border:1px solid var(--cm-border-2);display:flex;align-items:center;justify-content:center;color:var(--cm-sky);flex-shrink:0}
			[data-role="dashboard-root"] .cm-brand-icon svg{width:18px;height:18px}
			[data-role="dashboard-root"] .cm-brand-title{font-size:13px;font-weight:700;color:var(--cm-text);line-height:1.35}
			[data-role="dashboard-root"] .cm-sidebar-nav{flex:1;padding:10px 8px;display:flex;flex-direction:column;gap:2px;overflow-y:auto}
			[data-role="dashboard-root"] .cm-nav-group-label{font-size:10px;font-weight:700;color:var(--cm-text-3);text-transform:uppercase;letter-spacing:.08em;padding:6px 8px 2px;margin-bottom:2px}
			[data-role="dashboard-root"] .cm-nav-item{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:10px;border:none;background:transparent;color:var(--cm-text-2);font-size:13px;font-weight:500;cursor:pointer;text-align:left;width:100%;transition:background .15s,color .15s}
			[data-role="dashboard-root"] .cm-nav-item:hover{background:var(--cm-sky-dim);color:var(--cm-sky-hover)}
			[data-role="dashboard-root"] .cm-nav-item.cm-nav-active{background:var(--cm-sky-mid);color:var(--cm-sky-hover);font-weight:700}
			[data-role="dashboard-root"] .cm-nav-sub{padding-left:14px}
			[data-role="dashboard-root"] .cm-nav-label{flex:1;text-align:left}
			[data-role="dashboard-root"] .cm-nav-badge{flex-shrink:0;font-size:11px;font-weight:700;padding:2px 7px;border-radius:999px;background:var(--cm-surface-3);color:var(--cm-text-3);min-width:22px;text-align:center;transition:background .15s,color .15s}
			[data-role="dashboard-root"] .cm-nav-item.cm-nav-active .cm-nav-badge{background:var(--cm-sky);color:#fff}
			[data-role="dashboard-root"] .cm-nav-divider{height:1px;background:var(--cm-border);margin:6px 0}
			[data-role="dashboard-root"] .cm-sidebar-footer{padding:14px 16px;border-top:1px solid var(--cm-border);flex-shrink:0}
			[data-role="dashboard-root"] .cm-sidebar-summary{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:4px}
			[data-role="dashboard-root"] .cm-sidebar-label{font-size:11px;font-weight:600;color:var(--cm-text-2);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:4px}
			[data-role="dashboard-root"] .cm-main-panel{display:flex;flex-direction:column;overflow:hidden;background:var(--cm-surface)}
			[data-role="dashboard-root"] .cm-panel-header{padding:20px 24px 14px;border-bottom:1px solid var(--cm-border);flex-shrink:0}
			[data-role="dashboard-root"] .cm-panel-header-row{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
			[data-role="dashboard-root"] .cm-panel-title{font-size:15px;font-weight:700;color:var(--cm-text);display:flex;align-items:center;gap:8px;margin-bottom:4px}
			[data-role="dashboard-root"] .cm-panel-toolbar{display:flex;align-items:center;gap:10px;padding:10px 24px;border-bottom:1px solid var(--cm-border);background:var(--cm-surface-2);flex-shrink:0}
			[data-role="dashboard-root"] .cm-panel-toolbar .form-control{flex:1}
			[data-role="dashboard-root"] .cm-panel-body{flex:1;overflow-y:auto;padding:14px 24px}
			[data-role="dashboard-root"] .cm-panel-list{display:flex;flex-direction:column;gap:4px}
			[data-role="dashboard-root"] .cm-help,[data-role="dashboard-root"] .cm-muted{font-size:12px;color:var(--cm-text-2);line-height:1.55}
			[data-role="dashboard-root"] .form-control{background:var(--cm-surface);border:1px solid var(--cm-border-2);border-radius:10px;color:var(--cm-text);font-size:13px}
			[data-role="dashboard-root"] .form-control:focus{border-color:var(--cm-sky);box-shadow:0 0 0 3px var(--cm-sky-dim);outline:none}
			[data-role="dashboard-root"] .cm-option{display:flex;align-items:center;padding:9px 12px;border-radius:10px;border:1px solid var(--cm-border);background:var(--cm-surface);cursor:pointer;transition:background .15s,border-color .15s;gap:10px}
			[data-role="dashboard-root"] .cm-option:hover,[data-role="dashboard-root"] .cm-option-selected{background:var(--cm-sky-dim);border-color:var(--cm-sky)}
			[data-role="dashboard-root"] .cm-option-content{flex:1;display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0}
			[data-role="dashboard-root"] .cm-option-main{display:flex;align-items:center;gap:8px;min-width:0}
			[data-role="dashboard-root"] .cm-option-icon{width:28px;height:28px;border-radius:8px;background:var(--cm-surface-3);border:1px solid var(--cm-border);display:flex;align-items:center;justify-content:center;color:var(--cm-text-2);flex-shrink:0;transition:background .15s,color .15s}
			[data-role="dashboard-root"] .cm-option-selected .cm-option-icon{background:var(--cm-sky-mid);color:var(--cm-sky-hover);border-color:var(--cm-sky)}
			[data-role="dashboard-root"] .cm-option-icon svg{width:13px;height:13px}
			[data-role="dashboard-root"] .cm-option-title{font-size:13px;font-weight:600;color:var(--cm-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
			[data-role="dashboard-root"] .cm-option-meta{font-size:11px;color:var(--cm-text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}
			[data-role="dashboard-root"] .cm-option-badge{flex-shrink:0;font-size:11px;font-weight:600;padding:3px 9px;border-radius:999px;background:var(--cm-surface-3);color:var(--cm-text-3);border:1px solid var(--cm-border)}
			[data-role="dashboard-root"] .cm-option-selected .cm-option-badge{background:var(--cm-sky-mid);color:var(--cm-sky-hover);border-color:var(--cm-sky)}
			[data-role="dashboard-root"] .cm-chip{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:999px;background:var(--cm-sky-dim);border:1px solid var(--cm-border-2);color:var(--cm-sky-hover);font-size:12px;font-weight:600}
			[data-role="dashboard-root"] .cm-chip-gold{background:var(--cm-cyan-dim);color:var(--cm-sky-hover);border-color:var(--cm-cyan)}
			[data-role="dashboard-root"] .cm-card{position:relative;background:var(--cm-surface);border:1px solid var(--cm-border);border-radius:18px;box-shadow:var(--cm-shadow-card);color:var(--cm-text)}
			[data-role="dashboard-root"] .cm-check{display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:var(--cm-text);font-weight:500}
			[data-role="dashboard-root"] .cm-action-row{display:flex;align-items:center;flex-wrap:wrap;gap:10px}
			[data-role="dashboard-root"] .cm-dropzone{border:2px dashed var(--cm-border-2);border-radius:14px;padding:28px 20px;text-align:center;background:var(--cm-surface-2);cursor:pointer;transition:border-color .18s,background .18s}
			[data-role="dashboard-root"] .cm-dropzone:hover,[data-role="dashboard-root"] .cm-dropzone-active{border-color:var(--cm-sky);background:var(--cm-sky-dim)}
			[data-role="dashboard-root"] .cm-dropzone-title{font-weight:700;color:var(--cm-text);margin-bottom:6px;font-size:14px}
			[data-role="dashboard-root"] .cm-preview{padding:14px;border-radius:14px;background:var(--cm-surface-2);border:1px solid var(--cm-border);min-height:80px;display:flex;flex-direction:column;gap:10px}
			[data-role="dashboard-root"] .cm-preview-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:8px}
			[data-role="dashboard-root"] .cm-preview-field{background:var(--cm-surface);border:1px solid var(--cm-border);border-radius:10px;padding:10px 12px}
			[data-role="dashboard-root"] .cm-preview-label{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--cm-text-3);font-weight:600}
			[data-role="dashboard-root"] .cm-preview-value{font-size:13px;font-weight:600;color:var(--cm-text);margin-top:3px;word-break:break-word}
			[data-role="dashboard-root"] .cm-drop-meta{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
			[data-role="dashboard-root"] .cm-restore-layout{display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:start;margin-bottom:18px}
			[data-role="dashboard-root"] .cm-subsection{border-radius:14px;border:1px solid var(--cm-border);background:var(--cm-surface-2);margin-top:14px;overflow:hidden;padding:14px}
			[data-role="dashboard-root"] .cm-subsection-title{font-size:13px;font-weight:700;color:var(--cm-text);display:flex;align-items:center;gap:6px;margin-bottom:6px}
			[data-role="dashboard-root"] .cm-result-banner{display:flex;gap:14px;padding:16px 20px;border-radius:14px;border:1px solid var(--cm-border);background:var(--cm-surface-2);margin-bottom:14px}
			[data-role="dashboard-root"] .cm-result-banner-success{border-left:4px solid var(--cm-green)}
			[data-role="dashboard-root"] .cm-result-banner-warning{border-left:4px solid var(--cm-cyan)}
			[data-role="dashboard-root"] .cm-result-banner-error{border-left:4px solid var(--cm-red)}
			[data-role="dashboard-root"] .cm-result-banner-stat{text-align:center;min-width:60px}
			[data-role="dashboard-root"] .cm-result-banner-num{font-size:26px;font-weight:800;color:var(--cm-text);line-height:1}
			[data-role="dashboard-root"] .cm-result-banner-lbl{font-size:11px;color:var(--cm-text-3);margin-top:3px;font-weight:600;text-transform:uppercase;letter-spacing:.04em}
			[data-role="dashboard-root"] .cm-result-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px;margin-top:10px}
			[data-role="dashboard-root"] .cm-result-card{padding:13px 13px 13px 16px;border-radius:12px;border:1px solid var(--cm-border);background:var(--cm-surface);position:relative;overflow:hidden}
			[data-role="dashboard-root"] .cm-result-card::before{content:"";position:absolute;inset:0 auto 0 0;width:3px;background:linear-gradient(180deg,var(--cm-sky),var(--cm-cyan))}
			[data-role="dashboard-root"] .cm-result-title{font-weight:700;margin-bottom:6px;color:var(--cm-text);font-size:12px}
			[data-role="dashboard-root"] .cm-result-stats{font-size:12px;color:var(--cm-text-2);line-height:1.75}
			[data-role="dashboard-root"] .cm-errors{margin-top:8px;font-size:11px;color:var(--cm-red);font-weight:600}
			[data-role="dashboard-root"] .cm-table-wrap{border:1px solid var(--cm-border);border-radius:12px;overflow:auto;background:var(--cm-surface)}
			[data-role="dashboard-root"] .cm-table-wrap table{margin:0}
			[data-role="dashboard-root"] .cm-table-wrap table thead th{background:var(--cm-sky-dim);color:var(--cm-text);border-color:var(--cm-border-2);font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.05em}
			[data-role="dashboard-root"] .cm-table-wrap table tbody td{background:var(--cm-surface);color:var(--cm-text);border-color:var(--cm-border);font-size:13px}
			[data-role="dashboard-root"] .cm-table-wrap table tbody tr:nth-child(even) td{background:var(--cm-surface-2)}
			[data-role="dashboard-root"] .cm-table-wrap table tbody tr:hover td{background:var(--cm-sky-dim)}
			[data-role="dashboard-root"] .cm-badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;border:1px solid}
			[data-role="dashboard-root"] .cm-badge-success{background:rgba(16,185,129,.12);color:var(--cm-green);border-color:rgba(16,185,129,.30)}
			[data-role="dashboard-root"] .cm-badge-dryrun{background:rgba(14,165,233,.10);color:var(--cm-sky);border-color:rgba(14,165,233,.28)}
			[data-role="dashboard-root"] .cm-badge-error{background:rgba(239,68,68,.10);color:var(--cm-red);border-color:rgba(239,68,68,.28)}
			[data-role="dashboard-root"] .cm-inline-icon,[data-role="dashboard-root"] .cm-option-icon,[data-role="dashboard-root"] .cm-workflow-icon{display:inline-flex;align-items:center;justify-content:center}
			[data-role="dashboard-root"] .cm-inline-icon svg{width:15px;height:15px;vertical-align:middle}
			[data-role="dashboard-root"] .cm-empty{padding:14px;border-radius:12px;border:1px dashed var(--cm-border-2);background:var(--cm-surface-2);color:var(--cm-text-3);font-size:13px;text-align:center}
			[data-role="dashboard-root"] .cm-empty-state{display:flex;flex-direction:column;align-items:center;gap:10px;padding:24px 18px;border-radius:14px;border:1.5px dashed var(--cm-border-2);background:var(--cm-surface-2);text-align:center}
			[data-role="dashboard-root"] .cm-empty-art{position:relative;width:72px;height:72px;border-radius:20px;background:var(--cm-surface-3);border:1px solid var(--cm-border-2);overflow:hidden}
			[data-role="dashboard-root"] .cm-empty-bubble{position:absolute;border-radius:999px}
			[data-role="dashboard-root"] .cm-empty-bubble-a{top:10px;left:10px;width:26px;height:26px;background:var(--cm-sky-mid);animation:cmBubble 6s ease-in-out infinite}
			[data-role="dashboard-root"] .cm-empty-bubble-b{right:8px;bottom:10px;width:18px;height:18px;background:var(--cm-cyan-mid);animation:cmBubbleAlt 7s ease-in-out infinite}
			[data-role="dashboard-root"] .cm-empty-symbol{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--cm-text-2)}
			[data-role="dashboard-root"] .cm-empty-symbol svg{width:26px;height:26px}
			[data-role="dashboard-root"] .cm-empty-title{font-size:13px;font-weight:700;color:var(--cm-text)}
			[data-role="dashboard-root"] .cm-empty-copy{max-width:28ch;font-size:12px;line-height:1.6;color:var(--cm-text-2)}
			[data-role="dashboard-root"] .cm-ribbon{display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.03em;margin-bottom:8px}
			[data-role="dashboard-root"] .cm-card .btn{border-radius:10px;font-weight:600;font-size:13px;transition:transform .18s,box-shadow .18s,background .18s}
			[data-role="dashboard-root"] .cm-card .btn-primary,[data-role="dashboard-root"] .cm-sidebar-footer .btn-primary{background:var(--cm-sky);border-color:transparent;color:#fff;box-shadow:0 3px 10px rgba(14,165,233,.30);border-radius:10px;font-weight:600;font-size:13px}
			[data-role="dashboard-root"] .cm-card .btn-primary:hover,[data-role="dashboard-root"] .cm-sidebar-footer .btn-primary:hover{background:var(--cm-sky-hover);color:#fff}
			[data-role="dashboard-root"] .cm-panel-body .btn-primary{background:var(--cm-sky);border-color:transparent;color:#fff;border-radius:10px;font-weight:600;font-size:13px}
			[data-role="dashboard-root"] .cm-panel-toolbar .btn-default{background:var(--cm-surface);color:var(--cm-text-2);border:1px solid var(--cm-border-2);border-radius:10px;font-weight:600;font-size:12px}
			[data-role="dashboard-root"] .cm-panel-toolbar .btn-default:hover{border-color:var(--cm-sky);color:var(--cm-sky-hover);background:var(--cm-sky-dim)}
			[data-role="dashboard-root"] .cm-bundle-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;border-radius:10px;border:1px solid var(--cm-border);background:var(--cm-surface);margin-bottom:6px}
			[data-role="dashboard-root"] .cm-bundle-main{flex:1;min-width:0}
			[data-role="dashboard-root"] .cm-section-checks{display:flex;flex-wrap:wrap;gap:4px 0}
			.cm-fm-alert{border-radius:10px;padding:10px 14px;font-size:13px;line-height:1.55;margin-bottom:10px}
			.cm-fm-alert-green{background:rgba(16,185,129,.10);border:1px solid rgba(16,185,129,.30);color:var(--text-color)}
			.cm-fm-alert-yellow{background:rgba(234,179,8,.10);border:1px solid rgba(234,179,8,.35);color:var(--text-color)}
			.cm-fm-alert-red{background:rgba(239,68,68,.10);border:1px solid rgba(239,68,68,.30);color:var(--text-color)}
			.cm-fm-block{border:1px solid var(--border-color);border-radius:10px;overflow:hidden;margin-bottom:14px}
			.cm-fm-block-header{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--subtle-fg);border-bottom:1px solid var(--border-color)}
			.cm-fm-block-title{font-size:13px;font-weight:700;display:flex;align-items:center;gap:6px}
			.cm-fm-block-badges{display:flex;gap:5px;align-items:center;flex-shrink:0}
			.cm-fm-badge{display:inline-flex;align-items:center;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:700;border:1px solid}
			.cm-fm-badge-ok{background:rgba(16,185,129,.12);color:#059669;border-color:rgba(16,185,129,.30)}
			.cm-fm-badge-missing{background:rgba(239,68,68,.10);color:#dc2626;border-color:rgba(239,68,68,.28)}
			.cm-fm-body{padding:12px 14px}
			.cm-fm-table{width:100%;border-collapse:collapse;font-size:12px}
			.cm-fm-table th{padding:6px 10px;background:var(--subtle-fg);color:var(--text-muted);font-weight:600;text-transform:uppercase;font-size:10px;letter-spacing:.05em;border-bottom:1px solid var(--border-color);text-align:left}
			.cm-fm-table td{padding:6px 10px;border-bottom:1px solid var(--table-border-color);vertical-align:middle}
			.cm-fm-table tr:last-child td{border-bottom:none}
			.cm-fm-row-missing td{background:rgba(239,68,68,.04)}
			.cm-fm-pill-ok{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:999px;background:rgba(16,185,129,.12);color:#059669;border:1px solid rgba(16,185,129,.28);font-size:11px;font-weight:600}
			.cm-fm-pill-missing{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:999px;background:rgba(239,68,68,.10);color:#dc2626;border:1px solid rgba(239,68,68,.25);font-size:11px;font-weight:600}
			@keyframes cmBubble{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-5px) scale(1.06)}}
			@keyframes cmBubbleAlt{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(4px) scale(.94)}}
			@media(max-width:900px){[data-role="dashboard-root"] .cm-app-shell{grid-template-columns:1fr;height:auto}[data-role="dashboard-root"] .cm-sidebar{border-right:none;border-bottom:1px solid var(--cm-border)}[data-role="dashboard-root"] .cm-sidebar-nav{flex-direction:row;flex-wrap:wrap;padding:8px}[data-role="dashboard-root"] .cm-nav-group-label,[data-role="dashboard-root"] .cm-nav-divider{display:none}[data-role="dashboard-root"] .cm-nav-sub{padding-left:10px}[data-role="dashboard-root"] .cm-restore-layout{grid-template-columns:1fr}[data-role="dashboard-root"] .cm-preview-grid{grid-template-columns:1fr}}
		`;
		const href = `/assets/customization_manager/css/customization_manager.css?v=${VERSION}`;
		let link = document.getElementById("customization-manager-page-css");
		if (!link) {
			link = document.createElement("link");
			link.id = "customization-manager-page-css";
			link.rel = "stylesheet";
			document.head.appendChild(link);
		}
		if (link.getAttribute("href") !== href) {
			link.href = href;
		}
	}

	// ─── Shell ───────────────────────────────────────────────────────────────

	renderShell() {
		const main =
			this.wrapper.querySelector(".layout-main-section") ||
			(this.page && this.page.main && this.page.main[0]) ||
			this.wrapper;
		main.innerHTML = `
			<div data-role="dashboard-root">
				<div class="cm-app-shell">
					<aside class="cm-sidebar" data-role="sidebar">
						${this.renderSidebar()}
					</aside>
					<div class="cm-main-panel" data-role="main-panel">
						${this.renderMainPanel()}
					</div>
				</div>
			</div>
		`;
	}

	// ─── Sidebar ─────────────────────────────────────────────────────────────

	renderSidebar() {
		const t = this.state.activeTab;
		const s = this.state.activeSection;

		const subItem = (section, icon, label, count) => {
			const active = t === "export" && s === section;
			return `
				<button class="cm-nav-item cm-nav-sub${active ? " cm-nav-active" : ""}"
				        data-action="switch-section" data-section="${section}">
					${this.renderInlineIcon(icon)}
					<span class="cm-nav-label">${label}</span>
					<span class="cm-nav-badge" data-badge-section="${section}">${count}</span>
				</button>
			`;
		};

		const topItem = (tab, icon, label) => {
			const active = t === tab;
			return `
				<button class="cm-nav-item${active ? " cm-nav-active" : ""}"
				        data-action="switch-tab" data-tab="${tab}">
					${this.renderInlineIcon(icon)}
					<span class="cm-nav-label">${label}</span>
				</button>
			`;
		};

		return `
			<div class="cm-sidebar-brand">
				<div class="cm-brand-icon">${this.getIconMarkup("layers")}</div>
				<div class="cm-brand-title">Customization<br>Manager</div>
			</div>
			<nav class="cm-sidebar-nav">
				<div class="cm-nav-group-label">${__("Export")}</div>
				${subItem("doctypes", "sliders", __("DocTypes"), this.state.selectedDoctypes.size)}
				${subItem("seed-data", "database", __("Seed Data"), this.state.selectedDataDoctypes.size)}
				${subItem("workflows", "flow", __("Workflows"), this.state.selectedWorkflows.size)}
				${subItem("print-formats", "printer", __("Print Formats"), this.state.selectedPrintFormats.size)}
				<div class="cm-nav-divider"></div>
				${topItem("restore", "preview", __("Restore Bundle"))}
				${topItem("activity", "history", __("Activity"))}
				${topItem("bundles", "bundle", __("Bundles"))}
			</nav>
			${t === "export" ? this.renderSidebarFooter() : ""}
		`;
	}

	renderSidebarFooter() {
		return `
			<div class="cm-sidebar-footer">
				<div class="cm-sidebar-summary" data-role="sidebar-summary">
					<span class="cm-chip">${__("DocTypes")}: ${this.state.selectedDoctypes.size}</span>
					<span class="cm-chip">${__("Data")}: ${this.state.selectedDataDoctypes.size}</span>
				</div>
				<div style="margin-top:12px;">
					<label class="cm-sidebar-label">${__("Version Notes")}</label>
					<input type="text" data-role="notes" class="form-control" style="font-size:12px;"
					       value="${frappe.utils.escape_html(this.state.exportNotes)}"
					       placeholder="${__("e.g. UAT bundle")}">
				</div>
				<div style="margin-top:10px;">
					<label class="cm-check" style="font-size:12px;">
						<input type="checkbox" data-role="include-permissions"
						       ${this.state.includePermissions ? "checked" : ""}>
						<span>${__("Include Permissions")}</span>
					</label>
				</div>
				<div style="margin-top:14px;">
					<button class="btn btn-primary" data-action="export" style="width:100%;display:flex;align-items:center;justify-content:center;gap:6px;">
						${this.renderInlineIcon("rocket")} ${__("Download Bundle")}
					</button>
				</div>
			</div>
		`;
	}

	// ─── Main Panel ──────────────────────────────────────────────────────────

	renderMainPanel() {
		const t = this.state.activeTab;
		if (t === "restore") return this.renderRestoreContent();
		if (t === "activity") return this.renderActivityContent();
		if (t === "bundles") return this.renderBundlesContent();
		return this.renderExportContent();
	}

	renderExportContent() {
		const configs = {
			"doctypes": {
				icon: "sliders",
				title: __("DocTypes"),
				help: __("Select the customized DocTypes to include in this bundle."),
				toggleAction: "toggle-selection",
				toggleType: "customization",
				searchRole: "doctype-search",
				searchPlaceholder: __("Search DocTypes..."),
				searchStateKey: "doctypeSearch",
				listRole: "doctype-list",
			},
			"seed-data": {
				icon: "database",
				title: __("Seed Data"),
				help: __("Select master / setup data to bundle. Transactions are never exported."),
				toggleAction: "toggle-data-selection",
				toggleType: "data",
				searchRole: "data-search",
				searchPlaceholder: __("Search Seed Data..."),
				searchStateKey: "dataSearch",
				listRole: "data-doctype-list",
			},
			"workflows": {
				icon: "flow",
				title: __("Workflows"),
				help: __("Choose which workflows to include for the selected DocTypes."),
				toggleAction: "toggle-workflow-selection",
				toggleType: "workflow",
				searchRole: "workflow-search",
				searchPlaceholder: __("Search Workflows..."),
				searchStateKey: "workflowSearch",
				listRole: "workflow-list",
			},
			"print-formats": {
				icon: "printer",
				title: __("Print Formats"),
				help: __("Choose which custom print formats should travel with this bundle."),
				toggleAction: "toggle-print-format-selection",
				toggleType: "print_format",
				searchRole: "print-format-search",
				searchPlaceholder: __("Search Print Formats..."),
				searchStateKey: "printFormatSearch",
				listRole: "print-format-list",
			},
		};

		const cfg = configs[this.state.activeSection] || configs["doctypes"];

		return `
			<div class="cm-panel-header">
				<div class="cm-panel-title">${this.renderInlineIcon(cfg.icon)} ${cfg.title}</div>
				<div class="cm-help">${cfg.help}</div>
			</div>
			<div class="cm-panel-toolbar">
				<input type="text" class="form-control"
				       data-role="${cfg.searchRole}"
				       placeholder="${frappe.utils.escape_html(cfg.searchPlaceholder)}"
				       value="${frappe.utils.escape_html(this.state[cfg.searchStateKey] || "")}">
				<button class="btn btn-default btn-sm" data-action="${cfg.toggleAction}">
					${this.getToggleLabel(cfg.toggleType)}
				</button>
			</div>
			<div class="cm-panel-body">
				<div data-role="${cfg.listRole}" class="cm-panel-list">
					<div class="cm-empty">${__("Loading...")}</div>
				</div>
			</div>
		`;
	}

	renderRestoreContent() {
		return `
			<div class="cm-panel-header">
				<div class="cm-panel-title">${this.renderInlineIcon("preview")} ${__("Restore a Bundle")}</div>
				<div class="cm-help">${__("Upload a bundle, inspect its contents, then run a dry-run or live restore.")}</div>
			</div>
			<div class="cm-panel-body" style="padding:20px 24px;">
				<div class="cm-restore-sections" style="margin-bottom:18px;">
					<div class="cm-sidebar-label" style="margin-bottom:8px;">${__("Sections to restore")}</div>
					<div class="cm-section-checks">
						${[
							{key:"custom_fields", label:__("Custom Fields")},
							{key:"property_setters", label:__("Property Setters")},
							{key:"workflows", label:__("Workflows")},
							{key:"print_formats", label:__("Print Formats")},
							{key:"client_scripts", label:__("Client Scripts")},
							{key:"form_layouts", label:__("Form Layouts")},
							{key:"notifications", label:__("Notifications")},
							{key:"custom_docperms", label:__("Permissions")},
							{key:"data", label:__("Seed Data")},
						].map(s => `
							<label class="cm-check" style="font-size:12px;margin-right:16px;margin-bottom:6px;display:inline-flex;">
								<input type="checkbox" data-role="restore-section" data-section="${s.key}" ${this.state.restoreSections.has(s.key) ? "checked" : ""}>
								<span>${s.label}</span>
							</label>
						`).join("")}
					</div>
				</div>
				<div class="cm-restore-layout">
					<div>
						<div data-role="drop-zone" class="cm-dropzone">
							<div class="cm-dropzone-title">${__("Drop your bundle here")}</div>
							<div class="cm-muted">${__("JSON files only — or pick a file below.")}</div>
						</div>
						<input type="file" data-role="file-input" accept=".json,application/json"
						       class="form-control" style="margin-top:10px;">
						<div style="margin-top:14px;">
							<label class="cm-check">
								<input type="checkbox" data-role="dry-run" ${this.state.dryRun ? "checked" : ""}>
								<span>${__("Dry run first (recommended)")}</span>
							</label>
						</div>
						<div class="cm-action-row" style="margin-top:14px;justify-content:flex-end;">
							<button class="btn btn-primary" data-action="restore" ${this.state.loadedBundleText ? "" : "disabled"}>
								${__("Run Restore")}
							</button>
						</div>
					</div>
					<div data-role="bundle-preview" class="cm-preview">
						${this.renderBundlePreview()}
					</div>
				</div>
				<div data-role="restore-result">
					${this.renderRestoreResultContent()}
				</div>
			</div>
		`;
	}

	renderActivityContent() {
		return `
			<div class="cm-panel-header">
				<div class="cm-panel-header-row">
					<div>
						<div class="cm-panel-title">${this.renderInlineIcon("history")} ${__("Export & Restore Activity")}</div>
						<div class="cm-help">${__("Recent bundle operations, who ran them, and their outcome.")}</div>
					</div>
					<button class="btn btn-default btn-sm" data-action="refresh-logs">${__("Refresh")}</button>
				</div>
			</div>
			<div class="cm-panel-body">
				<div data-role="log-table" class="cm-table-wrap">
					<div class="cm-empty">${__("Loading activity...")}</div>
				</div>
			</div>
		`;
	}

	// ─── Navigation ──────────────────────────────────────────────────────────

	switchTab(tab) {
		this.state.activeTab = tab;
		this.wrapper.querySelector('[data-role="sidebar"]').innerHTML = this.renderSidebar();
		this.wrapper.querySelector('[data-role="main-panel"]').innerHTML = this.renderMainPanel();
		if (tab === "activity") {
			this.loadLogs();
		} else if (tab === "bundles") {
			this.loadBundles();
		} else if (tab === "export") {
			this._renderAllLists();
		}
	}

	switchSection(section) {
		this.state.activeTab = "export";
		this.state.activeSection = section;
		this.wrapper.querySelector('[data-role="sidebar"]').innerHTML = this.renderSidebar();
		this.wrapper.querySelector('[data-role="main-panel"]').innerHTML = this.renderMainPanel();
		this._renderAllLists();
	}

	_renderAllLists() {
		this.renderDoctypeList();
		this.renderSeedDataList();
		this.renderWorkflowList();
		this.renderPrintFormatList();
	}

	// ─── State updates ───────────────────────────────────────────────────────

	refreshDashboardState() {
		this.updateSidebarBadges();
		this.updateToggleButtons();
		this._renderAllLists();
	}

	updateSidebarBadges() {
		const items = [
			["doctypes", this.state.selectedDoctypes.size],
			["seed-data", this.state.selectedDataDoctypes.size],
			["workflows", this.state.selectedWorkflows.size],
			["print-formats", this.state.selectedPrintFormats.size],
		];
		items.forEach(([section, count]) => {
			const badge = this.wrapper.querySelector(`[data-badge-section="${section}"]`);
			if (badge) badge.textContent = count;
		});
		const summary = this.wrapper.querySelector('[data-role="sidebar-summary"]');
		if (summary) {
			summary.innerHTML = `
				<span class="cm-chip">${__("DocTypes")}: ${this.state.selectedDoctypes.size}</span>
				<span class="cm-chip">${__("Data")}: ${this.state.selectedDataDoctypes.size}</span>
			`;
		}
	}

	updateToggleButtons() {
		const map = [
			['[data-action="toggle-selection"]', "customization"],
			['[data-action="toggle-data-selection"]', "data"],
			['[data-action="toggle-workflow-selection"]', "workflow"],
			['[data-action="toggle-print-format-selection"]', "print_format"],
		];
		map.forEach(([sel, type]) => {
			const btn = this.wrapper.querySelector(sel);
			if (btn) btn.textContent = this.getToggleLabel(type);
		});
	}

	getToggleLabel(type) {
		if (type === "workflow") {
			const rows = this.getFilteredWorkflowRows();
			return rows.length && rows.every((r) => this.state.selectedWorkflows.has(r.name))
				? __("Deselect All")
				: __("Select All");
		}
		if (type === "print_format") {
			const rows = this.getFilteredPrintFormatRows();
			return rows.length && rows.every((r) => this.state.selectedPrintFormats.has(r.name))
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

	// ─── Data loading ────────────────────────────────────────────────────────

	async loadDoctypes() {
		try {
			const response = await frappe.call({
				method: "customization_manager.api.get_customized_doctypes",
			});
			this.state.doctypes = response.message || [];
			this.state.selectedDoctypes = new Set();
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
			this.state.selectedWorkflows = new Set();
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
			this.state.selectedPrintFormats = new Set();
			this.refreshDashboardState();
		} catch (error) {
			this.showAlert(__("Unable to load print formats."), "red");
		}
	}

	// ─── List renderers ──────────────────────────────────────────────────────

	renderDoctypeList() {
		const container = this.wrapper.querySelector('[data-role="doctype-list"]');
		if (!container) return;

		const rows = this.getFilteredRows(this.state.doctypes, this.state.doctypeSearch);
		if (!this.state.doctypes.length) {
			container.innerHTML = this.renderEmptyState(
				__("No customizations found yet"),
				__("Create custom fields, property setters, workflows, print formats, or client scripts — all DocTypes with any customization will appear here."),
				"sliders"
			);
			return;
		}
		if (!rows.length) {
			container.innerHTML = this.renderEmptyState(
				__("No matches"),
				__("Try a different DocType name in the search."),
				"search"
			);
			return;
		}
		container.innerHTML = rows
			.map((row) => {
				const metaParts = [
					row.custom_fields ? `${__("CF")}: ${row.custom_fields}` : null,
					row.property_setters ? `${__("PS")}: ${row.property_setters}` : null,
					row.workflows ? `${__("Workflows")}: ${row.workflows}` : null,
					row.print_formats ? `${__("Print Formats")}: ${row.print_formats}` : null,
					row.client_scripts ? `${__("Scripts")}: ${row.client_scripts}` : null,
					row.form_layouts ? `${__("Form Layouts")}: ${row.form_layouts}` : null,
					row.notifications ? `${__("Notifications")}: ${row.notifications}` : null,
				].filter(Boolean);
				return this.renderOptionRow({
					id: row.doctype,
					title: row.doctype,
					meta: metaParts.join(" • "),
					selected: this.state.selectedDoctypes.has(row.doctype),
					attr: "data-doctype",
				});
			})
			.join("");
	}

	renderSeedDataList() {
		const container = this.wrapper.querySelector('[data-role="data-doctype-list"]');
		if (!container) return;

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
			.map((row) =>
				this.renderOptionRow({
					id: row.doctype,
					title: row.doctype,
					meta: `${row.module ? row.module + " · " : ""}${__("Records")}: ${row.record_count}`,
					selected: this.state.selectedDataDoctypes.has(row.doctype),
					attr: "data-data-doctype",
				})
			)
			.join("");
	}

	renderWorkflowList() {
		const container = this.wrapper.querySelector('[data-role="workflow-list"]');
		if (!container) return;

		const rows = this.getFilteredWorkflowRows();
		if (!this.state.workflows.length) {
			container.innerHTML = this.renderEmptyState(
				__("No workflows available"),
				__("Workflows tied to your selected doctypes will appear here."),
				"flow"
			);
			return;
		}
		if (!rows.length) {
			container.innerHTML = this.renderEmptyState(
				__("No workflows match"),
				__("Adjust the selected doctypes or search term to show more."),
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
	}

	renderPrintFormatList() {
		const container = this.wrapper.querySelector('[data-role="print-format-list"]');
		if (!container) return;

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
				__("Adjust the selected doctypes or search term."),
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

	// ─── Filter helpers ───────────────────────────────────────────────────────

	getFilteredRows(rows, query) {
		const q = (query || "").trim().toLowerCase();
		if (!q) return rows;
		return rows.filter(
			(r) =>
				(r.doctype || "").toLowerCase().includes(q) ||
				(r.module || "").toLowerCase().includes(q)
		);
	}

	getFilteredWorkflowRows() {
		const selectedDoctypes = this.state.selectedDoctypes;
		const filtered = this.state.workflows.filter(
			(r) => !selectedDoctypes.size || selectedDoctypes.has(r.doctype)
		);
		const q = (this.state.workflowSearch || "").trim().toLowerCase();
		if (!q) return filtered;
		return filtered.filter(
			(r) => (r.name || "").toLowerCase().includes(q) || (r.doctype || "").toLowerCase().includes(q)
		);
	}

	getFilteredPrintFormatRows() {
		const selectedDoctypes = this.state.selectedDoctypes;
		const filtered = this.state.printFormats.filter(
			(r) => !selectedDoctypes.size || selectedDoctypes.has(r.doctype)
		);
		const q = (this.state.printFormatSearch || "").trim().toLowerCase();
		if (!q) return filtered;
		return filtered.filter(
			(r) => (r.name || "").toLowerCase().includes(q) || (r.doctype || "").toLowerCase().includes(q)
		);
	}

	// ─── Export ───────────────────────────────────────────────────────────────

	async handleExport() {
		const selected = Array.from(this.state.selectedDoctypes);
		const selectedDataDoctypes = Array.from(this.state.selectedDataDoctypes);
		const selectedWorkflows = this.getFilteredWorkflowRows()
			.filter((r) => this.state.selectedWorkflows.has(r.name))
			.map((r) => r.name);
		const selectedPrintFormats = this.getFilteredPrintFormatRows()
			.filter((r) => this.state.selectedPrintFormats.has(r.name))
			.map((r) => r.name);
		const notesEl = this.wrapper.querySelector('[data-role="notes"]');
		const notes = notesEl ? notesEl.value : this.state.exportNotes;
		const permEl = this.wrapper.querySelector('[data-role="include-permissions"]');
		const includePermissions = permEl ? (permEl.checked ? 1 : 0) : (this.state.includePermissions ? 1 : 0);

		try {
			const response = await frappe.call({
				method: "customization_manager.api.export_bundle",
				args: {
					doctypes: selected.length ? JSON.stringify(selected) : null,
					include_workflows: selectedWorkflows.length ? 1 : 0,
					include_print_formats: selectedPrintFormats.length ? 1 : 0,
					include_permissions: includePermissions,
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

	// ─── Restore ─────────────────────────────────────────────────────────────

	loadFile(file) {
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			this.state.loadedFile = file;
			this.state.loadedBundleText = reader.result;
			this.state.restoreReport = null;
			this.state.loadedBundleMeta = this.parseBundleMeta(reader.result);
			this.updateBundlePreview();
			this.updateRestoreButtonState();
			this.updateRestoreResult();
		};
		reader.onerror = () => this.showAlert(__("Could not read the selected file."), "red");
		reader.readAsText(file);
	}

	parseBundleMeta(bundleText) {
		try {
			const parsed = JSON.parse(bundleText || "{}");
			if (!parsed || typeof parsed !== "object") return null;
			return parsed.meta || { version: parsed.version || "" };
		} catch (error) {
			return null;
		}
	}

	getBundleSummaryText() {
		const bundle = this.safeParseBundle();
		if (!bundle) return __("The file is loaded, but its bundle preview could not be fully read.");
		const parts = [];
		if ((bundle.custom_fields || []).length || (bundle.property_setters || []).length) {
			parts.push(
				__("Customization content is present with {0} custom fields and {1} property setters.")
					.replace("{0}", (bundle.custom_fields || []).length)
					.replace("{1}", (bundle.property_setters || []).length)
			);
		}
		if ((bundle.data || []).length) {
			parts.push(__("Seed data is present for {0} doctypes.").replace("{0}", (bundle.data || []).length));
		}
		if ((bundle.workflows || []).length) {
			parts.push(__("Workflows included: {0}.").replace("{0}", (bundle.workflows || []).length));
		}
		if ((bundle.print_formats || []).length) {
			parts.push(__("Print formats included: {0}.").replace("{0}", (bundle.print_formats || []).length));
		}
		if (!parts.length) parts.push(__("The bundle is loaded and ready for preview or restore."));
		return parts.join(" ");
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
		if (target) target.innerHTML = this.renderBundlePreview();
	}

	updateRestoreButtonState() {
		const button = this.wrapper.querySelector('[data-action="restore"]');
		if (button) button.disabled = !this.state.loadedBundleText;
	}

	handleRestore() {
		if (!this.state.loadedBundleText) return;
		this.prepareRestoreFlow();
	}

	async prepareRestoreFlow() {
		try {
			const response = await frappe.call({
				method: "customization_manager.api.analyze_bundle_compatibility",
				args: { bundle_json: this.state.loadedBundleText },
				freeze: true,
				freeze_message: __("Checking bundle compatibility..."),
			});
			const analysis = response.message || {};
			// Always show the field mapping dialog when the bundle contains data sections,
			// so the user can review field mapping even when everything looks ok.
			if ((analysis.data_field_map || []).length || analysis.has_issues) {
				this.openFieldMappingDialog(analysis);
				return;
			}
			this.confirmAndRestore({}, {});
		} catch (error) {
			this.showAlert(__("Could not analyze bundle compatibility."), "red");
		}
	}

	confirmAndRestore(fieldMapping, generatedFields) {
		const dryRunEl = this.wrapper.querySelector('[data-role="dry-run"]');
		const dryRun = dryRunEl ? dryRunEl.checked : this.state.dryRun;
		const message = dryRun
			? __("Run a dry-run preview? No changes will be written to this site.")
			: __("Run a live restore? This will create and update customizations and seed data on this site.");
		frappe.confirm(message, () => this.executeRestore(dryRun, fieldMapping, generatedFields));
	}

	// ─── Field Mapping Dialog ─────────────────────────────────────────────────
	// Shown before every restore that contains data sections. Displays a
	// comprehensive field-mapping table (like ERPNext's Import DocType dialog)
	// so the user can confirm mappings, remap mismatched fields, and apply
	// missing Custom Field definitions from the bundle before committing.

	openFieldMappingDialog(analysis) {
		const dialog = new frappe.ui.Dialog({
			title: __("Field Mapping Review"),
			size: "extra-large",
			fields: [{ fieldtype: "HTML", fieldname: "content" }],
			primary_action_label: __("Proceed with Restore"),
			primary_action: () => {
				const resolution = this.collectFieldResolution(dialog);
				dialog.hide();
				this.confirmAndRestore(resolution.fieldMapping, resolution.generatedFields);
			},
		});
		this._fieldMappingDialog = dialog;
		this._refreshFieldMappingDialog(dialog, analysis);

		// Delegate "Apply Custom Fields" button clicks inside the dialog
		dialog.$wrapper.on("click", "[data-action='apply-bundle-cfs']", (e) => {
			const doctype = e.currentTarget.getAttribute("data-doctype");
			if (doctype) this.applyBundleCustomFields(dialog, [doctype]);
		});

		dialog.show();
	}

	_refreshFieldMappingDialog(dialog, analysis) {
		dialog.fields_dict.content.$wrapper.html(this.renderFieldMappingContent(analysis));
	}

	renderFieldMappingContent(analysis) {
		const dataFieldMap = analysis.data_field_map || [];
		const missingDoctypes = analysis.missing_doctypes || [];
		const totalMissing = dataFieldMap.reduce((s, d) => s + (d.missing_count || 0), 0);

		if (!dataFieldMap.length && !missingDoctypes.length) {
			return `<div class="cm-fm-alert cm-fm-alert-green">${__("This bundle contains no master data sections.")}</div>`;
		}

		const doctypeWarning = missingDoctypes.length ? `
			<div class="cm-fm-alert cm-fm-alert-red" style="margin-bottom:14px;">
				<strong>${__("Missing DocTypes on this site")}:</strong>
				${missingDoctypes.map(d => `<code>${frappe.utils.escape_html(d.section)}: ${frappe.utils.escape_html(d.doctype)}</code>`).join(", ")} —
				${__("these sections will be skipped during restore.")}
			</div>
		` : "";

		const summary = totalMissing > 0
			? `<div class="cm-fm-alert cm-fm-alert-yellow" style="margin-bottom:16px;">
				${__("Some incoming fields are not available on this site. Review each DocType below, then click")} <strong>${__("Proceed with Restore")}</strong>.
			   </div>`
			: `<div class="cm-fm-alert cm-fm-alert-green" style="margin-bottom:16px;">
				${__("All incoming fields map correctly to this site. Safe to proceed.")}
			   </div>`;

		return `
			<div>
				${doctypeWarning}
				${summary}
				${dataFieldMap.map(dt => this.renderDoctypeFieldBlock(dt)).join("")}
			</div>
		`;
	}

	renderDoctypeFieldBlock(dt) {
		const hasMissing = dt.missing_count > 0;

		const cfBanner = hasMissing && dt.has_bundle_custom_fields ? `
			<div class="cm-fm-alert cm-fm-alert-yellow" style="margin-bottom:10px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
				<div>
					<strong>${__("Bundle includes Custom Field definitions for this DocType.")}</strong><br>
					<span style="font-size:12px;">${__("Apply them to make missing fields available on this site, then the data restore will include those fields.")}</span>
				</div>
				<button class="btn btn-xs btn-warning" data-action="apply-bundle-cfs" data-doctype="${frappe.utils.escape_html(dt.doctype)}" style="white-space:nowrap;flex-shrink:0;">
					${__("Apply Custom Fields from Bundle")}
				</button>
			</div>
		` : (hasMissing ? `
			<div class="cm-fm-alert cm-fm-alert-red" style="margin-bottom:10px;font-size:12px;">
				${__("No Custom Field definitions in bundle for this DocType. Missing fields can be mapped to an existing field or skipped.")}
			</div>
		` : "");

		const fieldRows = (dt.incoming_fields || []).map(field => {
			if (field.status === "ok") {
				return `
					<tr>
						<td>${frappe.utils.escape_html(field.label || field.fieldname)}</td>
						<td><code style="font-size:11px;">${frappe.utils.escape_html(field.fieldname)}</code></td>
						<td class="text-muted" style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${frappe.utils.escape_html(field.sample_value || "—")}</td>
						<td><span class="cm-fm-pill-ok">✓ ${__("Mapped")}</span></td>
						<td style="color:var(--text-muted);font-size:11px;">—</td>
					</tr>
				`;
			}
			const defaultVal = field.has_bundle_custom_field ? "bundle" : "create";
			const defaultLabel = field.has_bundle_custom_field ? __("Use bundle field definition") : __("Create as Custom Field");
			const mapOptions = (dt.available_fields || [])
				.map(c => `<option value="map:${frappe.utils.escape_html(c.fieldname)}">${__("Map to")}: ${frappe.utils.escape_html(c.label)} (${frappe.utils.escape_html(c.fieldname)})</option>`)
				.join("");
			return `
				<tr class="cm-fm-row-missing">
					<td>${frappe.utils.escape_html(field.label || field.fieldname)}</td>
					<td><code style="font-size:11px;">${frappe.utils.escape_html(field.fieldname)}</code></td>
					<td class="text-muted" style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${frappe.utils.escape_html(field.sample_value || "—")}</td>
					<td><span class="cm-fm-pill-missing">✗ ${__("Missing")}</span></td>
					<td>
						<select class="form-control input-xs" style="font-size:12px;min-width:160px;"
						        data-role="field-resolution"
						        data-doctype="${frappe.utils.escape_html(dt.doctype)}"
						        data-fieldname="${frappe.utils.escape_html(field.fieldname)}">
							<option value="${frappe.utils.escape_html(defaultVal)}" selected>${frappe.utils.escape_html(defaultLabel)}</option>
							<option value="skip">${__("Skip (do not restore this field)")}</option>
							${mapOptions}
						</select>
					</td>
				</tr>
			`;
		}).join("");

		return `
			<div class="cm-fm-block">
				<div class="cm-fm-block-header">
					<div class="cm-fm-block-title">${this.renderInlineIcon("chart")} ${frappe.utils.escape_html(dt.doctype)}</div>
					<div class="cm-fm-block-badges">
						${dt.mapped_count > 0 ? `<span class="cm-fm-badge cm-fm-badge-ok">${dt.mapped_count} ${__("mapped")}</span>` : ""}
						${dt.missing_count > 0 ? `<span class="cm-fm-badge cm-fm-badge-missing">${dt.missing_count} ${__("missing")}</span>` : ""}
					</div>
				</div>
				<div class="cm-fm-body">
					${cfBanner}
					<table class="cm-fm-table">
						<thead>
							<tr>
								<th>${__("Label")}</th>
								<th>${__("Field Name")}</th>
								<th>${__("Sample Value")}</th>
								<th>${__("Status")}</th>
								<th>${__("Action")}</th>
							</tr>
						</thead>
						<tbody>${fieldRows}</tbody>
					</table>
				</div>
			</div>
		`;
	}

	async applyBundleCustomFields(dialog, doctypes) {
		try {
			frappe.show_progress(__("Applying Custom Fields…"), 30, 100);
			const response = await frappe.call({
				method: "customization_manager.api.apply_bundle_custom_fields",
				args: {
					bundle_json: this.state.loadedBundleText,
					doctypes: JSON.stringify(doctypes),
				},
			});
			frappe.hide_progress();
			const result = response.message || {};
			if (result.errors && result.errors.length) {
				frappe.msgprint(`${__("Applied with errors")}: ${result.errors.join("; ")}`);
			} else {
				frappe.show_alert({
					message: `${__("Custom fields applied")} — ${result.created} ${__("created")}, ${result.updated} ${__("updated")}`,
					indicator: "green",
				});
			}
			// Re-analyze and refresh the dialog so updated mapping status is shown
			const r2 = await frappe.call({
				method: "customization_manager.api.analyze_bundle_compatibility",
				args: { bundle_json: this.state.loadedBundleText },
				freeze: true,
				freeze_message: __("Re-checking compatibility…"),
			});
			this._refreshFieldMappingDialog(dialog, r2.message || {});
		} catch (err) {
			frappe.hide_progress();
			this.showAlert(__("Failed to apply custom fields."), "red");
		}
	}

	collectFieldResolution(dialog) {
		const fieldMapping = {};
		const generatedFields = {};
		const wrapper = dialog.$wrapper && dialog.$wrapper.get ? dialog.$wrapper.get(0) : null;
		const selects = wrapper ? wrapper.querySelectorAll('[data-role="field-resolution"]') : [];
		selects.forEach((el) => {
			const doctype = el.getAttribute("data-doctype");
			const fieldname = el.getAttribute("data-fieldname");
			const value = el.value;
			if (!doctype || !fieldname || !value || value === "skip") return;
			if (value === "bundle" || value === "create") {
				// Auto-create the field (backend uses bundle CF definition when available)
				if (!generatedFields[doctype]) generatedFields[doctype] = [];
				generatedFields[doctype].push(fieldname);
				return;
			}
			if (value.startsWith("map:")) {
				if (!fieldMapping[doctype]) fieldMapping[doctype] = {};
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
					sections: JSON.stringify(Array.from(this.state.restoreSections)),
				},
				freeze: true,
				freeze_message: dryRun ? __("Running dry run...") : __("Applying bundle..."),
			});
			this.state.restoreReport = response.message || {};
			this.updateRestoreResult();
			this.showAlert(
				dryRun ? __("Dry run completed.") : __("Restore completed."),
				dryRun ? "blue" : "green"
			);
			this.loadLogs();
		} catch (error) {
			this.showAlert(__("Restore failed."), "red");
		}
	}

	updateRestoreResult() {
		const target = this.wrapper.querySelector('[data-role="restore-result"]');
		if (target) target.innerHTML = this.renderRestoreResultContent();
	}

	// ─── Bundle preview ───────────────────────────────────────────────────────

	renderBundlePreview() {
		const meta = this.state.loadedBundleMeta;
		if (!this.state.loadedFile) {
			return this.renderEmptyState(
				__("No file loaded yet"),
				__("Once you choose a bundle, this area will show the file name and what the bundle contains."),
				"bundle"
			);
		}
		const bundle = this.safeParseBundle() || {};
		const exportedOn =
			meta && meta.exported_on
				? frappe.datetime.str_to_user(meta.exported_on)
				: meta && meta.timestamp
				? frappe.datetime.str_to_user(meta.timestamp)
				: "—";
		const countItems = [
			{ key: "custom_fields", label: __("Custom Fields") },
			{ key: "property_setters", label: __("Property Setters") },
			{ key: "workflows", label: __("Workflows") },
			{ key: "print_formats", label: __("Print Formats") },
			{ key: "client_scripts", label: __("Client Scripts") },
			{ key: "form_layouts", label: __("Form Layouts") },
			{ key: "notifications", label: __("Notifications") },
			{ key: "custom_docperms", label: __("Permissions") },
			{ key: "data", label: __("Seed Data Doctypes") },
		];
		const countChips = countItems
			.filter((item) => (bundle[item.key] || []).length > 0)
			.map(
				(item) =>
					`<span class="cm-chip cm-chip-gold">${item.label}: ${(bundle[item.key] || []).length}</span>`
			)
			.join("");
		return `
			<div style="font-weight:700;font-size:14px;">${frappe.utils.escape_html(this.state.loadedFile.name || __("Selected file"))}</div>
			<div class="cm-preview-grid">
				<div class="cm-preview-field">
					<div class="cm-preview-label">${__("Exported By")}</div>
					<div class="cm-preview-value">${frappe.utils.escape_html(meta && meta.exported_by ? meta.exported_by : "—")}</div>
				</div>
				<div class="cm-preview-field">
					<div class="cm-preview-label">${__("Exported On")}</div>
					<div class="cm-preview-value">${frappe.utils.escape_html(exportedOn)}</div>
				</div>
				<div class="cm-preview-field">
					<div class="cm-preview-label">${__("Bundle Version")}</div>
					<div class="cm-preview-value">${frappe.utils.escape_html(meta && meta.version ? meta.version : "—")}</div>
				</div>
				<div class="cm-preview-field">
					<div class="cm-preview-label">${__("Notes")}</div>
					<div class="cm-preview-value">${frappe.utils.escape_html(meta && meta.notes ? meta.notes : "—")}</div>
				</div>
			</div>
			${countChips ? `<div class="cm-drop-meta" style="margin-top:12px;">${countChips}</div>` : ""}
		`;
	}

	// ─── Restore result ───────────────────────────────────────────────────────

	renderRestoreResultContent() {
		if (!this.state.restoreReport) {
			return `
				<div class="cm-subsection">
					<div class="cm-subsection-title">${this.renderInlineIcon("chart")} ${__("Restore summary")}</div>
					<div class="cm-help">${__("After dry run or restore, the results will appear here.")}</div>
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
			form_layouts: __("Form Layouts"),
			notifications: __("Notifications"),
			custom_docperms: __("Permissions"),
		};
		let totalCreated = 0, totalUpdated = 0, totalErrors = 0;
		Object.keys(sectionTitles).forEach((key) => {
			const s = report[key] || { created: 0, updated: 0, errors: [] };
			totalCreated += s.created || 0;
			totalUpdated += s.updated || 0;
			totalErrors += (s.errors || []).length;
		});
		const dataReport = report.data || { created: 0, updated: 0, skipped: 0, errors: [], by_doctype: {} };
		totalCreated += dataReport.created || 0;
		totalUpdated += dataReport.updated || 0;
		totalErrors += (dataReport.errors || []).length;
		const bannerTone =
			totalErrors === 0 ? "success" : totalErrors > totalCreated + totalUpdated ? "error" : "warning";
		const configCards = Object.keys(sectionTitles)
			.map((key) => this.renderResultCard(sectionTitles[key], report[key]))
			.join("");
		const dataCards = [
			this.renderResultCard(__("Seed Data Overview"), dataReport),
			...Object.keys(dataReport.by_doctype || {}).map((doctype) =>
				this.renderResultCard(doctype, dataReport.by_doctype[doctype])
			),
		].join("");
		return `
			<div class="cm-subsection">
				<div class="cm-subsection-title">${this.renderInlineIcon("chart")} ${__("Restore summary")}</div>
				<div class="cm-help">${__("Confirm what changed, what already existed, and where any errors happened.")}</div>
				<div class="cm-result-banner cm-result-banner-${bannerTone}" style="margin-top:12px;">
					<div class="cm-result-banner-stat">
						<div class="cm-result-banner-num">${totalCreated}</div>
						<div class="cm-result-banner-lbl">${__("Created")}</div>
					</div>
					<div class="cm-result-banner-stat">
						<div class="cm-result-banner-num">${totalUpdated}</div>
						<div class="cm-result-banner-lbl">${__("Updated")}</div>
					</div>
					<div class="cm-result-banner-stat">
						<div class="cm-result-banner-num">${totalErrors}</div>
						<div class="cm-result-banner-lbl">${__("Errors")}</div>
					</div>
				</div>
				<div style="margin-top:14px;font-weight:700;font-size:12px;color:var(--cm-text-2);text-transform:uppercase;letter-spacing:.05em;">${__("Customization Results")}</div>
				<div class="cm-result-grid">${configCards}</div>
				<div style="margin-top:14px;font-weight:700;font-size:12px;color:var(--cm-text-2);text-transform:uppercase;letter-spacing:.05em;">${__("Seed Data Results")}</div>
				<div class="cm-result-grid">${dataCards}</div>
			</div>
		`;
	}

	renderResultCard(title, section) {
		const s = section || { created: 0, updated: 0, skipped: 0, errors: [] };
		const errors = s.errors || [];
		return `
			<div class="cm-result-card">
				<div class="cm-result-title">${frappe.utils.escape_html(title)}</div>
				<div class="cm-result-stats">
					<div>${__("Created")}: ${s.created || 0}</div>
					<div>${__("Updated")}: ${s.updated || 0}</div>
					<div>${__("Skipped")}: ${s.skipped || 0}</div>
					<div>${__("Errors")}: ${errors.length}</div>
				</div>
				${errors.length ? `<div class="cm-errors">${frappe.utils.escape_html(errors.join(" | "))}</div>` : ""}
			</div>
		`;
	}

	// ─── Activity log ────────────────────────────────────────────────────────

	async loadLogs() {
		const getTarget = () => this.wrapper.querySelector('[data-role="log-table"]');
		const initial = getTarget();
		if (initial) initial.innerHTML = `<div class="cm-empty">${__("Loading activity...")}</div>`;

		try {
			const response = await frappe.call({
				method: "customization_manager.api.get_bundle_logs",
				args: { limit: 20 },
			});
			const target = getTarget();
			if (!target) return;
			const rows = response.message || [];
			if (!rows.length) {
				target.innerHTML = this.renderEmptyState(
					__("No export or restore activity yet"),
					__("Once your team runs exports or restores, the latest entries will show up here."),
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
							<th>${__("Rollback")}</th>
						</tr>
					</thead>
					<tbody>
						${rows
							.map(
								(row) => `
								<tr>
									<td>${frappe.datetime.str_to_user(row.timestamp)}</td>
									<td>${frappe.utils.escape_html(row.action || "")}</td>
									<td>${this.getStatusBadge(row.status)}</td>
									<td>${frappe.utils.escape_html(row.user || "")}</td>
									<td>${frappe.utils.escape_html(row.details || "")}</td>
									<td>${row.snapshot_bundle ? `<button class="btn btn-default btn-xs" data-action="rollback-restore" data-snapshot="${frappe.utils.escape_html(row.snapshot_bundle)}">${__("Rollback")}</button>` : ""}</td>
								</tr>
							`
							)
							.join("")}
					</tbody>
				</table>
			`;
		} catch (error) {
			const target = getTarget();
			if (target) {
				target.innerHTML = `<div class="cm-empty" style="color:var(--red-600,#d9534f);">${__("Could not load recent activity.")}</div>`;
			}
		}
	}

	getStatusBadge(status) {
		const classMap = { Success: "cm-badge-success", "Dry Run": "cm-badge-dryrun", Error: "cm-badge-error" };
		const cls = classMap[status] || "cm-badge-dryrun";
		return `<span class="cm-badge ${cls}">${frappe.utils.escape_html(status || "")}</span>`;
	}

	showAlert(message, indicator) {
		frappe.show_alert({ message, indicator });
	}

	// ─── Bundle history ───────────────────────────────────────────────────────

	renderBundlesContent() {
		return `
			<div class="cm-panel-header">
				<div class="cm-panel-header-row">
					<div>
						<div class="cm-panel-title">${this.renderInlineIcon("bundle")} ${__("Bundle History")}</div>
						<div class="cm-help">${__("Previously exported bundles. Download any to restore on another site.")}</div>
					</div>
					<button class="btn btn-default btn-sm" data-action="refresh-bundles">${__("Refresh")}</button>
				</div>
			</div>
			<div class="cm-panel-body">
				<div data-role="bundles-list">
					<div class="cm-empty">${__("Loading bundles...")}</div>
				</div>
			</div>
		`;
	}

	async loadBundles() {
		const getTarget = () => this.wrapper.querySelector('[data-role="bundles-list"]');
		const initial = getTarget();
		if (initial) initial.innerHTML = `<div class="cm-empty">${__("Loading bundles...")}</div>`;
		try {
			const response = await frappe.call({ method: "customization_manager.api.get_bundle_list" });
			const target = getTarget();
			if (!target) return;
			const bundles = response.message || [];
			if (!bundles.length) {
				target.innerHTML = this.renderEmptyState(
					__("No bundles exported yet"),
					__("Export a bundle from the Export tab and it will appear here."),
					"bundle"
				);
				return;
			}
			target.innerHTML = bundles.map(b => `
				<div class="cm-bundle-row">
					<div class="cm-bundle-main">
						<div class="cm-option-title">${frappe.utils.escape_html(b.bundle_name)}</div>
						<div class="cm-option-meta">
							${frappe.utils.escape_html(b.exported_by || "")} &nbsp;·&nbsp;
							${frappe.datetime.str_to_user(b.exported_on)}
							${b.notes ? ` &nbsp;·&nbsp; ${frappe.utils.escape_html(b.notes)}` : ""}
						</div>
					</div>
					<button class="btn btn-default btn-sm" data-action="redownload-bundle"
					        data-bundle-name="${frappe.utils.escape_html(b.bundle_name)}">
						${__("Download")}
					</button>
				</div>
			`).join("");
		} catch (e) {
			const target = getTarget();
			if (target) target.innerHTML = `<div class="cm-empty">${__("Could not load bundles.")}</div>`;
		}
	}

	async handleRedownload(bundleName) {
		try {
			const response = await frappe.call({
				method: "customization_manager.api.get_bundle_json",
				args: { bundle_name: bundleName },
				freeze: true,
				freeze_message: __("Fetching bundle..."),
			});
			const jsonText = response.message;
			if (!jsonText) { this.showAlert(__("Bundle JSON is empty."), "red"); return; }
			const filename = bundleName.replace(/[^a-z0-9_\-]/gi, "_") + ".json";
			const blob = new Blob([jsonText], { type: "application/json" });
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url; a.download = filename; a.click();
			window.URL.revokeObjectURL(url);
		} catch (e) {
			this.showAlert(__("Failed to download bundle."), "red");
		}
	}

	async handleRollback(snapshotBundleName) {
		frappe.confirm(
			__("This will revert all customizations to the state before this restore. Continue?"),
			async () => {
				try {
					await frappe.call({
						method: "customization_manager.api.rollback_restore",
						args: { snapshot_bundle_name: snapshotBundleName },
						freeze: true,
						freeze_message: __("Rolling back..."),
					});
					this.showAlert(__("Rollback completed."), "green");
					this.loadLogs();
				} catch (e) {
					this.showAlert(__("Rollback failed."), "red");
				}
			}
		);
	}

	// ─── Event binding (full delegation) ─────────────────────────────────────

	bindEvents() {
		const root = this.wrapper.querySelector('[data-role="dashboard-root"]');

		root.addEventListener("click", (e) => {
			const tabBtn = e.target.closest('[data-action="switch-tab"]');
			if (tabBtn) { this.switchTab(tabBtn.dataset.tab); return; }

			const sectionBtn = e.target.closest('[data-action="switch-section"]');
			if (sectionBtn) { this.switchSection(sectionBtn.dataset.section); return; }

			if (e.target.closest('[data-action="toggle-selection"]')) {
				const all = this.state.doctypes.length && this.state.selectedDoctypes.size === this.state.doctypes.length;
				this.state.selectedDoctypes = all ? new Set() : new Set(this.state.doctypes.map((r) => r.doctype));
				this.refreshDashboardState();
				return;
			}

			if (e.target.closest('[data-action="toggle-data-selection"]')) {
				const all = this.state.seedDataDoctypes.length &&
					this.state.selectedDataDoctypes.size === this.state.seedDataDoctypes.length;
				this.state.selectedDataDoctypes = all
					? new Set()
					: new Set(this.state.seedDataDoctypes.map((r) => r.doctype));
				this.refreshDashboardState();
				return;
			}

			if (e.target.closest('[data-action="toggle-workflow-selection"]')) {
				const rows = this.getFilteredWorkflowRows();
				const all = rows.length && rows.every((r) => this.state.selectedWorkflows.has(r.name));
				rows.forEach((r) => { if (all) this.state.selectedWorkflows.delete(r.name); else this.state.selectedWorkflows.add(r.name); });
				this.refreshDashboardState();
				return;
			}

			if (e.target.closest('[data-action="toggle-print-format-selection"]')) {
				const rows = this.getFilteredPrintFormatRows();
				const all = rows.length && rows.every((r) => this.state.selectedPrintFormats.has(r.name));
				rows.forEach((r) => { if (all) this.state.selectedPrintFormats.delete(r.name); else this.state.selectedPrintFormats.add(r.name); });
				this.refreshDashboardState();
				return;
			}

			if (e.target.closest('[data-action="export"]')) { this.handleExport(); return; }
			if (e.target.closest('[data-action="restore"]')) { this.handleRestore(); return; }
			if (e.target.closest('[data-action="refresh-logs"]')) { this.loadLogs(); return; }

			if (e.target.closest('[data-action="redownload-bundle"]')) {
				const btn = e.target.closest('[data-action="redownload-bundle"]');
				this.handleRedownload(btn.dataset.bundleName);
				return;
			}
			if (e.target.closest('[data-action="refresh-bundles"]')) {
				this.loadBundles();
				return;
			}
			if (e.target.closest('[data-action="rollback-restore"]')) {
				const btn = e.target.closest('[data-action="rollback-restore"]');
				this.handleRollback(btn.dataset.snapshot);
				return;
			}
		});

		root.addEventListener("input", (e) => {
			if (e.target.matches('[data-role="doctype-search"]')) {
				this.state.doctypeSearch = e.target.value || "";
				this.renderDoctypeList();
			} else if (e.target.matches('[data-role="data-search"]')) {
				this.state.dataSearch = e.target.value || "";
				this.renderSeedDataList();
			} else if (e.target.matches('[data-role="workflow-search"]')) {
				this.state.workflowSearch = e.target.value || "";
				this.renderWorkflowList();
			} else if (e.target.matches('[data-role="print-format-search"]')) {
				this.state.printFormatSearch = e.target.value || "";
				this.renderPrintFormatList();
			} else if (e.target.matches('[data-role="notes"]')) {
				this.state.exportNotes = e.target.value || "";
			}
		});

		root.addEventListener("change", (e) => {
			const doctype = e.target.getAttribute("data-doctype");
			if (doctype) {
				if (e.target.checked) this.state.selectedDoctypes.add(doctype);
				else this.state.selectedDoctypes.delete(doctype);
				this.refreshDashboardState();
				return;
			}

			const dataDoctype = e.target.getAttribute("data-data-doctype");
			if (dataDoctype) {
				if (e.target.checked) this.state.selectedDataDoctypes.add(dataDoctype);
				else this.state.selectedDataDoctypes.delete(dataDoctype);
				this.refreshDashboardState();
				return;
			}

			const workflow = e.target.getAttribute("data-workflow");
			if (workflow) {
				if (e.target.checked) this.state.selectedWorkflows.add(workflow);
				else this.state.selectedWorkflows.delete(workflow);
				this.refreshDashboardState();
				return;
			}

			const printFormat = e.target.getAttribute("data-print-format");
			if (printFormat) {
				if (e.target.checked) this.state.selectedPrintFormats.add(printFormat);
				else this.state.selectedPrintFormats.delete(printFormat);
				this.refreshDashboardState();
				return;
			}

			if (e.target.matches('[data-role="file-input"]')) {
				const [file] = e.target.files || [];
				this.loadFile(file);
				return;
			}

			if (e.target.matches('[data-role="dry-run"]')) {
				this.state.dryRun = e.target.checked;
				return;
			}

			if (e.target.matches('[data-role="include-permissions"]')) {
				this.state.includePermissions = e.target.checked;
				return;
			}

			if (e.target.matches('[data-role="restore-section"]')) {
				const section = e.target.getAttribute("data-section");
				if (e.target.checked) this.state.restoreSections.add(section);
				else this.state.restoreSections.delete(section);
				return;
			}
		});

		root.addEventListener("dragover", (e) => {
			const dz = e.target.closest('[data-role="drop-zone"]');
			if (!dz) return;
			e.preventDefault();
			dz.classList.add("cm-dropzone-active");
		});

		root.addEventListener("dragleave", (e) => {
			const dz = e.target.closest('[data-role="drop-zone"]');
			if (!dz) return;
			dz.classList.remove("cm-dropzone-active");
		});

		root.addEventListener("drop", (e) => {
			const dz = e.target.closest('[data-role="drop-zone"]');
			if (!dz) return;
			e.preventDefault();
			dz.classList.remove("cm-dropzone-active");
			const [file] = e.dataTransfer.files || [];
			this.loadFile(file);
		});
	}

	// ─── Render helpers ───────────────────────────────────────────────────────

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
		return this.renderEmptyState(title, text, icon);
	}

	renderRibbon(label, icon, tone) {
		return `<div class="cm-ribbon cm-ribbon-${frappe.utils.escape_html(tone)}">${this.renderInlineIcon(icon)} ${frappe.utils.escape_html(label)}</div>`;
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
