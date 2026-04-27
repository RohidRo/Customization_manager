from pathlib import Path

from setuptools import find_packages, setup


def get_version():
	version_file = Path(__file__).parent / "customization_manager" / "__init__.py"
	for line in version_file.read_text(encoding="utf-8").splitlines():
		if line.startswith("__version__"):
			return line.split("=", maxsplit=1)[1].strip().strip('"')
	return "0.0.1"


setup(
	name="customization_manager",
	version=get_version(),
	description="Backup and restore ERPNext customizations as portable JSON bundles",
	author="OpenAI",
	author_email="support@example.com",
	packages=find_packages(),
	include_package_data=True,
	zip_safe=False,
	install_requires=[],
)
