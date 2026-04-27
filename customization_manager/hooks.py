from . import __version__ as app_version

app_name = "customization_manager"
app_title = "Customization Manager"
app_publisher = "OpenAI"
app_description = "Backup and restore ERPNext customizations as portable JSON bundles"
app_email = "support@example.com"
app_license = "MIT"
app_version = app_version
app_icon = "fa fa-database"
app_color = "#4f8bf9"
app_include_css = "/assets/customization_manager/css/customization_manager.css"

add_to_apps_screen = [
	{
		"name": "customization_manager",
		"title": "Customization Manager",
		"route": "/app/customization-manager",
		"has_permission": "customization_manager.api.has_permission",
	}
]

fixtures = [
	{
		"dt": "Custom Field",
		"filters": [["module", "=", "Customization Manager"]],
	},
	{
		"dt": "Property Setter",
		"filters": [["module", "=", "Customization Manager"]],
	},
]
