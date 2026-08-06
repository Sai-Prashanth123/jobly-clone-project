"""
Generates docs/Jobly-Technical-Documentation.pdf — a client-facing project
walkthrough + technical documentation covering the whole Jobly codebase
(public marketing site, portal SPA, backend API, database, workflows,
deployment) so a future developer can pick up the project without having
seen it before.

Run with:
    C:\\Users\\saip0\\AppData\\Local\\Programs\\Python\\Python311\\python.exe scripts/generate_docs.py

Content is hand-authored from a full codebase audit (not re-scanned at
generation time), so this script is just presentation logic — safe to
regenerate any time the doc's wording/layout needs a tweak.
"""

import os
from datetime import date

from reportlab.lib import colors
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, NextPageTemplate,
    Paragraph, Spacer, Table, TableStyle, Image, PageBreak,
    Preformatted, Flowable, KeepTogether, ListFlowable, ListItem,
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfgen import canvas as pdfcanvas

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO_PATH = os.path.join(ROOT, "public", "assets", "img", "logo", "logo-3.png")
OUTPUT_PATH = os.path.join(ROOT, "docs", "Jobly-Technical-Documentation.pdf")

PAGE_W, PAGE_H = LETTER
MARGIN = 0.85 * inch

NAVY = colors.HexColor("#1a2b4a")
BLUE = colors.HexColor("#4069FF")
LIGHT_BLUE = colors.HexColor("#eef2ff")
GRAY = colors.HexColor("#6b7280")
LIGHT_GRAY = colors.HexColor("#f3f4f6")
BORDER = colors.HexColor("#d1d5db")
CODE_BG = colors.HexColor("#0f172a")
CODE_FG = colors.HexColor("#e2e8f0")

DOC_TITLE = "Jobly — Project Walkthrough & Technical Documentation"

# ---------------------------------------------------------------------------
# Styles
# ---------------------------------------------------------------------------

styles = getSampleStyleSheet()

styles.add(ParagraphStyle(
    name="H1", parent=styles["Heading1"], fontSize=20, leading=24,
    textColor=NAVY, spaceBefore=6, spaceAfter=14, fontName="Helvetica-Bold",
))
styles.add(ParagraphStyle(
    name="H2", parent=styles["Heading2"], fontSize=14, leading=18,
    textColor=BLUE, spaceBefore=16, spaceAfter=8, fontName="Helvetica-Bold",
))
styles.add(ParagraphStyle(
    name="H3", parent=styles["Heading3"], fontSize=11.5, leading=15,
    textColor=NAVY, spaceBefore=12, spaceAfter=6, fontName="Helvetica-Bold",
))
styles.add(ParagraphStyle(
    name="Body", parent=styles["BodyText"], fontSize=9.6, leading=14,
    spaceAfter=8, textColor=colors.HexColor("#1f2937"),
))
styles.add(ParagraphStyle(
    name="Small", parent=styles["Body"], fontSize=8.3, leading=11.5,
    textColor=GRAY,
))
styles.add(ParagraphStyle(
    name="TableCell", parent=styles["Body"], fontSize=8.3, leading=11,
    spaceAfter=0,
))
styles.add(ParagraphStyle(
    name="TableHead", parent=styles["TableCell"], textColor=colors.white,
    fontName="Helvetica-Bold",
))
styles.add(ParagraphStyle(
    name="Callout", parent=styles["Body"], fontSize=9.2, leading=13,
    textColor=NAVY, backColor=LIGHT_BLUE, borderColor=BLUE, borderWidth=0.75,
    borderPadding=8, spaceBefore=6, spaceAfter=10,
))
styles.add(ParagraphStyle(
    name="Cover Title", parent=styles["Title"], fontSize=26, leading=32,
    textColor=NAVY, alignment=TA_CENTER, fontName="Helvetica-Bold",
))
styles.add(ParagraphStyle(
    name="Cover Sub", parent=styles["Body"], fontSize=13, leading=18,
    textColor=GRAY, alignment=TA_CENTER, spaceAfter=0,
))
styles.add(ParagraphStyle(
    name="DiagramLabel", parent=styles["Body"], fontSize=8.6, leading=11,
    alignment=TA_CENTER, textColor=NAVY, spaceAfter=0,
))

TOC_STYLES = [
    ParagraphStyle(name="TOC1", fontSize=11, leading=16, textColor=NAVY,
                   fontName="Helvetica-Bold", spaceBefore=8),
    ParagraphStyle(name="TOC2", fontSize=9.5, leading=13, leftIndent=16,
                   textColor=colors.HexColor("#374151")),
]


def P(text, style="Body"):
    return Paragraph(text, styles[style])


def code_block(text):
    """Dark code box for commands / config / SQL snippets."""
    pre = Preformatted(text, ParagraphStyle(
        name="Code", fontName="Courier", fontSize=8, leading=10.5,
        textColor=CODE_FG,
    ))
    t = Table([[pre]], colWidths=[PAGE_W - 2 * MARGIN])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), CODE_BG),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return t


def data_table(header, rows, col_widths, header_bg=NAVY):
    """Consistent styled table for reference lists throughout the doc."""
    header_cells = [Paragraph(h, styles["TableHead"]) for h in header]
    body_rows = []
    for row in rows:
        body_rows.append([Paragraph(str(c), styles["TableCell"]) for c in row])
    data = [header_cells] + body_rows
    t = Table(data, colWidths=col_widths, repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), header_bg),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            style.append(("BACKGROUND", (0, i), (-1, i), LIGHT_GRAY))
    t.setStyle(TableStyle(style))
    return t


_heading_counter = [0]


def heading(text, level=1, bookmark=None):
    """Heading paragraph that also registers a TOC entry + PDF bookmark."""
    style = "H1" if level == 1 else "H2"
    _heading_counter[0] += 1
    key = bookmark or f"h{_heading_counter[0]}"
    h = Paragraph(text, styles[style])
    h._bookmarkName = key
    h._tocText = text
    h._tocLevel = 0 if level == 1 else 1
    return h


# ---------------------------------------------------------------------------
# Diagram flowable — simple boxes + arrows, schematic only
# ---------------------------------------------------------------------------

class BoxDiagram(Flowable):
    """
    A schematic boxes-and-arrows diagram.
    boxes: list of (x, y, w, h, label, fill_color) in diagram-local points
           (origin bottom-left), label may contain '\\n' for multi-line.
    arrows: list of (x1, y1, x2, y2, label) — straight lines with an
            arrowhead at (x2, y2) and an optional small centered label.
    """

    def __init__(self, width, height, boxes, arrows, box_fill=LIGHT_BLUE,
                 box_border=BLUE, text_color=NAVY):
        Flowable.__init__(self)
        self.width = width
        self.height = height
        self.boxes = boxes
        self.arrows = arrows
        self.box_fill = box_fill
        self.box_border = box_border
        self.text_color = text_color

    def wrap(self, availWidth, availHeight):
        return (self.width, self.height)

    def _arrow_line(self, c, x1, y1, x2, y2):
        c.setStrokeColor(GRAY)
        c.setLineWidth(1.1)
        c.line(x1, y1, x2, y2)
        import math
        ang = math.atan2(y2 - y1, x2 - x1)
        head = 6
        for da in (0.5, -0.5):
            hx = x2 - head * math.cos(ang - da * 0.9)
            hy = y2 - head * math.sin(ang - da * 0.9)
            c.line(x2, y2, hx, hy)

    def _arrow_label(self, c, x1, y1, x2, y2, label):
        if not label:
            return
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        c.setFont("Helvetica", 6.8)
        w = c.stringWidth(label, "Helvetica", 6.8)
        c.setFillColor(colors.white)
        c.rect(mx - w / 2 - 3, my - 6, w + 6, 12, fill=1, stroke=0)
        c.setFillColor(GRAY)
        c.drawCentredString(mx, my - 2.5, label)

    def draw(self):
        c = self.canv
        # 1. lines/arrowheads first (boxes will cover any overrun at the ends)
        for (x1, y1, x2, y2, label) in self.arrows:
            self._arrow_line(c, x1, y1, x2, y2)
        # 2. boxes on top of lines
        for (x, y, w, h, label, fill) in self.boxes:
            fill_color = fill or self.box_fill
            c.setFillColor(fill_color)
            c.setStrokeColor(self.box_border)
            c.setLineWidth(1.2)
            c.roundRect(x, y, w, h, 5, fill=1, stroke=1)
            c.setFillColor(self.text_color)
            c.setFont("Helvetica-Bold", 8.2)
            lines = label.split("\n")
            total_h = len(lines) * 10
            start_y = y + h / 2 + total_h / 2 - 8
            for i, line in enumerate(lines):
                c.drawCentredString(x + w / 2, start_y - i * 10, line)
        # 3. arrow labels last, always on top and always fully readable
        for (x1, y1, x2, y2, label) in self.arrows:
            self._arrow_label(c, x1, y1, x2, y2, label)


