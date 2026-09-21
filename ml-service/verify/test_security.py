import os
import subprocess
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
import config as C
from fastapi import HTTPException
from security import is_authorized, require_service_auth, safe_request_id


class ServiceAuthTests(unittest.TestCase):
    def test_requires_exact_bearer_token(self):
        expected = "x" * 32
        self.assertTrue(is_authorized(f"Bearer {expected}", expected))
        self.assertFalse(is_authorized("Bearer wrong", expected))
        self.assertFalse(is_authorized(None, expected))

    def test_request_id_is_bounded_and_sanitized(self):
        self.assertEqual(safe_request_id("trace-123"), "trace-123")
        generated = safe_request_id("bad\nrequest-id")
        self.assertLessEqual(len(generated), 128)
        self.assertNotRegex(generated, r"[^A-Za-z0-9._:-]")

    def test_auth_dependency_rejects_invalid_and_accepts_valid_tokens(self):
        previous_token = C.ML_SERVICE_TOKEN
        C.ML_SERVICE_TOKEN = "x" * 32
        try:
            with self.assertRaises(HTTPException) as missing:
                require_service_auth(None)
            self.assertEqual(missing.exception.status_code, 401)
            with self.assertRaises(HTTPException):
                require_service_auth("Bearer wrong")
            self.assertIsNone(require_service_auth(f"Bearer {C.ML_SERVICE_TOKEN}"))
        finally:
            C.ML_SERVICE_TOKEN = previous_token

    def test_auth_dependency_does_not_disable_when_local_token_is_missing(self):
        previous_token = C.ML_SERVICE_TOKEN
        C.ML_SERVICE_TOKEN = ""
        try:
            with self.assertRaises(HTTPException) as missing:
                require_service_auth("Bearer local-development-token")
            self.assertEqual(missing.exception.status_code, 401)
        finally:
            C.ML_SERVICE_TOKEN = previous_token

    def test_production_config_fails_closed_for_auth_and_cors(self):
        config_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src"))

        def run_config(**updates):
            environment = os.environ.copy()
            environment.update({"NODE_ENV": "production", "PYTHONPATH": config_dir})
            environment.pop("ML_SERVICE_TOKEN", None)
            environment.pop("ALLOWED_ORIGINS", None)
            environment.update(updates)
            return subprocess.run(
                [sys.executable, "-c", "import config"],
                cwd=config_dir,
                env=environment,
                capture_output=True,
                text=True,
                check=False,
            )

        self.assertNotEqual(run_config(ALLOWED_ORIGINS="https://app.example").returncode, 0)
        self.assertNotEqual(run_config(ML_SERVICE_TOKEN="x" * 32).returncode, 0)
        self.assertNotEqual(run_config(ML_SERVICE_TOKEN="replace_with_long_random_service_token_at_least_32_chars", ALLOWED_ORIGINS="https://app.example").returncode, 0)
        self.assertNotEqual(run_config(ML_SERVICE_TOKEN="x" * 32, ALLOWED_ORIGINS="*").returncode, 0)
        self.assertNotEqual(run_config(ML_SERVICE_TOKEN="x" * 32).returncode, 0)
        self.assertEqual(run_config(ML_SERVICE_TOKEN="abcd" * 8, ALLOWED_ORIGINS="https://app.example").returncode, 0)

    def test_allowed_origins_are_explicit_bounded_and_normalized(self):
        self.assertEqual(C.parse_allowed_origins("https://app.example/, https://api.example"), ["https://app.example", "https://api.example"])
        with self.assertRaises(RuntimeError):
            C.parse_allowed_origins("*")
        with self.assertRaises(RuntimeError):
            C.parse_allowed_origins(",".join([f"https://{i}.example" for i in range(21)]))

    def test_health_route_is_public_and_protected_routes_have_auth_dependency(self):
        import main

        routes = {route.path: route for route in main.app.routes if hasattr(route, "path")}
        self.assertEqual(routes["/health"].dependencies, [])
        for path in ("/predict", "/localities", "/model-info", "/feature-importance"):
            self.assertEqual(len(routes[path].dependencies), 1)


if __name__ == "__main__":
    unittest.main()
