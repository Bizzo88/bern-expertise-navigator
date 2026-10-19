"""Short recipient-facing narrative, separate from the evidence dossier.

No invented savings, timelines, financing, agreed meetings or unsupported outcomes.
The source records remain available behind an explicit evidence disclosure.
"""
from urllib.parse import urlsplit
import re

COPY = {
 'en': {'kicker':'A personal invitation to Bern', 'headline':'Your next move. Connected in Bern.',
        'lead':'{company}, let’s explore what you could build next in Bern.',
        'body':'The ecosystem mapped for you brings together documented expertise in {topics}. Let’s explore how these complementary capabilities could support your next stage of development.',
        'body_generic':'These connections are a starting point for exploring complementary expertise around your ambitions. Let’s identify where Bern could support your next stage of development.',
        'invitation':'Start with a short conversation. Together, we can identify the right connections to explore and shape a focused visit to Bern.',
        'cta':'Let’s talk', 'evidence':'Check the information', 'evidence_intro':'Explore the sources behind the proposed connections. Potential collaborations remain to be discussed.',
        'details':'Explore the supporting expertise', 'pdf':'Download the pitch',
        'missing_contact':'Contact the colleague who shared this invitation to arrange a short conversation.'},
 'de': {'kicker':'Eine persönliche Einladung nach Bern', 'headline':'Ihr nächster Schritt. Vernetzt in Bern.',
        'lead':'{company}: Lassen Sie uns Ihren nächsten Schritt in Bern erkunden.',
        'body':'Das für Sie skizzierte Ökosystem vereint belegte Kompetenzen in {topics}. Lassen Sie uns besprechen, wie diese ergänzenden Fähigkeiten Ihre nächste Entwicklungsphase unterstützen könnten.',
        'body_generic':'Diese Verbindungen sind ein Ausgangspunkt, um ergänzende Kompetenzen für Ihre Ziele zu erkunden. Gemeinsam klären wir, wo Bern Ihre nächste Entwicklungsphase unterstützen könnte.',
        'invitation':'Beginnen wir mit einem kurzen Gespräch. Gemeinsam können wir passende Kontakte erkunden und einen gezielten Besuch in Bern vorbereiten.',
        'cta':'Lassen Sie uns sprechen', 'evidence':'Informationen prüfen', 'evidence_intro':'Entdecken Sie die Quellen hinter den vorgeschlagenen Verbindungen. Mögliche Kooperationen sind gemeinsam zu besprechen.',
        'details':'Die belegten Kompetenzen erkunden', 'pdf':'Pitch herunterladen',
        'missing_contact':'Wenden Sie sich für ein kurzes Gespräch an die Person, die Ihnen diese Einladung geschickt hat.'},
 'fr': {'kicker':'Une invitation personnelle à Berne', 'headline':'Votre prochaine étape. Connectée à Berne.',
        'lead':'{company}, explorons votre prochaine étape à Berne.',
        'body':'L’écosystème proposé réunit des compétences documentées en {topics}. Voyons comment ces capacités complémentaires pourraient soutenir votre prochaine phase de développement.',
        'body_generic':'Ces connexions permettent d’explorer des compétences complémentaires à vos ambitions. Identifions ensemble comment Berne pourrait soutenir votre prochaine phase de développement.',
        'invitation':'Commençons par un bref échange. Ensemble, nous pourrons explorer les contacts pertinents et préparer une visite ciblée à Berne.',
        'cta':'Parlons-en', 'evidence':'Vérifier les informations', 'evidence_intro':'Consultez les sources des connexions proposées. Les collaborations potentielles restent à discuter.',
        'details':'Explorer les compétences documentées', 'pdf':'Télécharger le pitch',
        'missing_contact':'Contactez la personne qui vous a transmis cette invitation pour convenir d’un bref échange.'}
}

# Describe only ambitions explicitly present in the public pitch objective.
# Never paste private notes or raw source text into the commercial narrative.
AMBITIONS = [
    (r'\b(xr|ar|vr|extended reality|virtual reality|augmented reality|immersive)\b',
     {'en':'taking immersive experiences into their next stage of development', 'de':'immersive Erlebnisse in die nächste Entwicklungsphase zu bringen', 'fr':'faire entrer les expériences immersives dans leur prochaine phase de développement'}),
    (r'\b(clinical|klinisch\w*|clinique|validation|validierung)\b',
     {'en':'exploring the next steps in research and validation', 'de':'die nächsten Schritte in Forschung und Validierung zu erkunden', 'fr':'explorer les prochaines étapes de recherche et de validation'}),
    (r'\b(ai|artificial intelligence|machine learning|deep learning|intelligence artificielle|künstliche intelligenz)\b',
     {'en':'developing the next applications of your AI expertise', 'de':'die nächsten Anwendungen Ihrer KI-Kompetenzen zu entwickeln', 'fr':'développer les prochaines applications de votre expertise en IA'}),
    (r'\b(manufactur\w*|production|fertigung|fabrication|industrial\w*)\b',
     {'en':'exploring the next stage of your industrial development', 'de':'die nächste Phase Ihrer industriellen Entwicklung zu erkunden', 'fr':'explorer la prochaine étape de votre développement industriel'}),
]

