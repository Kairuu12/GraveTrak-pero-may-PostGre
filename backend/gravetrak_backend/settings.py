import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent
# SMS credentials are backend process environment variables, never frontend values.
PHILSMS_ENABLED = os.environ.get('PHILSMS_ENABLED', '0') == '1'
PHILSMS_API_TOKEN = os.environ.get('PHILSMS_API_TOKEN', '')
PHILSMS_SENDER_ID = os.environ.get('PHILSMS_SENDER_ID', '')
PHILSMS_BASE_URL = os.environ.get('PHILSMS_BASE_URL', 'https://dashboard.philsms.com/api/v3').rstrip('/')
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'change-me-to-a-secure-key')
DEBUG = os.environ.get('DJANGO_DEBUG', '0') == '1'
ALLOWED_HOSTS = ['127.0.0.1', 
                 'localhost',
                 'gravetrak-backend.onrender.com']

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework.authtoken',
    'corsheaders',
    'api',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'gravetrak_backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'gravetrak_backend.wsgi.application'

DATABASES = {
    'default': {},
}

db_engine = os.environ.get('DB_ENGINE', 'sqlite' if DEBUG else 'postgresql').strip().lower()

if db_engine in ('sqlite', 'django.db.backends.sqlite3'):
    DATABASES['default'] = {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
elif db_engine in ('postgres', 'postgresql', 'django.db.backends.postgresql'):
    required_db_settings = ('DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_HOST')
    missing_db_settings = [name for name in required_db_settings if not os.environ.get(name)]
    if missing_db_settings:
        raise ImproperlyConfigured(
            'PostgreSQL is selected, but the following environment variables are missing: '
            + ', '.join(missing_db_settings)
        )

    db_port = os.environ.get('DB_PORT', '5432')
    if not db_port.isdigit() or not 1 <= int(db_port) <= 65535:
        raise ImproperlyConfigured('DB_PORT must be an integer between 1 and 65535.')

    DATABASES['default'] = {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ['DB_NAME'],
        'USER': os.environ['DB_USER'],
        'PASSWORD': os.environ['DB_PASSWORD'],
        'HOST': os.environ['DB_HOST'],
        'PORT': db_port,
        'CONN_MAX_AGE': 600,
        'CONN_HEALTH_CHECKS': True,
    }
else:
    raise ImproperlyConfigured(
        "DB_ENGINE must be 'sqlite' or 'postgresql' (also accepts 'postgres')."
    )

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Manila'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',
    ],
}

CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
]

CSRF_TRUSTED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
]

CORS_ALLOW_CREDENTIALS = True
