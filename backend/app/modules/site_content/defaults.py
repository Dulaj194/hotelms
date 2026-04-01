from __future__ import annotations

from datetime import UTC, datetime, timedelta


DEFAULT_SITE_PAGES: dict[str, dict] = {
    "landing": {
        "title": "R.LUMINUOUS Hospitality Platform",
        "summary": "Public landing page content for the HotelMS lead funnel.",
        "payload": {
            "hero_badge": "QR-Powered Restaurant and Hotel Solution",
            "product_name": "R.LUMINUOUS",
            "hero_title": "All-in-one QR Ordering and Hospitality Management",
            "hero_description": (
                "Built for hotel and restaurant teams that need faster service, stronger "
                "visibility, and a smoother guest journey from scan to settlement."
            ),
            "primary_cta_label": "Start Free Trial",
            "primary_cta_to": "/register",
            "secondary_cta_label": "Request a Demo",
            "secondary_cta_to": "/contact",
            "hero_image_url": (
                "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4"
                "?auto=format&fit=crop&w=1200&q=80"
            ),
            "stats": [
                {"value": "500+", "label": "Restaurants"},
                {"value": "120+", "label": "Hotels"},
                {"value": "1M+", "label": "Orders"},
                {"value": "99.9%", "label": "Platform uptime"},
            ],
            "audiences": [
                {
                    "title": "Hotel Owners",
                    "message": (
                        "Manage room ordering, billing visibility, and service delivery from "
                        "one connected workflow."
                    ),
                },
                {
                    "title": "Restaurant Owners",
                    "message": (
                        "Reduce manual order taking during peak hours and improve table "
                        "turnover with QR-first service."
                    ),
                },
                {
                    "title": "Operations Managers",
                    "message": (
                        "Track order flow, staff coordination, and sales signals without "
                        "jumping between disconnected tools."
                    ),
                },
                {
                    "title": "Finance Teams",
                    "message": (
                        "Move settled room folios cleanly from cashier to accountant with "
                        "better audit visibility."
                    ),
                },
            ],
            "benefits": [
                {
                    "title": "Short-staffed shifts",
                    "pain": "Teams lose time taking repeat orders and handling manual follow-up.",
                    "outcome": "QR ordering cuts repetitive work so staff can focus on guest care.",
                },
                {
                    "title": "Slow guest turnaround",
                    "pain": "Guests wait too long for menus, confirmations, and bill handling.",
                    "outcome": "Digital flows shorten the path from order placement to settlement.",
                },
                {
                    "title": "Weak operational visibility",
                    "pain": "Managers struggle to see what is selling, delaying, or underperforming.",
                    "outcome": "Live dashboards surface peak periods, top items, and team bottlenecks.",
                },
                {
                    "title": "Fragmented hotel workflows",
                    "pain": "Room service, housekeeping, and folio updates sit in separate channels.",
                    "outcome": "One platform keeps guest requests, charges, and staff execution connected.",
                },
            ],
            "features": [
                {
                    "capability": "QR Ordering",
                    "explanation": (
                        "Guests browse and order instantly from table or room QR flows without app installs."
                    ),
                    "visual_hint": "Scan to browse to order",
                    "icon_key": "qr_code",
                },
                {
                    "capability": "Kitchen Workflow",
                    "explanation": (
                        "Orders move to live kitchen views with clearer preparation and delivery timing."
                    ),
                    "visual_hint": "Live order routing",
                    "icon_key": "chef_hat",
                },
                {
                    "capability": "Sales Insights",
                    "explanation": (
                        "Track top-performing items, peak windows, and revenue patterns from one dashboard."
                    ),
                    "visual_hint": "Daily and weekly trends",
                    "icon_key": "bar_chart",
                },
                {
                    "capability": "Secure Operations",
                    "explanation": (
                        "Use role-based access for finance, operations, and hospitality teams with stronger control."
                    ),
                    "visual_hint": "Role-based access",
                    "icon_key": "shield_check",
                },
            ],
            "steps": [
                "Guest scans a table or room QR code",
                "The public menu opens instantly in browser",
                "Orders and requests route to the right team",
                "Kitchen and staff update progress live",
                "Charges move into billing and folio workflows",
                "Management tracks service quality and revenue outcomes",
            ],
            "use_cases": [
                {
                    "title": "Table QR Ordering",
                    "details": "Guests order faster without waiting for printed menus or staff handoffs.",
                },
                {
                    "title": "Room Service Ordering",
                    "details": "Hotel guests place food orders and track them from the room menu itself.",
                },
                {
                    "title": "Service Requests",
                    "details": "Housekeeping and support requests can be submitted through room-facing flows.",
                },
                {
                    "title": "Folio Settlement",
                    "details": "Room charges can be settled, printed, and handed across finance checkpoints.",
                },
            ],
            "mockups": [
                {
                    "title": "Menu on phone",
                    "image_url": (
                        "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f"
                        "?auto=format&fit=crop&w=900&q=80"
                    ),
                },
                {
                    "title": "Kitchen dashboard",
                    "image_url": (
                        "https://images.unsplash.com/photo-1556740749-887f6717d7e4"
                        "?auto=format&fit=crop&w=900&q=80"
                    ),
                },
                {
                    "title": "Staff workflow",
                    "image_url": (
                        "https://images.unsplash.com/photo-1559339352-11d035aa65de"
                        "?auto=format&fit=crop&w=900&q=80"
                    ),
                },
                {
                    "title": "Room ordering",
                    "image_url": (
                        "https://images.unsplash.com/photo-1566665797739-1674de7a421a"
                        "?auto=format&fit=crop&w=900&q=80"
                    ),
                },
                {
                    "title": "Analytics dashboard",
                    "image_url": (
                        "https://images.unsplash.com/photo-1551281044-8b9a4e7f4f7c"
                        "?auto=format&fit=crop&w=900&q=80"
                    ),
                },
            ],
            "testimonial": {
                "quote": (
                    "R.LUMINUOUS helped us cut ordering delays and improve coordination "
                    "between floor, kitchen, and finance teams in just two weeks."
                ),
                "author": "Nadeesha Perera",
                "role": "Operations Manager, Coastal Bay Hotel and Bistro",
            },
            "cta": {
                "title": "Launch your hospitality workflow with less friction",
                "message": (
                    "Request a tailored demo for your hotel or restaurant and see how "
                    "guest ordering, team execution, and billing fit together."
                ),
                "action_label": "Book a Demo",
                "action_to": "/contact",
            },
            "trust_message": (
                "Unified for restaurants and hotels with onboarding support, stable uptime, "
                "and finance-ready folio workflows."
            ),
            "footer": {
                "trust_info": (
                    "Trusted by hospitality teams that need faster service, better visibility, "
                    "and strong operational support."
                ),
                "contact_points": [
                    "info@rluminuous.com",
                    "+94 77 754 7239",
                    "Colombo, Sri Lanka",
                ],
            },
        },
    },
    "about": {
        "title": "About R.LUMINUOUS",
        "summary": "About page content for the HotelMS public website.",
        "payload": {
            "hero_eyebrow": "About the Platform",
            "hero_title": "Built for hospitality teams that need speed and control",
            "hero_description": (
                "R.LUMINUOUS brings together guest ordering, room service, service requests, "
                "and billing operations into one practical system."
            ),
            "overview_title": "Why we built it",
            "overview_paragraphs": [
                (
                    "Hospitality teams often run critical workflows through paper menus, manual "
                    "calls, and disconnected tools. That slows service and makes daily operations "
                    "harder to monitor."
                ),
                (
                    "We built R.LUMINUOUS to connect the guest journey from QR scan to order "
                    "tracking, delivery, settlement, and reporting without forcing teams to learn "
                    "five different systems."
                ),
            ],
            "values": [
                {
                    "title": "Operational clarity",
                    "description": (
                        "Teams should be able to see what is happening now, not reconstruct it later."
                    ),
                },
                {
                    "title": "Guest-first speed",
                    "description": (
                        "Ordering and service flows should feel instant for the guest and manageable for staff."
                    ),
                },
                {
                    "title": "Finance readiness",
                    "description": (
                        "Billing, receipts, and folio handoffs should support audit-friendly execution."
                    ),
                },
            ],
            "milestones": [
                "QR entry points for tables and rooms",
                "Live kitchen and service execution flows",
                "Room folio settlement with cashier and accountant handoff",
                "Reporting and package-based SaaS administration",
            ],
            "capabilities": [
                {
                    "title": "Unified guest journey",
                    "details": (
                        "Move from browse to order to status tracking without sending the guest into separate flows."
                    ),
                },
                {
                    "title": "Hotel-aware operations",
                    "details": (
                        "Support room service and housekeeping-style request patterns alongside restaurant operations."
                    ),
                },
                {
                    "title": "Scalable governance",
                    "details": (
                        "Use roles, reports, and super-admin tools to scale across multiple properties and teams."
                    ),
                },
            ],
            "cta": {
                "title": "See how the workflow fits your property",
                "message": "Talk with us about your restaurant, hotel, or hybrid hospitality operation.",
                "action_label": "Talk to Sales",
                "action_to": "/contact",
            },
        },
    },
    "contact": {
        "title": "Contact R.LUMINUOUS",
        "summary": "Contact and lead capture content for the HotelMS public website.",
        "payload": {
            "hero_eyebrow": "Talk With Our Team",
            "hero_title": "Plan your rollout with a hospitality-focused demo",
            "hero_description": (
                "Share your current setup and we will help map the right flow for rooms, "
                "restaurant ordering, billing, and operations."
            ),
            "channels": [
                {
                    "label": "Email",
                    "value": "info@rluminuous.com",
                    "detail": "Best for partnership, demos, and implementation questions.",
                },
                {
                    "label": "Phone",
                    "value": "+94 77 754 7239",
                    "detail": "Speak directly with our onboarding and sales support team.",
                },
                {
                    "label": "Office",
                    "value": "Colombo, Sri Lanka",
                    "detail": "Serving hotel and restaurant teams across Sri Lanka and beyond.",
                },
            ],
            "response_commitments": [
                "Typical response within one business day",
                "Demo planning tailored to your property type",
                "Guidance for QR ordering, room service, and finance workflows",
            ],
            "faq": [
                {
                    "question": "Can this work for both hotel rooms and restaurant tables?",
                    "answer": "Yes. The platform supports room, table, kitchen, and billing workflows in one system.",
                },
                {
                    "question": "Do guests need to install an app?",
                    "answer": "No. Guest ordering opens directly in browser after scanning the QR code.",
                },
                {
                    "question": "Can finance teams review room folio handoff status?",
                    "answer": "Yes. Billing flows can move room charges through cashier and accountant checkpoints.",
                },
            ],
            "sidebar_points": [
                "Free rollout consultation",
                "Hospitality workflow review",
                "Mobile-friendly guest ordering guidance",
            ],
            "success_title": "Thanks, your request has been received.",
            "success_message": "Our team will review your message and contact you shortly.",
        },
    },
}

