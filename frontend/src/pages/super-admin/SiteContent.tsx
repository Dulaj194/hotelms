import { useEffect, useState, type ReactNode } from "react";
import {
  BookOpen,
  Download,
  EyeOff,
  Globe2,
  Mail,
  Plus,
  RefreshCw,
  Save,
  Send,
} from "lucide-react";

import SuperAdminLayout from "@/components/shared/SuperAdminLayout";
import {
  downloadContactLeadCsv,
  fromDateTimeInputValue,
  joinLines,
  leadStatusBadgeClass,
  leadStatusLabel,
  publicationBadgeClass,
  splitLines,
  toDateTimeInputValue,
} from "@/features/super-admin/site-content/helpers";
import { api } from "@/lib/api";
import { formatDateTime, getApiErrorMessage } from "@/pages/super-admin/utils";
import type {
  AboutPageContent,
  AdminBlogPostDetail,
  AdminBlogPostListResponse,
  AdminBlogPostSummary,
  AdminBlogPostUpsertRequest,
  AdminContactLead,
  AdminContactLeadListResponse,
  AdminContactLeadSummary,
  AdminContactLeadUpdateRequest,
  AdminSitePageDetail,
  AdminSitePageListResponse,
  AdminSitePageSummary,
  ContactLeadStatus,
  ContactPageContent,
  SiteContentAdminUser,
  SiteContentAdminUserListResponse,
} from "@/types/siteContent";

type CmsTab = "pages" | "blogs" | "leads";
type ManagedPageSlug = "about" | "contact";

type PageMessage =
  | {
      type: "ok" | "err";
      text: string;
    }
  | null;

type ManagedAboutPageDetail = Omit<AdminSitePageDetail, "slug" | "payload" | "published_payload"> & {
  slug: "about";
  payload: AboutPageContent;
  published_payload: Record<string, unknown> | null;
};

type ManagedContactPageDetail = Omit<AdminSitePageDetail, "slug" | "payload" | "published_payload"> & {
  slug: "contact";
  payload: ContactPageContent;
  published_payload: Record<string, unknown> | null;
};

const EMPTY_BLOG_FORM: AdminBlogPostUpsertRequest = {
  slug: "",
  title: "",
  excerpt: "",
  category: "",
  cover_image_url: "",
  tags: [],
  body: [""],
  key_takeaways: [],
  reading_minutes: 4,
  is_featured: false,
  scheduled_publish_at: null,
};

const EMPTY_LEAD_SUMMARY: AdminContactLeadSummary = {
  new_count: 0,
  reviewed_count: 0,
  qualified_count: 0,
  closed_count: 0,
  unassigned_count: 0,
};

function toManagedAboutPage(detail: AdminSitePageDetail): ManagedAboutPageDetail {
  return {
    ...detail,
    slug: "about",
    payload: detail.payload as unknown as AboutPageContent,
  };
}

function toManagedContactPage(detail: AdminSitePageDetail): ManagedContactPageDetail {
  return {
    ...detail,
    slug: "contact",
    payload: detail.payload as unknown as ContactPageContent,
  };
}

function toBlogForm(detail: AdminBlogPostDetail): AdminBlogPostUpsertRequest {
  return {
    slug: detail.slug,
    title: detail.title,
    excerpt: detail.excerpt,
    category: detail.category,
    cover_image_url: detail.cover_image_url,
    tags: detail.tags,
    body: detail.body,
    key_takeaways: detail.key_takeaways,
    reading_minutes: detail.reading_minutes,
    is_featured: detail.is_featured,
    scheduled_publish_at: detail.scheduled_publish_at,
  };
}

