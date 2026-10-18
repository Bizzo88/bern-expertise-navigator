"""Company-request workflow over the API: understand -> select -> review -> invite (no LLM, temp database)."""
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "app"))

from navigator import api, cases, llm, plain  # noqa: E402
from navigator.cases import Match  # noqa: E402

REQ = {"company": "Example Sensors GmbH (fictional)", "contact_name": "Anna Example", "contact_email": "anna@example.com",
       "country": "Germany", "request_text": "We develop a needle-free CGM patch for type 1 diabetes. "
       "We are looking for a clinical study partner and need help with CE marking."}


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(cases, "DB", tmp_path / "cases.db")
    monkeypatch.setattr(llm, "available", lambda *a, **k: False)
    fake = [Match(id=f"e{i}", name=n, entity_type=t, institution="DCB", url=f"https://www.dcberne.com/{i}", why="test")
            for i, (n, t) in enumerate([("Prof. A", "person"), ("Lab B", "unit"), ("Dr. C", "person")])]
    monkeypatch.setattr(cases, "find_matches", lambda analysis, k=12: (list(fake), None))
    monkeypatch.setattr(cases.showcase, "build", lambda: {"highlights": [{"quote": "Verified sentence.", "url": "https://x.ch/a"}]})
    return TestClient(api.app)


def test_plain_language_terms_from_glossary():
    found = {t["term"] for t in plain.find_terms(REQ["request_text"])}
    assert {"continuous glucose monitoring", "type 1 diabetes", "clinical study", "regulatory affairs"} <= found
    de = plain.find_terms("needle-free CGM", "de")
    assert any("Blutzucker" in t["plain"] for t in de)


def test_full_workflow(client):
    c = client.post("/cases", json=REQ).json()
    cid = c["id"]
    assert c["status"] == "new" and c["analysis"]["generated_by"] == "rules" and len(c["matches"]) == 3
    assert client.post(f"/cases/{cid}/review-request", json={"reviewer": "Dr. R"}).status_code == 400  # nothing selected
    client.post(f"/cases/{cid}/selection", json={"selected": ["e0", "e1"]})
    assert client.post(f"/cases/{cid}/draft", json={}).status_code == 400  # not approved yet
    assert client.post(f"/cases/{cid}/review-request", json={"reviewer": "Dr. R", "note": "ok?"}).json()["status"] == "in_review"
    bad = client.post(f"/cases/{cid}/review", json={"decision": "approved", "verdicts": [{"id": "e0", "verdict": "no"}]})
    assert bad.status_code == 400  # cannot approve with zero suitable partners
    r = client.post(f"/cases/{cid}/review", json={"decision": "approved", "comment": "fine", "actor": "Dr. R",
                                                  "verdicts": [{"id": "e0", "verdict": "ok"}, {"id": "e1", "verdict": "no"}]})
    assert r.json()["status"] == "approved"
    d = client.post(f"/cases/{cid}/draft", json={"lang": "de", "slots": ["Di 10:00"], "sender": "Maria"}).json()
    assert "Prof. A" in d["body"] and "Lab B" not in d["body"]  # only partners the reviewer approved
    assert "Verified sentence." in d["body"] and "Di 10:00" in d["body"] and d["to"] == REQ["contact_email"]
    ics = client.get(f"/cases/{cid}/invite.ics", params={"start": "2026-10-22T14:00", "organizer_email": "m@x.ch"})
    assert ics.status_code == 200 and "BEGIN:VEVENT" in ics.text and "ATTENDEE;RSVP=TRUE:mailto:anna@example.com" in ics.text
    done = client.post(f"/cases/{cid}/outcome", json={"kind": "email", "subject": d["subject"], "body": d["body"]}).json()
    assert done["status"] == "contacted"
    kinds = [e["kind"] for e in done["events"]]
    assert kinds == ["created", "analysed", "review_requested", "approved", "emailed"]
    assert client.get("/cases").json()[0]["status"] == "contacted"


def test_changes_requested_reopens_selection(client):
    cid = client.post("/cases", json=REQ).json()["id"]
    client.post(f"/cases/{cid}/selection", json={"selected": ["e2"]})
    client.post(f"/cases/{cid}/review-request", json={"reviewer": "Dr. R"})
    r = client.post(f"/cases/{cid}/review", json={"decision": "changes_requested", "comment": "wrong field"}).json()
    assert r["status"] == "changes_requested" and r["review_comment"] == "wrong field"
    assert client.post(f"/cases/{cid}/review-request", json={"reviewer": "Dr. R"}).json()["status"] == "in_review"
