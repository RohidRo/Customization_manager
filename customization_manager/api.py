import json

import frappe

BUNDLE_VERSION = "1.1"
ALL_SECTIONS = frozenset([
    "custom_fields", "property_setters", "workflows", "print_formats",
    "client_scripts", "form_layouts", "notifications", "custom_docperms", "data",
])
SYSTEM_FIELDS = {
	"_assign",
	"_comments",
	"_liked_by",
	"_seen",
	"amended_from",
	"creation",
	"docstatus",
	"doctype",
	"idx",
	"modified",
	"modified_by",
	"owner",
	"parent",
	"parentfield",
	"parenttype",
}
CHILD_TABLE_SYSTEM_FIELDS = SYSTEM_FIELDS | {"parent", "parentfield", "parenttype"}
# Frappe system modules whose DocTypes are unsafe to export as data
# (internal framework tables, not application master data)
EXCLUDED_DATA_MODULES = frozenset([
	"Core",
	"Custom",
	"Desk",
	"Email",
	"Integrations",
	"Website",
	"Geo",
	"Workflow",
	"Printing",
	"Social",
	"Data Migration",
	"Customization Manager",
])


@frappe.whitelist()
def has_permission():
	frappe.only_for("System Manager")
	return True


@frappe.whitelist()
def get_customized_doctypes():
	frappe.only_for("System Manager")

	counts = {}

	def _default_entry(dt):
		return {
			"doctype": dt,
			"custom_fields": 0,
			"property_setters": 0,
			"form_layouts": 0,
			"notifications": 0,
			"workflows": 0,
			"print_formats": 0,
			"client_scripts": 0,
		}

	custom_field_rows = frappe.db.sql(
		"""
		SELECT dt AS target_doctype, COUNT(*) AS custom_fields
		FROM `tabCustom Field`
		GROUP BY dt
		""",
		as_dict=True,
	)
	for row in custom_field_rows:
		entry = counts.setdefault(row.target_doctype, _default_entry(row.target_doctype))
		entry["custom_fields"] = int(row.custom_fields or 0)

	property_setter_rows = frappe.db.sql(
		"""
		SELECT doc_type AS target_doctype, COUNT(*) AS property_setters
		FROM `tabProperty Setter`
		WHERE IFNULL(doc_type, '') != ''
		GROUP BY doc_type
		""",
		as_dict=True,
	)
	for row in property_setter_rows:
		entry = counts.setdefault(row.target_doctype, _default_entry(row.target_doctype))
		entry["property_setters"] = int(row.property_setters or 0)

	notification_rows = frappe.db.sql(
		"""
		SELECT document_type AS target_doctype, COUNT(*) AS notifications
		FROM `tabNotification`
		WHERE IFNULL(document_type, '') != ''
		GROUP BY document_type
		""",
		as_dict=True,
	)
	for row in notification_rows:
		entry = counts.setdefault(row.target_doctype, _default_entry(row.target_doctype))
		entry["notifications"] = int(row.notifications or 0)

	if frappe.db.exists("DocType", "Form Layout"):
		form_layout_rows = frappe.db.sql(
			"""
			SELECT dt AS target_doctype, COUNT(*) AS form_layouts
			FROM `tabForm Layout`
			GROUP BY dt
			""",
			as_dict=True,
		)
		for row in form_layout_rows:
			entry = counts.setdefault(row.target_doctype, _default_entry(row.target_doctype))
			entry["form_layouts"] = int(row.form_layouts or 0)

	workflow_rows = frappe.db.sql(
		"""
		SELECT document_type AS target_doctype, COUNT(*) AS workflows
		FROM `tabWorkflow`
		WHERE IFNULL(document_type, '') != ''
		GROUP BY document_type
		""",
		as_dict=True,
	)
	for row in workflow_rows:
		entry = counts.setdefault(row.target_doctype, _default_entry(row.target_doctype))
		entry["workflows"] = int(row.workflows or 0)

	print_format_rows = frappe.db.sql(
		"""
		SELECT doc_type AS target_doctype, COUNT(*) AS print_formats
		FROM `tabPrint Format`
		WHERE custom_format = 1 AND IFNULL(doc_type, '') != ''
		GROUP BY doc_type
		""",
		as_dict=True,
	)
	for row in print_format_rows:
		entry = counts.setdefault(row.target_doctype, _default_entry(row.target_doctype))
		entry["print_formats"] = int(row.print_formats or 0)

	client_script_rows = frappe.db.sql(
		"""
		SELECT dt AS target_doctype, COUNT(*) AS client_scripts
		FROM `tabClient Script`
		WHERE IFNULL(dt, '') != ''
		GROUP BY dt
		""",
		as_dict=True,
	)
	for row in client_script_rows:
		entry = counts.setdefault(row.target_doctype, _default_entry(row.target_doctype))
		entry["client_scripts"] = int(row.client_scripts or 0)

	return sorted(counts.values(), key=lambda row: row["doctype"])


