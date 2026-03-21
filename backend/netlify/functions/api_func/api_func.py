"""
Netlify Functions handler for TellSpike Backend.

Wraps the FastAPI ASGI app with Mangum for AWS Lambda compatibility.
"""

import os
import sys

# Ensure the function's directory is in the path so we can import the app
func_dir = os.path.dirname(os.path.abspath(__file__))
if func_dir not in sys.path:
    sys.path.insert(0, func_dir)

# Also add parent dirs for fallback imports
backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(func_dir)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from mangum import Mangum
from app.main import app

# Mangum adapter: converts Lambda events to ASGI requests
# lifespan="off" because serverless doesn't support persistent lifespan events
handler = Mangum(app, lifespan="off")
