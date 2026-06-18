from fastapi import FastAPI

app = FastAPI()

@app.get("/health")
def health():
	return {"status": "ok"}

@app.get("/items")
def get_items():
	return {"items": ["item1", "items2", "items3"]}

@app.post("/items")
def create_item(item: dict):
	return {"created": item}