@frappe.whitelist()
def get_exportable_data_doctypes():
	frappe.only_for("System Manager")

	# Fetch all non-child, non-single, non-virtual DocTypes not in excluded modules.
	# These are the DocTypes that are safe to treat as master/seed data.
	excluded = list(EXCLUDED_DATA_MODULES)
	candidates = frappe.db.sql(
		"""
		SELECT name, module
		FROM `tabDocType`
		WHERE istable = 0
		  AND issingle = 0
		  AND is_virtual = 0
		  AND module NOT IN %(excluded)s
		ORDER BY module ASC, name ASC
		""",
		{"excluded": excluded},
		as_dict=True,
	)

	rows = []
	for row in candidates:
		try:
			count = frappe.db.count(row.name)
			rows.append({
				"doctype": row.name,
				"module": row.module or "",
				"record_count": count,
			})
		except Exception:
			# DocType table may not exist yet (e.g. not migrated)
			pass

	return rows


@frappe.whitelist()
def get_available_workflows():
	frappe.only_for("System Manager")

	rows = frappe.get_all(
		"Workflow",
		fields=["name", "document_type", "is_active"],
		order_by="document_type asc, name asc",
	)
	return [
		{
			"name": row.name,
			"doctype": row.document_type,
			"is_active": int(row.is_active or 0),
		}
		for row in rows
	]


@frappe.whitelist()
def get_available_print_formats():
	frappe.only_for("System Manager")

	rows = frappe.get_all(
		"Print Format",
		fields=["name", "doc_type", "custom_format", "disabled"],
		filters={"custom_format": 1},
		order_by="doc_type asc, name asc",
	)
	return [
		{
			"name": row.name,
			"doctype": row.doc_type,
			"custom_format": int(row.custom_format or 0),
			"disabled": int(row.disabled or 0),
		}
		for row in rows
	]


@frappe.whitelist()
def analyze_bundle_compatibility(bundle_json):
	frappe.only_for("System Manager")

	bundle = json.loads(bundle_json or "{}")
	_validate_bundle(bundle)
	custom_field_lookup = _build_bundle_custom_field_lookup(bundle.get("custom_fields") or [])
	analysis = {"missing_fields": [], "has_issues": False}

	# Build both missing_fields (existing API contract) and the new data_field_map
	# (comprehensive per-field status for every incoming data field).
	data_field_map = []
	for section in bundle.get("data") or []:
		if not isinstance(section, dict):
			continue
		doctype = section.get("doctype")
		if not doctype or not frappe.db.exists("DocType", doctype):
			continue

		meta = frappe.get_meta(doctype)
		available_fields = _get_mappable_fields(meta)
		existing_fieldnames = {row["fieldname"] for row in available_fields}
		all_incoming = {}

		for record in section.get("records") or []:
			if not isinstance(record, dict):
				continue
			for key, value in record.items():
				if key in SYSTEM_FIELDS or isinstance(value, list) or key in all_incoming:
					continue
				all_incoming[key] = {
					"fieldname": key,
					"label": _guess_label(key),
					"sample_value": "" if value is None else str(value)[:80],
					"status": "ok" if key in existing_fieldnames else "missing",
					"has_bundle_custom_field": (doctype, key) in custom_field_lookup,
				}

		missing_map = {k: v for k, v in all_incoming.items() if v["status"] == "missing"}
		if missing_map:
			analysis["missing_fields"].append({
				"doctype": doctype,
				"available_fields": available_fields,
				"fields": sorted(missing_map.values(), key=lambda row: row["fieldname"]),
			})

		has_bundle_cfs = any(
			isinstance(r, dict) and r.get("dt") == doctype
			for r in (bundle.get("custom_fields") or [])
		)
		data_field_map.append({
			"doctype": doctype,
			"available_fields": available_fields,
			# missing fields first, then ok fields, each group sorted by fieldname
			"incoming_fields": sorted(
				all_incoming.values(),
				key=lambda f: (f["status"] == "ok", f["fieldname"]),
			),
			"mapped_count": sum(1 for f in all_incoming.values() if f["status"] == "ok"),
			"missing_count": len(missing_map),
			"has_bundle_custom_fields": has_bundle_cfs,
		})

	analysis["data_field_map"] = data_field_map
	analysis["has_issues"] = bool(analysis["missing_fields"])

	# Check DocType existence for all section types
	missing_doctypes = []
	section_checks = [
		("custom_fields", "dt", "Custom Field"),
		("property_setters", "doc_type", "Property Setter"),
		("workflows", "document_type", "Workflow"),
		("print_formats", "doc_type", "Print Format"),
		("client_scripts", "dt", "Client Script"),
		("notifications", "document_type", "Notification"),
	]
	for section_key, dt_field, label in section_checks:
		for record in bundle.get(section_key) or []:
			if not isinstance(record, dict):
				continue
			dt = record.get(dt_field)
			if dt and not frappe.db.exists("DocType", dt):
				missing_doctypes.append({"section": label, "doctype": dt})

	seen = set()
	deduped = []
	for item in missing_doctypes:
		key = (item["section"], item["doctype"])
		if key not in seen:
			seen.add(key)
			deduped.append(item)

	analysis["missing_doctypes"] = deduped
	if deduped:
		analysis["has_issues"] = True

	return analysis


