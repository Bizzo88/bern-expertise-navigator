from io import BytesIO
import pytest
from pypdf import PdfReader
from navigator import commercial_pitch, pitch_pdf


def example(lang='en'):
    return {'company':'Example XR','lang':lang,'kicker':'Old dossier','hook':'You save 6–12 months','headline':'Old headline',
            'objective':'Private text should not be repeated', 'proof':[{'figure':'CHF 6M+'}],
            'items':[{'id':'p','name':'Dr Example','page':'https://example.org/research','topics':[{'term':'applied AI'}],
                      'quote':{'text':'Documented source evidence'},'technical':[],'publications':[],'benefit':'Potential support'}],
            'ecosystem':{'nodes':[{'id':'p'}]},'sources':[{'url':'https://example.org/research','label':'Research source'}],
            'contact':{'email':'bern@example.org'},'from':'Canton Bern','labels':{'sources':'Sources'}}


@pytest.mark.parametrize('lang',['en','de','fr'])
def test_short_commercial_copy_excludes_legacy_claims_and_directory(lang):
    data=example(lang);copy=commercial_pitch.build(data)
    visible=' '.join(copy[k] for k in ('headline','lead','body','rationale','invitation','cta'))
    assert 'Example XR' in visible
    assert ('Berne' if lang == 'fr' else 'Bern') in visible
    assert 'applied AI' in copy['body']
    assert 'Dr Example' not in visible
    assert 'months' not in visible and 'CHF' not in visible and 'Private text' not in visible
    assert 110 < len(visible.split()) < 230
    assert copy['links']==[{'label':'Dr Example','url':'https://example.org/research'}]
    assert 'commercial' not in data


def test_evidence_links_are_bounded_and_public():
    data=example()
    data['ecosystem']={'nodes':[]}
    data['items'] += [{'id':str(i),'name':'Source '+str(i),'page':'https://example.org/'+str(i),'topics':[]} for i in range(8)]
    assert len(commercial_pitch.build(data)['links'])==3
    data['items']=[{'name':'Unsafe','page':'javascript:alert(1)','topics':[]}]
    assert commercial_pitch.build(data)['links']==[]


def test_pdf_opens_with_pitch_then_evidence_appendix():
    pdf=pitch_pdf.render(example())
    reader=PdfReader(BytesIO(pdf))
    text=reader.pages[0].extract_text()
    assert 'Your next move' in text and 'short call' in text
    assert '6–12 months' not in text and 'CHF' not in text and 'Private text' not in text
    assert 'Documented source evidence' not in text
    assert 'Documented source evidence' in reader.pages[1].extract_text()


@pytest.mark.parametrize('lang',['en','de','fr'])
def test_ambition_is_contextualized_without_copying_private_notes(lang):
    data=example(lang);data['objective']='We want XR platform development expertise and AI integration.'
    story=commercial_pitch.build(data)
    assert {'en':'immersive','de':'immersive','fr':'immersives'}[lang] in story['lead']
    assert 'XR platform development expertise' not in story['lead']
    data['items'][0]['type']='company'
    story=commercial_pitch.build(data)
    assert {'en':'local companies','de':'lokale Unternehmen','fr':'entreprises locales'}[lang] in story['body']