DEFAULT_BLOG_POSTS: list[dict] = [
    {
        "slug": "how-qr-ordering-improves-table-turnover",
        "title": "How QR Ordering Improves Table Turnover Without Hurting Service",
        "excerpt": (
            "A practical look at reducing menu wait time, confirmation lag, and payment friction "
            "while keeping staff focused on hospitality."
        ),
        "category": "Operations",
        "cover_image_url": (
            "https://images.unsplash.com/photo-1552566626-52f8b828add9"
            "?auto=format&fit=crop&w=1200&q=80"
        ),
        "tags": ["QR ordering", "table service", "operations"],
        "reading_minutes": 4,
        "is_featured": True,
        "published_at": datetime.now(UTC) - timedelta(days=3),
        "body": [
            (
                "When guests wait for menus, then wait again to place an order, turnover slows long "
                "before the kitchen becomes the bottleneck. QR ordering removes that early friction."
            ),
            (
                "The biggest gain usually comes from reducing idle moments: menu handoff, order "
                "capture, and repeated clarification. Staff can spend more time checking guest needs "
                "instead of repeating the same manual steps."
            ),
            (
                "The strongest implementations do not replace hospitality. They remove delay, surface "
                "clean order information, and free the team to focus on quality interactions."
            ),
        ],
        "key_takeaways": [
            "Reduce menu wait time and order capture delay",
            "Keep staff focused on service instead of repetitive order entry",
            "Use order data to identify new turnaround bottlenecks",
        ],
    },
    {
        "slug": "room-service-workflows-that-guests-actually-use",
        "title": "Room Service Workflows That Guests Actually Use",
        "excerpt": (
            "Why room ordering adoption improves when the path includes live tracking, clear pricing, "
            "and fewer confusing steps."
        ),
        "category": "Room Service",
        "cover_image_url": (
            "https://images.unsplash.com/photo-1445019980597-93fa8acb246c"
            "?auto=format&fit=crop&w=1200&q=80"
        ),
        "tags": ["hotel", "room service", "guest experience"],
        "reading_minutes": 5,
        "is_featured": False,
        "published_at": datetime.now(UTC) - timedelta(days=6),
        "body": [
            (
                "Guests are far more likely to use room ordering when the menu feels immediate and the "
                "next step is obvious. Hidden charges and no status visibility create drop-off."
            ),
            (
                "A better experience includes clean category browsing, a lightweight checkout flow, and "
                "a follow-up status page that reassures the guest their request is progressing."
            ),
            (
                "Hotels also benefit when those orders can post into folio-aware billing instead of "
                "creating manual reconciliation work later."
            ),
        ],
        "key_takeaways": [
            "Make the order path obvious on mobile devices",
            "Show order status after placement to reduce front-desk follow-up",
            "Connect room charges to settlement workflows early",
        ],
    },
    {
        "slug": "five-hospitality-metrics-worth-reviewing-every-week",
        "title": "Five Hospitality Metrics Worth Reviewing Every Week",
        "excerpt": (
            "From average ticket size to fulfillment lag, these are the numbers that help operators "
            "spot service and revenue issues early."
        ),
        "category": "Revenue",
        "cover_image_url": (
            "https://images.unsplash.com/photo-1554224155-6726b3ff858f"
            "?auto=format&fit=crop&w=1200&q=80"
        ),
        "tags": ["analytics", "revenue", "management"],
        "reading_minutes": 4,
        "is_featured": False,
        "published_at": datetime.now(UTC) - timedelta(days=9),
        "body": [
            (
                "Weekly reviews work best when they stay close to execution. Operators need metrics "
                "that connect directly to guest experience and team performance."
            ),
            (
                "Average order value, completion time, category mix, room service adoption, and "
                "settlement lag often reveal operational stories before complaints do."
            ),
            (
                "The goal is not to create more reporting. It is to create faster, clearer decisions "
                "for pricing, staffing, and workflow improvement."
            ),
        ],
        "key_takeaways": [
            "Track metrics tied directly to service execution",
            "Review both guest behavior and internal handoff lag",
            "Use weekly trends to guide staffing and pricing decisions",
        ],
    },
]
