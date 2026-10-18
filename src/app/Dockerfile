FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 HF_HOME=/models/hf NAV_ROOT=/srv
WORKDIR /srv

# CPU torch keeps the image small; embeddings run fine on CPU for a few thousand entities
RUN pip install --index-url https://download.pytorch.org/whl/cpu torch==2.5.1
COPY app/requirements.txt /srv/app/requirements.txt
RUN pip install -r /srv/app/requirements.txt

# Bake the embedding model into the image -> runs air-gapped afterwards
ARG EMBED_MODEL=intfloat/multilingual-e5-base
RUN python -c "from sentence_transformers import SentenceTransformer as S; S('${EMBED_MODEL}')"

COPY app /srv/app
COPY config /srv/config
COPY eval /srv/eval
COPY tests /srv/tests
ENV PYTHONPATH=/srv/app

EXPOSE 8080
CMD ["uvicorn", "navigator.api:app", "--host", "0.0.0.0", "--port", "8080"]
