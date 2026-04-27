# Customization Manager

Customization Manager is a production-ready Frappe app for backing up ERPNext customizations and selected seed/master data into one portable JSON bundle and restoring that bundle onto another site with a dry-run preview.

## Features

- Export Custom Fields, Property Setters, Workflows, Print Formats, and Client Scripts
- Export allowlisted seed/master data like `Item Group`, `Warehouse`, `UOM`, `Price List`, and `Mode of Payment`
- Filter export by customized DocType
- Save every export in `Customization Bundle`
- Preview restore impact with dry-run before live writes
- Upsert existing records instead of creating duplicates
- View recent export and restore activity in `Bundle Log`

## Installation

From your bench root:

```bash
bench get-app /path/to/apps/customization_manager
bench --site your-site-name install-app customization_manager
bench --site your-site-name migrate
bench --site your-site-name clear-cache
```

If the app is already present under `apps/customization_manager`, install it with:

```bash
bench --site your-site-name install-app customization_manager
bench --site your-site-name migrate
bench --site your-site-name clear-cache
```

## Usage

1. Log in as a user with the `System Manager` role.
2. Open the Desk page `Customization Manager`.
3. In the Export panel:
   - choose the customized DocTypes to include
   - optionally choose seed/master data doctypes from the Seed Data section
   - keep workflows / print formats enabled if needed
   - add optional notes
   - click `Export JSON`
4. Move the downloaded JSON file to the target site.
5. In the Restore panel on the target site:
   - upload or drag the JSON file
   - keep `Dry run` enabled first
   - run restore and review the result box
   - uncheck `Dry run` and rerun for a live restore
6. Review the bottom activity table for export / restore history.

## Bench Commands To Test Locally

```bash
bench --site your-site-name console
bench --site your-site-name migrate
bench --site your-site-name clear-cache
bench --site your-site-name execute customization_manager.api.has_permission
bench --site your-site-name execute customization_manager.api.get_customized_doctypes
```

Manual test flow:

1. Create a sample Custom Field, Property Setter, Workflow, Print Format, and Client Script.
2. Create or update a few allowlisted seed data records such as `Warehouse`, `UOM`, or `Item Group`.
3. Export a bundle from the source site.
4. Confirm the bundle JSON includes a top-level `data` section.
5. Confirm a `Customization Bundle` record and `Bundle Log` export row were created.
6. Upload the bundle on another site and run a dry-run restore.
7. Verify the report counts for both customization and seed data, and confirm no live writes happened.
8. Run a live restore and verify the customizations and seed data now exist.
9. Re-run the same restore to confirm existing records are updated instead of duplicated.

Not supported in v1:

- transactional data such as invoices, stock entries, GL entries, and submitted documents
- arbitrary DocType record export outside the explicit allowlist

## Files Added By This App

- `customization_manager/api.py`
- `customization_manager/doctype/customization_bundle/`
- `customization_manager/doctype/bundle_log/`
- `customization_manager/page/customization_manager/`

## GitHub Publishing Steps

1. Initialize a Git repository if needed.
2. Commit the app files with a clean README and license.
3. Push to GitHub with a public repository name matching the app.
4. Add topics like `frappe`, `erpnext`, `frappe-app`, and `customization`.
5. Create a release tag for the app version.

## Frappe Cloud Marketplace Checklist

1. Confirm the app installs cleanly on Frappe v15.
2. Verify metadata, README, and license are complete.
3. Add repository URL, app icon, screenshots, and a short description.
4. Test export and restore on fresh source and target sites.
5. Ensure no external Python dependencies are required.
6. Submit the GitHub repository through the Frappe Cloud Marketplace publisher flow.