@frappe.whitelist()
def apply_bundle_custom_fields(bundle_json, doctypes):
	"""Restore only the Custom Field definitions from a bundle for the given DocTypes.

	Called before data restore when the target site is missing fields that the bundle
	defines as Custom Fields. Applying them makes the fields available so the full data
	restore can succeed without skipping or remapping those columns.
	"""
	frappe.only_for("System Manager")
	bundle = json.loads(bundle_json or "{}")
	_validate_bundle(bundle)
	target_doctypes = set(_parse_json_list(doctypes) or [])
	if not target_doctypes:
		frappe.throw("No DocTypes specified.")
	filtered = [
		r for r in (bundle.get("custom_fields") or [])
		if isinstance(r, dict) and r.get("dt") in target_doctypes
	]
	if not filtered:
		frappe.throw(
			f"No custom field definitions found in the bundle for: {', '.join(sorted(target_doctypes))}"
		)
	report = _empty_section()
	_restore_custom_fields(filtered, report, dry_run=False)
	frappe.db.commit()
	_log(
		"Restore",
		"Success",
		f"Applied custom field definitions for: {', '.join(sorted(target_doctypes))}",
	)
	return {
		"created": report["created"],
		"updated": report["updated"],
		"errors": report["errors"],
	}


@frappe.whitelist()
def export_bundle(
	doctypes=None,
	include_workflows=1,
	include_print_formats=1,
	include_permissions=0,
	notes=None,
	data_doctypes=None,
	workflows=None,
	print_formats=None,
):
	frappe.only_for("System Manager")

	try:
		selected_doctypes = _parse_json_list(doctypes)
		selected_data_doctypes = _parse_json_list(data_doctypes) or []
		selected_workflows = _parse_json_list(workflows) or []
		selected_print_formats = _parse_json_list(print_formats) or []
		include_workflows = _as_bool(include_workflows)
		include_print_formats = _as_bool(include_print_formats)
		include_permissions = _as_bool(include_permissions)
		target_doctypes = selected_doctypes or _get_all_customized_doctypes()
		exported_on = frappe.utils.now_datetime()

		_validate_seed_data_doctypes(selected_data_doctypes)
		_validate_selected_records("Workflow", selected_workflows)
		_validate_selected_records("Print Format", selected_print_formats)

		meta = {
			"bundle_name": _build_bundle_name(exported_on),
			"version": BUNDLE_VERSION,
			"erpnext_version": _get_installed_app_version("erpnext"),
			"frappe_version": _get_installed_app_version("frappe"),
			"exported_on": exported_on.isoformat(),
			"exported_by": frappe.session.user,
			"notes": notes or "",
			"data_doctypes": selected_data_doctypes,
			"workflows": selected_workflows,
			"print_formats": selected_print_formats,
		}

		bundle = {
			"meta": meta,
			"custom_fields": _export_custom_fields(target_doctypes),
			"property_setters": _export_property_setters(target_doctypes),
			"workflows": _export_workflows(target_doctypes, selected_workflows) if include_workflows else [],
			"print_formats": _export_print_formats(target_doctypes, selected_print_formats) if include_print_formats else [],
			"client_scripts": _export_client_scripts(target_doctypes),
			"form_layouts": _export_form_layouts(target_doctypes),
			"notifications": _export_notifications(target_doctypes),
			"custom_docperms": _export_custom_docperms(target_doctypes) if include_permissions else [],
			"data": _export_seed_data(selected_data_doctypes),
		}

		bundle_json = json.dumps(bundle, indent=2, sort_keys=True, default=str)
		_save_bundle(meta, bundle_json)
		_log(
			"Export",
			"Success",
			(
				f"Exported {len(target_doctypes)} customization doctypes and "
				f"{len(selected_data_doctypes)} seed data doctypes by {frappe.session.user}."
			),
		)
		return bundle
	except Exception as exc:
		_log("Export", "Error", frappe.get_traceback(with_context=False))
		frappe.log_error(message=frappe.get_traceback(), title="Customization Manager Export Failed")
		raise frappe.ValidationError(f"Unable to export customization bundle: {exc}")


@frappe.whitelist()
def restore_bundle(bundle_json, dry_run=1, field_mapping=None, generated_fields=None, sections=None):
	frappe.only_for("System Manager")

	dry_run = _as_bool(dry_run)
	selected_sections = set(_parse_json_list(sections) or ALL_SECTIONS)
	report = _empty_report()

	try:
		bundle = json.loads(bundle_json or "{}")
		_validate_bundle(bundle)

		snapshot_bundle_name = None
		if not dry_run:
			snapshot_bundle_name = _take_snapshot(bundle)

		if "custom_fields" in selected_sections:
			_restore_custom_fields(bundle.get("custom_fields") or [], report["custom_fields"], dry_run)
		if "property_setters" in selected_sections:
			_restore_property_setters(bundle.get("property_setters") or [], report["property_setters"], dry_run)
		if "workflows" in selected_sections:
			_restore_workflows(bundle.get("workflows") or [], report["workflows"], dry_run)
		if "print_formats" in selected_sections:
			_restore_documents(
				"Print Format",
				bundle.get("print_formats") or [],
				report["print_formats"],
				dry_run,
				match_keys=["name"],
			)
		if "client_scripts" in selected_sections:
			_restore_documents(
				"Client Script",
				bundle.get("client_scripts") or [],
				report["client_scripts"],
				dry_run,
				match_keys=["name"],
			)
		if "form_layouts" in selected_sections:
			_restore_form_layouts(bundle.get("form_layouts") or [], report["form_layouts"], dry_run)
		if "notifications" in selected_sections:
			_restore_notifications(bundle.get("notifications") or [], report["notifications"], dry_run)
		if "custom_docperms" in selected_sections:
			_restore_custom_docperms(bundle.get("custom_docperms") or [], report["custom_docperms"], dry_run)
		field_mapping = _parse_nested_json_object(field_mapping)
		generated_fields = _parse_nested_json_object(generated_fields)
		if "data" in selected_sections:
			_restore_seed_data(
				bundle.get("data") or [],
				report["data"],
				dry_run,
				field_mapping=field_mapping,
				generated_fields=generated_fields,
				bundled_custom_fields=bundle.get("custom_fields") or [],
			)

		if not dry_run:
			frappe.db.commit()

		status = _get_restore_status(report, dry_run)
		_log("Restore", status, _summarize_report(report), snapshot_bundle=snapshot_bundle_name)
		return report
	except Exception:
		_log("Restore", "Error", frappe.get_traceback(with_context=False))
		frappe.log_error(message=frappe.get_traceback(), title="Customization Manager Restore Failed")
		raise