def state_machine_diagram(width, states, transitions):
    """Horizontal row of state boxes with labeled arrows between them."""
    n = len(states)
    box_w, box_h = 92, 34
    gap = (width - n * box_w) / max(n - 1, 1)
    boxes = []
    positions = {}
    for i, s in enumerate(states):
        x = i * (box_w + gap)
        y = 40
        boxes.append((x, y, box_w, box_h, s, None))
        positions[s] = (x, y, box_w, box_h)
    arrows = []
    for (frm, to, label) in transitions:
        x1, y1, w1, h1 = positions[frm]
        x2, y2, w2, h2 = positions[to]
        if x2 >= x1:
            arrows.append((x1 + w1, y1 + h1 / 2, x2, y2 + h2 / 2, label))
        else:
            arrows.append((x1, y1 + h1 / 2 - 10, x2 + w2, y2 + h2 / 2 - 10, label))
    return BoxDiagram(width, 100, boxes, arrows)


# ---------------------------------------------------------------------------
# Page decoration (header/footer) + TOC-aware doc template
# ---------------------------------------------------------------------------

class DocTemplate(BaseDocTemplate):
    def afterFlowable(self, flowable):
        if hasattr(flowable, "_bookmarkName"):
            key = flowable._bookmarkName
            text = getattr(flowable, "_tocText", key)
            self.canv.bookmarkPage(key)
            self.notify("TOCEntry", (flowable._tocLevel, text, self.page, key))


def _draw_cover_bg(c, doc):
    pass  # cover handled inline via flowables; no chrome needed


def _draw_page_chrome(c, doc, is_cover=False):
    if is_cover:
        return
    c.saveState()
    # Header rule + running title
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.6)
    c.line(MARGIN, PAGE_H - 0.55 * inch, PAGE_W - MARGIN, PAGE_H - 0.55 * inch)
    try:
        c.drawImage(LOGO_PATH, MARGIN, PAGE_H - 0.5 * inch, width=0.55 * inch,
                    height=0.55 * inch * (80 / 174), mask="auto")
    except Exception:
        pass
    c.setFont("Helvetica", 7.5)
    c.setFillColor(GRAY)
    c.drawRightString(PAGE_W - MARGIN, PAGE_H - 0.45 * inch, DOC_TITLE)
    # Footer
    c.setLineWidth(0.6)
    c.line(MARGIN, 0.6 * inch, PAGE_W - MARGIN, 0.6 * inch)
    c.setFont("Helvetica", 8)
    c.setFillColor(GRAY)
    c.drawString(MARGIN, 0.42 * inch, "Jobly — Confidential")
    c.drawRightString(PAGE_W - MARGIN, 0.42 * inch, f"Page {doc.page}")
    c.restoreState()


def on_page_cover(c, doc):
    _draw_page_chrome(c, doc, is_cover=True)


def on_page_normal(c, doc):
    _draw_page_chrome(c, doc, is_cover=False)


def build_doc():
    doc = DocTemplate(OUTPUT_PATH, pagesize=LETTER,
                       leftMargin=MARGIN, rightMargin=MARGIN,
                       topMargin=0.95 * inch, bottomMargin=0.85 * inch,
                       title=DOC_TITLE, author="Jobly")

    frame_cover = Frame(MARGIN, MARGIN, PAGE_W - 2 * MARGIN, PAGE_H - 2 * MARGIN,
                         id="cover")
    frame_normal = Frame(MARGIN, 0.85 * inch, PAGE_W - 2 * MARGIN,
                          PAGE_H - 1.8 * inch, id="normal")

    doc.addPageTemplates([
        PageTemplate(id="Cover", frames=[frame_cover], onPage=on_page_cover),
        PageTemplate(id="Normal", frames=[frame_normal], onPage=on_page_normal),
    ])

    story = []
    story += build_cover()
    story.append(NextPageTemplate("Normal"))
    story.append(PageBreak())
    story += build_toc()
    story.append(PageBreak())
    story += section_executive_overview()
    story += section_system_architecture()
    story += section_tech_stack()
    story += section_public_site()
    story += section_portal_app()
    story += section_backend()
    story += section_database()
    story += section_workflows()
    story += section_integrations()
    story += section_deployment()
    story += section_new_feature_runbook()
    story += section_appendix_files()
    story += section_appendix_glossary()

    doc.multiBuild(story)


# ---------------------------------------------------------------------------
# Cover + TOC
# ---------------------------------------------------------------------------

def build_cover():
    flow = [Spacer(1, 1.6 * inch)]
    try:
        img = Image(LOGO_PATH, width=1.9 * inch, height=1.9 * inch * (80 / 174))
        img.hAlign = "CENTER"
        flow.append(img)
    except Exception:
        pass
    flow.append(Spacer(1, 0.5 * inch))
    flow.append(P("Jobly", "Cover Title"))
    flow.append(Spacer(1, 0.12 * inch))
    flow.append(P("Project Walkthrough &amp; Technical Documentation", "Cover Sub"))
    flow.append(Spacer(1, 0.35 * inch))
    flow.append(P("A complete architecture, workflow, and deployment reference for the "
                  "Jobly workforce management platform — written so a new developer "
                  "can understand the system and confidently build the next feature.",
                  "Cover Sub"))
    flow.append(Spacer(1, 2.0 * inch))
    flow.append(P(date.today().strftime("Generated %B %d, %Y"), "Cover Sub"))
    return flow


def build_toc():
    flow = [P("Table of Contents", "H1"), Spacer(1, 6)]
    toc = TableOfContents()
    toc.levelStyles = TOC_STYLES
    flow.append(toc)
    return flow


# ---------------------------------------------------------------------------
# 1. Executive Overview
# ---------------------------------------------------------------------------

def section_executive_overview():
    flow = [heading("1. Executive Overview", 1)]
    flow.append(P(
        "Jobly is a workforce management platform built for a staffing/consulting "
        "business: it combines a public marketing website with a full internal "
        "operations portal used to hire, onboard, staff, timesheet, invoice, and "
        "manage employees end-to-end. The codebase is a single monorepo containing "
        "both a public-facing site and a role-based internal application, plus a "
        "separate backend API and a managed Postgres database.", "Body"))
    flow.append(P(
        "The system serves five distinct user roles, each with a different day-to-day "
        "job inside the portal:", "Body"))
    rows = [
        ("Admin", "Full access across every module — the operational super-user role."),
        ("HR", "Owns hiring, onboarding review/approval, employee records, documents, performance reviews, benefits enrollment."),
        ("Operations", "Owns staffing assignments, workforce scheduling, timesheet/attendance oversight."),
        ("Finance", "Owns client invoicing, payments, budgets, expense and cash-flow reporting."),
        ("Employee", "Self-service only — own profile, own timesheets, leave requests, expenses, documents, reviews."),
    ]
    flow.append(data_table(["Role", "What they own in the system"], rows,
                            [1.1 * inch, 5.0 * inch]))
    flow.append(Spacer(1, 4))
    flow.append(P(
        "This document is organized so a developer new to the project can start at "
        "the top (architecture), drill into the frontend and backend in detail, "
        "understand the database and core workflows, and finish with a concrete "
        "runbook for adding a new feature the same way the existing codebase does it.",
        "Body"))
    return flow


# ---------------------------------------------------------------------------
# 2. System Architecture
# ---------------------------------------------------------------------------

