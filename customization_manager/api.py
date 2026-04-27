import json

import frappe

BUNDLE_VERSION = "1.1"
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
SEED_DATA_ALLOWLIST = [
	"Item Group",
	"Customer Group",
	"Supplier Group",
	"UOM",
	"Warehouse",
	"Territory",
	"Sales Person",
	"Price List",
	"Mode of Payment",
]


@frappe.whitelist()
def has_permission():
	frappe.only_for("System Manager")
	return True


@frappe.whitelist()
def get_customized_doctypes():
	frappe.only_for("System Manager")

	counts = {}

	custom_field_rows = frappe.db.sql(
		"""
		SELECT dt AS target_doctype, COUNT(*) AS custom_fields
		FROM `tabCustom Field`
		GROUP BY dt
		""",
		as_dict=True,
	)
	for row in custom_field_rows:
		entry = counts.setdefault(
			row.target_doctype,
			{"doctype": row.target_doctype, "custom_fields": 0, "property_setters": 0},
		)
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
		entry = counts.setdefault(
			row.target_doctype,
			{"doctype": row.target_doctype, "custom_fields": 0, "property_setters": 0},
		)
		entry["property_setters"] = int(row.property_setters or 0)

	return sorted(counts.values(), key=lambda row: row["doctype"])


@frappe.whitelist()
def get_exportable_data_doctypes():
	frappe.only_for("System Manager")

	rows = []
	for doctype in SEED_DATA_ALLOWLIST:
		if not frappe.db.exists("DocType", doctype):
			continue
		rows.append(
			{
				"doctype": doctype,
				"record_count": frappe.db.count(doctype),
			}
		)

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

	for section in bundle.get("data") or []:
		if not isinstance(section, dict):
			continue

		doctype = section.get("doctype")
		if not doctype or not frappe.db.exists("DocType", doctype):
			continue

		meta = frappe.get_meta(doctype)
		available_fields = _get_mappable_fields(meta)
		existing_fieldnames = {row["fieldname"] for row in available_fields}
		missing_map = {}

		for record in section.get("records") or []:
			if not isinstance(record, dict):
				continue
			for key, value in record.items():
				if key in SYSTEM_FIELDS or isinstance(value, list):
					continue
				if key in existing_fieldnames:
					continue
				if key not in missing_map:
					missing_map[key] = {
						"fieldname": key,
						"label": _guess_label(key),
						"sample_value": "" if value is None else str(value)[:80],
						"has_bundle_custom_field": (doctype, key) in custom_field_lookup,
					}

		if missing_map:
			analysis["missing_fields"].append(
				{
					"doctype": doctype,
					"available_fields": available_fields,
					"fields": sorted(missing_map.values(), key=lambda row: row["fieldname"]),
				}
			)

	analysis["has_issues"] = bool(analysis["missing_fields"])
	return analysis


@frappe.whitelist()
def export_bundle(
	doctypes=None,
	include_workflows=1,
	include_print_formats=1,
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
def restore_bundle(bundle_json, dry_run=1, field_mapping=None, generated_fields=None):
	frappe.only_for("System Manager")

	dry_run = _as_bool(dry_run)
	report = _empty_report()

	try:
		bundle = json.loads(bundle_json or "{}")
		_validate_bundle(bundle)

		_restore_custom_fields(bundle.get("custom_fields") or [], report["custom_fields"], dry_run)
		_restore_property_setters(bundle.get("property_setters") or [], report["property_setters"], dry_run)
		_restore_workflows(bundle.get("workflows") or [], report["workflows"], dry_run)
		_restore_documents(
			"Print Format",
			bundle.get("print_formats") or [],
			report["print_formats"],
			dry_run,
			match_keys=["name"],
		)
		_restore_documents(
			"Client Script",
			bundle.get("client_scripts") or [],
			report["client_scripts"],
			dry_run,
			match_keys=["name"],
		)
		field_mapping = _parse_nested_json_object(field_mapping)
		generated_fields = _parse_nested_json_object(generated_fields)
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
		_log("Restore", status, _summarize_report(report))
		return report
	except Exception:
		_log("Restore", "Error", frappe.get_traceback(with_context=False))
		frappe.log_error(message=frappe.get_traceback(), title="Customization Manager Restore Failed")
		raise


def _log(action, status, details):
	log_doc = frappe.get_doc(
		{
			"doctype": "Bundle Log",
			"action": action,
			"status": status,
			"details": (details or "")[:140],
			"user": frappe.session.user,
			"timestamp": frappe.utils.now_datetime(),
		}
	)
	log_doc.insert(ignore_permissions=True)


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


def _validate_seed_data_doctypes(data_doctypes):
	invalid = sorted(set(data_doctypes) - set(SEED_DATA_ALLOWLIST))
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
			if doctype not in SEED_DATA_ALLOWLIST:
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
