"""
Django settings for complia_backend project.
Production-ready configuration locked to the dotenv + dj-database-url stack.
"""

import os
import sys
from datetime import timedelta
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
TESTING = "test" in sys.argv


def _env_list(name: str, default: str = "") -> list[str]:
    raw = os.getenv(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


# ==============================
# CORE SECURITY
# ==============================
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise ValueError("SECRET_KEY environment variable is required.")

DEBUG = os.getenv("DEBUG", "False").lower() in ("true", "1", "yes")
ALLOWED_HOSTS = _env_list("ALLOWED_HOSTS", "localhost,127.0.0.1")

# CORS/CSRF should always be explicit in deployed environments.
CORS_ALLOWED_ORIGINS = _env_list("CORS_ALLOWED_ORIGINS")
CSRF_TRUSTED_ORIGINS = _env_list("CSRF_TRUSTED_ORIGINS")


# ==============================
# APPLICATION DEFINITION
# ==============================
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.sites",
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "allauth.socialaccount.providers.google",
    "dj_rest_auth",
    "dj_rest_auth.registration",
    "accounts",
    "complia_backend.notices",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "allauth.account.middleware.AccountMiddleware",
]

if not TESTING:
    MIDDLEWARE.insert(1, "whitenoise.middleware.WhiteNoiseMiddleware")

ROOT_URLCONF = "complia_backend.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "complia_backend.wsgi.application"


# ==============================
# DATABASE
# ==============================
if TESTING:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "test_db.sqlite3",
        }
    }
else:
    db_ssl_require = os.getenv("DB_SSL_REQUIRE")
    if db_ssl_require is None:
        ssl_require = not DEBUG
    else:
        ssl_require = db_ssl_require.lower() in ("true", "1", "yes")

    DATABASES = {
        "default": dj_database_url.config(
            default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
            conn_max_age=600,
            ssl_require=ssl_require,
        )
    }


# ==============================
# CUSTOM USER + AUTH
# ==============================
AUTH_USER_MODEL = "accounts.User"
AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
]
SITE_ID = int(os.getenv("SITE_ID", "1"))

ACCOUNT_EMAIL_VERIFICATION = "none"
ACCOUNT_LOGIN_METHODS = {"email"}
ACCOUNT_USER_MODEL_USERNAME_FIELD = None
ACCOUNT_SIGNUP_FIELDS = ["email*", "password1*", "password2*"]


# ==============================
# REST / JWT
# ==============================
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticatedOrReadOnly",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
        "rest_framework.throttling.ScopedRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "100/hour",
        "user": "1000/hour",
        "feedback": "30/hour",
        "ca_help": "20/hour",
        "analytics_event": "300/hour",
        "admin_metrics": "600/hour",
    },
    "EXCEPTION_HANDLER": "complia_backend.exceptions.custom_exception_handler",
}

if DEBUG:
    REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"] = [
        "rest_framework.renderers.JSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",
    ]
else:
    REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"] = [
        "rest_framework.renderers.JSONRenderer",
    ]

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

REST_AUTH = {
    "USE_JWT": True,
    "JWT_AUTH_COOKIE": "jwt-auth",
    "JWT_AUTH_HTTPONLY": True,
    "TOKEN_MODEL": None,
    "USER_DETAILS_SERIALIZER": "accounts.serializers.UserDetailSerializer",
}

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
SOCIALACCOUNT_PROVIDERS = {
    "google": {
        "APP": {
            "client_id": GOOGLE_CLIENT_ID,
            "secret": GOOGLE_CLIENT_SECRET,
        },
        "SCOPE": ["profile", "email"],
        "AUTH_PARAMS": {"access_type": "online"},
    }
}


# ==============================
# PASSWORD VALIDATION
# ==============================
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]


# ==============================
# I18N / STATIC
# ==============================
LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Kolkata"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# ==============================
# PRODUCTION HARDENING
# ==============================
if not DEBUG and not TESTING:
    SECURE_SSL_REDIRECT = True
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_SAMESITE = "Lax"
    CSRF_COOKIE_SECURE = True
    CSRF_COOKIE_SAMESITE = "Lax"
    CSRF_COOKIE_HTTPONLY = True
    SECURE_HSTS_SECONDS = int(os.getenv("SECURE_HSTS_SECONDS", "31536000"))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
    X_FRAME_OPTIONS = "DENY"


# ==============================
# MONITORING
# ==============================
SENTRY_DSN = os.getenv("SENTRY_DSN")
if SENTRY_DSN:
    import sentry_sdk

    sentry_sdk.init(dsn=SENTRY_DSN, traces_sample_rate=0.1, send_default_pii=False)