def section_system_architecture():
    flow = [heading("2. System Architecture", 1)]
    flow.append(P(
        "Jobly is a classic three-tier web application, split into two independently "
        "deployed pieces plus a managed data platform:", "Body"))

    diagram_w = PAGE_W - 2 * MARGIN
    browser_box = (10, 130, 120, 55, "Browser\n(public site +\nportal SPA)", colors.white)
    frontend_box = (diagram_w / 2 - 80, 130, 160, 55, "Frontend\nAzure Static Web Apps\n(React / Vite build)", LIGHT_BLUE)
    backend_box = (diagram_w - 155, 130, 145, 55, "Backend API\nAzure Web App (Docker)\nExpress / TypeScript", LIGHT_BLUE)
    supabase_box = (diagram_w / 2 - 100, 20, 200, 50, "Supabase\nPostgres + Auth + Storage", LIGHT_BLUE)
    boxes = [browser_box, frontend_box, backend_box, supabase_box]
    arrows = [
        (browser_box[0] + browser_box[2], browser_box[1] + 40,
         frontend_box[0], frontend_box[1] + 40, "loads app"),
        (frontend_box[0] + frontend_box[2], frontend_box[1] + 20,
         backend_box[0], backend_box[1] + 20, "REST /api/v1"),
        (backend_box[0] + backend_box[2] / 2, backend_box[1],
         supabase_box[0] + supabase_box[2] / 2, supabase_box[1] + supabase_box[3],
         "service-role client"),
    ]
    flow.append(BoxDiagram(diagram_w, 195, boxes, arrows))
    flow.append(Spacer(1, 6))

    rows = [
        ("Frontend hosting", "Azure Static Web Apps — static bundle only, no server-side code. Auto-deployed on every push to main via GitHub Actions."),
        ("Backend hosting", "Azure Web App for Containers — a Docker image running the Express API. Deployed manually (no tracked CI pipeline for this — see Section 10)."),
        ("Database", "Supabase-managed PostgreSQL. The backend talks to it exclusively via the Supabase REST API using a service-role key (supabaseAdmin) — not a direct Postgres connection, and not Prisma (Prisma exists in the repo but is unused dead code)."),
        ("Auth", "Supabase Auth issues JWTs. The backend validates them per-request and cross-references a portal_users table for role/employee linkage."),
        ("File storage", "Supabase Storage buckets (employee docs, client docs, invoices, timesheets, performance reviews, enrollment forms) — private by default, accessed via signed URLs."),
        ("Email", "Azure Communication Services (ACS) — not Gmail/SMTP despite some stale comments elsewhere in the codebase; see Section 9."),
    ]
    flow.append(data_table(["Layer", "Detail"], rows, [1.35 * inch, 4.75 * inch]))
    return flow


# ---------------------------------------------------------------------------
# 3. Technology Stack
# ---------------------------------------------------------------------------

FRONTEND_STACK = [
    ("React 18", "Core UI library — used for both the public site and the portal SPA"),
    ("TypeScript 5", "Static typing across the entire frontend"),
    ("Vite 8 (Rolldown)", "Dev server + production build tool; Rust-based Rollup replacement"),
    ("React Router 6", "Client-side routing for both apps, one shared BrowserRouter"),
    ("TanStack Query 5", "All server-state fetching/caching/mutations"),
    ("Axios", "HTTP client, wrapped by a custom apiClient with auth interceptors"),
    ("Tailwind CSS 3", "Utility-first styling for the portal (scoped under .portal-scope)"),
    ("shadcn/ui + Radix UI primitives", "~25 Radix packages (dialog, dropdown, tabs, tooltip, etc.) wrapped as shadcn/ui components in src/components/ui/"),
    ("Zod + react-hook-form + @hookform/resolvers", "Form schema validation and form state management"),
    ("Recharts", "All charts across Reports and analytics pages"),
    ("Lucide React", "Icon set used throughout the portal"),
    ("TipTap", "Rich text editor (email templates, announcements)"),
    ("Sonner", "Toast notification library"),
    ("cmdk", "Command palette component"),
    ("Embla Carousel", "Carousel/slider component in the portal UI kit"),
    ("date-fns", "Date formatting/manipulation utilities"),
    ("Bootstrap + jQuery (legacy)", "The public marketing site's original template stack, still active there only"),
    ("Slick Carousel, Magnific Popup, animate.css", "Public-site vendor plugins loaded via src/lib/vendors/"),
]

FRONTEND_DEV_STACK = [
    ("ESLint 9 + typescript-eslint", "Linting"),
    ("Vitest 4 + Testing Library", "Unit/component tests"),
    ("Playwright", "End-to-end browser testing"),
]

BACKEND_STACK = [
    ("Node.js + Express 4", "HTTP server and routing"),
    ("TypeScript 5", "Static typing across the backend"),
    ("Zod", "Request validation schemas (backend/src/schemas/)"),
    ("@supabase/supabase-js", "Service-role Supabase client used for every database query"),
    ("Helmet, CORS, express-rate-limit, compression", "Security and traffic-shaping middleware"),
    ("Morgan", "HTTP request logging"),
    ("Multer", "Multipart file-upload handling"),
    ("pdfkit", "PDF generation (invoices, timesheets, reviews, enrollment forms)"),
    ("docx + mammoth", "Word document generation and parsing (monthly timesheet exports)"),
    ("xlsx", "Spreadsheet export support"),
    ("sanitize-html", "HTML sanitization for user-supplied rich text"),
    ("node-cron", "Scheduled jobs — invoice reminders, expiry sweeps (backend/src/jobs/scheduler.ts)"),
    ("@azure/communication-email", "Active email transport (Azure Communication Services)"),
    ("dotenv", "Local environment variable loading"),
]

BACKEND_DEAD_DEPS = [
    ("Prisma (@prisma/client, prisma)", "Installed and generated at build time, but zero runtime usage — every query goes through supabaseAdmin instead"),
    ("nodemailer, resend", "Installed from earlier mailer generations; the live mailer.ts uses Azure Communication Services exclusively"),
]


def section_tech_stack():
    flow = [heading("3. Technology Stack", 1)]
    flow.append(P(
        "A consolidated reference of every technology in use, by layer. Deployment "
        "targets (Azure Static Web Apps, Azure Web App, GitHub Actions) are covered "
        "separately in Section 10 — this section is about what the application is "
        "built with, not where it runs.", "Body"))

    flow.append(heading("3.1  Frontend", 2))
    flow.append(data_table(["Technology", "Role in the project"], FRONTEND_STACK,
                            [1.85 * inch, 4.15 * inch]))
    flow.append(Spacer(1, 4))
    flow.append(P("Frontend tooling / testing:", "Body"))
    flow.append(data_table(["Technology", "Role in the project"], FRONTEND_DEV_STACK,
                            [1.85 * inch, 4.15 * inch]))

    flow.append(PageBreak())
    flow.append(heading("3.2  Backend", 2))
    flow.append(data_table(["Technology", "Role in the project"], BACKEND_STACK,
                            [1.85 * inch, 4.15 * inch]))
    flow.append(Spacer(1, 4))
    flow.append(Paragraph(
        "Installed but unused at runtime — present in package.json but dead weight "
        "in the actual request path. Worth knowing before assuming either one is "
        "active:", styles["Callout"]))
    flow.append(data_table(["Package", "Why it's dead"], BACKEND_DEAD_DEPS,
                            [1.85 * inch, 4.15 * inch]))

    flow.append(heading("3.3  Database &amp; Managed Platform Services", 2))
    rows = [
        ("PostgreSQL (via Supabase)", "Primary relational database — 24+ tables, accessed exclusively through the Supabase REST API, never a direct Postgres connection"),
        ("Supabase Auth", "Issues and validates JWTs; auth.users is the identity root the portal_users table links into"),
        ("Supabase Storage", "Private file buckets for documents, invoices, timesheets, performance reviews, enrollment forms — always accessed via signed URLs"),
    ]
    flow.append(data_table(["Service", "Role in the project"], rows, [1.85 * inch, 4.15 * inch]))

    flow.append(heading("3.4  Version control &amp; CI", 2))
    rows = [
        ("Git / GitHub", "Source control — single monorepo containing both frontend and backend"),
        ("GitHub Actions", "Automated frontend build + deploy on every push to main (no backend CI — see Section 10.2)"),
    ]
    flow.append(data_table(["Tool", "Role in the project"], rows, [1.85 * inch, 4.15 * inch]))
    return flow


# ---------------------------------------------------------------------------
# 4. Public Marketing Site
# ---------------------------------------------------------------------------

