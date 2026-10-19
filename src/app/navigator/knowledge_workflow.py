"""Private approvals, resolved afresh before generating public pitch content."""
import json
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field
from . import cases, knowledge, complementarity, private_pitch, knowledge_access

router = APIRouter()


class SourceSelection(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    source_id: str = Field(pattern=r'^[0-9a-f]{64}$')
    revision: str = Field(min_length=1, max_length=100)


def resolve(case, selections):
    return private_pitch.build_approved_context(case, selections)


def enrich(output, case, sources):
    if not sources:
        return
    brief = output['brief']
    added = []
    for entry in sources:
        reference = next((n for n, source in enumerate(brief['sources'], 1) if source['url'] == entry['source_url']), None)
        if reference is None:
            brief['sources'].append({'url': entry['source_url'], 'label': entry['company'], 'kind': 'page'})
            reference = len(brief['sources'])
        benefit = {'en': 'Explore the documented capabilities below as a possible complement to your development objectives.',
                   'de': 'Die unten belegten Kompetenzen als mögliche Ergänzung zu Ihren Entwicklungszielen erkunden.',
                   'fr': 'Explorer les compétences documentées ci-dessous comme complément possible à vos objectifs.'}[brief['lang']]
        identifier = 'kb-' + entry['source_id']
        item = {'id': identifier, 'name': entry['company'], 'type': 'company', 'role': None, 'unit': None,
                'institution': entry['canton'], 'page': entry['source_url'], 'page_ref': reference,
                'benefit': benefit, 'topics': [], 'quote': {'text': entry['evidence'], 'ref': reference, 'url': entry['source_url'], 'via': None},
                'technical': [], 'publications': []}
        brief['items'].append(item)
        added.append({'name': item['name'], 'benefit': benefit, 'url': item['page'], 'evidence': item['quote'], 'topics': []})
        brief['ecosystem']['nodes'].append({'id': identifier, 'name': item['name'], 'topics': [], 'url': item['page']})
    brief['opportunities'] = (added + brief.get('opportunities', []))[:3]
    brief['hook'] = {'en': f"For {case.company}, explore complementary expertise in Bern through the documented connections below.",
                     'de': f"Für {case.company}: Ergänzende Kompetenzen in Bern anhand der unten dokumentierten Verbindungen erkunden.",
                     'fr': f"Pour {case.company}, explorez des compétences complémentaires à Berne grâce aux connexions documentées ci-dessous."}[brief['lang']]
    output['stats']['claims'] += len(sources)
    output['stats']['sources'] = len(brief['sources'])
    output['summary']['connections'] += [{'name': e['company'], 'reason': e['evidence'][:150], 'source': e['source_url']} for e in sources]


@router.get('/kb/leads/{lead_id}/sources')
def sources(lead_id: str, response: Response, user=Depends(knowledge_access.require_member)):
    case = cases.get(lead_id)
    if not case:
        raise HTTPException(404, 'Lead not found')
    response.headers['Cache-Control'] = 'no-store'
    return complementarity.retrieve(case.analysis.search_query or case.analysis.summary, scope=case.match_scope)
