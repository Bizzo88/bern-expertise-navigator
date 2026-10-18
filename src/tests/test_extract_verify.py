"""The anti-hallucination validator: unsupported claims must be dropped."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "app"))

from navigator.extract import merge, to_entity, verify  # noqa: E402
from navigator.schema import Cited, ExtractedEntity, Page  # noqa: E402

PAGE = Page(
    url="https://example.unibe.ch/people/jane",
    source="artorg",
    title="Jane Doe – ARTORG",
    text=("Prof. Dr. Jane Doe leads the Diabetes Technology Lab.\n"
          "Her research focuses on continuous glucose monitoring and closed-loop insulin delivery.\n"
          "The lab operates a wearable sensor testbed."),
    fetched_at="2026-10-18T09:00:00Z",
)


def C(v, s):
    return Cited(value=v, snippet=s)


def test_supported_fields_kept_and_invented_ones_dropped():
    ent = ExtractedEntity(
        entity_type="person",
        name=C("Jane Doe", "Prof. Dr. Jane Doe leads the Diabetes Technology Lab."),
        role=C("Professor", "She is a full professor since 2010."),          # invented snippet
        unit=C("Diabetes Technology Lab", "Prof. Dr. Jane Doe leads the Diabetes Technology Lab."),
        expertise=[
            C("continuous glucose monitoring", "Her research focuses on continuous glucose monitoring and closed-loop insulin delivery."),
            C("cancer immunotherapy", "Her research focuses on continuous glucose monitoring and closed-loop insulin delivery."),  # value not in snippet
        ],
        infrastructure=[C("wearable sensor testbed", "The lab operates a wearable sensor testbed.")],
    )
    rejected = []
    v = verify(ent, PAGE, rejected)
    assert v is not None
    assert v.role is None
    assert [c.value for c in v.expertise] == ["continuous glucose monitoring"]
    assert v.unit and v.infrastructure
    assert {r["field"] for r in rejected} == {"role", "expertise"}


def test_entity_without_verifiable_name_is_dropped():
    ent = ExtractedEntity(entity_type="person", name=C("John Smith", "John Smith is a professor."))
    assert verify(ent, PAGE, []) is None


def test_every_stored_claim_has_url_and_merge_keeps_evidence():
    ent = ExtractedEntity(entity_type="person",
                          name=C("Jane Doe", "Prof. Dr. Jane Doe leads the Diabetes Technology Lab."),
                          expertise=[C("closed-loop insulin delivery", "Her research focuses on continuous glucose monitoring and closed-loop insulin delivery.")])
    e1 = to_entity(ent, PAGE, "ARTORG")
    e2 = to_entity(ent, PAGE.model_copy(update={"url": "https://example.unibe.ch/team"}), "ARTORG")
    [m] = merge([e1, e2])
    assert len(m.source_urls) == 2
    assert all(ev.url and ev.snippet for ev in m.evidence)