def section_public_site():
    flow = [heading("4. Public Marketing Site", 1)]
    flow.append(P(
        "The public site (<font face=\"Courier\">src/pages/</font>, "
        "<font face=\"Courier\">src/components/</font>) is a Bootstrap/jQuery-era "
        "HTML template converted into React components. It shares the same Vite "
        "build and React Router instance as the portal, but is architecturally and "
        "visually independent from it.", "Body"))

    rows = [
        ("/", "Index.tsx", "Home page — hero slider, about, services, clients, stats, careers"),
        ("/about", "About.tsx", "Company about page"),
        ("/career-guidance", "CareerGuidance.tsx", "Career guidance content"),
        ("/staffing-and-consulting", "StaffingConsulting.tsx", "Service detail page"),
        ("/clients", "Clients.tsx", "Client showcase"),
        ("/contact", "Contact.tsx", "Contact form"),
        ("/technology", "Technology.tsx", "Technology/services page"),
        ("/careers", "Careers.tsx", "Careers/job listings"),
        ("*", "NotFound.tsx", "404 catch-all"),
    ]
    flow.append(data_table(["Route", "File", "Purpose"], rows,
                            [1.0 * inch, 1.6 * inch, 3.5 * inch]))
    flow.append(Spacer(1, 6))

    flow.append(heading("Legacy jQuery integration", 2))
    flow.append(P(
        "Vendor CSS (Bootstrap, Slick carousel, animate.css, icon fonts) lives in "
        "<font face=\"Courier\">src/styles/</font> and is imported in "
        "<font face=\"Courier\">src/main.tsx</font>, followed by "
        "<font face=\"Courier\">src/index.css</font> for custom overrides. jQuery "
        "plugins live in <font face=\"Courier\">src/lib/vendors/</font>. Because "
        "these are legacy non-module scripts, a custom Vite plugin — "
        "<font face=\"Courier\">injectJQueryGlobal()</font> in "
        "<font face=\"Courier\">vite.config.ts</font> — wraps each one to expose "
        "<font face=\"Courier\">window.$</font>/<font face=\"Courier\">window.jQuery</font> "
        "safely inside Vite's ES module context (proper UMD files like Bootstrap, "
        "Popper, Modernizr and Slick are skipped since they don't need it).",
        "Body"))
    flow.append(P(
        "Icons use Font Awesome Free 5.x via CDN (only fas/far/fab — the fal set is "
        "Pro-only and unavailable). Layout uses Bootstrap grid utility classes "
        "(d-none, d-xl-block, col-*) — there is no Tailwind on the public site.",
        "Body"))
    flow.append(Paragraph(
        "When overriding template styling, add new rules to src/index.css (loaded "
        "after style.css); if template specificity needs to be beaten directly, edit "
        "src/styles/style.css itself and add a matching mobile breakpoint rule.",
        styles["Callout"]))
    return flow


# ---------------------------------------------------------------------------
# 4. Portal Application
# ---------------------------------------------------------------------------

PORTAL_PAGES = [
    ("Dashboard", "Role router — renders the correct dashboard for the logged-in role"),
    ("Employees / Employee Detail", "Employee directory, filters, and full profile view"),
    ("New Employee (wizard)", "One component serves HR-create, HR-edit, self-onboarding, and self-edit (see 4.6)"),
    ("People", "Company-wide directory visible to all roles"),
    ("HR drill-downs", "Active / Onboarding / Inactive / Visa-Expiring / I-9-Status segmented employee views"),
    ("Clients / Client Detail", "Client account list and detail"),
    ("Assignments / Assignment Detail", "Employee-to-client staffing placements"),
    ("Timesheets / Timesheet Detail", "Weekly billing timesheets — submit/approve workflow"),
    ("My Monthly Timesheet", "Employee's own monthly attendance timesheet"),
    ("Monthly Timesheets / Detail", "HR/ops review of monthly attendance"),
    ("Invoices / Invoice Detail / Invoice Editor", "Client invoicing — list, detail, full create/edit editor"),
    ("Record Payment", "Full-page payment entry against an invoice"),
    ("Public Invoice View", "Token-gated, unauthenticated invoice viewing page"),
    ("Invoice Analytics", "Finance analytics on invoicing"),
    ("Estimates", "Client estimates/quotes"),
    ("Reports", "Central reports hub (Recharts-based, many sub-reports)"),
    ("Documents", "Document repository"),
    ("Email Templates", "Reusable templates for invoice-sending emails"),
    ("Announcements", "Company-wide announcement board"),
    ("Expenses / Expense Analytics", "Employee expense claims + finance analytics"),
    ("Performance Reviews / Detail / My Reviews", "HR-run appraisal cycles; employees view their own"),
    ("Enrollment Forms / Detail", "Benefits enrollment forms"),
    ("Leave Requests", "Leave/PTO application and approval workflow"),
    ("Notifications", "In-app notification center, click-to-navigate (see 4.7)"),
    ("My Profile", "Employee's own profile view"),
    ("Admin Settings / System Settings", "Admin-only configuration hubs"),
    ("Audit Log", "Admin-only audit trail viewer"),
    ("Holidays Settings / Company Holidays", "Holiday calendar configuration and viewing"),
    ("Milestones / Headcount Report", "HR milestone tracking and headcount analytics"),
    ("Expiring Documents", "HR view of documents nearing expiry"),
    ("Workforce Availability / Client SLA", "Operations availability planning and SLA tracking"),
    ("Budgets / Cash Flow", "Finance budgeting and cash-flow views"),
    ("Tax Documents", "Employee/finance tax document access"),
    ("Assets", "Company equipment inventory and assignment"),
    ("Skills Registry", "Employee skills catalog"),
    ("Shift Schedule", "Shift scheduling"),
    ("Probation Tracker", "New-hire probation period tracking"),
    ("Capacity Report", "Workforce capacity/utilization reporting"),
    ("Onboarding Pending", "\"Awaiting HR review\" screen after self-onboarding submission"),
]

ROLE_MATRIX = [
    ("Dashboard / Announcements / People / Notifications / Timesheets", "Y", "Y", "Y", "Y", "Y"),
    ("Employees (list/detail)", "Y", "Y", "Y", "", ""),
    ("Add / Edit Employee", "Y", "Y", "", "", ""),
    ("Clients / Invoices / Budgets / Cash Flow / Analytics", "Y", "", "", "Y", ""),
    ("Assignments", "Y", "", "Y", "", "own"),
    ("Attendance (self)", "Y", "Y", "", "", "Y"),
    ("Attendance Review", "Y", "Y", "Y", "", ""),
    ("Leave Requests", "Y", "Y", "", "", "Y"),
    ("Expenses", "Y", "Y", "Y", "Y", "Y"),
    ("Performance Reviews (manage)", "Y", "Y", "", "", ""),
    ("My Reviews", "", "", "", "", "Y"),
    ("Enrollment Forms", "Y", "Y", "", "", "Y"),
    ("Documents", "Y", "Y", "", "", "Y"),
    ("Reports", "Y", "Y", "", "Y", ""),
    ("My Profile", "", "", "", "", "Y"),
    ("Admin / System Settings / Audit Log", "Y", "", "", "", ""),
    ("Milestones / Headcount / Skills / Probation", "Y", "Y", "", "", ""),
    ("Workforce / Shift Schedule / Capacity", "Y", "Y", "Y", "", ""),
    ("Client SLA", "Y", "", "Y", "", ""),
    ("Tax Documents", "Y", "", "", "Y", "Y"),
    ("Estimates", "Y", "", "", "Y", ""),
    ("Assets", "Y", "Y", "Y", "", ""),
]