def _log(action, status, details, snapshot_bundle=None):
	log_doc = frappe.get_doc(
		{
			"doctype": "Bundle Log",
			"action": action,
			"status": status,
			"details": (details or "")[:140],
			"user": frappe.session.user,
			"timestamp": frappe.utils.now_datetime(),
			"snapshot_bundle": snapshot_bundle,
		}
	)
	log_doc.insert(ignore_permissions=True)


@frappe.whitelist()
def get_bundle_logs(limit=20):
	frappe.only_for("System Manager")
	rows = frappe.db.sql(
		"""
		SELECT action, status, details, user, timestamp, IFNULL(snapshot_bundle, '') AS snapshot_bundle
		FROM `tabBundle Log`
		ORDER BY timestamp DESC
		LIMIT %(limit)s
		""",
		{"limit": int(limit)},
		as_dict=True,
	)
	return rows


@frappe.whitelist()
def get_bundle_list():
	frappe.only_for("System Manager")
	return frappe.get_all(
		"Customization Bundle",
		fields=["bundle_name", "version", "exported_on", "exported_by", "notes", "frappe_version", "erpnext_version"],
		filters=[["bundle_name", "not like", "SNAPSHOT:%"]],
		order_by="exported_on desc",
		limit=50,
	)


@frappe.whitelist()
def get_bundle_json(bundle_name):
	frappe.only_for("System Manager")
	doc = frappe.get_doc("Customization Bundle", bundle_name)
	return doc.bundle_json


@frappe.whitelist()
def rollback_restore(snapshot_bundle_name):
	frappe.only_for("System Manager")
	doc = frappe.get_doc("Customization Bundle", snapshot_bundle_name)
	if not doc.bundle_json:
		raise frappe.ValidationError("Snapshot bundle has no JSON data.")
	bundle = json.loads(doc.bundle_json)
	report = _empty_report()
	_validate_bundle(bundle)
	_restore_custom_fields(bundle.get("custom_fields") or [], report["custom_fields"], dry_run=False)
	_restore_property_setters(bundle.get("property_setters") or [], report["property_setters"], dry_run=False)
	_restore_workflows(bundle.get("workflows") or [], report["workflows"], dry_run=False)
	_restore_documents("Print Format", bundle.get("print_formats") or [], report["print_formats"], dry_run=False, match_keys=["name"])
	_restore_documents("Client Script", bundle.get("client_scripts") or [], report["client_scripts"], dry_run=False, match_keys=["name"])
	_restore_form_layouts(bundle.get("form_layouts") or [], report["form_layouts"], dry_run=False)
	_restore_notifications(bundle.get("notifications") or [], report["notifications"], dry_run=False)
	_restore_custom_docperms(bundle.get("custom_docperms") or [], report["custom_docperms"], dry_run=False)
	_restore_seed_data(bundle.get("data") or [], report["data"], dry_run=False)
	frappe.db.commit()
	_log("Rollback", "Success", f"Rolled back using snapshot {snapshot_bundle_name}")
	return report


