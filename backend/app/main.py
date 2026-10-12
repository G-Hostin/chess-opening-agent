from fastapi import FastAPI

app = FastAPI(title="Agent IA ouvertures d'échecs")


# Sert à vérifier que l'API répond, en local comme dans le conteneur
@app.get("/api/v1/healthcheck")
def healthcheck():
    return {"status": "ok"}