def section_portal_app():
    flow = [heading("5. Portal Application", 1)]
    flow.append(P(
        "The portal is a fully isolated React SPA mounted at <font face=\"Courier\">"
        "/portal/*</font>, lazy-loaded from the public site's entry point. It is "
        "wrapped in a <font face=\"Courier\">.portal-scope</font> class so its own "
        "Tailwind-based styling (<font face=\"Courier\">src/portal/portal.css</font>) "
        "never bleeds into the Bootstrap-based public site.", "Body"))

    flow.append(heading("5.1  Page inventory", 2))
    flow.append(P("Roughly 60 distinct pages under <font face=\"Courier\">src/portal/pages/</font>:", "Body"))
    rows = [(p, d) for p, d in PORTAL_PAGES]
    flow.append(data_table(["Page", "Purpose"], rows, [1.9 * inch, 4.15 * inch]))

    flow.append(PageBreak())
    flow.append(heading("5.2  Role-permission matrix", 2))
    flow.append(P("Enforced on the frontend by ProtectedRoute (allowedRoles) and mirrored "
                  "server-side by requireRole(...) middleware on every route.", "Body"))
    header = ["Feature area", "Admin", "HR", "Ops", "Finance", "Employee"]
    flow.append(data_table(header, ROLE_MATRIX,
                            [2.5 * inch, 0.55 * inch, 0.5 * inch, 0.5 * inch, 0.75 * inch, 0.75 * inch]))

    flow.append(heading("5.3  Authentication flow", 2))
    diagram_w = PAGE_W - 2 * MARGIN
    boxes = [
        (0, 20, 95, 40, "Login form\nposts credentials", None),
        (diagram_w * 0.27, 20, 95, 40, "Backend\nissues JWT", None),
        (diagram_w * 0.54, 20, 105, 40, "sessionStorage\njobly_session +\naccess_token", None),
        (diagram_w - 100, 20, 100, 40, "apiClient\nattaches Bearer\nheader per request", None),
    ]
    arrows = [
        (95, 40, diagram_w * 0.27, 40, ""),
        (diagram_w * 0.27 + 95, 40, diagram_w * 0.54, 40, ""),
        (diagram_w * 0.54 + 105, 40, diagram_w - 100, 40, ""),
    ]
    flow.append(BoxDiagram(diagram_w, 75, boxes, arrows))
    flow.append(P(
        "Tokens are kept in <font face=\"Courier\">sessionStorage</font> (not "
        "localStorage), so a session clears when the tab closes. On a 401 response, "
        "the Axios response interceptor attempts one silent refresh via "
        "<font face=\"Courier\">POST /auth/refresh</font> before falling back to a "
        "forced logout/redirect. A 2-hour idle timer (mouse/keyboard/touch activity) "
        "also force-logs-out stale sessions. A 4-state onboarding gate "
        "(<font face=\"Courier\">in_progress -> pending_review -> changes_requested -> "
        "approved</font>) pins new hires to the onboarding wizard until HR approves "
        "them, enforced inside <font face=\"Courier\">ProtectedRoute</font>.", "Body"))

    flow.append(heading("5.4  State management convention", 2))
    flow.append(P(
        "All server state goes through TanStack Query, via a dedicated "
        "<font face=\"Courier\">QueryClient</font> "
        "(<font face=\"Courier\">src/portal/lib/queryClient.ts</font>). Every domain "
        "has a <font face=\"Courier\">useXxx</font> hook file in "
        "<font face=\"Courier\">src/portal/hooks/</font> (30 files) that defines a "
        "<font face=\"Courier\">mapXxx(raw)</font> function translating the backend's "
        "snake_case row shape into the camelCase TypeScript interfaces in "
        "<font face=\"Courier\">src/portal/types/index.ts</font>. This is the single "
        "most important convention to know before touching any data field:", "Body"))
    flow.append(Paragraph(
        "Rule: any new database column must be added in THREE places — the migration, "
        "the relevant mapXxx() function, and the TypeScript interface in types/index.ts. "
        "Missing any one of the three causes silent data loss on the frontend.",
        styles["Callout"]))

    flow.append(heading("5.5  UI library &amp; the custom Select component", 2))
    flow.append(P(
        "The portal uses shadcn/ui (Radix primitives + Tailwind) throughout — 60+ "
        "reusable components in <font face=\"Courier\">src/components/ui/</font>. "
        "One notable exception: <font face=\"Courier\">src/components/ui/select.tsx</font> "
        "is a full in-house rewrite, no longer using "
        "<font face=\"Courier\">@radix-ui/react-select</font>. The original Radix "
        "component moved real DOM focus onto the open dropdown list, which — combined "
        "with its portaled, fixed-position rendering — caused the entire page to snap "
        "to the top on some browsers when reopening a dropdown with a pre-selected "
        "value. After exhausting configuration-level fixes, the team rewrote it using "
        "the ARIA \"virtual focus\" combobox pattern (tracking the highlighted option "
        "in React state via <font face=\"Courier\">aria-activedescendant</font> instead "
        "of moving real focus), which makes the bug structurally impossible rather than "
        "just patched. The public API is unchanged, so all ~40 existing call sites work "
        "without modification.", "Body"))

    flow.append(heading("5.6  Onboarding wizard", 2))
    flow.append(P(
        "<font face=\"Courier\">src/portal/pages/NewEmployee.tsx</font> is a single "
        "~2,200-line component serving four distinct modes based on the current route, "
        "not four separate components:", "Body"))
    rows = [
        ("Self-onboarding", "/portal/onboarding", "New hire completing their own profile; strict validation (LinkedIn, nationality, bank details, emergency-contact address all become required)"),
        ("Self-edit", "/portal/profile (edit)", "Already-approved employee editing their own record"),
        ("HR create", "/portal/employees/new", "HR/admin creating a new employee — only name + email required up front"),
        ("HR edit", "/portal/employees/:id/edit", "HR/admin editing an existing employee's full record"),
    ]
    flow.append(data_table(["Mode", "Route", "Behavior"], rows,
                            [1.0 * inch, 1.6 * inch, 3.45 * inch]))
    flow.append(P(
        "Identity document uploads track an expiry date per document type. A validation "
        "rule (added after a real production bug) blocks submission whenever ANY document "
        "has an expiry date entered but no file actually uploaded — not just the small set "
        "of hard-required document types — since recording an expiry for a document that "
        "was never provided is always a data-entry mistake.", "Body"))

    flow.append(heading("5.7  Notification system", 2))
    flow.append(P(
        "Notifications carry <font face=\"Courier\">entity_type</font>/"
        "<font face=\"Courier\">entity_id</font> plus a pre-computed "
        "<font face=\"Courier\">link</font> field. The link is computed and stored by "
        "the backend at creation time — not derived generically on the frontend — "
        "because the same entity type routes to a different page depending on the "
        "recipient's role (e.g. an \"onboarding submitted\" notification sends HR to "
        "the employee's detail page, but sends the employee themself to their own "
        "profile). Clicking a notification (in the sidebar dropdown or the full "
        "Notifications page) marks it read and navigates to its link in one action.",
        "Body"))
    return flow


# ---------------------------------------------------------------------------
# 5. Backend Architecture
# ---------------------------------------------------------------------------

BACKEND_DOMAINS = [
    ("Auth", "/auth", "Login, logout, me, change-password, refresh, forgot-password"),
    ("Employees", "/employees", "Employee CRUD, onboarding workflow, credentials, leave/termination, directory"),
    ("Clients", "/clients", "Client company CRUD, billing contacts"),
    ("Assignments", "/assignments", "Employee<->client project placements, bill/pay rates"),
    ("Timesheets", "/timesheets", "Weekly billing timesheets + entries, approval state machine"),
    ("Monthly Timesheets", "/monthly-timesheets", "Monthly attendance tracker, PDF/DOCX export"),
    ("Leave Requests / Balance", "/leave-requests, /leave", "Leave applications + entitlement/balance tracking"),
    ("Invoices", "/invoices", "Line items, discounts, payments, recurring templates, estimates, PDF/email"),
    ("Invoice / Email Templates", "/invoice-templates, /email-templates", "PDF theme presets; reusable HTML email templates"),
    ("Documents", "/documents", "Polymorphic file attachments via Supabase Storage"),
    ("Enrollment Forms", "/enrollment-forms", "Benefits enrollment: HR creates, employee fills, PDF generated"),
    ("Performance Reviews", "/performance-reviews", "Appraisal reports, 12-criteria rating grid, PDF + email"),
    ("Notifications", "/notifications", "In-app notification fan-out, admin dedup view"),
    ("Announcements", "/announcements", "Company-wide announcement board"),
    ("Assets", "/assets", "Equipment inventory + assignment"),
    ("Expenses", "/expenses", "Expense report submission/approval"),
    ("Budgets", "/budgets", "Department budgets vs. actuals"),
    ("Shifts", "/shifts", "Shift scheduling per employee/date"),
    ("Skills", "/skills", "Employee skills directory"),
    ("Holidays", "/holidays", "Company holiday calendar"),
    ("Onboarding / Offboarding Checklist", "/onboarding-checklist, /offboarding-checklist", "Configurable task templates + per-employee instances"),
    ("Tax Documents", "/tax-documents", "W-2/1099-style document tracking"),
    ("Activity Logs", "/activity-logs", "Audit trail viewer"),
    ("Analytics / Reports", "/analytics, /reports", "Dashboards and exports across employees, timesheets, invoices"),
    ("Nav Badges", "/nav-badges", "Sidebar unread/pending counters"),
    ("Settings / System / Admin", "/portal-settings, /system, /admin", "System config, ops endpoints, password resets, user management"),
    ("Public", "/public", "Unauthenticated endpoints — contact form, public invoice view"),
]


