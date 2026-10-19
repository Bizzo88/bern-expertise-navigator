"""Minimal, linked PDF companion to the interactive pitch; generated on demand."""
from io import BytesIO
import base64
from html import escape

def render(brief):
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, PageBreak
    out = BytesIO()
    styles = getSampleStyleSheet()
    from pathlib import Path
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    assets = Path(__file__).parent / 'static' / 'brand'
    for face, filename in [('BernRoboto','roboto-400.ttf'),('BernRobotoMedium','roboto-500.ttf')]:
        if face not in pdfmetrics.getRegisteredFontNames():
            pdfmetrics.registerFont(TTFont(face, str(assets / filename)))
    for style in styles.byName.values():
        style.fontName = 'BernRoboto'
    for name in ('Title','Heading1','Heading2','Heading3'):
        styles[name].fontName = 'BernRobotoMedium'
    styles['BodyText'].leading = 16
    brand = brief.get('branding', {})
    accent = brand.get('primary_color', '#dc0018')
    styles['Title'].textColor = colors.HexColor(accent)
    from .commercial_pitch import build
    pitch = build(brief)
    story = [Paragraph(escape(pitch['kicker']), styles['Heading2']),
             Paragraph(escape(pitch['headline']), styles['Title']), Spacer(1, 5*mm),
             Paragraph(escape(pitch['lead']), styles['Heading2']),
             Paragraph(escape(pitch['body']), styles['BodyText']), Spacer(1, 4*mm),
             Paragraph(escape(pitch['rationale']), styles['BodyText']), Spacer(1, 4*mm),
             Paragraph(escape(pitch['invitation']), styles['BodyText']), Spacer(1, 6*mm)]
    contact = brief.get('contact', {}).get('email', '')
    if contact:
        from urllib.parse import quote
        url = escape('mailto:' + quote(contact, safe='@') + '?subject=' + quote(brief['company'] + ' — Bern'), quote=True)
        story += [Paragraph(f'<link href="{url}" color="{accent}">{escape(pitch["cta"])}</link>', styles['Heading2'])]
    else:
        story += [Paragraph(escape(pitch['missing_contact']), styles['BodyText'])]
    story += [Paragraph(escape(pitch['evidence']), styles['Heading2'])]
    for source in pitch['links']:
        url = escape(source['url'], quote=True)
        story += [Paragraph(f'<link href="{url}" color="{accent}">{escape(source["label"])}</link>', styles['BodyText'])]
    story += [Spacer(1, 5*mm), Paragraph(escape(brief['from']), styles['BodyText'])]
    if brief.get('items') or brief.get('sources'):
        story += [PageBreak(), Paragraph(escape(pitch['details']), styles['Title'])]
    logo = brand.get('company_logo')
    if logo:
        image = Image(BytesIO(base64.b64decode(logo.split(',',1)[1])))
        image._restrictSize(60*mm, 25*mm)
        story.insert(0, image)
    curated_ids = [node['id'] for node in brief.get('ecosystem', {}).get('nodes', [])]
    by_id = {it['id']: it for it in brief['items']}
    featured = [by_id[i] for i in curated_ids if i in by_id] if curated_ids else brief['items'][:3]
    for item in featured:
        story += [Paragraph(escape(item['name']), styles['Heading2']), Paragraph(escape(item.get('benefit', '')), styles['BodyText'])]
        if item.get('quote'):
            story += [Paragraph(escape(item['quote']['text']), styles['BodyText'])]
        url = escape(item['page'], quote=True)
        story += [Paragraph(f'<link href="{url}" color="{accent}">{url}</link>', styles['BodyText']), Spacer(1, 4*mm)]
    if brief.get('sources'):
        story += [Paragraph(escape(brief['labels']['sources']), styles['Heading2'])]
        for source in brief['sources']:
            url = escape(source['url'], quote=True)
            story += [Paragraph(f'<link href="{url}">{escape(source["label"][:180])}</link>', styles['BodyText'])]
    story += [Spacer(1, 5*mm), Paragraph(escape(brief['from']), styles['BodyText'])]
    SimpleDocTemplate(out, pagesize=(210*mm,297*mm), rightMargin=20*mm,leftMargin=20*mm,topMargin=18*mm,bottomMargin=18*mm,invariant=1).build(story)
    return out.getvalue()