export default function SuperAdminSiteContentPage() {
  const [activeTab, setActiveTab] = useState<CmsTab>("pages");
  const [pageMessage, setPageMessage] = useState<PageMessage>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [pageSummaries, setPageSummaries] = useState<AdminSitePageSummary[]>([]);
  const [aboutPage, setAboutPage] = useState<ManagedAboutPageDetail | null>(null);
  const [contactPage, setContactPage] = useState<ManagedContactPageDetail | null>(null);
  const [selectedPageSlug, setSelectedPageSlug] = useState<ManagedPageSlug>("about");
  const [pageBusy, setPageBusy] = useState(false);

  const [blogs, setBlogs] = useState<AdminBlogPostSummary[]>([]);
  const [blogTotal, setBlogTotal] = useState(0);
  const [blogSearch, setBlogSearch] = useState("");
  const [blogStatusFilter, setBlogStatusFilter] = useState<"all" | "published" | "draft">("all");
  const [blogEditorMode, setBlogEditorMode] = useState<"new" | "edit">("new");
  const [blogBusy, setBlogBusy] = useState(false);
  const [selectedBlogSlug, setSelectedBlogSlug] = useState<string | null>(null);
  const [selectedBlog, setSelectedBlog] = useState<AdminBlogPostDetail | null>(null);
  const [blogForm, setBlogForm] = useState<AdminBlogPostUpsertRequest>(EMPTY_BLOG_FORM);

  const [assignees, setAssignees] = useState<SiteContentAdminUser[]>([]);
  const [leads, setLeads] = useState<AdminContactLead[]>([]);
  const [leadTotal, setLeadTotal] = useState(0);
  const [leadSummary, setLeadSummary] = useState<AdminContactLeadSummary>(EMPTY_LEAD_SUMMARY);
  const [leadSearch, setLeadSearch] = useState("");
  const [leadStatusFilter, setLeadStatusFilter] = useState<string>("");
  const [leadAssigneeFilter, setLeadAssigneeFilter] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [leadBusy, setLeadBusy] = useState(false);
  const [leadExporting, setLeadExporting] = useState(false);
  const [leadDraft, setLeadDraft] = useState<{
    status: ContactLeadStatus;
    assigned_to_user_id: string;
    internal_notes: string;
  }>({
    status: "new",
    assigned_to_user_id: "",
    internal_notes: "",
  });

  const selectedPage = selectedPageSlug === "about" ? aboutPage : contactPage;
  const selectedLead = leads.find((item) => item.id === selectedLeadId) ?? null;
  const managedPageSummaries = pageSummaries.filter(
    (item) => item.slug === "about" || item.slug === "contact",
  );

  useEffect(() => {
    void bootstrap();
  }, []);

  useEffect(() => {
    if (!selectedLead) {
      setLeadDraft({
        status: "new",
        assigned_to_user_id: "",
        internal_notes: "",
      });
      return;
    }

    setLeadDraft({
      status: selectedLead.status,
      assigned_to_user_id: selectedLead.assigned_to?.user_id
        ? String(selectedLead.assigned_to.user_id)
        : "",
      internal_notes: selectedLead.internal_notes ?? "",
    });
  }, [selectedLead]);

  async function bootstrap() {
    setLoading(true);
    setPageMessage(null);
    try {
      await Promise.all([loadPages(), loadBlogs(), loadAssignees(), loadLeads()]);
    } catch (error) {
      setPageMessage({
        type: "err",
        text: getApiErrorMessage(error, "Failed to load the website CMS."),
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await bootstrap();
    setRefreshing(false);
  }

  async function loadPages() {
    const [pageList, aboutDetail, contactDetail] = await Promise.all([
      api.get<AdminSitePageListResponse>("/site-content/admin/pages"),
      api.get<AdminSitePageDetail>("/site-content/admin/pages/about"),
      api.get<AdminSitePageDetail>("/site-content/admin/pages/contact"),
    ]);
    setPageSummaries(pageList.items);
    setAboutPage(toManagedAboutPage(aboutDetail));
    setContactPage(toManagedContactPage(contactDetail));
  }

  async function loadBlogs(nextSelectedSlug?: string | null) {
    const params = new URLSearchParams({ limit: "100" });
    if (blogSearch.trim()) params.set("search", blogSearch.trim());
    if (blogStatusFilter === "published") params.set("is_published", "true");
    if (blogStatusFilter === "draft") params.set("is_published", "false");

    const response = await api.get<AdminBlogPostListResponse>(`/site-content/admin/blogs?${params.toString()}`);
    setBlogs(response.items);
    setBlogTotal(response.total);

    const targetSlug = nextSelectedSlug ?? selectedBlogSlug;
    if (!targetSlug) return;

    const stillVisible = response.items.some((item) => item.slug === targetSlug);
    if (stillVisible) {
      await loadBlogDetail(targetSlug);
      return;
    }

    if (response.items[0]) {
      await loadBlogDetail(response.items[0].slug);
      return;
    }

    setSelectedBlog(null);
    setSelectedBlogSlug(null);
    setBlogEditorMode("new");
    setBlogForm(EMPTY_BLOG_FORM);
  }

  async function loadBlogDetail(slug: string) {
    const detail = await api.get<AdminBlogPostDetail>(`/site-content/admin/blogs/${slug}`);
    setSelectedBlogSlug(detail.slug);
    setSelectedBlog(detail);
    setBlogEditorMode("edit");
    setBlogForm(toBlogForm(detail));
  }

  async function loadAssignees() {
    const response = await api.get<SiteContentAdminUserListResponse>("/site-content/admin/leads/assignees");
    setAssignees(response.items);
  }

  async function loadLeads() {
    const params = new URLSearchParams({ limit: "100" });
    if (leadSearch.trim()) params.set("search", leadSearch.trim());
    if (leadStatusFilter) params.set("status_filter", leadStatusFilter);
    if (leadAssigneeFilter) params.set("assigned_to_user_id", leadAssigneeFilter);

    const response = await api.get<AdminContactLeadListResponse>(`/site-content/admin/leads?${params.toString()}`);
    setLeads(response.items);
    setLeadTotal(response.total);
    setLeadSummary(response.summary);

    if (selectedLeadId && response.items.some((item) => item.id === selectedLeadId)) return;
    setSelectedLeadId(response.items[0]?.id ?? null);
  }

  function updatePageSummary(nextSummary: AdminSitePageSummary) {
    setPageSummaries((current) =>
      current.map((item) => (item.slug === nextSummary.slug ? nextSummary : item)),
    );
  }

  async function saveSelectedPageDraft() {
    if (!selectedPage) return;

    setPageBusy(true);
    setPageMessage(null);
    try {
      const response = await api.put<AdminSitePageDetail>(`/site-content/admin/pages/${selectedPage.slug}`, {
        title: selectedPage.title,
        summary: selectedPage.summary,
        payload: selectedPage.payload,
      });

      if (response.slug === "about") {
        const managed = toManagedAboutPage(response);
        setAboutPage(managed);
        updatePageSummary(managed);
      } else {
        const managed = toManagedContactPage(response);
        setContactPage(managed);
        updatePageSummary(managed);
      }
      setPageMessage({ type: "ok", text: `${capitalize(selectedPage.slug)} page draft saved.` });
    } catch (error) {
      setPageMessage({
        type: "err",
        text: getApiErrorMessage(error, "Failed to save the page draft."),
      });
    } finally {
      setPageBusy(false);
    }
  }

  async function publishSelectedPage() {
    if (!selectedPage) return;

    setPageBusy(true);
    setPageMessage(null);
    try {
      const response = await api.post<AdminSitePageDetail>(`/site-content/admin/pages/${selectedPage.slug}/publish`, {});
      if (response.slug === "about") {
        const managed = toManagedAboutPage(response);
        setAboutPage(managed);
        updatePageSummary(managed);
      } else {
        const managed = toManagedContactPage(response);
        setContactPage(managed);
        updatePageSummary(managed);
      }
      setPageMessage({ type: "ok", text: `${capitalize(selectedPage.slug)} page published.` });
    } catch (error) {
      setPageMessage({
        type: "err",
        text: getApiErrorMessage(error, "Failed to publish the page."),
      });
    } finally {
      setPageBusy(false);
    }
  }

  async function unpublishSelectedPage() {
    if (!selectedPage) return;

    setPageBusy(true);
    setPageMessage(null);
    try {
      const response = await api.post<AdminSitePageDetail>(`/site-content/admin/pages/${selectedPage.slug}/unpublish`, {});
      if (response.slug === "about") {
        const managed = toManagedAboutPage(response);
        setAboutPage(managed);
        updatePageSummary(managed);
      } else {
        const managed = toManagedContactPage(response);
        setContactPage(managed);
        updatePageSummary(managed);
      }
      setPageMessage({ type: "ok", text: `${capitalize(selectedPage.slug)} page unpublished.` });
    } catch (error) {
      setPageMessage({
        type: "err",
        text: getApiErrorMessage(error, "Failed to unpublish the page."),
      });
    } finally {
      setPageBusy(false);
    }
  }

  function startNewBlog() {
    setBlogEditorMode("new");
    setSelectedBlogSlug(null);
    setSelectedBlog(null);
    setBlogForm(EMPTY_BLOG_FORM);
  }

  async function saveBlogDraft() {
    setBlogBusy(true);
    setPageMessage(null);
    try {
      const payload: AdminBlogPostUpsertRequest = {
        ...blogForm,
        scheduled_publish_at: blogForm.scheduled_publish_at || null,
      };

      const response =
        blogEditorMode === "new"
          ? await api.post<AdminBlogPostDetail>("/site-content/admin/blogs", payload)
          : await api.put<AdminBlogPostDetail>(`/site-content/admin/blogs/${selectedBlogSlug}`, payload);

      setSelectedBlog(response);
      setSelectedBlogSlug(response.slug);
      setBlogEditorMode("edit");
      setBlogForm(toBlogForm(response));
      await loadBlogs(response.slug);
      setPageMessage({
        type: "ok",
        text: blogEditorMode === "new" ? "Blog draft created successfully." : "Blog draft updated successfully.",
      });
    } catch (error) {
      setPageMessage({
        type: "err",
        text: getApiErrorMessage(error, "Failed to save the blog draft."),
      });
    } finally {
      setBlogBusy(false);
    }
  }

  async function publishBlog() {
    if (!selectedBlogSlug) return;

    setBlogBusy(true);
    setPageMessage(null);
    try {
      const response = await api.post<AdminBlogPostDetail>(`/site-content/admin/blogs/${selectedBlogSlug}/publish`, {});
      setSelectedBlog(response);
      setBlogForm(toBlogForm(response));
      await loadBlogs(response.slug);
      setPageMessage({ type: "ok", text: "Blog post published." });
    } catch (error) {
      setPageMessage({
        type: "err",
        text: getApiErrorMessage(error, "Failed to publish the blog post."),
      });
    } finally {
      setBlogBusy(false);
    }
  }

  async function unpublishBlog() {
    if (!selectedBlogSlug) return;

    setBlogBusy(true);
    setPageMessage(null);
    try {
      const response = await api.post<AdminBlogPostDetail>(`/site-content/admin/blogs/${selectedBlogSlug}/unpublish`, {});
      setSelectedBlog(response);
      setBlogForm(toBlogForm(response));
      await loadBlogs(response.slug);
      setPageMessage({ type: "ok", text: "Blog post unpublished." });
    } catch (error) {
      setPageMessage({
        type: "err",
        text: getApiErrorMessage(error, "Failed to unpublish the blog post."),
      });
    } finally {
      setBlogBusy(false);
    }
  }

  async function deleteBlog() {
    if (!selectedBlogSlug) return;
    if (!window.confirm("Delete this draft permanently?")) return;

    setBlogBusy(true);
    setPageMessage(null);
    try {
      await api.delete(`/site-content/admin/blogs/${selectedBlogSlug}`);
      startNewBlog();
      await loadBlogs();
      setPageMessage({ type: "ok", text: "Blog draft deleted." });
    } catch (error) {
      setPageMessage({
        type: "err",
        text: getApiErrorMessage(error, "Failed to delete the blog draft."),
      });
    } finally {
      setBlogBusy(false);
    }
  }

  async function saveLeadUpdate() {
    if (!selectedLead) return;

    setLeadBusy(true);
    setPageMessage(null);
    try {
      const response = await api.patch<AdminContactLead>(`/site-content/admin/leads/${selectedLead.id}`, {
        status: leadDraft.status,
        assigned_to_user_id: leadDraft.assigned_to_user_id ? Number(leadDraft.assigned_to_user_id) : null,
        internal_notes: leadDraft.internal_notes,
      } satisfies AdminContactLeadUpdateRequest);

      setLeads((current) => current.map((item) => (item.id === response.id ? response : item)));
      setSelectedLeadId(response.id);
      await loadLeads();
      setPageMessage({ type: "ok", text: "Lead inbox updated." });
    } catch (error) {
      setPageMessage({
        type: "err",
        text: getApiErrorMessage(error, "Failed to update the lead inbox."),
      });
    } finally {
      setLeadBusy(false);
    }
  }

  async function exportLeads() {
    setLeadExporting(true);
    setPageMessage(null);
    try {
      await downloadContactLeadCsv({
        search: leadSearch,
        status_filter: leadStatusFilter,
        assigned_to_user_id: leadAssigneeFilter,
      });
      setPageMessage({ type: "ok", text: "Lead export downloaded." });
    } catch (error) {
      setPageMessage({
        type: "err",
        text: getApiErrorMessage(error, "Failed to export contact leads."),
      });
    } finally {
      setLeadExporting(false);
    }
  }

  const publishedPageCount = managedPageSummaries.filter((item) => item.is_published).length;
  const publishedBlogCount = blogs.filter((item) => item.is_published).length;

  return (
    <SuperAdminLayout>
      <div className="app-page-stack">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-700">
                <Globe2 className="h-3.5 w-3.5" />
                Public Website CMS
              </div>
              <h1 className="mt-3 text-2xl font-semibold text-slate-900 sm:text-3xl">
                Manage the public site, blog pipeline, and lead inbox
              </h1>
              <p className="mt-2 text-sm text-slate-600 sm:text-base">
                Keep About, Contact, and blog content in draft until it is ready, then publish live
                without breaking the current public experience. Lead handoff, notes, and export stay
                in the same workspace.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={handleRefresh} disabled={refreshing} className="app-btn-ghost">
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Published Pages" value={publishedPageCount} hint={`${managedPageSummaries.length} managed pages in the CMS`} />
            <MetricCard label="Published Blogs" value={publishedBlogCount} hint={`${blogTotal} drafts and live articles in the current view`} />
            <MetricCard label="New Leads" value={leadSummary.new_count} hint="Fresh contact requests waiting for review" />
            <MetricCard label="Qualified Leads" value={leadSummary.qualified_count} hint={`${leadSummary.unassigned_count} currently unassigned`} />
          </div>

          <div className="mt-6 grid gap-2 sm:grid-cols-3">
            <TabButton label="Pages" active={activeTab === "pages"} icon={<Mail className="h-4 w-4" />} onClick={() => setActiveTab("pages")} />
            <TabButton label="Blogs" active={activeTab === "blogs"} icon={<BookOpen className="h-4 w-4" />} onClick={() => setActiveTab("blogs")} />
            <TabButton label="Lead Inbox" active={activeTab === "leads"} icon={<Send className="h-4 w-4" />} onClick={() => setActiveTab("leads")} />
          </div>
        </section>

        {pageMessage && (
          <div
            className={`rounded-xl border p-4 text-sm ${
              pageMessage.type === "ok"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {pageMessage.text}
          </div>
        )}

        {loading ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
            Loading website CMS...
          </section>
        ) : (
          <>
            {activeTab === "pages" && (
              <section className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <PanelTitle
                      title="Page Switcher"
                      description="Move between public content pages and publish when the draft is ready."
                    />
                    <div className="mt-4 space-y-3">
                      {managedPageSummaries.map((item) => (
                          <button
                            key={item.slug}
                            type="button"
                            onClick={() => setSelectedPageSlug(item.slug as ManagedPageSlug)}
                            className={`w-full rounded-xl border p-4 text-left transition ${
                              selectedPageSlug === item.slug
                                ? "border-sky-300 bg-sky-50"
                                : "border-slate-200 bg-white hover:border-slate-300"
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="font-semibold text-slate-900">{item.title}</p>
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${publicationBadgeClass(item.is_published)}`}
                              >
                                {item.is_published ? "Live" : "Draft only"}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-slate-600">
                              {item.summary ?? "No summary saved yet."}
                            </p>
                            <p className="mt-3 text-xs text-slate-500">
                              Updated {formatDateTime(item.updated_at)}
                            </p>
                          </button>
                        ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <PanelTitle
                      title="Publication"
                      description="Save draft changes as often as needed, then publish or unpublish the current page."
                    />
                    <div className="mt-4 space-y-2 text-sm text-slate-600">
                      <p>
                        Current status:{" "}
                        <span className="font-semibold text-slate-900">
                          {selectedPage?.is_published ? "Live" : "Draft only"}
                        </span>
                      </p>
                      <p>Last published: {formatDateTime(selectedPage?.last_published_at)}</p>
                      <p>
                        Published by: {selectedPage?.published_by?.full_name ?? "Not published yet"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-xl font-semibold text-slate-900">
                          {selectedPageSlug === "about" ? "About Page Editor" : "Contact Page Editor"}
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                          Draft editing stays separate from the public live version until you publish.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void saveSelectedPageDraft()}
                          disabled={pageBusy || !selectedPage}
                          className="app-btn-base bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          <Save className="h-4 w-4" />
                          Save Draft
                        </button>
                        <button
                          type="button"
                          onClick={() => void publishSelectedPage()}
                          disabled={pageBusy || !selectedPage}
                          className="app-btn-base bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <Send className="h-4 w-4" />
                          Publish {selectedPageSlug === "about" ? "About" : "Contact"} Page
                        </button>
                        <button
                          type="button"
                          onClick={() => void unpublishSelectedPage()}
                          disabled={pageBusy || !selectedPage?.is_published}
                          className="app-btn-ghost"
                        >
                          <EyeOff className="h-4 w-4" />
                          Unpublish
                        </button>
                      </div>
                    </div>

                    {!selectedPage ? (
                      <div className="mt-6 rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                        Select a managed page to start editing.
                      </div>
                    ) : selectedPageSlug === "about" && aboutPage ? (
                      <AboutEditor page={aboutPage} onChange={setAboutPage} />
                    ) : contactPage ? (
                      <ContactEditor page={contactPage} onChange={setContactPage} />
                    ) : null}
                  </div>
                </div>
              </section>
            )}

            {activeTab === "blogs" && (
              <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <PanelTitle
                      title="Blog Queue"
                      description="Filter, open, and manage draft or live blog posts."
                    />
                    <div className="mt-4 space-y-3">
                      <TextField
                        label="Search"
                        value={blogSearch}
                        onChange={setBlogSearch}
                        placeholder="title, excerpt, category..."
                      />
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                        <SelectField
                          label="Status"
                          value={blogStatusFilter}
                          onChange={(value) =>
                            setBlogStatusFilter(value as "all" | "published" | "draft")
                          }
                          options={[
                            { value: "all", label: "All posts" },
                            { value: "published", label: "Published only" },
                            { value: "draft", label: "Drafts only" },
                          ]}
                        />
                        <button
                          type="button"
                          onClick={() => void loadBlogs()}
                          className="app-btn-base mt-auto bg-slate-900 text-white hover:bg-slate-800"
                        >
                          Apply Filters
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={startNewBlog}
                        className="app-btn-base bg-blue-600 text-white hover:bg-blue-700"
                      >
                        <Plus className="h-4 w-4" />
                        New Draft
                      </button>
                      <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
                        {blogTotal} post{blogTotal === 1 ? "" : "s"} in current view
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {blogs.length === 0 ? (
                      <EmptyCard message="No blog posts matched the current filter set." />
                    ) : (
                      blogs.map((item) => (
                        <button
                          key={item.slug}
                          type="button"
                          onClick={() => void loadBlogDetail(item.slug)}
                          className={`w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition ${
                            selectedBlogSlug === item.slug
                              ? "border-sky-300 ring-2 ring-sky-100"
                              : "border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${publicationBadgeClass(item.is_published)}`}
                            >
                              {item.is_published ? "Published" : "Draft"}
                            </span>
                            <span className="text-xs font-medium text-slate-500">
                              {item.category}
                            </span>
                          </div>
                          <p className="mt-3 font-semibold text-slate-900">{item.title}</p>
                          <p className="mt-2 line-clamp-3 text-sm text-slate-600">
                            {item.excerpt}
                          </p>
                          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span>{item.reading_minutes} min read</span>
                            <span>Live: {formatDateTime(item.live_published_at)}</span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold text-slate-900">
                        {blogEditorMode === "new" ? "New Blog Draft" : "Blog Editor"}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Prepare the draft, then publish when the live version is ready.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void saveBlogDraft()}
                        disabled={blogBusy}
                        className="app-btn-base bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        <Save className="h-4 w-4" />
                        Save Draft
                      </button>
                      <button
                        type="button"
                        onClick={() => void publishBlog()}
                        disabled={blogBusy || blogEditorMode === "new"}
                        className="app-btn-base bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <Send className="h-4 w-4" />
                        Publish
                      </button>
                      <button
                        type="button"
                        onClick={() => void unpublishBlog()}
                        disabled={blogBusy || !selectedBlog?.is_published}
                        className="app-btn-ghost"
                      >
                        <EyeOff className="h-4 w-4" />
                        Unpublish
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteBlog()}
                        disabled={blogBusy || blogEditorMode === "new"}
                        className="app-btn-ghost"
                      >
                        Delete Draft
                      </button>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 lg:grid-cols-2">
                    <TextField
                      label="Slug"
                      value={blogForm.slug}
                      onChange={(value) => setBlogForm((current) => ({ ...current, slug: value }))}
                      placeholder="room-service-workflows"
                    />
                    <TextField
                      label="Category"
                      value={blogForm.category}
                      onChange={(value) =>
                        setBlogForm((current) => ({ ...current, category: value }))
                      }
                      placeholder="Operations"
                    />
                    <div className="lg:col-span-2">
                      <TextField
                        label="Title"
                        value={blogForm.title}
                        onChange={(value) =>
                          setBlogForm((current) => ({ ...current, title: value }))
                        }
                        placeholder="Write a clear article title"
                      />
                    </div>
                    <div className="lg:col-span-2">
                      <TextAreaField
                        label="Excerpt"
                        rows={4}
                        value={blogForm.excerpt}
                        onChange={(value) =>
                          setBlogForm((current) => ({ ...current, excerpt: value }))
                        }
                        placeholder="Short summary used in blog cards and previews"
                      />
                    </div>
                    <TextField
                      label="Cover Image URL"
                      value={blogForm.cover_image_url ?? ""}
                      onChange={(value) =>
                        setBlogForm((current) => ({ ...current, cover_image_url: value }))
                      }
                      placeholder="https://..."
                    />
                    <TextField
                      label="Reading Minutes"
                      type="number"
                      value={String(blogForm.reading_minutes)}
                      onChange={(value) =>
                        setBlogForm((current) => ({
                          ...current,
                          reading_minutes: Math.max(1, Number(value || "1")),
                        }))
                      }
                      placeholder="4"
                    />
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Scheduled Publish Time
                      </label>
                      <input
                        type="datetime-local"
                        value={toDateTimeInputValue(blogForm.scheduled_publish_at ?? null)}
                        onChange={(event) =>
                          setBlogForm((current) => ({
                            ...current,
                            scheduled_publish_at: fromDateTimeInputValue(event.target.value),
                          }))
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                      />
                    </div>
                    <label className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={blogForm.is_featured}
                        onChange={(event) =>
                          setBlogForm((current) => ({
                            ...current,
                            is_featured: event.target.checked,
                          }))
                        }
                      />
                      Feature this article on the public blog page
                    </label>
                    <div className="lg:col-span-2">
                      <TextAreaField
                        label="Tags"
                        rows={3}
                        value={joinLines(blogForm.tags)}
                        onChange={(value) =>
                          setBlogForm((current) => ({
                            ...current,
                            tags: splitLines(value),
                          }))
                        }
                        placeholder="One tag per line"
                      />
                    </div>
                    <div className="lg:col-span-2">
                      <TextAreaField
                        label="Body Paragraphs"
                        rows={9}
                        value={joinLines(blogForm.body)}
                        onChange={(value) =>
                          setBlogForm((current) => ({
                            ...current,
                            body: splitLines(value),
                          }))
                        }
                        placeholder="One paragraph per line"
                      />
                    </div>
                    <div className="lg:col-span-2">
                      <TextAreaField
                        label="Key Takeaways"
                        rows={4}
                        value={joinLines(blogForm.key_takeaways)}
                        onChange={(value) =>
                          setBlogForm((current) => ({
                            ...current,
                            key_takeaways: splitLines(value),
                          }))
                        }
                        placeholder="One takeaway per line"
                      />
                    </div>
                  </div>

                  {selectedBlog && (
                    <div className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
                      <InfoCard label="Status" value={selectedBlog.is_published ? "Live" : "Draft"} />
                      <InfoCard label="Live Published" value={formatDateTime(selectedBlog.live_published_at)} />
                      <InfoCard label="Last Edited" value={formatDateTime(selectedBlog.updated_at)} />
                    </div>
                  )}
                </div>
              </section>
            )}

            {activeTab === "leads" && (
              <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <PanelTitle
                      title="Lead Filters"
                      description="Track new inquiries, assign owners, and export the visible queue."
                    />
                    <div className="mt-4 space-y-3">
                      <TextField
                        label="Search"
                        value={leadSearch}
                        onChange={setLeadSearch}
                        placeholder="name, email, company..."
                      />
                      <SelectField
                        label="Status"
                        value={leadStatusFilter}
                        onChange={setLeadStatusFilter}
                        options={[
                          { value: "", label: "All statuses" },
                          { value: "new", label: "New" },
                          { value: "reviewed", label: "Reviewed" },
                          { value: "qualified", label: "Qualified" },
                          { value: "closed", label: "Closed" },
                        ]}
                      />
                      <SelectField
                        label="Owner"
                        value={leadAssigneeFilter}
                        onChange={setLeadAssigneeFilter}
                        options={[
                          { value: "", label: "All owners" },
                          { value: "0", label: "Unassigned only" },
                          ...assignees.map((item) => ({
                            value: String(item.user_id),
                            label: item.full_name,
                          })),
                        ]}
                      />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void loadLeads()}
                        className="app-btn-base bg-slate-900 text-white hover:bg-slate-800"
                      >
                        Apply Filters
                      </button>
                      <button
                        type="button"
                        onClick={() => void exportLeads()}
                        disabled={leadExporting}
                        className="app-btn-ghost"
                      >
                        <Download className="h-4 w-4" />
                        {leadExporting ? "Exporting..." : "Export CSV"}
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <MetricCard label="Queue Size" value={leadTotal} hint="Visible leads in the inbox" />
                    <MetricCard label="Unassigned" value={leadSummary.unassigned_count} hint="Needs an owner" />
                    <MetricCard label="Reviewed" value={leadSummary.reviewed_count} hint="Touched by an admin" />
                    <MetricCard label="Closed" value={leadSummary.closed_count} hint="Marked as complete" />
                  </div>

                  <div className="space-y-3">
                    {leads.length === 0 ? (
                      <EmptyCard message="No leads matched the current filter set." />
                    ) : (
                      leads.map((lead) => (
                        <button
                          key={lead.id}
                          type="button"
                          onClick={() => setSelectedLeadId(lead.id)}
                          className={`w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition ${
                            selectedLeadId === lead.id
                              ? "border-sky-300 ring-2 ring-sky-100"
                              : "border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${leadStatusBadgeClass(lead.status)}`}
                            >
                              {leadStatusLabel(lead.status)}
                            </span>
                            <span className="text-xs text-slate-500">
                              {formatDateTime(lead.created_at)}
                            </span>
                          </div>
                          <p className="mt-3 font-semibold text-slate-900">{lead.full_name}</p>
                          <p className="mt-1 text-sm text-slate-600">{lead.email}</p>
                          <p className="mt-2 line-clamp-3 text-sm text-slate-600">{lead.message}</p>
                          <p className="mt-3 text-xs text-slate-500">
                            Owner: {lead.assigned_to?.full_name ?? "Unassigned"}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold text-slate-900">Lead Detail</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Capture internal notes, move the lead through the funnel, and assign ownership.
                      </p>
                    </div>
                    {selectedLead && (
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${leadStatusBadgeClass(selectedLead.status)}`}
                      >
                        {leadStatusLabel(selectedLead.status)}
                      </span>
                    )}
                  </div>

                  {!selectedLead ? (
                    <div className="mt-6 rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                      Select a lead from the queue to review details.
                    </div>
                  ) : (
                    <div className="mt-6 space-y-6">
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        <InfoCard label="Full Name" value={selectedLead.full_name} />
                        <InfoCard label="Email" value={selectedLead.email} />
                        <InfoCard label="Phone" value={selectedLead.phone ?? "-"} />
                        <InfoCard label="Company" value={selectedLead.company_name ?? "-"} />
                        <InfoCard label="Property Type" value={selectedLead.property_type ?? "-"} />
                        <InfoCard label="Source Page" value={selectedLead.source_page ?? "-"} />
                        <InfoCard label="Source Path" value={selectedLead.source_path ?? "-"} />
                        <InfoCard label="Entry Point" value={selectedLead.entry_point ?? "-"} />
                        <InfoCard label="Role Intent" value={selectedLead.login_intent ?? "-"} />
                        <InfoCard label="UTM Source" value={selectedLead.utm_source ?? "-"} />
                        <InfoCard label="UTM Campaign" value={selectedLead.utm_campaign ?? "-"} />
                        <InfoCard label="Referrer" value={selectedLead.referrer_url ?? "-"} />
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Inquiry Message
                        </p>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                          {selectedLead.message}
                        </p>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <SelectField
                          label="Status"
                          value={leadDraft.status}
                          onChange={(value) =>
                            setLeadDraft((current) => ({
                              ...current,
                              status: value as ContactLeadStatus,
                            }))
                          }
                          options={[
                            { value: "new", label: "New" },
                            { value: "reviewed", label: "Reviewed" },
                            { value: "qualified", label: "Qualified" },
                            { value: "closed", label: "Closed" },
                          ]}
                        />
                        <SelectField
                          label="Assigned Owner"
                          value={leadDraft.assigned_to_user_id}
                          onChange={(value) =>
                            setLeadDraft((current) => ({
                              ...current,
                              assigned_to_user_id: value,
                            }))
                          }
                          options={[
                            { value: "", label: "Unassigned" },
                            ...assignees.map((item) => ({
                              value: String(item.user_id),
                              label: item.full_name,
                            })),
                          ]}
                        />
                        <div className="lg:col-span-2">
                          <TextAreaField
                            label="Internal Notes"
                            rows={8}
                            value={leadDraft.internal_notes}
                            onChange={(value) =>
                              setLeadDraft((current) => ({
                                ...current,
                                internal_notes: value,
                              }))
                            }
                            placeholder="Add follow-up notes, rollout readiness details, or next actions..."
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void saveLeadUpdate()}
                          disabled={leadBusy}
                          className="app-btn-base bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          <Save className="h-4 w-4" />
                          {leadBusy ? "Saving..." : "Save Lead Update"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </SuperAdminLayout>
  );
}

function AboutEditor({
  page,
  onChange,
}: {
  page: ManagedAboutPageDetail;
  onChange: (value: ManagedAboutPageDetail) => void;
}) {
  const payload = page.payload;

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <TextField
          label="Page Title"
          value={page.title}
          onChange={(value) => onChange({ ...page, title: value })}
          placeholder="About R.LUMINUOUS"
        />
        <TextField
          label="Page Summary"
          value={page.summary ?? ""}
          onChange={(value) => onChange({ ...page, summary: value })}
          placeholder="Short CMS summary"
        />
        <TextField
          label="Hero Eyebrow"
          value={payload.hero_eyebrow}
          onChange={(value) =>
            onChange({ ...page, payload: { ...payload, hero_eyebrow: value } })
          }
          placeholder="About the Platform"
        />
        <TextField
          label="Hero Title"
          value={payload.hero_title}
          onChange={(value) =>
            onChange({ ...page, payload: { ...payload, hero_title: value } })
          }
          placeholder="Built for hospitality teams..."
        />
      </div>

      <TextAreaField
        label="Hero Description"
        rows={4}
        value={payload.hero_description}
        onChange={(value) =>
          onChange({ ...page, payload: { ...payload, hero_description: value } })
        }
        placeholder="Explain the platform story"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <TextField
          label="Overview Title"
          value={payload.overview_title}
          onChange={(value) =>
            onChange({ ...page, payload: { ...payload, overview_title: value } })
          }
          placeholder="Why we built it"
        />
      </div>

      <TextAreaField
        label="Overview Paragraphs"
        rows={6}
        value={joinLines(payload.overview_paragraphs)}
        onChange={(value) =>
          onChange({
            ...page,
            payload: { ...payload, overview_paragraphs: splitLines(value) },
          })
        }
        placeholder="One paragraph per line"
      />

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-900">Values</p>
          <button
            type="button"
            onClick={() =>
              onChange({
                ...page,
                payload: {
                  ...payload,
                  values: [...payload.values, { title: "", description: "" }],
                },
              })
            }
            className="app-btn-ghost"
          >
            <Plus className="h-4 w-4" />
            Add Value
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {payload.values.map((valueItem, index) => (
            <div key={`value-${index}`} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)_auto]">
                <TextField
                  label="Title"
                  value={valueItem.title}
                  onChange={(value) =>
                    onChange({
                      ...page,
                      payload: {
                        ...payload,
                        values: payload.values.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, title: value } : item,
                        ),
                      },
                    })
                  }
                  placeholder="Operational clarity"
                />
                <TextAreaField
                  label="Description"
                  rows={3}
                  value={valueItem.description}
                  onChange={(value) =>
                    onChange({
                      ...page,
                      payload: {
                        ...payload,
                        values: payload.values.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, description: value } : item,
                        ),
                      },
                    })
                  }
                  placeholder="Explain the value"
                />
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...page,
                      payload: {
                        ...payload,
                        values: payload.values.filter((_, itemIndex) => itemIndex !== index),
                      },
                    })
                  }
                  className="app-btn-ghost mt-auto"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <TextAreaField
        label="Milestones"
        rows={5}
        value={joinLines(payload.milestones)}
        onChange={(value) =>
          onChange({ ...page, payload: { ...payload, milestones: splitLines(value) } })
        }
        placeholder="One milestone per line"
      />

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-900">Capabilities</p>
          <button
            type="button"
            onClick={() =>
              onChange({
                ...page,
                payload: {
                  ...payload,
                  capabilities: [...payload.capabilities, { title: "", details: "" }],
                },
              })
            }
            className="app-btn-ghost"
          >
            <Plus className="h-4 w-4" />
            Add Capability
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {payload.capabilities.map((capability, index) => (
            <div
              key={`capability-${index}`}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)_auto]">
                <TextField
                  label="Title"
                  value={capability.title}
                  onChange={(value) =>
                    onChange({
                      ...page,
                      payload: {
                        ...payload,
                        capabilities: payload.capabilities.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, title: value } : item,
                        ),
                      },
                    })
                  }
                  placeholder="Unified guest journey"
                />
                <TextAreaField
                  label="Details"
                  rows={3}
                  value={capability.details}
                  onChange={(value) =>
                    onChange({
                      ...page,
                      payload: {
                        ...payload,
                        capabilities: payload.capabilities.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, details: value } : item,
                        ),
                      },
                    })
                  }
                  placeholder="Explain this capability"
                />
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...page,
                      payload: {
                        ...payload,
                        capabilities: payload.capabilities.filter(
                          (_, itemIndex) => itemIndex !== index,
                        ),
                      },
                    })
                  }
                  className="app-btn-ghost mt-auto"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-900">Call to Action</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <TextField
            label="CTA Title"
            value={payload.cta.title}
            onChange={(value) =>
              onChange({
                ...page,
                payload: { ...payload, cta: { ...payload.cta, title: value } },
              })
            }
            placeholder="See how the workflow fits your property"
          />
          <TextField
            label="CTA Action Label"
            value={payload.cta.action_label}
            onChange={(value) =>
              onChange({
                ...page,
                payload: { ...payload, cta: { ...payload.cta, action_label: value } },
              })
            }
            placeholder="Talk to Sales"
          />
          <div className="lg:col-span-2">
            <TextAreaField
              label="CTA Message"
              rows={3}
              value={payload.cta.message}
              onChange={(value) =>
                onChange({
                  ...page,
                  payload: { ...payload, cta: { ...payload.cta, message: value } },
                })
              }
              placeholder="Short CTA support text"
            />
          </div>
          <TextField
            label="CTA Destination"
            value={payload.cta.action_to}
            onChange={(value) =>
              onChange({
                ...page,
                payload: { ...payload, cta: { ...payload.cta, action_to: value } },
              })
            }
            placeholder="/contact"
          />
        </div>
      </div>
    </div>
  );
}

function ContactEditor({
  page,
  onChange,
}: {
  page: ManagedContactPageDetail;
  onChange: (value: ManagedContactPageDetail) => void;
}) {
  const payload = page.payload;

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <TextField
          label="Page Title"
          value={page.title}
          onChange={(value) => onChange({ ...page, title: value })}
          placeholder="Contact R.LUMINUOUS"
        />
        <TextField
          label="Page Summary"
          value={page.summary ?? ""}
          onChange={(value) => onChange({ ...page, summary: value })}
          placeholder="Short CMS summary"
        />
        <TextField
          label="Hero Eyebrow"
          value={payload.hero_eyebrow}
          onChange={(value) =>
            onChange({ ...page, payload: { ...payload, hero_eyebrow: value } })
          }
          placeholder="Talk With Our Team"
        />
        <TextField
          label="Hero Title"
          value={payload.hero_title}
          onChange={(value) =>
            onChange({ ...page, payload: { ...payload, hero_title: value } })
          }
          placeholder="Plan your rollout..."
        />
      </div>

      <TextAreaField
        label="Hero Description"
        rows={4}
        value={payload.hero_description}
        onChange={(value) =>
          onChange({ ...page, payload: { ...payload, hero_description: value } })
        }
        placeholder="Explain how your team helps"
      />

      <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PanelTitle
            title="Contact Channels"
            description="Show the key ways prospects can reach your team."
          />
          <button
            type="button"
            onClick={() =>
              onChange({
                ...page,
                payload: {
                  ...payload,
                  channels: [
                    ...payload.channels,
                    { label: "", value: "", detail: "" },
                  ],
                },
              })
            }
            className="app-btn-ghost"
          >
            <Plus className="h-4 w-4" />
            Add Channel
          </button>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          {payload.channels.map((channel, index) => (
            <div
              key={`channel-${index}`}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">Channel {index + 1}</p>
                {payload.channels.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        ...page,
                        payload: {
                          ...payload,
                          channels: payload.channels.filter((_, itemIndex) => itemIndex !== index),
                        },
                      })
                    }
                    className="text-xs font-semibold text-red-600 hover:text-red-700"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="mt-4 space-y-4">
                <TextField
                  label="Label"
                  value={channel.label}
                  onChange={(value) =>
                    onChange({
                      ...page,
                      payload: {
                        ...payload,
                        channels: payload.channels.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, label: value } : item,
                        ),
                      },
                    })
                  }
                  placeholder="Email"
                />
                <TextField
                  label="Value"
                  value={channel.value}
                  onChange={(value) =>
                    onChange({
                      ...page,
                      payload: {
                        ...payload,
                        channels: payload.channels.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, value } : item,
                        ),
                      },
                    })
                  }
                  placeholder="info@rluminuous.com"
                />
                <TextAreaField
                  label="Detail"
                  rows={3}
                  value={channel.detail}
                  onChange={(value) =>
                    onChange({
                      ...page,
                      payload: {
                        ...payload,
                        channels: payload.channels.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, detail: value } : item,
                        ),
                      },
                    })
                  }
                  placeholder="When prospects should use this channel"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <TextAreaField
          label="Response Commitments"
          rows={5}
          value={joinLines(payload.response_commitments)}
          onChange={(value) =>
            onChange({
              ...page,
              payload: { ...payload, response_commitments: splitLines(value) },
            })
          }
          placeholder="One promise per line"
        />
        <TextAreaField
          label="Sidebar Planning Points"
          rows={5}
          value={joinLines(payload.sidebar_points)}
          onChange={(value) =>
            onChange({
              ...page,
              payload: { ...payload, sidebar_points: splitLines(value) },
            })
          }
          placeholder="One planning point per line"
        />
      </div>

      <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PanelTitle
            title="Frequently Asked Questions"
            description="Capture objections and rollout questions before the sales conversation."
          />
          <button
            type="button"
            onClick={() =>
              onChange({
                ...page,
                payload: {
                  ...payload,
                  faq: [...payload.faq, { question: "", answer: "" }],
                },
              })
            }
            className="app-btn-ghost"
          >
            <Plus className="h-4 w-4" />
            Add FAQ
          </button>
        </div>

        <div className="space-y-4">
          {payload.faq.map((item, index) => (
            <div
              key={`faq-${index}`}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">Question {index + 1}</p>
                {payload.faq.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        ...page,
                        payload: {
                          ...payload,
                          faq: payload.faq.filter((_, itemIndex) => itemIndex !== index),
                        },
                      })
                    }
                    className="text-xs font-semibold text-red-600 hover:text-red-700"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="mt-4 space-y-4">
                <TextField
                  label="Question"
                  value={item.question}
                  onChange={(value) =>
                    onChange({
                      ...page,
                      payload: {
                        ...payload,
                        faq: payload.faq.map((faqItem, itemIndex) =>
                          itemIndex === index ? { ...faqItem, question: value } : faqItem,
                        ),
                      },
                    })
                  }
                  placeholder="Can this work for both hotel rooms and restaurant tables?"
                />
                <TextAreaField
                  label="Answer"
                  rows={4}
                  value={item.answer}
                  onChange={(value) =>
                    onChange({
                      ...page,
                      payload: {
                        ...payload,
                        faq: payload.faq.map((faqItem, itemIndex) =>
                          itemIndex === index ? { ...faqItem, answer: value } : faqItem,
                        ),
                      },
                    })
                  }
                  placeholder="Explain the answer clearly"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TextField
          label="Success Title"
          value={payload.success_title}
          onChange={(value) =>
            onChange({ ...page, payload: { ...payload, success_title: value } })
          }
          placeholder="Thanks, your request has been received."
        />
        <TextAreaField
          label="Success Message"
          rows={3}
          value={payload.success_message}
          onChange={(value) =>
            onChange({ ...page, payload: { ...payload, success_message: value } })
          }
          placeholder="Our team will review your message and contact you shortly."
        />
      </div>
    </div>
  );
}

function TabButton({
  label,
  active,
  icon,
  onClick,
}: {
  label: string;
  active: boolean;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
        active
          ? "border-sky-300 bg-sky-50 text-sky-700"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-600">{hint}</p>
    </div>
  );
}

function PanelTitle({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <input
        aria-label={label}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <textarea
        aria-label={label}
        rows={rows ?? 4}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
      >
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

function EmptyCard({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
      {message}
    </div>
  );
}

function capitalize(value: string): string {
  if (!value) return value;
  return `${value[0].toUpperCase()}${value.slice(1)}`;
}