def section_backend():
    flow = [heading("6. Backend Architecture", 1)]
    flow.append(P(
        "The backend is a standalone Express 4 + TypeScript REST API "
        "(<font face=\"Courier\">backend/</font>), listening on port 3001, every "
        "route mounted under <font face=\"Courier\">/api/v1</font>. It is deployed "
        "independently of the frontend as a Docker container on Azure Web App.",
        "Body"))

    flow.append(heading("6.1  Request pipeline", 2))
    diagram_w = PAGE_W - 2 * MARGIN
    steps = ["helmet\n+ cors", "express.json\n(10mb)", "rate\nlimiter", "authenticate\n(JWT)", "requireRole\n(roles)", "validate\n(Zod)", "controller\n-> service"]
    n = len(steps)
    box_w = 78
    gap = (diagram_w - n * box_w) / (n - 1)
    boxes = []
    arrows = []
    for i, s in enumerate(steps):
        x = i * (box_w + gap)
        boxes.append((x, 15, box_w, 40, s, None))
        if i > 0:
            px = (i - 1) * (box_w + gap) + box_w
            arrows.append((px, 35, x, 35, ""))
    flow.append(BoxDiagram(diagram_w, 65, boxes, arrows))
    flow.append(P(
        "Every route follows this same chain: authenticate -> requireRole(...roles) -> "
        "validateBody/validateQuery(schema) -> controller -> service -> supabaseAdmin. "
        "Controllers stay thin (parse request, call service, shape the response); all "
        "business logic and every Supabase query lives in the service layer.", "Body"))

    flow.append(heading("6.2  Domain / route map", 2))
    flow.append(P("~30 distinct resource domains, each with its own routes/controller/service files:", "Body"))
    rows = [(d, r, p) for d, r, p in BACKEND_DOMAINS]
    flow.append(data_table(["Domain", "Base route(s)", "Purpose"], rows,
                            [1.55 * inch, 1.85 * inch, 2.65 * inch]))

    flow.append(PageBreak())
    flow.append(heading("6.3  Auth &amp; RBAC internals", 2))
    flow.append(P(
        "Identity chain: <font face=\"Courier\">auth.users</font> (Supabase-managed) "
        "<-> <font face=\"Courier\">portal_users</font> (role, employee_id) <-> "
        "<font face=\"Courier\">employees</font> (full HR record). A portal user's "
        "role isn't cached in the JWT — the <font face=\"Courier\">authenticate</font> "
        "middleware re-fetches the <font face=\"Courier\">portal_users</font> row on "
        "every request, so role/permission changes take effect immediately, not on "
        "next login. <font face=\"Courier\">requireRole(...roles)</font> is called "
        "roughly 140 times across the route files — the authoritative permission "
        "check lives server-side even though the frontend also gates navigation for "
        "UX purposes.", "Body"))

    flow.append(heading("6.4  Validation pattern", 2))
    flow.append(P(
        "26 Zod schema files in <font face=\"Courier\">backend/src/schemas/</font>, "
        "one per resource, each exporting typed input schemas (e.g. "
        "<font face=\"Courier\">CreateEmployeeInput</font>). Routes wrap the schema "
        "with <font face=\"Courier\">validateBody(schema)</font> / "
        "<font face=\"Courier\">validateQuery(schema)</font> "
        "(<font face=\"Courier\">backend/src/middleware/validate.ts</font>) — a failed "
        "parse raises a 400 <font face=\"Courier\">ValidationError</font> with a "
        "readable field-by-field message, handled centrally in "
        "<font face=\"Courier\">errorHandler.ts</font>.", "Body"))
    return flow


# ---------------------------------------------------------------------------
# 6. Database Schema
# ---------------------------------------------------------------------------

DB_TABLES_TRACKED = [
    ("portal_users", "Login identity — 1:1 with auth.users, carries role + employee_id"),
    ("employees", "Core HR record — personal, address, employment, immigration, pay, onboarding state"),
    ("clients", "Client company + billing contact info"),
    ("assignments", "Employee<->client project placement, rates, status"),
    ("timesheets / timesheet_entries", "Weekly billing timesheet header + per-day hours"),
    ("invoices / invoice_line_items / invoice_timesheets", "Client invoices, line items, and the timesheet<->invoice junction"),
    ("documents", "Polymorphic file metadata pointing at Supabase Storage"),
    ("notifications", "Per-recipient in-app notifications (entity_type/entity_id/link)"),
    ("activity_logs", "Audit trail — actor, action, entity, metadata"),
    ("monthly_timesheets", "Independent monthly attendance timesheet (JSONB day entries)"),
    ("leave_requests", "Prospective leave applications + approval workflow"),
    ("leave_types / employee_leave_entitlements", "Configurable leave categories + per-employee grants"),
    ("products / payments / recurring_invoice_templates", "Invoice catalog items, manual payments, recurring-invoice config"),
    ("email_templates / invoice_templates", "Reusable HTML email templates; PDF theme presets"),
    ("announcements", "Company announcement board"),
    ("performance_reviews", "Appraisal reports (12-criteria JSONB rating grid)"),
    ("enrollment_forms", "New-hire benefits enrollment form (JSONB form_data)"),
]

DB_TABLES_UNTRACKED = [
    "assets", "expense_reports", "department_budgets", "company_holidays",
    "tax_documents", "offboarding_templates / offboarding_tasks",
    "onboarding_checklist_templates / employee_onboarding_tasks",
    "employee_skills", "shifts", "system_settings",
]


def section_database():
    flow = [heading("7. Database Schema", 1)]
    flow.append(P(
        "The database is Supabase-managed PostgreSQL. The backend never uses a direct "
        "Postgres connection or Prisma at runtime (both exist in the repo but are "
        "unused/dead code) — every query goes through the Supabase REST API via a "
        "service-role client (<font face=\"Courier\">supabaseAdmin</font>, "
        "<font face=\"Courier\">backend/src/config/supabase.ts</font>). Row Level "
        "Security is enabled on tracked tables as a defense-in-depth backstop (a "
        "blanket service-role-only policy) — the real authorization boundary is the "
        "application code (<font face=\"Courier\">requireRole</font> + service-layer "
        "filtering), not the database.", "Body"))

    flow.append(heading("7.1  Tables defined in tracked migrations", 2))
    flow.append(P("27 numbered, additive-only SQL files in <font face=\"Courier\">"
                  "backend/supabase/migrations/</font> (001 -> 027):", "Body"))
    flow.append(data_table(["Table(s)", "Purpose"], DB_TABLES_TRACKED,
                            [2.1 * inch, 3.95 * inch]))

    flow.append(heading("7.2  Important gap — tables that exist live but aren't tracked", 2))
    items = ", ".join(DB_TABLES_UNTRACKED)
    flow.append(Paragraph(
        "The following tables are actively queried by the backend service layer but "
        "have NO corresponding CREATE TABLE statement anywhere in "
        "backend/supabase/migrations/: " + items + ". They were evidently created "
        "directly against the Supabase project (dashboard or SQL editor) outside the "
        "versioned migration history. Anyone extending these features should verify "
        "the live column list directly against the Supabase project rather than "
        "trusting the migrations folder alone — it is not a complete source of truth "
        "for the current schema.",
        styles["Callout"]))

    flow.append(heading("7.3  Key relationships", 2))
    flow.append(P(
        "employees.reporting_manager_id is a self-referencing FK for the management "
        "chain. assignments links employees to clients. timesheets are unique per "
        "(employee, assignment, week) and link to invoice_line_items via the "
        "invoice_timesheets junction table when billed. documents uses a polymorphic "
        "entity_type/entity_id pointer (employee | client | invoice) rather than a "
        "hard foreign key. notifications.user_id points at portal_users, with its own "
        "polymorphic entity_type/entity_id plus the pre-computed link field described "
        "in Section 5.7.", "Body"))
    return flow


# ---------------------------------------------------------------------------
# 7. Core Business Workflows
# ---------------------------------------------------------------------------