NARRATIVE = {
 'en': {
    'lead':'For {company}, Bern could be the setting for {ambition}—with complementary expertise to explore alongside your own.',
    'ambition':'your next stage of development',
    'body':'The ecosystem we have mapped brings together {partners}, with capabilities in {topics} documented in the linked sources. These connections give us a concrete basis to explore new applications for your work, questions worth investigating together and opportunities for complementary development.',
    'body_generic':'The ecosystem we have mapped brings together {partners} supported by the linked sources. These connections give us a concrete starting point to explore how local expertise could complement your work and where a useful collaboration might take shape.',
    'rationale':'The opportunity lies in connecting that expertise around your plans. Together, we can examine what could be developed, whether a pilot would be relevant and which connections deserve a closer look. The sources are there for you to check; the next step is to explore the fit with you.',
    'invitation':'Let’s start with a short call focused on your priorities. From there, we can shape a visit to Bern around the most relevant connections and discuss what a first collaboration might look like.',
    'companies':'local companies', 'research':'research expertise', 'facilities':'specialist facilities', 'projects':'research projects', 'connections':'selected connections', 'join':' and '},
 'de': {
    'lead':'Für {company} könnte Bern der Ort sein, um {ambition} – gemeinsam mit ergänzenden Kompetenzen, die Sie erkunden können.',
    'ambition':'Ihre nächste Entwicklungsphase zu gestalten',
    'body':'Das skizzierte Ökosystem verbindet {partners} mit belegten Kompetenzen in {topics}. Daraus entstehen konkrete Ansatzpunkte, um zu prüfen, wie lokale Fähigkeiten Ihre Arbeit ergänzen, neue Anwendungen anregen oder Forschungsgespräche ermöglichen könnten.',
    'body_generic':'Das skizzierte Ökosystem verbindet {partners}, dokumentiert durch die verlinkten Quellen. Diese Verbindungen sind ein konkreter Ausgangspunkt, um ergänzende Kompetenzen und mögliche Formen einer Zusammenarbeit zu erkunden.',
    'rationale':'Die Chance liegt darin, diese Expertise mit Ihren Plänen zu verbinden. Gemeinsam können wir prüfen, was sich entwickeln liesse, ob ein Pilot sinnvoll wäre und welche Kontakte einen vertieften Austausch verdienen. Die Quellen sind überprüfbar; die konkrete Passung klären wir mit Ihnen.',
    'invitation':'Beginnen wir mit einem kurzen Gespräch über Ihre Prioritäten. Darauf können wir einen gezielten Besuch in Bern aufbauen und besprechen, wie eine erste Zusammenarbeit aussehen könnte.',
    'companies':'lokale Unternehmen', 'research':'Forschungskompetenzen', 'facilities':'spezialisierte Einrichtungen', 'projects':'Forschungsprojekte', 'connections':'ausgewählte Verbindungen', 'join':' und '},
 'fr': {
    'lead':'Pour {company}, Berne pourrait être le lieu pour {ambition}, avec des compétences complémentaires à explorer aux côtés des vôtres.',
    'ambition':'préparer votre prochaine phase de développement',
    'body':'L’écosystème proposé réunit {partners} avec des compétences documentées en {topics}. Ces connexions offrent des points de départ concrets pour examiner comment les capacités locales pourraient compléter votre travail, nourrir une nouvelle application ou ouvrir un échange scientifique.',
    'body_generic':'L’écosystème proposé réunit {partners}, documentés par les sources liées. Ces connexions constituent un point de départ concret pour explorer des expertises complémentaires et les formes que pourrait prendre une collaboration utile.',
    'rationale':'L’opportunité consiste à relier ces compétences à vos projets. Ensemble, nous pouvons examiner ce qui pourrait être développé, la pertinence d’un pilote et les connexions à approfondir. Les sources sont à votre disposition ; la prochaine étape consiste à explorer cette adéquation avec vous.',
    'invitation':'Commençons par un bref échange sur vos priorités. Nous pourrons ensuite préparer une visite ciblée à Berne et discuter de ce que pourrait être une première collaboration.',
    'companies':'des entreprises locales', 'research':'des expertises scientifiques', 'facilities':'des infrastructures spécialisées', 'projects':'des projets de recherche', 'connections':'des connexions sélectionnées', 'join':' et '}
}



def build(data):
    language = data.get('lang', 'en')
    language = language if language in COPY else 'en'
    copy = COPY[language]
    narrative = NARRATIVE[language]
    items = data.get('items', [])
    ids = [node.get('id') for node in data.get('ecosystem', {}).get('nodes', [])]
    selected = [item for item in items if not ids or item.get('id') in ids]
    topics = []
    for item in selected:
        for topic in item.get('topics', []):
            value = topic.get('term', '').strip()
            if value and len(value) <= 65 and value.casefold() not in {t.casefold() for t in topics}:
                topics.append(value)
    topics = topics[:3]
    links = []
    for item in selected:
        url = item.get('page', '')
        parsed = urlsplit(url)
        if parsed.scheme not in ('https','http') or not parsed.hostname or parsed.username or parsed.password:
            continue
        if any(link['url'] == url for link in links):
            continue
        links.append({'label': item.get('name', parsed.hostname), 'url': url})
        if len(links) == 3:
            break
    objective = data.get('objective', '')
    ambition = next((translations[language] for pattern, translations in AMBITIONS
                     if re.search(pattern, objective, re.I)), narrative['ambition'])
    types = {item.get('type') for item in selected}
    partners = [narrative[key] for key, included in (
        ('companies', 'company' in types), ('research', bool(types & {'person', 'unit'})),
        ('facilities', 'infrastructure' in types), ('projects', 'project' in types)) if included]
    partner_text = narrative['join'].join(partners[:3]) if partners else narrative['connections']
    return {**copy, 'lead': narrative['lead'].format(company=data.get('company', ''), ambition=ambition),
            'body': narrative['body'].format(topics=', '.join(topics), partners=partner_text) if topics else narrative['body_generic'].format(partners=partner_text),
            'rationale': narrative['rationale'], 'invitation': narrative['invitation'],
            'topics': topics, 'links': links}


def present(data):
    # Derive the safe presentation for legacy snapshots too; retain original evidence.
    return {**data, 'commercial': build(data)}
