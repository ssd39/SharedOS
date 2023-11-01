import os
import uvicorn

port = int(os.environ.get("PORT", 8000))  # Default port is 8000 if PORT is not set in the environment

if __name__ == "__main__":
    uvicorn.run("api:app", host="0.0.0.0", port=port, reload=True)
