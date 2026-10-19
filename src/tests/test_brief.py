"""The two outputs: plain explanation for the officer + sourced executive brief for the CEO (fake data, no LLM)."""
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "app"))

from navigator import api, brief, cases, llm, search  # noqa: E402
from navigator.cases import Match  # noqa: E402
from navigator.schema import Entity, Evidence, Page  # noqa: E402

URL = "https://www.dcberne.com/en/team/"
PUB_URL = "https://www.dcberne.com/en/projects/"


def _ent(i, name, etype, ev):
    return Entity(id=i, entity_type=etype, name=name, unit="Sensing Lab", source="dcb", source_label="Diabetes Center Berne",
                  source_urls=[URL], retrieved_at="2026-10-18",
                  evidence=[Evidence(field="name", value=name, snippet=name, url=URL), *ev])


ENTS = {
    "p1": _ent("p1", "Prof. Jane Example", "person", [
        Evidence(field="expertise", value="continuous glucose monitoring",
                 snippet="Her lab develops new sensors for continuous glucose monitoring in daily life.", url=URL)]),
    "p2": _ent("p2", "Dr. Not Approved", "person", []),
}
PAGES = [Page(url=PUB_URL, source="dcb", title="Projects", fetched_at="2026", text=(
    "Recent publications\nExample J, Other A. Accuracy of a new CGM system in daily life. Diabetes Care 2025. "
    "doi: 10.1234/dc25-0001\nUnrelated B. Something else entirely, 2024, doi: 10.9999/xyz-2"))]
REQ = {"company": "Example Sensors (fictional)", "contact_email": "ceo@example.com",
       "request_text": "We build a needle-free CGM patch and look for a clinical study partner.", "actor": "Maria"}
OFF = {"actor": "Maria"}


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(cases, "DB", tmp_path / "cases.db")
    from navigator import knowledge_access, published_pitch
    monkeypatch.setattr(knowledge_access, "member", lambda request: {"email": "officer@example.test", "role": "representative"})
    monkeypatch.setattr(published_pitch, "DB", tmp_path / "published.db")
    monkeypatch.setattr(llm, "available", lambda *a, **k: False)
    monkeypatch.setattr(brief.index, "load_entities", lambda: ENTS)
    monkeypatch.setattr(search, "neighbors", lambda ids: {})
    monkeypatch.setattr(brief.crawl, "load_pages", lambda source=None: PAGES)
    brief._publications.cache_clear()
    hl = [{"figure": "100+", "label": {"en": "start-ups"}, "quote": "we work with more than 100 start-ups.", "url": "https://x.ch/i"}]
    monkeypatch.setattr(brief.showcase, "build", lambda: {"highlights": hl})
    monkeypatch.setattr(cases.showcase, "build", lambda: {"highlights": hl})
    matches = [Match(id="p1", name="Prof. Jane Example", entity_type="person", institution="DCB", url=URL),
               Match(id="p2", name="Dr. Not Approved", entity_type="person", institution="DCB", url=URL)]
    monkeypatch.setattr(cases, "find_matches", lambda analysis, k=12: ([m.model_copy() for m in matches], None))
    return TestClient(api.app)


def _chosen_case(client):
    cid = client.post("/cases", json=REQ).json()["id"]
    client.post(f"/cases/{cid}/selection", json={"selected": ["p1"], **OFF})   # p2 is offered but not chosen
    return cid


def test_pdf_download_and_disabled_server_delivery(client, monkeypatch):
    from navigator import knowledge_access
    monkeypatch.setattr(knowledge_access, 'member', lambda request: {'email': 'officer@example.test', 'role': 'representative'})
    monkeypatch.delenv('SMTP_HOST', raising=False)
    cid = _chosen_case(client)
    prepared = client.post(f'/cases/{cid}/brief', json=OFF).json()
    pdf = client.get('/briefs/' + prepared['token'] + '/pdf')
    assert pdf.status_code == 200 and pdf.content.startswith(b'%PDF')
    assert pdf.content == client.get('/briefs/' + prepared['token'] + '/pdf').content
    assert client.get(f'/cases/{cid}/delivery').json()['configured'] is False
    response = client.post(f'/cases/{cid}/delivery', json={'subject': 'Pitch', 'body': 'Reviewed message', 'idempotency_key': 'test-delivery-key-1234'})
    assert response.status_code == 503


def test_brief_only_chosen_partners_and_everything_sourced(client):
    cid = _chosen_case(client)
    r = client.post(f"/cases/{cid}/brief", json={"lang": "en", "email": "maria@x.ch", **OFF}).json()
    b = r["brief"]
    assert [i["name"] for i in b["items"]] == ["Prof. Jane Example"]  # a partner not chosen is not pitched
    item = b["items"][0]
    assert item["topics"][0]["term"] == "continuous glucose monitoring"
    assert "continuous glucose monitoring" in item["quote"]["text"] and item["quote"]["ref"] >= 1
    assert [p["doi"] for p in item["publications"]] == ["10.1234/dc25-0001"]  # surname match, not the unrelated one
    n = len(b["sources"])
    refs = [item["quote"]["ref"], item["page_ref"], *(x["ref"] for x in item["technical"]),
            *(p["ref"] for p in item["publications"]), *(h["ref"] for h in b["proof"])]
    assert all(1 <= x <= n for x in refs)  # every statement points to a numbered source
    assert any(s["kind"] == "doi" and s["url"] == "https://doi.org/10.1234/dc25-0001" for s in b["sources"])
    assert "agreed" not in b["hook"].lower() and "money" not in b["hook"].lower()
    titles = [s["title"] for s in r["explainer"]]
    assert titles[0] == "Summary of the pitch" and "Why these connections" in titles
    assert any("A small sensor worn on the skin" in ln.get("plain", "") for s in r["explainer"] for ln in s["lines"])
    # public link: works, read-only, stable across updates
    pub = client.get(f"/briefs/{r['token']}").json()
    assert pub["company"] == REQ["company"] and client.get("/briefs/wrong-token").status_code == 404
    r2 = client.post(f"/cases/{cid}/brief", json={"lang": "de", **OFF}).json()
    assert r2["token"] != r["token"] and "Bern" in r2["brief"]["hook"]
    assert client.get(f"/briefs/{r['token']}").json() == pub


