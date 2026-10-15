from django.apps import AppConfig

# --- BUG FIX PARA SA PYTHON 3.14 & DJANGO 4.2 ---
import copy
from django.template.context import BaseContext, Context

def patched_basecontext_copy(self):
    duplicate = type(self).__new__(type(self))
    duplicate.__dict__.update(self.__dict__)
    duplicate.dicts = self.dicts[:]
    return duplicate

def patched_context_copy(self):
    duplicate = patched_basecontext_copy(self)
    if hasattr(self, 'render_context'):
        duplicate.render_context = copy.copy(self.render_context)
    return duplicate

BaseContext.__copy__ = patched_basecontext_copy
Context.__copy__ = patched_context_copy
# -------------------------------------------------

class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'