def section_workflows():
    flow = [heading("8. Core Business Workflows", 1)]

    flow.append(heading("8.1  Onboarding state machine", 2))
    flow.append(P(
        "employees.status is one of onboarding / active / inactive. \"Pending review\" "
        "and \"changes requested\" are NOT separate enum values — they're derived from "
        "whether onboarding_completed_at and onboarding_change_request_message are set. "
        "A shared checklist function (backend/src/lib/onboarding.ts, "
        "computeOnboarding()) is the single source of truth for completion %, used both "
        "to gate the employee's own submit action and HR's approval action.", "Body"))
    diagram_w = PAGE_W - 2 * MARGIN
    flow.append(state_machine_diagram(diagram_w, ["onboarding\n(in progress)", "pending_review", "active"],
                                       [("onboarding\n(in progress)", "pending_review", "employee submits"),
                                        ("pending_review", "active", "HR approves")]))
    flow.append(P(
        "HR can instead \"request changes,\" which clears onboarding_completed_at and "
        "routes the employee back to the wizard with a message — a documented resubmit "
        "loop rather than a hard rejection.", "Small"))

    flow.append(heading("8.2  Timesheet state machine", 2))
    flow.append(state_machine_diagram(diagram_w, ["draft", "submitted", "manager_\napproved"],
                                       [("draft", "submitted", "submit"),
                                        ("submitted", "manager_\napproved", "approve"),
                                        ("manager_\napproved", "submitted", "reject")]))
    flow.append(P(
        "Only these transitions are valid — enforced in code, not just at the database "
        "level. Submitting a zero-hour week requires a leave_reason; hours can't be "
        "logged on a day the employee already has an approved leave request (checked "
        "at both submit and manager-approve time, since leave can be approved after a "
        "timesheet is already submitted). Admin is exempt from these business gates.",
        "Body"))

    flow.append(heading("8.3  Notification fan-out &amp; dedup", 2))
    flow.append(P(
        "createNotification() inserts one row per recipient — a \"notify all HR\" "
        "event creates N rows, one per HR user, each carrying the same title/message/"
        "entity/link. For the admin's notification view specifically, these fan-out "
        "copies are collapsed back into one logical event (matched by title+message+"
        "entity), tracked via a separate admin_read column so an admin's own read "
        "state never collides with the actual recipient's read flag.", "Body"))
    return flow


# ---------------------------------------------------------------------------
# 8. Integrations
# ---------------------------------------------------------------------------

def section_integrations():
    flow = [heading("9. Integrations", 1)]

    flow.append(heading("9.1  Email — Azure Communication Services", 2))
    flow.append(P(
        "backend/src/lib/mailer.ts sends all transactional email exclusively through "
        "Azure Communication Services (@azure/communication-email), configured via "
        "AZURE_COMM_CONNECTION_STRING and ACS_SENDER_ADDRESS. A mailerConfigured flag "
        "guards every send call so a missing config never crashes a request — it just "
        "skips the email and logs it. Every email uses a shared branded HTML shell "
        "with the Jobly logo.", "Body"))
    flow.append(Paragraph(
        "Note: some older comments elsewhere in the codebase (including the root "
        "CLAUDE.md) still describe the mailer as nodemailer + Gmail SMTP or Brevo SMTP "
        "— those describe earlier generations of the mailer that were since replaced. "
        "The nodemailer/resend packages remain installed but are unused. Always verify "
        "against mailer.ts's actual imports, not surrounding comments.",
        styles["Callout"]))

    flow.append(heading("9.2  PDF / DOCX generation", 2))
    flow.append(P(
        "backend/src/lib/pdfGenerator.ts (pdfkit for PDFs, the docx package for Word "
        "output) has six generator entry points: invoices, monthly timesheets (PDF and "
        "DOCX), yearly timesheets, performance reviews, and enrollment forms. The "
        "pattern is consistent everywhere it's used: generate a Buffer in memory -> "
        "upload it to a Supabase Storage bucket -> create a 7-day signed URL -> persist "
        "that URL on the record's pdf_url column.", "Body"))

    flow.append(heading("9.3  Supabase Auth &amp; Storage", 2))
    flow.append(P(
        "Login uses supabaseAnon.auth.signInWithPassword(); everything else server-side "
        "goes through supabaseAdmin with a pre-seeded service-role Authorization header "
        "(a documented workaround for a supabase-js client bug that could otherwise "
        "silently drop it). Storage buckets are private by default and always accessed "
        "through signed URLs, never public links, except one inferred public bucket for "
        "employee profile photos.", "Body"))
    return flow


# ---------------------------------------------------------------------------
# 9. Deployment & Infrastructure
# ---------------------------------------------------------------------------

def section_deployment():
    flow = [heading("10. Deployment &amp; Infrastructure", 1)]

    flow.append(heading("10.1  Frontend — automatic", 2))
    flow.append(P(
        "Every push to the main branch triggers a GitHub Actions workflow "
        "(.github/workflows/azure-static-web-apps-*.yml) that builds the Vite app "
        "(output_location: dist) and deploys it to Azure Static Web Apps via the "
        "official Azure/static-web-apps-deploy action. No manual step required.",
        "Body"))
    flow.append(code_block(
        "git push origin main\n"
        "# -> GitHub Actions builds + deploys automatically\n"
        "gh run list --limit 1                  # check status\n"
        "gh run watch <run-id> --exit-status     # wait for completion"
    ))

    flow.append(heading("10.2  Backend — manual runbook", 2))
    flow.append(Paragraph(
        "There is no tracked CI workflow for the backend in this repository. "
        "Deployment to Azure Web App is a manual process — documented here as the "
        "exact working sequence.",
        styles["Callout"]))
    flow.append(code_block(
        "# 1. Build and push the Docker image (capture the sha256 digest printed)\n"
        "docker buildx build --no-cache --platform linux/amd64 \\\n"
        "    -t prashanth1710/jobly-backend:latest --push backend/\n\n"
        "# 2. Point the Web App at the exact new digest\n"
        "az webapp config set -n <app-name> -g <resource-group> \\\n"
        "    --linux-fx-version \"DOCKER|prashanth1710/jobly-backend@sha256:<DIGEST>\"\n\n"
        "# 3. Restart and wait for /health\n"
        "az webapp restart -n <app-name> -g <resource-group>\n"
        "curl -sf https://<app-host>/health   # expect {\"status\":\"ok\", ...}"
    ))
    flow.append(P(
        "Important: the container is digest-pinned, not tag-pinned — pushing a new "
        ":latest tag alone does nothing; the linux-fx-version must be re-pointed to the "
        "new digest explicitly. Always keep the previous known-good digest on hand "
        "before deploying, and health-poll after every restart — a build that exits 0 "
        "can still produce a crash-looping container.", "Body"))

    flow.append(heading("10.3  Environment configuration", 2))
    flow.append(P(
        "Every variable actually read by the running code, grouped by whether it's "
        "required, actively used, or present but dead. This is the list to work from "
        "when standing up a new environment — not backend/.env.example, which is out "
        "of date (see the callout below).", "Body"))

    flow.append(P("<b>Frontend — set at build time, baked into the bundle</b>", "Body"))
    rows = [
        ("VITE_API_URL", "The backend API base URL. Read once at build time (import.meta.env), not at runtime — changing it requires a rebuild + redeploy, not just an env change on a running server."),
    ]
    flow.append(data_table(["Variable", "Purpose"], rows, [2.4 * inch, 3.6 * inch]))
    flow.append(Paragraph(
        "Gotcha: the production GitHub Actions workflow never sets VITE_API_URL — "
        "there's no build-time env step for it. When unset, src/portal/lib/apiClient.ts "
        "falls back to a backend URL that's hardcoded directly in that source file. In "
        "practice this means the deployed frontend's backend URL is currently pinned in "
        "source code, not configured via environment. If the backend's hostname ever "
        "changes, update the fallback in apiClient.ts (or add a real VITE_API_URL build "
        "step to the workflow) and redeploy the frontend — an env var change alone won't "
        "reach it.", styles["Callout"]))

    flow.append(P("<b>Backend — required (the process exits at boot if these are missing)</b>", "Body"))
    rows = [
        ("SUPABASE_URL", "The Supabase project's API URL"),
        ("SUPABASE_SERVICE_ROLE_KEY", "Service-role key — bypasses RLS, used for every database query"),
        ("SUPABASE_ANON_KEY", "Anon key — used only for the login call (supabaseAnon.auth.signInWithPassword)"),
        ("PORT", "Defaults to 3001 if unset"),
        ("NODE_ENV", "development / production / test — defaults to development"),
    ]
    flow.append(data_table(["Variable", "Purpose"], rows, [2.4 * inch, 3.6 * inch]))

    flow.append(P("<b>Backend — actively used, not boot-enforced</b>", "Body"))
    rows = [
        ("FRONTEND_URL", "Used for the CORS allowlist and for building deep-links in outgoing emails. Defaults to http://localhost:8080 if unset — must be set to the real frontend URL in production or CORS will reject it"),
        ("AZURE_COMM_CONNECTION_STRING", "The active email transport (Azure Communication Services). Without it, mailerConfigured is false and every email is silently skipped (logged, not thrown)"),
        ("ACS_SENDER_ADDRESS", "The verified ACS sender address emails are sent from"),
        ("ENABLE_SCHEDULER", "Must be exactly \"true\" to enable the daily cron job (invoice reminders, expiry sweeps). Off by default — safe to leave unset on any non-primary environment to avoid duplicate scheduled sends"),
        ("CONTACT_TO", "Recipient for the public contact form. Defaults to info@joblysolutions.com if unset"),
    ]
    flow.append(data_table(["Variable", "Purpose"], rows, [2.4 * inch, 3.6 * inch]))

    flow.append(P("<b>Backend — present but not part of the live code path</b>", "Body"))
    rows = [
        ("SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / MAIL_FROM", "Validated as optional by the Zod env schema, but mailer.ts never reads them — leftover from an earlier SMTP-based mailer generation"),
        ("GMAIL_USER / GMAIL_APP_PASSWORD", "Same — leftover from an even earlier Gmail-based mailer generation"),
        ("HR_FALLBACK_EMAIL", "Validated as optional but not read by any current code path"),
        ("DATABASE_URL / DIRECT_URL", "Only consulted by the unused Prisma client (src/lib/prisma.ts) and the npx prisma CLI — the running app never opens a direct Postgres connection"),
    ]
    flow.append(data_table(["Variable(s)", "Why it's inert"], rows, [2.6 * inch, 3.4 * inch]))
    flow.append(Paragraph(
        "backend/.env.example itself is stale: it documents only PORT, NODE_ENV, the "
        "three SUPABASE_* variables, DATABASE_URL/DIRECT_URL, FRONTEND_URL, and "
        "GMAIL_USER/GMAIL_APP_PASSWORD — it doesn't mention AZURE_COMM_CONNECTION_STRING, "
        "ACS_SENDER_ADDRESS, ENABLE_SCHEDULER, or CONTACT_TO at all, and still frames "
        "Gmail as the email option. Use the tables above, not that file, when setting up "
        "a new environment — this is the same class of \"comments lag behind the real "
        "code\" gap already flagged for the mailer in Section 9.1.",
        styles["Callout"]))

    flow.append(P(
        "What actually changes when standing up a new environment (e.g. staging, or "
        "moving to a new Azure subscription): a new Supabase project means new "
        "SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY on the backend (and "
        "re-running every migration against it); a new backend hostname means updating "
        "FRONTEND_URL on the backend AND the hardcoded fallback in apiClient.ts on the "
        "frontend; a new frontend hostname means updating the backend's FRONTEND_URL "
        "for CORS to keep working; a new email sender means new "
        "AZURE_COMM_CONNECTION_STRING/ACS_SENDER_ADDRESS.", "Body"))

    flow.append(heading("10.4  Database migrations", 2))
    flow.append(P(
        "The Supabase project's direct database host is IPv6-only, which blocks local "
        "psql access from most Windows setups — migrations are applied through the "
        "Supabase MCP tooling's apply_migration action (or the Supabase dashboard SQL "
        "editor) rather than a local CLI. New migration files are still added to "
        "backend/supabase/migrations/ for history, numbered sequentially, additive-only "
        "(ADD COLUMN IF NOT EXISTS style) — no down-migrations exist in this project.",
        "Body"))
    return flow