def test_brief_needs_chosen_partners_and_email_links_it(client):
    cid = client.post("/cases", json=REQ).json()["id"]
    assert client.post(f"/cases/{cid}/brief", json={"lang": "en", **OFF}).status_code == 400
    cid = _chosen_case(client)
    tok = client.post(f"/cases/{cid}/brief", json={"lang": "en", **OFF}).json()["token"]
    d = client.post(f"/cases/{cid}/draft", json={"lang": "en", "link": f"http://h/#/b/{tok}", **OFF}).json()
    assert f"#/b/{tok}" in d["body"] and "Prof. Jane Example" in d["body"] and "Dr. Not Approved" not in d["body"]


def test_local_company_only_pitch_and_email(client, monkeypatch):
    from navigator import knowledge, complementarity
    record = {"id": "local", "revision": "v1", "name": "Example Materials", "canton": "Bern", "status": "ready",
              "sources": [{"url": "https://example.org/materials", "text": "Biocompatibility testing and microfabrication for medical devices."}]}
    monkeypatch.setattr(knowledge, "get", lambda key: record if key == "local" else None)
    cid = client.post("/cases", json=REQ).json()["id"]
    source = next(complementarity.passages(record))
    result = client.post(f"/cases/{cid}/brief", json={**OFF, "knowledge_sources": [{key: source[key] for key in ("id", "source_id", "revision")}]})
    assert result.status_code == 200
    data = result.json()
    assert data["brief"]["items"][0]["name"] == "Example Materials"
    assert data["brief"]["items"][0]["quote"]["text"] == record["sources"][0]["text"]
    email = client.post(f"/cases/{cid}/draft", json={**OFF, "link": "https://example.test/#/b/" + data["token"]})
    assert email.status_code == 200 and "Example Materials" in email.json()["body"]
    record["revision"] = "v2"
    assert client.post(f"/cases/{cid}/brief", json={**OFF, "knowledge_sources": [{key: source[key] for key in ("id", "source_id", "revision")}] }).status_code == 422


@pytest.mark.parametrize('lang', ['en', 'de', 'fr'])
@pytest.mark.parametrize('mixed', [False, True])
def test_kb_approvals_survive_regeneration_and_summary_matches(client, monkeypatch, lang, mixed):
    from navigator import knowledge, complementarity
    record = {'id':'local','revision':'v1','name':'Example Materials','canton':'Bern','status':'ready',
              'sources':[{'url':'https://example.org/materials','text':'Biocompatibility testing and microfabrication for medical devices.'}]}
    monkeypatch.setattr(knowledge,'get',lambda key:record if key=='local' else None)
    cid=client.post('/cases',json=REQ).json()['id']
    if mixed:
        client.post(f'/cases/{cid}/selection',json={**OFF,'selected':['p1']})
    source=next(complementarity.passages(record))
    refs=[{key:source[key] for key in ('id','revision','source_id')}]
    first=client.post(f'/cases/{cid}/brief',json={**OFF,'lang':lang,'knowledge_sources':refs}).json()
    expected=brief.COMMERCIAL[lang]['summary'].format(company=REQ['company'],n=2 if mixed else 1)
    assert first['summary']['text']==expected
    assert first['explainer'][0]['lines'][0]['text']==expected
    assert any('Example Materials' in line['text'] for line in first['explainer'][1]['lines'])
    assert first['explainer'][2]['lines'][0]['text']==brief.T[lang]['x.check1'].format(c=first['stats']['claims'],p=first['stats']['publications'])
    stored=client.get(f'/cases/{cid}').json()['outreach']['brief']
    assert stored['knowledge_sources']==refs
    assert 'knowledge_sources' not in client.get('/briefs/'+first['token']).json()
    regenerated=client.post(f'/cases/{cid}/brief',json={**OFF,'lang':lang})
    assert regenerated.status_code==200
    assert 'Example Materials' in [i['name'] for i in regenerated.json()['brief']['items']]
    assert regenerated.json()['token']!=first['token']
    record['revision']='v2'
    assert client.post(f'/cases/{cid}/brief',json=OFF).status_code==422
    cleared=client.post(f'/cases/{cid}/brief',json={**OFF,'knowledge_sources':[]})
    assert cleared.status_code==(200 if mixed else 400)
    if mixed:
        assert 'Example Materials' not in [i['name'] for i in cleared.json()['brief']['items']]
