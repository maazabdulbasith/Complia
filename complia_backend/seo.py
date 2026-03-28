from __future__ import annotations

from html import escape
from urllib.parse import quote

from django.conf import settings
from django.http import HttpResponse
from django.utils import timezone

from complia_backend.notices.models import NoticeType


def _base_url(request) -> str:
    if settings.PUBLIC_SITE_URL:
        return settings.PUBLIC_SITE_URL
    return request.build_absolute_uri("/").rstrip("/")


def robots_txt(request):
    base_url = _base_url(request)
    sitemap_url = f"{base_url}/sitemap.xml"
    content = "\n".join(
        [
            "User-agent: *",
            "Allow: /",
            f"Sitemap: {sitemap_url}",
            "",
        ]
    )
    return HttpResponse(content, content_type="text/plain; charset=utf-8")


def sitemap_xml(request):
    base_url = _base_url(request)
    urls = [
        {"loc": f"{base_url}/", "lastmod": timezone.now().date().isoformat()},
        {"loc": f"{base_url}/ca-help", "lastmod": timezone.now().date().isoformat()},
    ]

    for notice in NoticeType.objects.filter(is_active=True).only("code", "updated_at"):
        urls.append(
            {
                "loc": f"{base_url}/notice/{quote(notice.code, safe='')}",
                "lastmod": notice.updated_at.date().isoformat(),
            }
        )

    xml_parts = [
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
        "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">",
    ]
    for item in urls:
        xml_parts.append("  <url>")
        xml_parts.append(f"    <loc>{escape(item['loc'])}</loc>")
        xml_parts.append(f"    <lastmod>{item['lastmod']}</lastmod>")
        xml_parts.append("  </url>")
    xml_parts.append("</urlset>")

    return HttpResponse("\n".join(xml_parts), content_type="application/xml; charset=utf-8")