def _take_snapshot(bundle):
	affected = set()
	for r in bundle.get("custom_fields") or []:
		if isinstance(r, dict) and r.get("dt"):
			affected.add(r["dt"])
	for r in bundle.get("property_setters") or []:
		if isinstance(r, dict) and r.get("doc_type"):
			affected.add(r["doc_type"])
	for r in bundle.get("workflows") or []:
		if isinstance(r, dict) and r.get("document_type"):
			affected.add(r["document_type"])
	for r in bundle.get("print_formats") or []:
		if isinstance(r, dict) and r.get("doc_type"):
			affected.add(r["doc_type"])
	for r in bundle.get("client_scripts") or []:
		if isinstance(r, dict) and r.get("dt"):
			affected.add(r["dt"])
	for r in bundle.get("form_layouts") or []:
		if isinstance(r, dict) and r.get("dt"):
			affected.add(r["dt"])
	for r in bundle.get("notifications") or []:
		if isinstance(r, dict) and r.get("document_type"):
			affected.add(r["document_type"])
	for r in bundle.get("custom_docperms") or []:
		if isinstance(r, dict) and r.get("parent"):
			affected.add(r["parent"])
	data_doctypes = [s["doctype"] for s in (bundle.get("data") or []) if isinstance(s, dict) and s.get("doctype")]
	target_doctypes = sorted(affected - {None, ""})

	exported_on = frappe.utils.now_datetime()
	snapshot_name = f"SNAPSHOT: {exported_on.strftime('%Y-%m-%d %H:%M:%S')}"
	snapshot = {
		"meta": {
			"bundle_name": snapshot_name,
			"version": BUNDLE_VERSION,
			"erpnext_version": _get_installed_app_version("erpnext"),
			"frappe_version": _get_installed_app_version("frappe"),
			"exported_on": exported_on.isoformat(),
			"exported_by": frappe.session.user,
			"notes": "Pre-restore snapshot (auto-generated for rollback)",
			"data_doctypes": data_doctypes,
			"workflows": [],
			"print_formats": [],
		},
		"custom_fields": _export_custom_fields(target_doctypes),
		"property_setters": _export_property_setters(target_doctypes),
		"workflows": _export_workflows(target_doctypes),
		"print_formats": _export_print_formats(target_doctypes),
		"client_scripts": _export_client_scripts(target_doctypes),
		"form_layouts": _export_form_layouts(target_doctypes),
		"notifications": _export_notifications(target_doctypes),
		"custom_docperms": _export_custom_docperms(target_doctypes),
		"data": _export_seed_data(data_doctypes),
	}
	snapshot_json = json.dumps(snapshot, indent=2, sort_keys=True, default=str)
	frappe.get_doc({
		"doctype": "Customization Bundle",
		"bundle_name": snapshot_name,
		"version": BUNDLE_VERSION,
		"exported_on": exported_on,
		"exported_by": frappe.session.user,
		"notes": "Pre-restore snapshot",
		"bundle_json": snapshot_json,
	}).insert(ignore_permissions=True)
	return snapshot_name


def _parse_json_list(value):
	if value in (None, "", "null"):
		return None

	parsed = json.loads(value) if isinstance(value, str) else value
	if not isinstance(parsed, list):
		raise frappe.ValidationError("Expected a JSON array.")

	return sorted({entry for entry in parsed if entry})


def _parse_nested_json_object(value):
	if value in (None, "", "null"):
		return {}

	parsed = json.loads(value) if isinstance(value, str) else value
	if not isinstance(parsed, dict):
		raise frappe.ValidationError("Expected a JSON object.")
	return parsed


def _as_bool(value):
	if isinstance(value, bool):
		return value
	if value in (1, "1", "true", "True", "yes", "Yes", "on"):
		return True
	return False


def _get_all_customized_doctypes():
	rows = get_customized_doctypes()
	return [row["doctype"] for row in rows]


def _build_bundle_name(exported_on):
	return f"Customization Bundle {exported_on.strftime('%Y-%m-%d %H:%M:%S')}"


def _get_installed_app_version(app_name):
	installed_apps = frappe.utils.get_installed_apps_info() or []
	for app in installed_apps:
		if app.get("app_name") == app_name:
			return app.get("version") or ""
	return ""


def _is_safe_data_doctype(doctype):
	try:
		meta = frappe.get_meta(doctype)
	except Exception:
		return False
	return not (meta.istable or meta.issingle or meta.is_virtual or meta.module in EXCLUDED_DATA_MODULES)


def _validate_seed_data_doctypes(data_doctypes):
	invalid = sorted(dt for dt in data_doctypes if not _is_safe_data_doctype(dt))
	if invalid:
		raise frappe.ValidationError(f"Seed data export is not allowed for: {', '.join(invalid)}")


def _validate_selected_records(doctype, names):
	if not names:
		return
	existing = set(frappe.get_all(doctype, filters={"name": ["in", names]}, pluck="name"))
	missing = sorted(set(names) - existing)
	if missing:
		raise frappe.ValidationError(f"{doctype} records not found: {', '.join(missing)}")


def _build_bundle_custom_field_lookup(records):
	lookup = set()
	for record in records:
		if not isinstance(record, dict):
			continue
		dt = record.get("dt")
		fieldname = record.get("fieldname")
		if dt and fieldname:
			lookup.add((dt, fieldname))
	return lookup


def _guess_label(fieldname):
	return " ".join(part.capitalize() for part in (fieldname or "").split("_"))


def _get_mappable_fields(meta):
	fields = []
	for field in meta.fields:
		if field.fieldtype in {"Section Break", "Column Break", "Tab Break", "HTML", "Table", "Table MultiSelect", "Button"}:
			continue
		fields.append(
			{
				"fieldname": field.fieldname,
				"label": field.label or _guess_label(field.fieldname),
				"fieldtype": field.fieldtype,
			}
		)

	standard_fields = [
		{"fieldname": "name", "label": "ID", "fieldtype": "Data"},
	]
	return standard_fields + fields


def _export_custom_fields(target_doctypes):
	if not target_doctypes:
		return []
	rows = frappe.get_all(
		"Custom Field",
		filters={"dt": ["in", target_doctypes]},
		fields=["name"],
		order_by="dt asc, fieldname asc",
	)
	return [_export_doc("Custom Field", row.name) for row in rows]


