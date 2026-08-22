from fastapi import FastAPI

app = FastAPI(
    title="Cloud Preview Platform",
    version="1.0.0"
)

@app.get("/")
def home():
    return {
        "message": "Preview Environment Platform",
        "version": "1.0.0"
    }

@app.get("/health")
def health():
    return {
        "status": "healthy"
    }