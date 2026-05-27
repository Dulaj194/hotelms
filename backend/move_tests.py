import os
import shutil
import glob

os.makedirs('tests/unit', exist_ok=True)
os.makedirs('tests/integration', exist_ok=True)

unit_patterns = ['test_auth_*.py', 'test_i18n_*.py', 'test_order_transitions.py', 'test_platform_access_*.py', 'test_promo_codes_*.py', 'test_reports_*.py', 'test_restaurant_billing_*.py', 'test_sms_config_*.py', 'test_subscription_*.py']
integration_patterns = ['test_billing_*.py', 'test_critical_paths_integration.py', 'test_menu_hierarchy_services.py', 'test_model_registry.py', 'test_platform_banners.py', 'test_qr_service.py', 'test_realtime_ws_auth.py', 'test_site_content_*.py', 'test_standardization_checks.py', 'test_super_admin_*.py', 'test_table_sessions_*.py']

for pat in unit_patterns:
    for f in glob.glob(f'tests/{pat}'):
        print(f"Moving {f} to tests/unit/")
        shutil.move(f, 'tests/unit/')

for pat in integration_patterns:
    for f in glob.glob(f'tests/{pat}'):
        print(f"Moving {f} to tests/integration/")
        shutil.move(f, 'tests/integration/')