def _export_property_setters(target_doctypes):
	if not target_doctypes:
		return []
	rows = frappe.get_all(
		"Property Setter",
		filters={"doc_type": ["in", target_doctypes]},
		fields=["name"],
		order_by="doc_type asc, property asc",
	)
	return [_export_doc("Property Setter", row.name) for row in rows]


def _export_workflows(target_doctypes, selected_workflows=None):
	if not target_doctypes:
		return []
	filters = {"document_type": ["in", target_doctypes]}
	if selected_workflows:
		filters["name"] = ["in", selected_workflows]
	rows = frappe.get_all("Workflow", filters=filters, fields=["name"], order_by="name asc")
	return [_export_doc("Workflow", row.name, include_children=True) for row in rows]


def _export_print_formats(target_doctypes, selected_print_formats=None):
	if not target_doctypes:
		return []
	filters = {"doc_type": ["in", target_doctypes], "custom_format": 1}
	if selected_print_formats:
		filters["name"] = ["in", selected_print_formats]
	rows = frappe.get_all("Print Format", filters=filters, fields=["name"], order_by="doc_type asc, name asc")
	return [_export_doc("Print Format", row.name) for row in rows]


def _export_client_scripts(target_doctypes):
	if not target_doctypes:
		return []
	rows = frappe.get_all(
		"Client Script",
		filters={"dt": ["in", target_doctypes]},
		fields=["name"],
		order_by="dt asc, name asc",
	)
	return [_export_doc("Client Script", row.name) for row in rows]


def _export_form_layouts(target_doctypes):
	if not target_doctypes:
		return []
	if not frappe.db.exists("DocType", "Form Layout"):
		return []
	rows = frappe.get_all(
		"Form Layout",
		filters={"dt": ["in", target_doctypes]},
		fields=["name"],
		order_by="dt asc",
	)
	return [_export_doc("Form Layout", row.name) for row in rows]


def _export_notifications(target_doctypes):
	if not target_doctypes:
		return []
	rows = frappe.get_all(
		"Notification",
		filters={"document_type": ["in", target_doctypes]},
		fields=["name"],
		order_by="document_type asc, name asc",
	)
	return [_export_doc("Notification", row.name, include_children=True) for row in rows]


def _export_custom_docperms(target_doctypes):
	if not target_doctypes:
		return []
	# Use frappe.get_all with explicit `parent` field — _sanitize_document would strip it
	# as a system field, but here `parent` is data (the DocType name).
	rows = frappe.get_all(
		"Custom DocPerm",
		filters={"parent": ["in", target_doctypes]},
		fields=[
			"name", "parent", "role", "permlevel",
			"read", "write", "create", "delete",
			"submit", "cancel", "amend",
			"print", "email", "report", "export", "import", "share",
		],
		order_by="parent asc, role asc, permlevel asc",
	)
	return [dict(row) for row in rows]


def _export_seed_data(data_doctypes):
	if not data_doctypes:
		return []

	exported = []
	for doctype in data_doctypes:
		records = frappe.get_all(doctype, pluck="name", order_by="name asc")
		exported.append(
			{
				"doctype": doctype,
				"record_count": len(records),
				"records": [_export_doc(doctype, name, include_children=True) for name in records],
			}
		)
	return exported


def _export_doc(doctype, name, include_children=False):
	doc = frappe.get_doc(doctype, name)
	return _sanitize_document(doc, include_children=include_children)


def _sanitize_document(doc, include_children=False):
	data = doc.as_dict(no_default_fields=False)
	cleaned = {"doctype": doc.doctype, "name": doc.name}
	meta = frappe.get_meta(doc.doctype)
	table_fields = {field.fieldname for field in meta.get_table_fields()}

	for key, value in data.items():
		if key in SYSTEM_FIELDS:
			continue
		if key in table_fields:
			if include_children:
				cleaned[key] = [_sanitize_child_row(row) for row in value or []]
			continue
		cleaned[key] = value

	return cleaned


def _sanitize_child_row(row):
	cleaned = {}
	for key, value in row.items():
		if key in CHILD_TABLE_SYSTEM_FIELDS:
			continue
		cleaned[key] = value
	return cleaned


def _save_bundle(meta, bundle_json):
	doc = frappe.get_doc(
		{
			"doctype": "Customization Bundle",
			"bundle_name": meta.get("bundle_name"),
			"version": meta.get("version"),
			"erpnext_version": meta.get("erpnext_version"),
			"frappe_version": meta.get("frappe_version"),
			"exported_on": meta.get("exported_on"),
			"exported_by": meta.get("exported_by"),
			"notes": meta.get("notes"),
			"bundle_json": bundle_json,
		}
	)
	doc.insert(ignore_permissions=True)


def _empty_section():
	return {"created": 0, "updated": 0, "skipped": 0, "errors": []}


def _empty_data_section():
	return {
		"created": 0,
		"updated": 0,
		"skipped": 0,
		"errors": [],
		"by_doctype": {},
	}


def _empty_report():
	return {
		"custom_fields": _empty_section(),
		"property_setters": _empty_section(),
		"workflows": _empty_section(),
		"print_formats": _empty_section(),
		"client_scripts": _empty_section(),
		"form_layouts": _empty_section(),
		"notifications": _empty_section(),
		"custom_docperms": _empty_section(),
		"data": _empty_data_section(),
	}


