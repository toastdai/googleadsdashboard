# TellSpike Backend

Python FastAPI backend for Google Ads Analytics & Alerting Tool.

## Setup

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Run database migrations
alembic upgrade head

# Start the server
uvicorn app.main:app --reload

# Start Celery worker (in another terminal)
celery -A celery_app worker --loglevel=info
```

## Environment Variables

See `.env.example` for required environment variables.

## API Documentation

After starting the server, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