# ---------------------------------------------------------------------------
# 10. New Feature Runbook
# ---------------------------------------------------------------------------

def section_new_feature_runbook():
    flow = [heading("11. How to Add a New Feature", 1)]
    flow.append(P(
        "This is the concrete, repeatable pattern this codebase already uses for "
        "every existing feature. Following it keeps a new feature consistent with "
        "everything else in the system.", "Body"))

    steps = [
        "<b>Database</b> — add a new migration file in backend/supabase/migrations/ "
        "(numbered sequentially, ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS "
        "style). Apply it via the Supabase tooling, not a local psql connection.",
        "<b>Validation</b> — add or extend a Zod schema in backend/src/schemas/ for "
        "the new input shape.",
        "<b>Service</b> — add the Supabase query logic in the relevant "
        "backend/src/services/*.service.ts file (or a new one for a new domain), "
        "using supabaseAdmin.",
        "<b>Controller + route</b> — add a thin controller function and wire it into "
        "the router with the correct middleware chain: authenticate -> "
        "requireRole(...roles) -> validateBody(schema) -> controller.",
        "<b>Frontend hook</b> — add/extend a useXxx hook in src/portal/hooks/, "
        "including a mapXxx() function that translates the backend's snake_case "
        "response into camelCase.",
        "<b>Types</b> — update the corresponding TypeScript interface in "
        "src/portal/types/index.ts to match exactly what mapXxx() now returns.",
        "<b>UI</b> — build the page/component using the existing shadcn/ui component "
        "set in src/components/ui/ and the shared portal components in "
        "src/portal/components/shared/ wherever a suitable one already exists.",
        "<b>Routing</b> — register the new page in src/portal/PortalApp.tsx inside a "
        "ProtectedRoute with the correct allowedRoles for who should see it.",
        "<b>Navigation</b> — add a sidebar entry in "
        "src/portal/components/layout/PortalSidebar.tsx if the feature needs its own "
        "nav item, scoped to the same roles as the route.",
        "<b>Notifications (if relevant)</b> — if the feature should notify anyone, call "
        "createNotification(userId, title, message, type, entityType, entityId, link) "
        "— compute the link server-side, accounting for the recipient's role if the "
        "same entity type routes differently per role (see Section 5.7).",
        "<b>Verify end-to-end</b> — npx tsc --noEmit, npm run build (frontend); "
        "backend npx tsc --noEmit; a local or staging smoke test of the new flow "
        "before deploying.",
    ]
    flow.append(ListFlowable(
        [ListItem(P(s, "Body"), leftIndent=6) for s in steps],
        bulletType="1", start=1, leftIndent=18, spaceBefore=2, bulletFontSize=9,
    ))
    return flow


# ---------------------------------------------------------------------------
# Appendices
# ---------------------------------------------------------------------------

FILE_INDEX = [
    ("Add/change a portal page", "src/portal/pages/, register route in src/portal/PortalApp.tsx"),
    ("Add/change a backend endpoint", "backend/src/routes/, backend/src/controllers/, backend/src/services/"),
    ("Change validation rules", "backend/src/schemas/*.schema.ts"),
    ("Change a DB table/column", "backend/supabase/migrations/ + the matching mapXxx() in src/portal/hooks/"),
    ("Change role permissions", "requireRole(...) in backend routes; allowedRoles in PortalApp.tsx / PortalSidebar.tsx"),
    ("Change email content", "backend/src/lib/mailer.ts"),
    ("Change PDF layout (invoices etc.)", "backend/src/lib/pdfGenerator.ts"),
    ("Change notification behavior", "backend/src/services/notifications.service.ts, src/portal/hooks/useNotifications.ts"),
    ("Change auth/session behavior", "backend/src/middleware/auth.ts, src/portal/context/AuthContext.tsx, src/portal/lib/apiClient.ts"),
    ("Change shared UI components", "src/components/ui/ (shadcn/ui), src/portal/components/shared/"),
    ("Change public site content", "src/pages/, src/components/ (non-ui)"),
]


def section_appendix_files():
    flow = [heading("Appendix A — Key File Reference Index", 1)]
    flow.append(P("Quick lookup for \"where do I start\" when making a common kind of change:", "Body"))
    flow.append(data_table(["If you need to...", "Start here"], FILE_INDEX,
                            [2.5 * inch, 3.55 * inch]))
    return flow


GLOSSARY = [
    ("displayId vs UUID", "Every entity has both a UUID primary key (used for API calls/foreign keys) and a human-readable displayId like EMP-0001, INV-2026-0001 (used only in the UI)."),
    ("Onboarding states", "in_progress -> pending_review -> (changes_requested <-> pending_review) -> approved. Derived from employees columns, not a dedicated enum."),
    ("Timesheet states", "draft -> submitted -> manager_approved, with rejection paths back to submitted."),
    ("RBAC", "Role-Based Access Control — the 5 roles (admin, hr, operations, finance, employee) that gate both frontend routes and backend endpoints."),
    ("mapXxx() / useXxx()", "The frontend convention: every hook maps the backend's snake_case response into a camelCase TypeScript object."),
    ("entity_type / entity_id", "A polymorphic reference pattern used by documents and notifications to point at any kind of record (employee, client, invoice, etc.) without a rigid foreign key."),
    ("supabaseAdmin", "The service-role Supabase client used for every backend database query — bypasses Row Level Security by design; all authorization happens in application code instead."),
]


def section_appendix_glossary():
    flow = [heading("Appendix B — Glossary", 1)]
    flow.append(data_table(["Term", "Meaning"], GLOSSARY, [1.5 * inch, 4.55 * inch]))
    return flow


if __name__ == "__main__":
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    build_doc()
    print(f"Wrote {OUTPUT_PATH}")