def _validate_bundle(bundle):
	if not isinstance(bundle, dict):
		raise frappe.ValidationError("Bundle JSON must be an object.")

	if "meta" not in bundle:
		raise frappe.ValidationError("Bundle JSON is missing the meta section.")


def _restore_custom_fields(records, section_report, dry_run):
	_restore_documents(
		"Custom Field",
		records,
		section_report,
		dry_run,
		match_keys=["dt", "fieldname"],
	)


def _restore_property_setters(records, section_report, dry_run):
	_restore_documents(
		"Property Setter",
		records,
		section_report,
		dry_run,
		match_keys=["doc_type", "field_name", "property"],
	)


def _restore_workflows(records, section_report, dry_run):
	for record in records:
		try:
			if not isinstance(record, dict):
				raise frappe.ValidationError("Workflow payload must be an object.")

			filters = _build_exists_filters(record, ["name", "workflow_name"])
			if not filters:
				raise frappe.ValidationError("Workflow payload is missing name/workflow_name.")

			existing_name = frappe.db.exists("Workflow", filters)
			if dry_run:
				section_report["updated" if existing_name else "created"] += 1
				continue

			record_data = _prepare_doc_payload(record)
			if existing_name:
				doc = frappe.get_doc("Workflow", existing_name)
				_apply_document_data(doc, record_data, reset_tables=True)
				doc.save(ignore_permissions=True)
				section_report["updated"] += 1
			else:
				record_data["doctype"] = "Workflow"
				doc = frappe.get_doc(record_data)
				doc.insert(ignore_permissions=True)
				section_report["created"] += 1
		except Exception as exc:
			section_report["errors"].append(str(exc))


def _restore_form_layouts(records, section_report, dry_run):
	if not frappe.db.exists("DocType", "Form Layout"):
		return
	_restore_documents("Form Layout", records, section_report, dry_run, match_keys=["dt"])


def _restore_notifications(records, section_report, dry_run):
	_restore_documents("Notification", records, section_report, dry_run, match_keys=["name"])


def _restore_custom_docperms(records, section_report, dry_run):
	# `parent` in Custom DocPerm is the DocType name (meaningful data), not a Frappe hierarchy
	# field, so we can't use the generic _restore_documents helper which strips it via
	# _prepare_doc_payload → SYSTEM_FIELDS.
	skip_fields = (SYSTEM_FIELDS - {"parent"}) | {"name"}
	for record in records:
		try:
			if not isinstance(record, dict):
				raise frappe.ValidationError("Custom DocPerm payload must be an object.")

			doctype_name = record.get("parent")
			role = record.get("role")
			if not doctype_name or not role:
				raise frappe.ValidationError("Custom DocPerm is missing parent or role.")

			permlevel = record.get("permlevel") or 0
			existing_name = frappe.db.exists(
				"Custom DocPerm", {"parent": doctype_name, "role": role, "permlevel": permlevel}
			)

			if dry_run:
				section_report["updated" if existing_name else "created"] += 1
				continue

			perm_data = {k: v for k, v in record.items() if k not in skip_fields}
			if existing_name:
				doc = frappe.get_doc("Custom DocPerm", existing_name)
				for key, value in perm_data.items():
					doc.set(key, value)
				doc.save(ignore_permissions=True)
				section_report["updated"] += 1
			else:
				perm_data["doctype"] = "Custom DocPerm"
				frappe.get_doc(perm_data).insert(ignore_permissions=True)
				section_report["created"] += 1
		except Exception as exc:
			section_report["errors"].append(str(exc))


def _restore_documents(doctype, records, section_report, dry_run, match_keys):
	for record in records:
		try:
			if not isinstance(record, dict):
				raise frappe.ValidationError(f"{doctype} payload must be an object.")

			filters = _build_exists_filters(record, match_keys)
			if not filters:
				raise frappe.ValidationError(f"{doctype} payload is missing matching keys.")

			existing_name = frappe.db.exists(doctype, filters)
			if dry_run:
				section_report["updated" if existing_name else "created"] += 1
				continue

			record_data = _prepare_doc_payload(record)
			if existing_name:
				doc = frappe.get_doc(doctype, existing_name)
				_apply_document_data(doc, record_data)
				doc.save(ignore_permissions=True)
				section_report["updated"] += 1
			else:
				record_data["doctype"] = doctype
				doc = frappe.get_doc(record_data)
				doc.insert(ignore_permissions=True)
				section_report["created"] += 1
		except Exception as exc:
			section_report["errors"].append(str(exc))


def _restore_seed_data(data_sections, data_report, dry_run, field_mapping=None, generated_fields=None, bundled_custom_fields=None):
	if not isinstance(data_sections, list):
		data_report["errors"].append("Data section must be an array.")
		return

	field_mapping = field_mapping or {}
	generated_fields = generated_fields or {}
	bundled_custom_fields = bundled_custom_fields or []

	if not dry_run:
		_create_generated_custom_fields(generated_fields, bundled_custom_fields)

	general_errors = []
	for section in data_sections:
		try:
			if not isinstance(section, dict):
				raise frappe.ValidationError("Each data section must be an object.")

			doctype = section.get("doctype")
			if not doctype:
				raise frappe.ValidationError("Data section is missing the doctype.")
			if not _is_safe_data_doctype(doctype):
				raise frappe.ValidationError(f"Seed data import is not allowed for {doctype}.")

			records = section.get("records") or []
			section_report = _get_data_doctype_report(data_report, doctype)
			prepared_records = [
				_resolve_record_fields(record, doctype, field_mapping.get(doctype) or {})
				for record in records
				if isinstance(record, dict)
			]
			_restore_documents(doctype, prepared_records, section_report, dry_run, match_keys=["name"])
		except Exception as exc:
			general_errors.append(str(exc))

	_rebuild_data_totals(data_report, general_errors)


def _get_data_doctype_report(data_report, doctype):
	return data_report["by_doctype"].setdefault(
		doctype,
		{"created": 0, "updated": 0, "skipped": 0, "errors": []},
	)


def _rebuild_data_totals(data_report, general_errors=None):
	data_report["created"] = sum(row["created"] for row in data_report["by_doctype"].values())
	data_report["updated"] = sum(row["updated"] for row in data_report["by_doctype"].values())
	data_report["skipped"] = sum(row["skipped"] for row in data_report["by_doctype"].values())
	data_report["errors"] = list(general_errors or [])
	for doctype, row in data_report["by_doctype"].items():
		for error in row["errors"]:
			data_report["errors"].append(f"{doctype}: {error}")


def _resolve_record_fields(record, doctype, doctype_mapping):
	meta = frappe.get_meta(doctype)
	table_fields = {field.fieldname for field in meta.get_table_fields()}
	valid_fields = {field.fieldname for field in meta.fields} | {"name"}
	resolved = {}

	for key, value in record.items():
		if key in SYSTEM_FIELDS:
			continue
		if key in table_fields:
			resolved[key] = value
			continue

		target_key = doctype_mapping.get(key) or key
		if target_key in valid_fields:
			resolved[target_key] = value

	return resolved


def _create_generated_custom_fields(generated_fields, bundled_custom_fields):
	bundle_lookup = {}
	for record in bundled_custom_fields:
		if not isinstance(record, dict):
			continue
		dt = record.get("dt")
		fieldname = record.get("fieldname")
		if dt and fieldname:
			bundle_lookup[(dt, fieldname)] = record

	for doctype, fieldnames in generated_fields.items():
		if not isinstance(fieldnames, list):
			continue
		for fieldname in fieldnames:
			if frappe.db.exists("Custom Field", {"dt": doctype, "fieldname": fieldname}):
				continue

			bundle_record = bundle_lookup.get((doctype, fieldname))
			if bundle_record:
				record_data = _prepare_doc_payload(bundle_record)
				record_data["doctype"] = "Custom Field"
				frappe.get_doc(record_data).insert(ignore_permissions=True)
				continue

			frappe.get_doc(
				{
					"doctype": "Custom Field",
					"dt": doctype,
					"fieldname": fieldname,
					"label": _guess_label(fieldname),
					"fieldtype": "Data",
					"insert_after": _get_insert_after_field(doctype),
					"module": "Customization Manager",
				}
			).insert(ignore_permissions=True)


def _get_insert_after_field(doctype):
	meta = frappe.get_meta(doctype)
	for field in reversed(meta.fields):
		if field.fieldname and field.fieldtype not in {"Section Break", "Column Break", "Tab Break", "HTML", "Button"}:
			return field.fieldname
	return "name"


def _build_exists_filters(record, keys):
	if "name" in keys and record.get("name"):
		return {"name": record.get("name")}

	filters = {}
	for key in keys:
		value = record.get(key)
		if value not in (None, ""):
			filters[key] = value
	return filters


def _prepare_doc_payload(record):
	payload = {}
	for key, value in record.items():
		if key in SYSTEM_FIELDS:
			continue
		if isinstance(value, list):
			payload[key] = []
			for row in value:
				if not isinstance(row, dict):
					continue
				payload[key].append(
					{
						child_key: child_value
						for child_key, child_value in row.items()
						if child_key not in CHILD_TABLE_SYSTEM_FIELDS
					}
				)
		else:
			payload[key] = value
	return payload


def _apply_document_data(doc, payload, reset_tables=False):
	meta = frappe.get_meta(doc.doctype)
	table_fields = {field.fieldname for field in meta.get_table_fields()}

	if reset_tables:
		for fieldname in table_fields:
			if fieldname in payload:
				doc.set(fieldname, [])

	for key, value in payload.items():
		if key in {"doctype", "name"}:
			continue
		if key in table_fields:
			doc.set(key, [])
			for row in value or []:
				doc.append(key, row)
		else:
			doc.set(key, value)


def _get_restore_status(report, dry_run):
	if dry_run:
		return "Dry Run"

	for section in report.values():
		if section["errors"]:
			return "Error"
	return "Success"


def _summarize_report(report):
	parts = []
	for section_name, section in report.items():
		if section_name == "data":
			parts.append(
				f"data: created={section['created']}, "
				f"updated={section['updated']}, errors={len(section['errors'])}"
			)
			continue
		parts.append(
			f"{section_name}: created={section['created']}, "
			f"updated={section['updated']}, errors={len(section['errors'])}"
		)
	return "; ".join(parts)
